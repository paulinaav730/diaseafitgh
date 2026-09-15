const fs = require('fs');
let content = fs.readFileSync('src/data/eventStructure.ts', 'utf8').replace(/\r\n/g, '\n');

const target = `// 15 Physical Bases for The Games
export const THE_GAMES_JUEVES_BASES: ConfigurableBase[] = Array.from({ length: 15 }, (_, i) => ({
  id: 'games_jueves_' + (i + 1),
  name: 'Base ' + (i + 1),
  baseNumber: String(i + 1),
  defaultCapacity: 2,
  capacity: 2,
  isActive: true,
  eventId: 'the-games',
  dayId: 'jueves',
  color: '#B83A24',
  orderIndex: i + 1,
}));

export const THE_GAMES_VIERNES_BASES: ConfigurableBase[] = Array.from({ length: 15 }, (_, i) => ({
  id: 'games_viernes_' + (i + 16),
  name: 'Base ' + (i + 16),
  baseNumber: String(i + 16),
  defaultCapacity: 2,
  capacity: 2,
  isActive: true,
  eventId: 'the-games',
  dayId: 'viernes',
  color: '#B83A24',
  orderIndex: i + 16,
}));`;

const replacement = `// 15 Physical Bases for The Games
export const THE_GAMES_JUEVES_BASES: ConfigurableBase[] = [
  { id: 'games_jueves_1', name: 'Base 1', baseNumber: '1', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 1 },
  { id: 'games_jueves_2', name: 'Base 2', baseNumber: '2', defaultCapacity: 3, capacity: 3, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 2 },
  { id: 'games_jueves_3', name: 'Base 3', baseNumber: '3', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 3 },
  { id: 'games_jueves_4', name: 'Base 4', baseNumber: '4', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 4 },
  { id: 'games_jueves_5', name: 'Base 5', baseNumber: '5', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 5 },
  { id: 'games_jueves_6', name: 'Base 6', baseNumber: '6', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 6 },
  { id: 'games_jueves_7', name: 'Base 7', baseNumber: '7', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 7 },
  { id: 'games_jueves_8', name: 'Base 8', baseNumber: '8', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 8 },
  { id: 'games_jueves_9', name: 'Base 9', baseNumber: '9', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 9 },
  { id: 'games_jueves_10', name: 'Base 10', baseNumber: '10', defaultCapacity: 5, capacity: 5, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 10 },
  { id: 'games_jueves_11', name: 'Base 11', baseNumber: '11', defaultCapacity: 5, capacity: 5, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 11 },
  { id: 'games_jueves_12', name: 'Base 12', baseNumber: '12', defaultCapacity: 5, capacity: 5, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 12 },
  { id: 'games_jueves_13', name: 'Base vivo', baseNumber: '13', defaultCapacity: 3, capacity: 3, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 13, isSpecial: true },
  { id: 'games_jueves_14', name: 'Macro 1', baseNumber: '14', defaultCapacity: 5, capacity: 5, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 14, isSpecial: true },
  { id: 'games_jueves_15', name: 'Macro 2', baseNumber: '15', defaultCapacity: 5, capacity: 5, isActive: true, eventId: 'the-games', dayId: 'jueves', color: '#B83A24', orderIndex: 15, isSpecial: true },
];

export const THE_GAMES_VIERNES_BASES: ConfigurableBase[] = [
  { id: 'games_viernes_16', name: 'Base 16', baseNumber: '16', defaultCapacity: 5, capacity: 5, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 16 },
  { id: 'games_viernes_17', name: 'Base 17', baseNumber: '17', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 17 },
  { id: 'games_viernes_18', name: 'Base 18', baseNumber: '18', defaultCapacity: 6, capacity: 6, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 18 },
  { id: 'games_viernes_19', name: 'Base 19', baseNumber: '19', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 19 },
  { id: 'games_viernes_20', name: 'Base 20', baseNumber: '20', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 20 },
  { id: 'games_viernes_21', name: 'Base 21', baseNumber: '21', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 21 },
  { id: 'games_viernes_22', name: 'Base 22', baseNumber: '22', defaultCapacity: 6, capacity: 6, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 22 },
  { id: 'games_viernes_23', name: 'Base 23', baseNumber: '23', defaultCapacity: 7, capacity: 7, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 23 },
  { id: 'games_viernes_24', name: 'Base 24', baseNumber: '24', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 24 },
  { id: 'games_viernes_25', name: 'Base 25', baseNumber: '25', defaultCapacity: 6, capacity: 6, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 25 },
  { id: 'games_viernes_26', name: 'Base 26', baseNumber: '26', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 26 },
  { id: 'games_viernes_27', name: 'Base 27', baseNumber: '27', defaultCapacity: 4, capacity: 4, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 27 },
  { id: 'games_viernes_28', name: 'Bicis', baseNumber: '28', defaultCapacity: 2, capacity: 2, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 28, isSpecial: true },
  { id: 'games_viernes_29', name: 'Macro 1', baseNumber: '29', defaultCapacity: 5, capacity: 5, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 29, isSpecial: true },
  { id: 'games_viernes_30', name: 'Macro 2', baseNumber: '30', defaultCapacity: 5, capacity: 5, isActive: true, eventId: 'the-games', dayId: 'viernes', color: '#B83A24', orderIndex: 30, isSpecial: true },
];`;

content = content.replace(target, replacement);

fs.writeFileSync('src/data/eventStructure.ts', content);
console.log('Modified bases capacities');
