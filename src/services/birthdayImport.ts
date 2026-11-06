import * as XLSX from 'xlsx';
import { Person } from '../types';
import { normalizeHeader } from './excelService';
import { bogotaToday, BirthdayPerson, parseBirthDate } from '../../supabase/functions/_shared/birthdays';

/**
 * Carga masiva de fechas de nacimiento desde Excel o CSV.
 * Cada fila se une a un integrante EXISTENTE por su cédula (o, si no hay
 * cédula, por su nombre exacto). Nunca crea personas nuevas.
 */

export type ImportRowStatus = 'ok' | 'sin_cambio' | 'sin_persona' | 'fecha_invalida' | 'sin_fecha' | 'repetida';

export interface BirthdayImportRow {
  row: number;
  label: string;
  rawDate: string;
  birthDate?: string;
  person?: Person;
  status: ImportRowStatus;
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const normName = (v: unknown) => normalizeHeader(String(v ?? ''));

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

function findColumn(headers: string[], tests: ((h: string) => boolean)[]): string | undefined {
  for (const t of tests) {
    const found = headers.find((h) => t(normalizeHeader(h)));
    if (found) return found;
  }
  return undefined;
}

export function parseBirthdayRows(rows: Record<string, unknown>[], people: Person[], current: BirthdayPerson[]): {
  rows: BirthdayImportRow[];
  error?: string;
} {
  if (rows.length === 0) return { rows: [], error: 'El archivo no tiene filas.' };
  const headers = Object.keys(rows[0]);
  const dateCol = findColumn(headers, [(h) => h.includes('nacimiento'), (h) => h.includes('cumple'), (h) => h === 'fecha']);
  if (!dateCol) return { rows: [], error: 'No encontré la columna de la fecha. Ponle de título "Fecha de nacimiento".' };
  const docCol = findColumn(headers, [
    (h) => h.includes('cedula'),
    (h) => h.includes('documento') && !h.includes('nombre'),
    (h) => h.includes('identificacion') && !h.includes('nombre'),
    (h) => h === 'cc' || h === 'c c' || h === 'id',
  ]);
  const nameCol = findColumn(headers, [(h) => h.includes('nombre')]);
  if (!docCol && !nameCol) return { rows: [], error: 'No encontré la columna de la cédula ni la del nombre.' };

  const byDoc = new Map(people.filter((p) => digits(p.documentId)).map((p) => [digits(p.documentId), p]));
  const byName = new Map<string, Person[]>();
  people.forEach((p) => [p.name, p.fullName].forEach((n) => n && byName.set(normName(n), [...(byName.get(normName(n)) || []), p])));
  const currentById = new Map(current.map((b) => [b.personId, b.birthDate]));
  const seen = new Set<string>();

  const out = rows.map((r, i): BirthdayImportRow => {
    const doc = docCol ? digits(r[docCol]) : '';
    const name = nameCol ? String(r[nameCol] ?? '').trim() : '';
    const cell = r[dateCol];
    const parsed = toBirthDate(cell);
    const rawDate =
      typeof cell === 'number' && parsed ? parsed.split('-').reverse().join('/') : cell instanceof Date ? cell.toLocaleDateString('es-CO') : String(cell ?? '').trim();
    let person = doc ? byDoc.get(doc) : undefined;
    // Nombre con cédula al final ("Juan Pérez 1017123456")
    if (!person && name) {
      const tail = digits(name.match(/\d{5,}/)?.[0]);
      person = (tail && byDoc.get(tail)) || (byName.get(normName(name))?.length === 1 ? byName.get(normName(name))![0] : undefined);
    }
    const label = person?.name || name || (doc ? `CC ${doc}` : `Fila ${i + 2}`);
    const base = { row: i + 2, label, rawDate, person };
    if (!rawDate) return { ...base, status: 'sin_fecha' };
    if (!person) return { ...base, status: 'sin_persona' };
    const birthDate = parsed ?? undefined;
    if (!birthDate) return { ...base, status: 'fecha_invalida' };
    if (seen.has(person.id)) return { ...base, birthDate, status: 'repetida' };
    seen.add(person.id);
    return { ...base, birthDate, status: currentById.get(person.id) === birthDate ? 'sin_cambio' : 'ok' };
  });
  // Filas totalmente vacías: no se muestran
  return { rows: out.filter((r) => !(r.status === 'sin_fecha' && r.label.startsWith('Fila '))) };
}

export async function readBirthdayFile(file: File, people: Person[], current: BirthdayPerson[]) {
  // Sin cellDates: las fechas llegan como número de serie de Excel y se
  // convierten sin depender de la zona horaria del computador.
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  return parseBirthdayRows(rows, people, current);
}

/** Plantilla con todos los integrantes (y la fecha que ya tengan) para llenar de una vez. */
export function downloadBirthdayTemplate(people: Person[], current: BirthdayPerson[]) {
  const dates = new Map(current.map((b) => [b.personId, b.birthDate]));
  const data = [...people]
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((p) => {
      const d = dates.get(p.id);
      return { Cédula: p.documentId, Nombre: p.name, 'Fecha de nacimiento': d ? d.split('-').reverse().join('/') : '' };
    });
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 16 }, { wch: 36 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cumpleaños');
  XLSX.writeFile(wb, 'cumpleanos_dias_eafit.xlsx');
}
