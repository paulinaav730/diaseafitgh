import { bogotaToday, parseBirthDate } from '../../supabase/functions/_shared/birthdays';

/** Lectura de fechas de nacimiento escritas a mano o como fecha de Excel. */
const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Convierte lo que venga en la celda a AAAA-MM-DD (formato colombiano: día/mes/año). */
export function toBirthDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const today = bogotaToday();
  const build = (y: number, m: number, d: number) => {
    if (y < 100) y = y + (y + 2000 > Number(today.slice(0, 4)) ? 1900 : 2000);
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    return parseBirthDate(iso, today) ? iso : null;
  };
  if (value instanceof Date && !isNaN(value.getTime())) return build(value.getFullYear(), value.getMonth() + 1, value.getDate());
  if (typeof value === 'number') {
    // Número de serie de Excel (días desde el 30/12/1899)
    if (!Number.isFinite(value) || value < 1) return null;
    const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400_000);
    return build(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  const s = String(value).trim().toLowerCase();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return build(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (m) return build(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})\s*(?:de\s+)?([a-záéíóú]+)\.?\s*(?:de\s+|del\s+)?(\d{2,4})$/.exec(s);
  if (m) {
    const month = MONTHS[m[2].normalize('NFD').replace(/[̀-ͯ]/g, '')];
    return month ? build(+m[3], month, +m[1]) : null;
  }
  if (/^\d{5}$/.test(s)) return toBirthDate(Number(s));
  return null;
}
