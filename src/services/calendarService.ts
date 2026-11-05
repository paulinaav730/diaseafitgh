import {
  CalendarAudience,
  CalendarEvent,
  CALENDAR_EVENT_TYPES,
  EventReminderPreference,
  Person,
  ReminderOffset,
  REMINDER_OFFSETS,
  getEffectivePersonType,
} from '../types';
import { createSyncedCollection, newId } from './syncedCollection';

/** DÍAS EAFIT opera en Medellín: todas las fechas/horas del calendario son hora de Colombia (UTC-5, sin horario de verano). */
export const EVENT_TZ_OFFSET = '-05:00';

// ----------------------------------------------------------------------------
// Colecciones
// ----------------------------------------------------------------------------

export const calendarEvents = createSyncedCollection<CalendarEvent>({
  storageKey: 'dias_eafit_calendar_events',
  table: 'calendar_events',
  toRow: (e) => ({
    id: e.id,
    title: e.title,
    description: e.description ?? null,
    event_date: e.date,
    start_time: e.startTime,
    end_time: e.endTime,
    location: e.location ?? null,
    type: e.type,
    training_mode: e.type === 'capacitacion' ? e.trainingMode ?? 'invitacion' : null,
    audience: e.audience,
    status: e.status,
    scoring: e.scoring ?? null,
    starts_at: eventStart(e).toISOString(),
    created_by: e.createdBy ?? null,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  }),
  fromRow: (r) => ({
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
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }),
});

export const reminderPreferences = createSyncedCollection<EventReminderPreference>({
  storageKey: 'dias_eafit_event_reminders',
  table: 'calendar_reminders',
  toRow: (p) => ({
    id: p.id,
    event_id: p.eventId,
    person_id: p.personId,
    enabled: p.enabled,
    offsets: p.offsets,
    updated_at: p.updatedAt,
  }),
  fromRow: (r) => ({
    id: r.id,
    eventId: r.event_id,
    personId: r.person_id,
    enabled: !!r.enabled,
    offsets: (r.offsets || []).filter((o: number) => (REMINDER_OFFSETS as readonly number[]).includes(o)),
    updatedAt: r.updated_at,
  }),
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

export const EMPTY_AUDIENCE: CalendarAudience = {
  all: true,
  gtTeams: [],
  includeGap: false,
  includeMesa: false,
  personIds: [],
};

/** Tipos anteriores (reuniones, institucional) se muestran como "Otro". */
export function normalizeEventType(t: string): CalendarEvent['type'] {
  return (CALENDAR_EVENT_TYPES as string[]).includes(t) ? (t as CalendarEvent['type']) : 'otro';
}

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
    const names = a.personIds
      .map((id) => people.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[];
    parts.push(
      names.length && names.length <= 3
        ? names.join(', ')
        : `${a.personIds.length} persona${a.personIds.length === 1 ? '' : 's'}`
    );
  }
  return parts.join(' · ') || 'Sin destinatarios';
}

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

// ----------------------------------------------------------------------------
// Acciones
// ----------------------------------------------------------------------------

export function saveCalendarEvent(
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

export function setCalendarEventStatus(id: string, status: CalendarEvent['status']) {
  const ev = calendarEvents.get(id);
  if (!ev) return;
  calendarEvents.upsert({ ...ev, status, updatedAt: new Date().toISOString() });
}

export function deleteCalendarEvent(id: string) {
  calendarEvents.remove(id);
  reminderPreferences
    .getAll()
    .filter((r) => r.eventId === id)
    .forEach((r) => reminderPreferences.remove(r.id));
}

export function reminderId(eventId: string, personId: string) {
  return `${eventId}__${personId}`;
}

export function saveReminderPreference(
  eventId: string,
  personId: string,
  enabled: boolean,
  offsets: ReminderOffset[]
): EventReminderPreference {
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
