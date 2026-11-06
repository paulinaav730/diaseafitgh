/**
 * Regla única de alimentación de DÍAS.
 *
 * Se suman TODAS las horas de los turnos asignados a la persona en el mismo
 * día y se aplica la tabla con umbrales exactos (en minutos, sin redondear):
 *
 *   menos de 3 h               → ninguna
 *   desde 3 h y menos de 6 h   → 1 refrigerio
 *   desde 6 h y menos de 7 h 30 → 1 almuerzo
 *   desde 7 h 30 y menos de 9 h → 1 almuerzo + 1 refrigerio
 *   desde 9 h                  → 1 almuerzo + 2 refrigerios
 *
 * Todas las pantallas (alimentación, entregas, dashboard, Mi DÍAS y perfil)
 * usan estas funciones, así que el resultado es el mismo en todas partes y se
 * recalcula solo cuando cambian los turnos o las asignaciones.
 */

export interface MealEntitlement {
  lunches: number;
  snacks: number;
  /** Texto corto: "1 almuerzo + 2 refrigerios", "Ninguna"… */
  label: string;
}

export const FOOD_THRESHOLDS: readonly { fromMinutes: number; lunches: number; snacks: number; label: string }[] = [
  { fromMinutes: 9 * 60, lunches: 1, snacks: 2, label: '1 almuerzo + 2 refrigerios' },
  { fromMinutes: 7 * 60 + 30, lunches: 1, snacks: 1, label: '1 almuerzo + 1 refrigerio' },
  { fromMinutes: 6 * 60, lunches: 1, snacks: 0, label: '1 almuerzo' },
  { fromMinutes: 3 * 60, lunches: 0, snacks: 1, label: '1 refrigerio' },
];

/** Texto de la regla para mostrar en pantalla. */
export const FOOD_RULE_SUMMARY =
  'Menos de 3 h: ninguna · 3 h a menos de 6 h: 1 refrigerio · 6 h a menos de 7 h 30: 1 almuerzo · 7 h 30 a menos de 9 h: 1 almuerzo + 1 refrigerio · 9 h o más: 1 almuerzo + 2 refrigerios';

export function mealsForMinutes(totalMinutes: number): MealEntitlement {
  const rule = FOOD_THRESHOLDS.find((r) => totalMinutes >= r.fromMinutes);
  return rule ? { lunches: rule.lunches, snacks: rule.snacks, label: rule.label } : { lunches: 0, snacks: 0, label: 'Ninguna' };
}

function toMinutes(t?: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

/** Duración exacta de un turno en minutos. Si termina después de medianoche, se cuenta hasta el día siguiente. */
export function shiftMinutes(startTime?: string, endTime?: string): number {
  const start = toMinutes(startTime);
  let end = toMinutes(endTime);
  if (start === null || end === null) return 0;
  if (end < start) end += 24 * 60;
  return end - start;
}

/**
 * Minutos trabajados en el día: suma de los turnos de la persona. Un mismo
 * turno repetido (asignación duplicada) se cuenta una sola vez.
 */
export function sumShiftMinutes(shifts: ({ id?: string; startTime?: string; endTime?: string } | null | undefined)[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const s of shifts) {
    if (!s) continue;
    if (s.id) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
    }
    total += shiftMinutes(s.startTime, s.endTime);
  }
  return total;
}

/** "7 h 30 min", "3 h", "45 min", "0 h". */
export function formatWorked(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h && m) return `${h} h ${m} min`;
  if (m) return `${m} min`;
  return `${h} h`;
}

/** Texto de las comidas con número de refrigerios: "1 almuerzo + 2 refrigerios". */
export function mealText(e: { lunches: number; snacks: number }): string {
  const parts: string[] = [];
  if (e.lunches) parts.push(`${e.lunches} almuerzo`);
  if (e.snacks) parts.push(`${e.snacks} refrigerio${e.snacks > 1 ? 's' : ''}`);
  return parts.length ? parts.join(' + ') : 'Ninguna';
}
