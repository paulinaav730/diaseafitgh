// Regla de alimentación: umbrales exactos sobre la suma de horas del día.
import assert from 'node:assert/strict';
import { mealsForMinutes, mealText, shiftMinutes, sumShiftMinutes, formatWorked } from '../src/services/foodRules';

const h = (hours: number, min = 0) => hours * 60 + min;
const cases: [string, number, string][] = [
  ['1 hora', h(1), 'Ninguna'],
  ['2 h 59 min', h(2, 59), 'Ninguna'],
  ['3 horas', h(3), '1 refrigerio'],
  ['4 horas', h(4), '1 refrigerio'],
  ['5 h 59 min', h(5, 59), '1 refrigerio'],
  ['6 horas', h(6), '1 almuerzo'],
  ['7 horas', h(7), '1 almuerzo'],
  ['7 h 29 min', h(7, 29), '1 almuerzo'],
  ['7 h 30 min', h(7, 30), '1 almuerzo + 1 refrigerio'],
  ['8 horas', h(8), '1 almuerzo + 1 refrigerio'],
  ['8 h 59 min', h(8, 59), '1 almuerzo + 1 refrigerio'],
  ['9 horas', h(9), '1 almuerzo + 2 refrigerios'],
  ['15 horas', h(15), '1 almuerzo + 2 refrigerios'],
];
for (const [name, minutes, expected] of cases) {
  assert.equal(mealText(mealsForMinutes(minutes)), expected, name);
  console.log(`✔ Paulina trabaja ${name}: ${expected}`);
}

// Se suman los turnos del mismo día antes de decidir
const turnos = [
  { id: 'a', startTime: '08:00', endTime: '11:00' }, // 3 h
  { id: 'b', startTime: '13:00', endTime: '17:30' }, // 4 h 30
];
assert.equal(sumShiftMinutes(turnos), h(7, 30));
assert.equal(mealText(mealsForMinutes(sumShiftMinutes(turnos))), '1 almuerzo + 1 refrigerio');
console.log('✔ Dos turnos (3 h + 4 h 30) suman 7 h 30: 1 almuerzo + 1 refrigerio');

// Al quitar un turno, se recalcula
assert.equal(mealText(mealsForMinutes(sumShiftMinutes([turnos[1]]))), '1 refrigerio');
console.log('✔ Al eliminar un turno se recalcula (4 h 30: 1 refrigerio)');

// La misma asignación repetida no cuenta doble
assert.equal(sumShiftMinutes([turnos[0], turnos[0]]), h(3));
console.log('✔ Un turno duplicado se cuenta una sola vez');

// Sin redondeo: 5 h 57 min (antes se redondeaba a 6,0 h y daba almuerzo)
assert.equal(mealText(mealsForMinutes(shiftMinutes('06:00', '11:57'))), '1 refrigerio');
console.log('✔ Sin redondeo: 5 h 57 min sigue siendo 1 refrigerio');

assert.equal(shiftMinutes('22:00', '02:00'), h(4));
assert.equal(formatWorked(h(7, 30)), '7 h 30 min');
console.log('✔ Turnos que pasan la medianoche y formato de horas');
console.log('\nReglas de alimentación OK.');
