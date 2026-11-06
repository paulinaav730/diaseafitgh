/**
 * Reglas de cumpleaños de DÍAS EAFIT (sin dependencias: las usan la app y la
 * función programada del servidor que envía las notificaciones push).
 *
 * - Los cumpleaños NO se guardan como eventos: se calculan cada año a partir
 *   de la fecha de nacimiento, así que se repiten solos y nunca se duplican.
 * - Todo se calcula en la hora de Colombia (America/Bogota, UTC−5 todo el
 *   año, sin horario de verano).
 * - Quien nació un 29 de febrero celebra el 28 de febrero en años no bisiestos.
 */

export const BOGOTA_OFFSET_MIN = -5 * 60;
/** Hora (Bogotá) a la que se envían los recordatorios. */
export const BIRTHDAY_NOTIFY_HOUR = 12;
/** Días de anticipación de los recordatorios: 7 días antes, 1 día antes y el mismo día. */
export const BIRTHDAY_REMINDER_DAYS = [7, 1, 0] as const;
export type BirthdayReminderDays = (typeof BIRTHDAY_REMINDER_DAYS)[number];

export interface BirthdayPerson {
  personId: string;
  name: string;
  gt?: string | null;
  /** AAAA-MM-DD */
  birthDate: string;
}

export interface BirthdayOccurrence extends BirthdayPerson {
  /** Fecha del cumpleaños en ese año, AAAA-MM-DD */
  date: string;
  /** Años que cumple ese día */
  age: number;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const pad = (n: number) => String(n).padStart(2, '0');
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Valida AAAA-MM-DD (fecha real, no futura respecto a `today` si se da). */
export function parseBirthDate(value: string | null | undefined, today?: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || mo < 1 || mo > 12 || d < 1) return null;
  const maxDay = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  if (d > maxDay) return null;
  if (today && value!.trim() > today) return null;
  return { y, m: mo, d };
}

/** Fecha de hoy en Bogotá (AAAA-MM-DD) para un instante dado. */
export function bogotaToday(now: Date = new Date()): string {
  const t = new Date(now.getTime() + BOGOTA_OFFSET_MIN * 60_000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Instante (UTC) que corresponde a la fecha y hora dadas en Bogotá. */
export function bogotaInstant(dateIso: string, hour = BIRTHDAY_NOTIFY_HOUR, minute = 0): Date {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - BOGOTA_OFFSET_MIN * 60_000);
}

export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400_000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Fecha del cumpleaños en un año concreto (29-feb → 28-feb si el año no es bisiesto). */
export function birthdayInYear(birthDate: string, year: number): string | null {
  const b = parseBirthDate(birthDate);
  if (!b || year < b.y) return null;
  const d = b.m === 2 && b.d === 29 && !isLeap(year) ? 28 : b.d;
  return `${year}-${pad(b.m)}-${pad(d)}`;
}

/** Cumpleaños que caen entre `from` y `to` (incluidos), con la edad que cumple cada persona. */
export function birthdaysInRange(people: BirthdayPerson[], from: string, to: string): BirthdayOccurrence[] {
  if (to < from) return [];
  const out: BirthdayOccurrence[] = [];
  const y0 = Number(from.slice(0, 4));
  const y1 = Number(to.slice(0, 4));
  for (const p of people) {
    const b = parseBirthDate(p.birthDate);
    if (!b) continue; // sin fecha válida: no se muestra ni se inventa nada
    for (let y = y0; y <= y1; y++) {
      const date = birthdayInYear(p.birthDate, y);
      if (!date || date < from || date > to) continue;
      const age = y - b.y;
      if (age < 1) continue;
      out.push({ ...p, date, age });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/** Próximo cumpleaños desde `today` (incluye hoy). */
export function nextBirthday(p: BirthdayPerson, today: string): BirthdayOccurrence | null {
  const y = Number(today.slice(0, 4));
  return birthdaysInRange([p], today, `${y + 1}-12-31`)[0] ?? null;
}

/** "6 de noviembre" (sin año: el año de nacimiento no se muestra). */
export function formatBirthdayDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

export interface BirthdayReminder {
  /** Clave única por persona, año y anticipación (evita enviar dos veces). */
  key: string;
  occurrence: BirthdayOccurrence;
  daysBefore: BirthdayReminderDays;
  fireAt: Date;
  title: string;
  body: string;
}

export function birthdayReminderText(o: BirthdayOccurrence, daysBefore: number): { title: string; body: string } {
  const name = o.name.toUpperCase();
  if (daysBefore === 0) {
    return { title: `🎂 ¡HOY ESTÁ DE CUMPLEAÑOS ${name}!`, body: `Hoy cumple ${o.age} años. ¡No olvides felicitarle!` };
  }
  if (daysBefore === 1) {
    return { title: `🎂 Mañana cumple años ${o.name}`, body: `${formatBirthdayDate(o.date)} · cumple ${o.age} años${o.gt ? ` · GT ${o.gt}` : ''}.` };
  }
  return {
    title: `🎂 En ${daysBefore} días cumple años ${o.name}`,
    body: `${formatBirthdayDate(o.date)} · cumple ${o.age} años${o.gt ? ` · GT ${o.gt}` : ''}.`,
  };
}

/**
 * Recordatorios que ya deben enviarse: su hora (12:00 p. m. de Bogotá del día
 * correspondiente) pasó hace menos de `windowMs`. Así un retraso del
 * programador no los pierde y tampoco se envían avisos viejos.
 */
export function dueBirthdayReminders(people: BirthdayPerson[], now: Date, windowMs = 15 * 60_000): BirthdayReminder[] {
  const today = bogotaToday(now);
  const occurrences = birthdaysInRange(people, addDaysIso(today, -1), addDaysIso(today, 8));
  const out: BirthdayReminder[] = [];
  for (const o of occurrences) {
    for (const daysBefore of BIRTHDAY_REMINDER_DAYS) {
      const fireAt = bogotaInstant(addDaysIso(o.date, -daysBefore));
      const t = now.getTime();
      if (t >= fireAt.getTime() && t < fireAt.getTime() + windowMs) {
        out.push({
          key: `bday__${o.personId}__${o.date}__${daysBefore}`,
          occurrence: o,
          daysBefore,
          fireAt,
          ...birthdayReminderText(o, daysBefore),
        });
      }
    }
  }
  return out;
}
