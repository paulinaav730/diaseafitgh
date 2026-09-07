const fs = require('fs');
let c = fs.readFileSync('src/data/eventStructure.ts', 'utf8');

const replacement = "export const THE_GAMES_JUEVES_BASES: ConfigurableBase[] = Array.from({ length: 15 }, (_, i) => ({
  id: 'games_jueves_' + String(i + 1),
  name: 'Base ' + String(i + 1),
  baseNumber: String(i + 1),
  capacity: 2,
  isActive: true,
  eventId: 'the-games',
  dayId: 'jueves',
  color: '#B83A24',
  orderIndex: i + 1,
}));

export const THE_GAMES_VIERNES_BASES: ConfigurableBase[] = Array.from({ length: 15 }, (_, i) => ({
  id: 'games_viernes_' + String(i + 16),
  name: 'Base ' + String(i + 16),
  baseNumber: String(i + 16),
  capacity: 2,
  isActive: true,
  eventId: 'the-games',
  dayId: 'viernes',
  color: '#B83A24',
  orderIndex: i + 16,
}));

export const DEFAULT_INITIAL_BASES: ConfigurableBase[] = [
  ...CARNIVAL_PHYSICAL_BASES.map(b => ({
    id: 'carnival_' + String(b.id),
    name: b.name,
    baseNumber: String(b.id),
    capacity: b.defaultCapacity,
    isActive: true,
    eventId: 'carnival',
    dayId: 'miercoles',
    color: '#B83A24',
    orderIndex: Number(b.id) || 99,
  })),
  ...THE_GAMES_JUEVES_BASES,
  ...THE_GAMES_VIERNES_BASES,
];";

c = c.replace(/export const THE_GAMES_PHYSICAL_BASES[\s\S]*?\];/, replacement);

fs.writeFileSync('src/data/eventStructure.ts', c);
