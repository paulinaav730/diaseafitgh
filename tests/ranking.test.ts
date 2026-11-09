// Ranking equitativo de la DÍAS LEAGUE: promedio por integrante (50 %) + participación ajustada (50 %).
import assert from 'node:assert/strict';
import { computeLeagueRanking, RankingInput } from '../src/services/leagueRanking';
import { CalendarEvent, ConectadosClosure, Person, PointActivity, PointActivityClaim, PointMovement } from '../src/types';

const ok = (m: string) => console.log('✔ ' + m);

const person = (id: string, gt: string, extra: Partial<Person> = {}): Person =>
  ({ id, name: id, documentId: id, email: `${id}@x.co`, primaryType: 'GT', gtTeams: [gt], gtSubTeam: gt, functions: [], createdAt: '', ...extra }) as Person;

// Logística: 10 integrantes. RRPP: 2. GH: 4. Una persona de MESA no cuenta.
const people: Person[] = [
  ...Array.from({ length: 10 }, (_, i) => person(`log${i}`, 'Logística')),
  person('rr0', 'RRPP'),
  person('rr1', 'RRPP'),
  ...Array.from({ length: 4 }, (_, i) => person(`gh${i}`, 'GH')),
  person('mesa', 'Logística', { primaryType: 'MESA' }),
];

let n = 0;
const mv = (target: 'gt' | 'person', gt: string, points: number, personId?: string, voided = false): PointMovement =>
  ({ id: `m${n++}`, date: '2026-10-01', target, gt, personId, points, category: 'manual', activityName: 'x', registeredBy: 'a', createdAt: '', voided }) as PointMovement;

// Logística suma MÁS puntos en total (60) pero tiene más gente: promedio 6.
// RRPP suma 20 con 2 personas: promedio 10 → el mejor promedio.
const movements: PointMovement[] = [
  ...Array.from({ length: 6 }, (_, i) => mv('person', 'Logística', 10, `log${i}`)), // 4 integrantes con 0 puntos
  mv('person', 'RRPP', 10, 'rr0'),
  mv('person', 'RRPP', 10, 'rr1'),
  mv('person', 'GH', 8, 'gh0'),
  mv('person', 'GH', 999, 'gh1', true), // anulado: no cuenta
  mv('gt', 'GH', 12), // puntos al GT completo
  mv('person', 'Logística', 50, 'mesa'), // MESA: no es de ningún GT de la liga
];

const ev = (id: string, type: string, status: CalendarEvent['status'] = 'activo'): CalendarEvent =>
  ({ id, title: id, date: '2026-10-0' + id.length, type, status, audience: { all: true, gtTeams: [], includeGap: false, includeMesa: false, personIds: [] } }) as unknown as CalendarEvent;
const res = (gt: string, den: number, eff: number) => ({ gt, enabled: den, attended: eff, late: 0, excused: 0, absent: den - eff, denominator: den, effectiveAttendance: eff, percentage: Math.round((eff / den) * 10000) / 100, points: 0 });
const closure = (eventId: string, results: ReturnType<typeof res>[], status: ConectadosClosure['status'] = 'cerrado'): ConectadosClosure =>
  ({ id: eventId, eventId, results, status, closedAt: '', closedBy: 'a', updatedAt: '' }) as ConectadosClosure;

const events = [ev('c1', 'conectados'), ev('dec', 'decoracion'), ev('show', 'the_show'), ev('can', 'conectados', 'cancelado'), ev('open', 'conectados')];
const closures = [
  // Conectados: Logística 5/10 = 50 %, RRPP 2/2 = 100 %, GH 3/4 = 75 %
  closure('c1', [res('Logística', 10, 5), res('RRPP', 2, 2), res('GH', 4, 3)]),
  // Decoración: Logística 10/10, RRPP 1/2, GH sin habilitados (no cuenta para GH)
  closure('dec', [res('Logística', 10, 10), res('RRPP', 2, 1), res('GH', 0, 0)]),
  closure('show', [res('Logística', 10, 0)]), // THE SHOW no cuenta por defecto
  closure('can', [res('Logística', 10, 0)]), // evento cancelado: no cuenta
  closure('open', [res('Logística', 10, 0)], 'reabierto'), // asistencia reabierta: no cuenta
];
const qr: PointActivity = {
  id: 'qr1', name: 'Trivia', individualPoints: 0, gtPoints: 0, mechanism: 'ambos', status: 'cerrada', date: '2026-10-05', createdAt: '',
  eligibility: { all: false, gtTeams: ['Logística', 'GH'], includeGap: false, includeMesa: false, personIds: [] },
};
const qrOpen: PointActivity = { ...qr, id: 'qr2', status: 'activa', date: '2099-01-01' }; // aún no termina
const claims: PointActivityClaim[] = ['log0', 'log1', 'gh0', 'gh1', 'gh2', 'gh3', 'rr0'].map((p) => ({ id: `qr1__${p}`, activityId: 'qr1', personId: p, source: 'qr_actividad', registeredBy: p, claimedAt: '' }));

