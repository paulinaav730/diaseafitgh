// Supabase Edge Function (Deno): envía los recordatorios del calendario como
// notificaciones push, aunque la app esté cerrada.
//
// Se ejecuta cada 5 minutos (pg_cron, ver supabase/calendar_league.sql).
// Variables necesarias (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ej. mailto:dias@eafit.edu.co)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las inyecta Supabase automáticamente.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';
import { dueBirthdayReminders } from '../_shared/birthdays.ts';

const WHEN: Record<number, string> = { 1440: 'Es mañana', 60: 'Empieza en 1 hora', 15: 'Empieza en 15 minutos' };
// Un recordatorio se envía si su hora ya pasó hace menos de esta ventana
// (cubre retrasos del cron sin mandar avisos viejos).
const WINDOW_MS = 15 * 60_000;

function to12h(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'p. m.' : 'a. m.'}`;
}

type Client = ReturnType<typeof createClient>;

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:dias@eafit.edu.co',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );
  try {
    const events = await sendEventReminders(supabase);
    const birthdays = await sendBirthdayReminders(supabase);
    return Response.json({ events, birthdays });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});

/** Envía un push y elimina la suscripción si el navegador ya no la acepta. */
async function push(supabase: Client, table: string, s: { id: string; endpoint: string; p256dh: string; auth: string }, payload: string) {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
    return true;
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.statusCode === 410) await supabase.from(table).delete().eq('id', s.id);
    else console.error('push error', err?.statusCode, err?.body);
    return false;
  }
}

/**
 * Cumpleaños: 7 días antes, 1 día antes y el mismo día, a las 12:00 p. m. de
 * Colombia (America/Bogota). Llegan a todas las cuentas de administración que
 * activaron las notificaciones. No se crean eventos: se calculan con la fecha
 * de nacimiento guardada en el perfil (privado).
 */
async function sendBirthdayReminders(supabase: Client) {
  const { data: rows, error } = await supabase
    .from('person_profiles')
    .select('person_id, birth_date, people!inner(name, primary_type, gt_sub_team, gt_teams)')
    .not('birth_date', 'is', null);
  if (error) throw error;
  const people = (rows ?? []).map((r: any) => ({
    personId: r.person_id,
    name: r.people.name,
    gt: r.people.primary_type === 'MESA' ? null : r.people.gt_sub_team || r.people.gt_teams?.[0] || null,
    birthDate: r.birth_date,
  }));
  const due = dueBirthdayReminders(people, new Date());
  if (!due.length) return { sent: 0 };

  const { data: subs } = await supabase.from('admin_push_subscriptions').select('id, admin_id, endpoint, p256dh, auth');
  if (!subs?.length) return { sent: 0, reminders: due.length, note: 'Ninguna administradora activó las notificaciones' };

  const keys = due.flatMap((d) => subs.map((s) => `${d.key}__${s.admin_id}`));
  const { data: already } = await supabase.from('reminder_deliveries').select('id').in('id', keys);
  const sentKeys = new Set((already ?? []).map((r) => r.id));

  let sent = 0;
  for (const d of due) {
    const payload = JSON.stringify({ title: d.title, body: d.body, tag: d.key, url: '/' });
    for (const adminId of new Set(subs.map((s) => s.admin_id))) {
      const key = `${d.key}__${adminId}`;
      if (sentKeys.has(key)) continue;
      for (const s of subs.filter((x) => x.admin_id === adminId)) if (await push(supabase, 'admin_push_subscriptions', s, payload)) sent++;
      await supabase.from('reminder_deliveries').upsert({ id: key });
    }
  }
  return { sent, reminders: due.length };
}

async function sendEventReminders(supabase: Client) {
  const now = Date.now();
  // Eventos activos que empiezan en las próximas ~24 h
  const { data: events, error } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, location, starts_at')
    .eq('status', 'activo')
    .gt('starts_at', new Date(now).toISOString())
    .lte('starts_at', new Date(now + 1440 * 60_000 + WINDOW_MS).toISOString());
  if (error) throw error;
  if (!events?.length) return { sent: 0 };

  const { data: prefs } = await supabase
    .from('calendar_reminders')
    .select('event_id, person_id, offsets')
    .eq('enabled', true)
    .in('event_id', events.map((e) => e.id));

  const due: { key: string; ev: (typeof events)[number]; personId: string; offset: number }[] = [];
  for (const p of prefs ?? []) {
    const ev = events.find((e) => e.id === p.event_id)!;
    const start = new Date(ev.starts_at).getTime();
    for (const offset of p.offsets as number[]) {
      const fireAt = start - offset * 60_000;
      if (now >= fireAt && now < fireAt + WINDOW_MS) {
        due.push({ key: `${ev.id}__${p.person_id}__${offset}`, ev, personId: p.person_id, offset });
      }
    }
  }
  if (!due.length) return { sent: 0 };

  const { data: already } = await supabase.from('reminder_deliveries').select('id').in('id', due.map((d) => d.key));
  const sentKeys = new Set((already ?? []).map((r) => r.id));
  const pending = due.filter((d) => !sentKeys.has(d.key));

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, person_id, endpoint, p256dh, auth')
    .in('person_id', [...new Set(pending.map((d) => d.personId))]);

  let sent = 0;
  for (const d of pending) {
    const payload = JSON.stringify({
      title: d.ev.title,
      body: `${WHEN[d.offset] ?? 'Empieza pronto'} · ${to12h(d.ev.start_time)}${d.ev.location ? ` · ${d.ev.location}` : ''}`,
      tag: `${d.ev.id}__${d.offset}`,
      url: '/',
    });
    for (const s of (subs ?? []).filter((x) => x.person_id === d.personId)) {
      if (await push(supabase, 'push_subscriptions', s, payload)) sent++;
    }
    await supabase.from('reminder_deliveries').upsert({ id: d.key });
  }
  return { sent, reminders: pending.length };
}
