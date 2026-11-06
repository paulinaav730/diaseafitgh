/**
 * Pruebas del cálculo de DÍAS POINTS por CONECTADOS.
 * Ejecutar: npx tsx tests/league.test.ts
 */
import assert from 'node:assert/strict';
import { computeConectadosResults, computeGtStandings, DEFAULT_CONECTADOS_SCORING } from '../src/services/leagueService';
import type { AttendanceState, Person, PointMovement } from '../src/types';

let n = 0;
const person = (gt: string): Person => ({
  id: `p${++n}`,
  name: `Persona ${n}`,
  documentId: String(n),
  email: '',
  primaryType: 'GT',
  gtSubTeam: gt as Person['gtSubTeam'],
  createdAt: '',
});

function team(gt: string, size: number, statuses: AttendanceState[]) {
  const members = Array.from({ length: size }, () => person(gt));
  const map = new Map<string, AttendanceState>();
  members.forEach((m, i) => statuses[i] && map.set(m.id, statuses[i]));
  return { members, map };
}
const fill = (k: number, st: AttendanceState, rest: AttendanceState = 'no_asistio', size = 0) =>
  [...Array(k).fill(st), ...Array(Math.max(0, size - k)).fill(rest)] as AttendanceState[];

// --- Ejemplo del documento: 20 pts máx. ---
const carnival = team('Carnival', 20, fill(16, 'llego', 'no_asistio', 20));
const finanzas = team('Finanzas', 6, fill(6, 'llego'));
const gh = team('GH', 10, fill(8, 'llego', 'no_asistio', 10));
const logistica = team('Logística', 15, fill(9, 'llego', 'no_asistio', 15));
const people = [...carnival.members, ...finanzas.members, ...gh.members, ...logistica.members];
const status = new Map([...carnival.map, ...finanzas.map, ...gh.map, ...logistica.map]);
const scoring = { ...DEFAULT_CONECTADOS_SCORING, maxGtPoints: 20 };

const res = computeConectadosResults(scoring, ['Carnival', 'Finanzas', 'GH', 'Logística'], people, (id) => status.get(id));
const by = Object.fromEntries(res.map((r) => [r.gt, r]));
assert.equal(by.Carnival.percentage, 80);
assert.equal(by.Carnival.points, 16);
assert.equal(by.Finanzas.percentage, 100);
assert.equal(by.Finanzas.points, 20);
assert.equal(by.GH.percentage, 80);
assert.equal(by.GH.points, 16);
assert.equal(by.Logística.percentage, 60);
assert.equal(by.Logística.points, 12);
console.log('✔ Ejemplo del documento (Carnival 16, Finanzas 20, GH 16, Logística 12)');

// --- Excusas: 10 integrantes, 7 asisten, 2 excusa, 1 ausente ---
const t = team('Mercadeo', 10, [...fill(7, 'llego'), 'excusa', 'excusa', 'no_asistio']);
const run = (mode: 'excluir' | 'asistencia' | 'ausencia') =>
  computeConectadosResults({ ...scoring, excuseMode: mode }, ['Mercadeo'], t.members, (id) => t.map.get(id))[0];
assert.equal(run('excluir').denominator, 8);
assert.equal(run('excluir').percentage, 87.5); // 7/8
assert.equal(run('asistencia').percentage, 90); // 9/10
assert.equal(run('ausencia').percentage, 70); // 7/10
console.log('✔ Criterios de excusa (excluir 87.5%, asistencia 90%, ausencia 70%)');

// --- Tarde a media asistencia + no habilitados fuera del denominador ---
const t2 = team('RRPP', 6, ['llego', 'llego', 'llego_tarde', 'llego_tarde', 'no_aplica', 'no_asistio']);
const r2 = computeConectadosResults({ ...scoring, lateWeight: 0.5 }, ['RRPP'], t2.members, (id) => t2.map.get(id))[0];
assert.equal(r2.enabled, 5);
assert.equal(r2.percentage, 60); // (2 + 2×0.5) / 5
assert.equal(r2.points, 12);
console.log('✔ Llegada tarde ponderada y "No habilitado" fuera del denominador');

// --- PENDIENTE: sin registro cuenta como pendiente (no como no asistió) y no suma ---
const t3 = team('Seguridad', 4, ['llego', 'llego']);
const r3 = computeConectadosResults(scoring, ['Seguridad'], t3.members, (id) => t3.map.get(id))[0];
assert.equal(r3.pending, 2);
assert.equal(r3.percentage, 50);
console.log('✔ Sin registro = PENDIENTE (cuenta 0 en el cálculo hasta cerrar)');

// --- GT sin integrantes no rompe ---
assert.equal(computeConectadosResults(scoring, ['Seguridad'], [], () => undefined)[0].points, 0);

// --- Ranking: ignora anulados, empates comparten puesto ---
const mv = (gt: string, points: number, category: PointMovement['category'], voided = false, date = '2027-02-01'): PointMovement => ({
  id: Math.random().toString(), date, target: 'gt', gt, points, category, activityName: 'x', registeredBy: 'a', createdAt: date, voided,
});
const st = computeGtStandings(
  [mv('Finanzas', 20, 'conectados'), mv('GH', 100, 'reto'), mv('GH', 50, 'reto', true), mv('Carnival', 20, 'conectados'), mv('Finanzas', 5, 'manual', false, '2027-03-01')],
  ['Finanzas', 'GH', 'Carnival']
);
assert.deepEqual(st.map((s) => [s.gt, s.position, s.total]), [['GH', 1, 100], ['Finanzas', 2, 25], ['Carnival', 3, 20]]);
assert.equal(st[1].otros, 5);
assert.deepEqual(st[1].evolution, [{ date: '2027-02-01', total: 20 }, { date: '2027-03-01', total: 25 }]);
const tie = computeGtStandings([mv('A', 10, 'reto'), mv('B', 10, 'reto'), mv('C', 5, 'reto')], ['A', 'B', 'C']);
assert.deepEqual(tie.map((s) => s.position), [1, 1, 3]);
console.log('✔ Ranking (anulados excluidos, evolución, empates)');
console.log('\nTodas las pruebas pasaron.');
