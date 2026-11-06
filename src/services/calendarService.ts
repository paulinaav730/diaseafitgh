import {
  BUILTIN_EVENT_TYPES,
  BUILTIN_EVENT_TYPE_LABELS,
  BuiltinEventType,
  CalendarAudience,
  CalendarEvent,
  CustomEventType,
  EventReminderPreference,
  Person,
  ReminderOffset,
  REMINDER_OFFSETS,
  getEffectivePersonType,
} from '../types';
import { createSyncedCollection, newId } from './syncedCollection';
import { getSupabase } from './supabaseClient';
import { getSessionToken, getCurrentSession } from './session';

/** DÍAS EAFIT opera en Medellín: todas las fechas/horas del calendario son hora de Colombia (UTC-5, sin horario de verano). */
export const EVENT_TZ_OFFSET = '-05:00';

/** Lee una función privada con la sesión actual; null si no hay sesión o falla. */
export async function privateRead(fn: string, args: Record<string, unknown> = {}, role?: 'admin' | 'staff'): Promise<any[] | null> {
  const token = getSessionToken();
  const s = getCurrentSession();
  if (!token || (role && s?.role !== role)) return [];
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.rpc(fn, { p_session: token, ...args });
  if (error) {
    console.warn(`${fn}:`, error.message);
    return null;
  }
  return (data as any[]) || [];
}

// ----------------------------------------------------------------------------
// Conversión desde la base de datos
// ----------------------------------------------------------------------------

export function eventFromRow(r: any): CalendarEvent {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? undefined,
    date: r.event_date,
    startTime: (r.start_time || '').slice(0, 5),
    endTime: (r.end_time || '').slice(0, 5),
    location: r.location ?? undefined,
    type: normalizeEventType(r.type),
    trainingMode: r.type === 'capacitacion' ? r.training_mode ?? 'invitacion' : undefined,
    audience: normalizeAudience(r.audience),
    status: r.status,
    scoring: r.scoring ?? undefined,
    attendanceEnabled: !!r.attendance_enabled,
    checkinOpensMinutes: r.checkin_opens_minutes ?? 30,
    lateAfterMinutes: r.late_after_minutes ?? 15,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function reminderFromRow(r: any): EventReminderPreference {
  return {
    id: r.id,
    eventId: r.event_id,
    personId: r.person_id,
    enabled: !!r.enabled,
    offsets: (r.offsets || []).filter((o: number) => (REMINDER_OFFSETS as readonly number[]).includes(o)),
    updatedAt: r.updated_at,
  };
}

// ----------------------------------------------------------------------------
// Colecciones
// ----------------------------------------------------------------------------

export const calendarEvents = createSyncedCollection<CalendarEvent>({
  storageKey: 'dias_eafit_calendar_events',
  table: 'calendar_events',
  fromRow: eventFromRow,
});

export const customEventTypes = createSyncedCollection<CustomEventType>({
  storageKey: 'dias_eafit_event_types',
  table: 'calendar_event_types',
  fromRow: (r) => ({ id: r.id, name: r.name, color: r.color, createdBy: r.created_by ?? undefined, createdAt: r.created_at }),
});

/** Preferencias de recordatorio: privadas, cada integrante solo ve las suyas. */
export const reminderPreferences = createSyncedCollection<EventReminderPreference>({
  storageKey: 'dias_eafit_event_reminders',
  table: 'calendar_reminders',
  fromRow: reminderFromRow,
  loader: () => privateRead('my_reminders', {}, 'staff'),
});

// ----------------------------------------------------------------------------
// Tipos de evento
// ----------------------------------------------------------------------------

const LEGACY_TYPES: Record<string, BuiltinEventType> = {
  semana_dias: 'otro',
  reunion_gt: 'otro',
  reunion_general: 'otro',
  institucional: 'otro',
};

/** Tipos anteriores se muestran como "Otras actividades"; los personalizados se respetan. */
export function normalizeEventType(t: string): string {
  return LEGACY_TYPES[t] ?? t ?? 'otro';
}

export function isBuiltinType(t: string): t is BuiltinEventType {
  return (BUILTIN_EVENT_TYPES as readonly string[]).includes(t);
}

export function eventTypeName(t: string, custom: CustomEventType[] = customEventTypes.getAll()): string {
  if (isBuiltinType(t)) return BUILTIN_EVENT_TYPE_LABELS[t];
  return custom.find((c) => c.id === t)?.name ?? 'Otras actividades';
}

// ----------------------------------------------------------------------------
// Destinatarios y personas
// ----------------------------------------------------------------------------

export const EMPTY_AUDIENCE: CalendarAudience = {
  all: true,
  gtTeams: [],
  includeGap: false,
  includeMesa: false,
  personIds: [],
};

export function normalizeAudience(a: Partial<CalendarAudience> | null | undefined): CalendarAudience {
  return {
    all: !!a?.all,
    gtTeams: a?.gtTeams ?? [],
    includeGap: !!a?.includeGap,
    includeMesa: !!a?.includeMesa,
    personIds: a?.personIds ?? [],
  };
}

/** GT principal de una persona (o undefined si no pertenece a un GT). */
export function personPrimaryGt(p: Person): string | undefined {
  if (getEffectivePersonType(p) !== 'GT') return undefined;
  return p.gtSubTeam || p.gtTeams?.[0];
}

/** Todos los GT en los que participa una persona. */
export function personGts(p: Person): string[] {
  const set = new Set<string>();
  if (p.gtSubTeam) set.add(p.gtSubTeam);
  (p.gtTeams || []).forEach((t) => set.add(t));
  return [...set];
}

export function isPersonInAudience(p: Person, a: CalendarAudience): boolean {
  if (a.all) return true;
  if (a.personIds.includes(p.id)) return true;
  if (a.gtTeams.length > 0 && personGts(p).some((g) => a.gtTeams.includes(g))) return true;
  if (a.includeGap && (p.primaryType === 'GAP' || p.alsoActsAsGap)) return true;
  if (a.includeMesa && p.primaryType === 'MESA') return true;
  return false;
}

export function audienceLabel(a: CalendarAudience, people: Person[] = []): string {
  if (a.all) return 'Todos los integrantes';
  const parts: string[] = [];
  if (a.gtTeams.length) parts.push(a.gtTeams.length === 1 ? `GT ${a.gtTeams[0]}` : `GT: ${a.gtTeams.join(', ')}`);
  if (a.includeGap) parts.push('GAP');
  if (a.includeMesa) parts.push('MESA');
  if (a.personIds.length) {
    const names = a.personIds.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean) as string[];
    parts.push(
      names.length && names.length <= 3 ? names.join(', ') : `${a.personIds.length} persona${a.personIds.length === 1 ? '' : 's'}`
    );
  }
  return parts.join(' · ') || 'Sin destinatarios';
}

