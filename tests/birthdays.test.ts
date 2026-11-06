// Cumpleaños: recurrencia anual, edad, 29 de febrero, hora de Bogotá y recordatorios.
import assert from 'node:assert/strict';
import {
  birthdaysInRange,
  bogotaInstant,
  bogotaToday,
  dueBirthdayReminders,
  formatBirthdayDate,
  nextBirthday,
  parseBirthDate,
} from '../supabase/functions/_shared/birthdays';

const ok = (m: string) => console.log('✔ ' + m);
const paulina = { personId: 'p1', name: 'María Paulina Avendaño', gt: 'Logística', birthDate: '2003-11-06' };

// Recurrencia anual y edad
const r2026 = birthdaysInRange([paulina], '2026-11-01', '2026-11-30');
assert.equal(r2026.length, 1);
assert.equal(r2026[0].date, '2026-11-06');
assert.equal(r2026[0].age, 23);
assert.equal(formatBirthdayDate(r2026[0].date), '6 de noviembre');
ok('6 de noviembre de 2026: cumple 23 años');
const r2027 = birthdaysInRange([paulina], '2027-01-01', '2027-12-31');
assert.equal(r2027[0].age, 24);
ok('En 2027 aparece solo otra vez y cumple 24 (sin crear nada nuevo)');
assert.equal(birthdaysInRange([paulina], '2026-12-25', '2027-01-10').length, 0);
ok('Fuera del rango no aparece');

// Rango que cruza el año
const ana = { personId: 'p2', name: 'Ana', birthDate: '2000-01-02' };
const cross = birthdaysInRange([ana], '2026-12-28', '2027-01-05');
assert.equal(cross[0].date, '2027-01-02');
assert.equal(cross[0].age, 27);
ok('Rango que cruza diciembre-enero');

// 29 de febrero
const leap = { personId: 'p3', name: 'Leo', birthDate: '2004-02-29' };
assert.equal(birthdaysInRange([leap], '2027-02-01', '2027-03-31')[0].date, '2027-02-28');
assert.equal(birthdaysInRange([leap], '2028-02-01', '2028-03-31')[0].date, '2028-02-29');
ok('29 de febrero: se celebra el 28 en años no bisiestos');

// Sin fecha o fecha inválida: no se inventa nada
const sinFecha = [
  { personId: 'x', name: 'Sin fecha', birthDate: '' },
  { personId: 'y', name: 'Inválida', birthDate: '2001-02-30' },
  { personId: 'z', name: 'Texto', birthDate: 'ayer' },
];
assert.equal(birthdaysInRange(sinFecha, '2026-01-01', '2026-12-31').length, 0);
assert.equal(parseBirthDate('2030-01-01', '2026-11-06'), null);
ok('Sin fecha, fecha imposible o futura: no se muestra ningún cumpleaños');

// Próximo cumpleaños
assert.equal(nextBirthday(paulina, '2026-11-06')!.date, '2026-11-06');
assert.equal(nextBirthday(paulina, '2026-11-07')!.date, '2027-11-06');
ok('Próximo cumpleaños (hoy cuenta; si ya pasó, el del año siguiente)');

// Hora de Bogotá (UTC−5)
assert.equal(bogotaInstant('2026-11-06').toISOString(), '2026-11-06T17:00:00.000Z');
assert.equal(bogotaToday(new Date('2026-11-07T03:00:00Z')), '2026-11-06');
ok('12:00 p. m. en Bogotá = 17:00 UTC; a las 10 p. m. de Bogotá sigue siendo el mismo día');

// Recordatorios: 7 días antes, 1 día antes y el mismo día a las 12:00 p. m.
const at = (iso: string) => new Date(iso);
const due = (iso: string) => dueBirthdayReminders([paulina], at(iso)).map((r) => r.daysBefore);
assert.deepEqual(due('2026-10-30T17:00:00Z'), [7]);
assert.deepEqual(due('2026-11-05T17:05:00Z'), [1]);
assert.deepEqual(due('2026-11-06T17:00:00Z'), [0]);
ok('Se envían 7 días antes, 1 día antes y el mismo día a las 12:00 p. m. de Bogotá');
assert.deepEqual(due('2026-11-06T16:59:00Z'), []);
assert.deepEqual(due('2026-11-06T17:16:00Z'), []);
assert.deepEqual(due('2026-11-04T17:00:00Z'), []);
ok('Ni antes del mediodía, ni avisos viejos, ni otros días');
const hoy = dueBirthdayReminders([paulina], at('2026-11-06T17:00:00Z'))[0];
assert.equal(hoy.title, '🎂 ¡HOY ESTÁ DE CUMPLEAÑOS MARÍA PAULINA AVENDAÑO!');
assert.equal(hoy.body, 'Hoy cumple 23 años. ¡No olvides felicitarle!');
assert.equal(hoy.key, 'bday__p1__2026-11-06__0');
ok('Mensaje del día: "🎂 ¡HOY ESTÁ DE CUMPLEAÑOS …! Hoy cumple 23 años. ¡No olvides felicitarle!"');
const semana = dueBirthdayReminders([paulina], at('2026-10-30T17:00:00Z'))[0];
assert.match(semana.title, /En 7 días cumple años María Paulina Avendaño/);
assert.match(semana.body, /6 de noviembre · cumple 23 años · GT Logística/);
ok('Mensaje de 7 días antes con fecha, edad y GT');

// Cumpleaños el 1 de enero: el aviso de 7 días llega en diciembre del año anterior
const enero = { personId: 'p4', name: 'Enero', birthDate: '1999-01-01' };
assert.deepEqual(dueBirthdayReminders([enero], at('2026-12-25T17:00:00Z')).map((r) => [r.daysBefore, r.occurrence.age]), [[7, 28]]);
ok('Aviso de 7 días que cae en el año anterior (1 de enero)');

console.log('\nCumpleaños OK.');
