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

// ---------------------------------------------------------------------------
// Carga masiva desde Excel
// ---------------------------------------------------------------------------
const { toBirthDate, parseBirthdayRows } = await import('../src/services/birthdayImport');
assert.equal(toBirthDate('06/11/2003'), '2003-11-06');
assert.equal(toBirthDate('6-11-2003'), '2003-11-06');
assert.equal(toBirthDate('2003-11-06'), '2003-11-06');
assert.equal(toBirthDate('6 de noviembre de 2003'), '2003-11-06');
assert.equal(toBirthDate('6 nov 2003'), '2003-11-06');
assert.equal(toBirthDate(37931), '2003-11-06'); // número de serie de Excel
assert.equal(toBirthDate('06/11/03'), '2003-11-06');
assert.equal(toBirthDate('31/02/2003'), null);
assert.equal(toBirthDate('01/01/2099'), null);
assert.equal(toBirthDate(''), null);
ok('Fechas de Excel: día/mes/año, AAAA-MM-DD, "6 de noviembre de 2003", número de serie; imposibles o futuras se rechazan');

const gente: any[] = [
  { id: 'a', name: 'Paulina', documentId: '1017123456' },
  { id: 'b', name: 'Juan Pérez', documentId: '1020304050' },
  { id: 'c', name: 'Ana', documentId: '43111222' },
];
const { rows, error } = parseBirthdayRows(
  [
    { 'Cédula': '1.017.123.456', Nombre: 'Paulina', 'Fecha de nacimiento': '06/11/2003' },
    { 'Cédula': '', Nombre: 'Juan Pérez', 'Fecha de nacimiento': 35000 },
    { 'Cédula': '999', Nombre: 'No existe', 'Fecha de nacimiento': '01/01/2000' },
    { 'Cédula': '43111222', Nombre: 'Ana', 'Fecha de nacimiento': '30/02/2001' },
    { 'Cédula': '1017123456', Nombre: 'Paulina otra vez', 'Fecha de nacimiento': '07/11/2003' },
    { 'Cédula': '', Nombre: '', 'Fecha de nacimiento': '' },
  ],
  gente,
  []
);
assert.equal(error, undefined);
assert.deepEqual(rows.map((r) => [r.status, r.person?.id ?? null, r.birthDate ?? null]), [
  ['ok', 'a', '2003-11-06'],
  ['ok', 'b', '1995-10-28'],
  ['sin_persona', null, null],
  ['fecha_invalida', 'c', null],
  ['repetida', 'a', '2003-11-07'],
]);
ok('Une cada fila con el integrante que ya existe (cédula con puntos o nombre); no inventa personas ni repite');
const again = parseBirthdayRows([{ 'Cédula': '1017123456', 'Fecha de nacimiento': '06/11/2003' }], gente, [{ personId: 'a', name: 'Paulina', birthDate: '2003-11-06' }]);
assert.equal(again.rows[0].status, 'sin_cambio');
assert.match(parseBirthdayRows([{ Cédula: '1', Otra: 'x' }], gente, []).error!, /Fecha de nacimiento/);
ok('Si la fecha ya estaba, no cambia nada; si falta la columna, lo explica');
console.log('\nCarga masiva OK.');

// ---- Directorio de personal: la fecha de nacimiento viene en el mismo Excel ----
{
  const XLSX = await import('xlsx');
  const { identifyColumns, parseExcelMaestroFile } = await import('../src/services/excelService');
  assert.equal(identifyColumns(['Nombre', 'Fecha de nacimiento', 'THE SHOW LUNES 28 de septiembre']).birthDateKey, 'Fecha de nacimiento');
  assert.equal(identifyColumns(['Cumpleaños']).birthDateKey, 'Cumpleaños');
  const ws = XLSX.utils.json_to_sheet([
    { Nombre: 'Paulina', 'Documento de identidad': '1017123456', 'Fecha de nacimiento': '06/11/2003' },
    { Nombre: 'Juan', 'Documento de identidad': '1020304050', 'Fecha de nacimiento': 35000 },
    { Nombre: 'Ana', 'Documento de identidad': '43111222', 'Fecha de nacimiento': '31/02/2001' },
    { Nombre: 'Luis', 'Documento de identidad': '71222333', 'Fecha de nacimiento': '' },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const preview = await parseExcelMaestroFile(new File([buf], 'directorio.xlsx'), [], []);
  assert.deepEqual(preview.rows.map((r) => [r.name, r.birthDate ?? null, r.isValid]), [
    ['Paulina', '2003-11-06', true],
    ['Juan', '1995-10-28', true],
    ['Ana', null, true],
    ['Luis', null, true],
  ]);
  assert.ok(preview.rows[2].warnings.some((w) => w.startsWith('Fecha de nacimiento')));
  assert.equal(preview.rows[3].warnings.length, 0);
  ok('El Excel del directorio de personal lee la fecha de nacimiento; una fecha mala solo avisa, no bloquea a la persona');
  assert.equal(preview.birthDateColumn, 'Fecha de nacimiento');
  const csv = 'Nombre,Documento de identidad,Fecha de nacimiento\nPaulina,1017123456,06/11/2003\nJuan,1020304050,15/11/2003\n';
  const csvPreview = await parseExcelMaestroFile(new File([csv], 'directorio.csv'), [], []);
  assert.deepEqual(csvPreview.rows.map((r) => r.birthDate), ['2003-11-06', '2003-11-15']);
  for (const h of ['F. Nac', 'Fecha Nac.', 'DOB', 'FECHA DE NACIMIENTO']) assert.equal(identifyColumns([h]).birthDateKey, h);
  const sinColumna = await parseExcelMaestroFile(new File(['Nombre,Documento de identidad\nAna,43111222\n'], 'x.csv'), [], []);
  assert.equal(sinColumna.birthDateColumn, undefined);
  ok('En CSV 06/11/2003 es 6 de noviembre (no 11 de junio); reconoce "F. Nac" y "DOB"; avisa si no hay columna');
}