// ----------------------------------------------------------------------------
// Fechas
// ----------------------------------------------------------------------------

export function eventStart(e: Pick<CalendarEvent, 'date' | 'startTime'>): Date {
  return new Date(`${e.date}T${e.startTime || '00:00'}:00${EVENT_TZ_OFFSET}`);
}

export function eventEnd(e: Pick<CalendarEvent, 'date' | 'endTime' | 'startTime'>): Date {
  return new Date(`${e.date}T${e.endTime || e.startTime || '23:59'}:00${EVENT_TZ_OFFSET}`);
}

/** Fecha de hoy (YYYY-MM-DD) en hora de Colombia. */
export function todayIso(now: Date = new Date()): string {
  const bogota = new Date(now.getTime() - 5 * 3600 * 1000);
  return bogota.toISOString().slice(0, 10);
}

export function formatTime12(t: string): string {
  if (!t) return '';
  const [hStr, m] = t.split(':');
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

/** Hora (12 h, Colombia) de una marca de tiempo ISO */
export function formatClock(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
}

export function formatDateLong(iso: string): string {
  const d = new Date(`${iso}T12:00:00${EVENT_TZ_OFFSET}`);
  return d.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  });
}

/** ¿Se puede registrar asistencia por QR ahora? */
export function checkinWindow(e: CalendarEvent, now: Date = new Date()): 'antes' | 'abierta' | 'terminada' {
  const opens = eventStart(e).getTime() - (e.checkinOpensMinutes ?? 30) * 60_000;
  if (now.getTime() < opens) return 'antes';
  if (now.getTime() > eventEnd(e).getTime()) return 'terminada';
  return 'abierta';
}

// ----------------------------------------------------------------------------
// Implementación local (demo / sin Supabase). En producción lo hace el servidor.
// ----------------------------------------------------------------------------

export function localSaveCalendarEvent(
  data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  author: string
): CalendarEvent {
  const now = new Date().toISOString();
  const existing = data.id ? calendarEvents.get(data.id) : undefined;
  const ev: CalendarEvent = {
    ...data,
    id: existing?.id ?? newId('evt'),
    createdBy: existing?.createdBy ?? author,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  calendarEvents.upsert(ev);
  return ev;
}

export function reminderId(eventId: string, personId: string) {
  return `${eventId}__${personId}`;
}

export function localSaveReminder(eventId: string, personId: string, enabled: boolean, offsets: ReminderOffset[]): EventReminderPreference {
  const pref: EventReminderPreference = {
    id: reminderId(eventId, personId),
    eventId,
    personId,
    enabled,
    offsets: [...new Set(offsets)].sort((a, b) => b - a) as ReminderOffset[],
    updatedAt: new Date().toISOString(),
  };
  reminderPreferences.upsert(pref);
  return pref;
}

/**
 * Recordatorios que ya deberían haberse enviado (para el aviso en primer plano).
 * Devuelve una clave única por (evento, persona, anticipación).
 */
export function dueReminders(
  events: CalendarEvent[],
  prefs: EventReminderPreference[],
  personId: string,
  now: Date = new Date(),
  windowMinutes = 10
): { key: string; event: CalendarEvent; offset: ReminderOffset }[] {
  const out: { key: string; event: CalendarEvent; offset: ReminderOffset }[] = [];
  prefs
    .filter((p) => p.personId === personId && p.enabled)
    .forEach((p) => {
      const ev = events.find((e) => e.id === p.eventId);
      if (!ev || ev.status !== 'activo') return;
      const start = eventStart(ev).getTime();
      p.offsets.forEach((offset) => {
        const fireAt = start - offset * 60_000;
        const t = now.getTime();
        if (t >= fireAt && t < fireAt + windowMinutes * 60_000 && t < start) {
          out.push({ key: `${ev.id}__${personId}__${offset}`, event: ev, offset });
        }
      });
    });
  return out;
}