const input: RankingInput = {
  people, movements, events, closures, activities: [qr, qrOpen], claims,
  inAudience: (p, a) => a.all || (a.gtTeams || []).includes(p.gtSubTeam || ''),
  today: '2026-11-09',
};
const { rows, activities } = computeLeagueRanking(input);
const by = Object.fromEntries(rows.map((r) => [r.gt, r]));

assert.equal(rows.length, 9);
assert.deepEqual(activities.map((a) => a.id).sort(), ['c1', 'dec', 'qr1']);
ok('Cuentan los eventos cerrados de los tipos habilitados y las actividades QR terminadas; no cuentan cancelados, reabiertos ni actividades abiertas');

assert.equal(by['Logística'].members, 10);
assert.equal(by['Logística'].totalPoints, 60);
assert.equal(by['Logística'].avgPoints, 6);
assert.equal(by['RRPP'].avgPoints, 10);
assert.equal(by['GH'].totalPoints, 20); // 8 individual + 12 del GT; el anulado no suma
assert.equal(by['GH'].avgPoints, 5);
assert.equal(by['Finanzas'].avgPoints, 0);
ok('Promedio = puntos ÷ integrantes activos, contando a quienes tienen 0 puntos; sin anulados ni MESA');

// Participación: Logística (50 + 100 + 20) / 3 = 56.67 · RRPP (100 + 50) / 2 = 75 · GH (75 + 100) / 2 = 87.5
assert.equal(by['Logística'].participation, 56.67);
assert.equal(by['RRPP'].participation, 75);
assert.equal(by['GH'].participation, 87.5);
assert.equal(by['GH'].activitiesCounted, 2);
ok('Participación = promedio del % de cada actividad; un GT sin habilitados en una actividad no se penaliza por ella');

// Escalas: el mejor promedio (RRPP 10) = 100; la mejor participación (GH 87.5) = 100
assert.equal(by['RRPP'].pointsScore, 100);
assert.equal(by['Logística'].pointsScore, 60);
assert.equal(by['GH'].participationScore, 100);
assert.equal(by['RRPP'].participationScore, 85.71);
assert.equal(by['RRPP'].score, 92.86); // 50 % × 100 + 50 % × 85.71
assert.equal(by['GH'].score, 75); // 50 % × 50 + 50 % × 100
assert.equal(by['Logística'].participationScore, 64.77);
assert.equal(by['Logística'].score, 62.39); // 50 % × 60 + 50 % × 64.77
ok('Cada dimensión va de 0 a 100 frente al mejor GT y el puntaje final es 50 % + 50 %');

assert.deepEqual(rows.slice(0, 3).map((r) => r.gt), ['RRPP', 'GH', 'Logística']);
assert.deepEqual(rows.slice(0, 3).map((r) => r.position), [1, 2, 3]);
assert.ok(rows.slice(3).every((r) => r.score === 0 && r.position === 4));
ok('Gana el mejor promedio y la mayor participación, no el GT más grande (Logística tiene más puntos en total y queda 3.º); empates comparten puesto');

// Configuración: solo puntos individuales y sin actividades QR
const alt = computeLeagueRanking({ ...input, config: { pointsBase: 'individuales', includeQrActivities: false } });
const altBy = Object.fromEntries(alt.rows.map((r) => [r.gt, r]));
assert.equal(altBy['GH'].avgPoints, 2);
assert.equal(altBy['GH'].participation, 75);
assert.ok(!alt.activities.some((a) => a.kind === 'actividad_qr'));
// Incluir THE SHOW y excluir la decoración
const alt2 = computeLeagueRanking({ ...input, config: { countedTypes: ['conectados', 'the_show', 'decoracion'], excludedIds: ['dec'] } });
assert.deepEqual(alt2.activities.map((a) => a.id).sort(), ['c1', 'qr1', 'show']);
ok('La administración elige qué tipos y actividades cuentan y qué puntos entran al promedio');

// Sin datos: todos en 0, sin dividir por cero
const empty = computeLeagueRanking({ ...input, movements: [], closures: [], activities: [], claims: [] });
assert.ok(empty.rows.every((r) => r.score === 0 && r.position === 1));
ok('Sin puntos ni actividades todos quedan en 0 sin errores');

console.log('\nRanking equitativo OK.');
