import { AppEvent, ConfigurableBase, ConfigurableShift, EventDayDefinition, PhysicalBase, Shift, ShiftRequirement } from '../types';

// Helper to format 24h hour to AM/PM nicely
export function formatHourAMPM(time24: string): string {
  if (!time24) return '';
  const parts = time24.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export function formatTimeRangeLabel(startTime: string, endTime: string): string {
  return `${formatHourAMPM(startTime)} – ${formatHourAMPM(endTime)}`;
}

// Helper to generate numbered physical bases
export function generateBases(count: number, capacityPerBase = 2, eventId?: string): PhysicalBase[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Base ${i + 1}`,
    defaultCapacity: capacityPerBase,
    isActive: true,
    eventId,
  }));
}

// 22 Physical Bases for Carnival: 19 numbered bases + Base Toro (20) + Base Speed (21) + Base Arcade (22)
export const CARNIVAL_PHYSICAL_BASES: PhysicalBase[] = [
  { id: 1, baseNumber: '1', baseLabel: 'BASE 1', gameName: 'Ring Toss', name: 'BASE 1 — Ring Toss', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-1', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 1 },
  { id: 2, baseNumber: '2', baseLabel: 'BASE 2', gameName: 'Balance Maestro', name: 'BASE 2 — Balance Maestro', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-2', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 2 },
  { id: 3, baseNumber: '3', baseLabel: 'BASE 3', gameName: 'Encesta Puntos', name: 'BASE 3 — Encesta Puntos', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-3', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 3 },
  { id: 4, baseNumber: '4', baseLabel: 'BASE 4', gameName: 'Salta Sapitos', name: 'BASE 4 — Salta Sapitos', defaultCapacity: 2, gapCapacity: 2, isSpecial: false, code: 'base-4', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 4 },
  { id: 5, baseNumber: '5', baseLabel: 'BASE 5', gameName: 'Duck Shoots', name: 'BASE 5 — Duck Shoots', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-5', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 5 },
  { id: 6, baseNumber: '6', baseLabel: 'BASE 6', gameName: 'Punto a Punto', name: 'BASE 6 — Punto a Punto', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-6', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 6 },
  { id: 7, baseNumber: '7', baseLabel: 'BASE 7', gameName: 'La Cima', name: 'BASE 7 — La Cima', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-7', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 7 },
  { id: 8, baseNumber: '8', baseLabel: 'BASE 8', gameName: 'Derriba y Asciende', name: 'BASE 8 — Derriba y Asciende', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-8', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 8 },
  { id: 9, baseNumber: '9', baseLabel: 'BASE 9', gameName: 'Descenso Caótico', name: 'BASE 9 — Descenso Caótico', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-9', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 9 },
  { id: 10, baseNumber: '10', baseLabel: 'BASE 10', gameName: 'Duck Fish', name: 'BASE 10 — Duck Fish', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-10', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 10 },
  { id: 11, baseNumber: '11', baseLabel: 'BASE 11', gameName: 'La Joroba', name: 'BASE 11 — La Joroba', defaultCapacity: 2, gapCapacity: 2, isSpecial: false, code: 'base-11', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 11 },
  { id: 12, baseNumber: '12', baseLabel: 'BASE 12', gameName: 'Herradura', name: 'BASE 12 — Herradura', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-12', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 12 },
  { id: 13, baseNumber: '13', baseLabel: 'BASE 13', gameName: 'Croquet y Golf', name: 'BASE 13 — Croquet y Golf', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-13', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 13 },
  { id: 14, baseNumber: '14', baseLabel: 'BASE 14', gameName: 'Nerfs', name: 'BASE 14 — Nerfs', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-14', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 14 },
  { id: 15, baseNumber: '15', baseLabel: 'BASE 15', gameName: 'Tower', name: 'BASE 15 — Tower', defaultCapacity: 3, gapCapacity: 3, isSpecial: false, code: 'base-15', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 15 },
  { id: 16, baseNumber: '16', baseLabel: 'BASE 16', gameName: 'Flip the bottle', name: 'BASE 16 — Flip the bottle', defaultCapacity: 2, gapCapacity: 2, isSpecial: false, code: 'base-16', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 16 },
  { id: 17, baseNumber: '17', baseLabel: 'BASE 17', gameName: 'Deslizamiento Cruzado', name: 'BASE 17 — Deslizamiento Cruzado', defaultCapacity: 2, gapCapacity: 2, isSpecial: false, code: 'base-17', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 17 },
  { id: 18, baseNumber: '18', baseLabel: 'BASE 18', gameName: 'Mini Futbol', name: 'BASE 18 — Mini Futbol', defaultCapacity: 2, gapCapacity: 2, isSpecial: false, code: 'base-18', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 18 },
  { id: 19, baseNumber: '19', baseLabel: 'BASE 19', gameName: 'Match', name: 'BASE 19 — Match', defaultCapacity: 2, gapCapacity: 2, isSpecial: false, code: 'base-19', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 19 },
  { id: 20, baseNumber: '20', baseLabel: 'BASE TORO', gameName: 'Base Toro', name: 'BASE TORO', defaultCapacity: 2, gapCapacity: 2, isSpecial: true, code: 'toro', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 20 },
  { id: 21, baseNumber: '21', baseLabel: 'BASE SPEED', gameName: 'Base Speed', name: 'BASE SPEED', defaultCapacity: 2, gapCapacity: 2, isSpecial: true, code: 'speedway', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 21 },
  { id: 22, baseNumber: '22', baseLabel: 'BASE ARCADE', gameName: 'Base Arcade', name: 'BASE ARCADE', defaultCapacity: 2, gapCapacity: 2, isSpecial: true, code: 'arcade', isActive: true, eventId: 'carnival', dayId: 'miercoles', orderIndex: 22 },
];

// Helper to format base display name reliably
export function getBaseDisplayName(base: number | string | undefined | null): string {
  if (base === undefined || base === null || base === '' || base === 'null' || base === 'undefined') return '';
  let s = String(base).trim();
  if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';

  const sLower = s.toLowerCase();
  if (sLower === '20' || sLower === '28' || sLower === 'toro' || sLower === 'base toro' || sLower === 'carnival_20' || sLower === 'carnival_28') return 'BASE TORO';
  if (sLower === '21' || sLower === '29' || sLower === 'speed' || sLower === 'speedway' || sLower === 'base speed' || sLower === 'base speedway' || sLower === 'carnival_21' || sLower === 'carnival_29') return 'BASE SPEED';
  if (sLower === '22' || sLower === '30' || sLower === 'arcade' || sLower === 'base arcade' || sLower === 'carnival_22' || sLower === 'carnival_30') return 'BASE ARCADE';

  // If matches "BASE X — Game Name" return as is
  if (/^BASE\s+\d+\s+—/i.test(s)) {
    return s.replace(/^base\s+(\d+)/i, (_, n) => `BASE ${n}`);
  }

  // Handle #01, #02, #1, etc.
  const hashMatch = s.match(/^#0?(\d+)$/);
  if (hashMatch) {
    const num = Number(hashMatch[1]);
    const found = CARNIVAL_PHYSICAL_BASES.find((b) => Number(b.id) === num);
    if (found) return found.name;
    return `BASE ${num}`;
  }

  const match = s.match(/(?:carnival|games_jueves|games_viernes)_(\d+)/i);
  if (match) {
    const num = Number(match[1]);
    if (num === 20 || num === 28) return 'BASE TORO';
    if (num === 21 || num === 29) return 'BASE SPEED';
    if (num === 22 || num === 30) return 'BASE ARCADE';
    const found = CARNIVAL_PHYSICAL_BASES.find((b) => Number(b.id) === num);
    if (found) return found.name;
    return `BASE ${num}`;
  }

  // Handle base_X (e.g. base_1, base_19)
  const numMatch = s.match(/^base_(\d{1,3})$/i);
  if (numMatch) {
    const num = Number(numMatch[1]);
    if (num === 20 || num === 28) return 'BASE TORO';
    if (num === 21 || num === 29) return 'BASE SPEED';
    if (num === 22 || num === 30) return 'BASE ARCADE';
    const found = CARNIVAL_PHYSICAL_BASES.find((b) => Number(b.id) === num);
    if (found) return found.name;
    return `BASE ${num}`;
  }

  // Plain number
  if (/^\d+$/.test(s)) {
    const num = Number(s);
    if (num === 20 || num === 28) return 'BASE TORO';
    if (num === 21 || num === 29) return 'BASE SPEED';
    if (num === 22 || num === 30) return 'BASE ARCADE';
    const found = CARNIVAL_PHYSICAL_BASES.find((b) => Number(b.id) === num);
    if (found) return found.name;
    return `BASE ${num}`;
  }

  // If already "Base X" convert to "BASE X"
  if (/^base\s+(\d+)$/i.test(s)) {
    const num = s.match(/^base\s+(\d+)$/i)?.[1];
    const found = CARNIVAL_PHYSICAL_BASES.find((b) => String(b.id) === num);
    if (found) return found.name;
    return `BASE ${num}`;
  }

  return s;
}

// 15 Physical Bases for The Games
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
}));

export const THE_GAMES_PHYSICAL_BASES: ConfigurableBase[] = [
  ...THE_GAMES_JUEVES_BASES,
  ...THE_GAMES_VIERNES_BASES,
];

export const DEFAULT_INITIAL_BASES: ConfigurableBase[] = [
  ...CARNIVAL_PHYSICAL_BASES.map((b) => ({
    id: 'carnival_' + b.id,
    name: b.name,
    baseNumber: String(b.id),
    baseLabel: b.baseLabel,
    gameName: b.gameName,
    defaultCapacity: b.defaultCapacity,
    gapCapacity: b.gapCapacity,
    capacity: b.defaultCapacity,
    isSpecial: b.isSpecial || false,
    isActive: true,
    eventId: 'carnival',
    dayId: 'miercoles',
    color: '#B83A24',
    orderIndex: Number(b.id) || 99,
  })),
  ...THE_GAMES_JUEVES_BASES,
  ...THE_GAMES_VIERNES_BASES,
];

// DEFAULT INITIAL EVENTS (Admin can edit, delete, or add new ones)
export const DEFAULT_INITIAL_EVENTS: AppEvent[] = [
  {
    id: 'the-show',
    name: 'THE SHOW',
    dayId: 'lunes',
    dayName: 'Lunes',
    description: 'Apertura y gran inauguración de Días EAFIT. Coordinación y soporte con equipo GRUPO DE TRABAJO (GT).',
    notes: '5 turnos programados para GRUPO DE TRABAJO (GT).',
    isActive: true,
    order: 1,
  },
  {
    id: 'the-zone',
    name: 'THE ZONE',
    dayId: 'martes',
    dayName: 'Martes',
    description: 'Zona de interacción, actividades interactivas en campus con equipo GRUPO DE TRABAJO (GT).',
    notes: '4 turnos GT y 1 Turno MESA (8:00 a. m. – 12:30 p. m.).',
    isActive: true,
    order: 2,
  },
  {
    id: 'carnival',
    name: 'CARNIVAL',
    dayId: 'miercoles',
    dayName: 'Miércoles',
    description: 'Día de actividades simultáneas en campus con equipo GRUPO DE TRABAJO (GT) y GAP.',
    notes: '5 turnos GT y 3 turnos GAP con 22 bases físicas oficiales.',
    isCarnival: true,
    isDivided: true,
    isActive: true,
    order: 3,
  },
  {
    id: 'the-challenge',
    name: 'THE CHALLENGE & THE GAMES',
    dayId: 'jueves',
    dayName: 'Jueves',
    description: 'Turno 1: The Challenge (GT). Turno 2: The Games (GT).',
    notes: '2 turnos programados para GRUPO DE TRABAJO (GT).',
    isDivided: false,
    isActive: true,
    order: 4,
  },
  {
    id: 'the-games',
    name: 'THE GAMES',
    dayId: 'viernes',
    dayName: 'Viernes',
    description: 'Gran final de competencias con equipo GRUPO DE TRABAJO (GT).',
    notes: 'Turno programado para GRUPO DE TRABAJO (GT).',
    isDivided: false,
    isActive: true,
    order: 5,
  },
];

// DEFAULT INITIAL SHIFTS (Editable by Admin)
export const DEFAULT_INITIAL_SHIFTS: ConfigurableShift[] = [
  // LUNES - THE SHOW (5 turnos GT)
  {
    id: 'lunes-t1',
    name: 'Turno 1',
    dayId: 'lunes',
    eventId: 'the-show',
    category: 'GT',
    startTime: '06:00',
    endTime: '08:00',
    label: '6:00 a. m. a 8:00 a. m.',
    capacity: 19,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'lunes-t2',
    name: 'Turno 2',
    dayId: 'lunes',
    eventId: 'the-show',
    category: 'GT',
    startTime: '08:00',
    endTime: '12:30',
    label: '8:00 a. m. a 12:30 p. m.',
    capacity: 30,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'lunes-t3',
    name: 'Turno 3',
    dayId: 'lunes',
    eventId: 'the-show',
    category: 'GT',
    startTime: '12:30',
    endTime: '16:00',
    label: '12:30 p. m. a 4:00 p. m.',
    capacity: 36,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'lunes-t4',
    name: 'Turno 4',
    dayId: 'lunes',
    eventId: 'the-show',
    category: 'GT',
    startTime: '16:00',
    endTime: '19:30',
    label: '4:00 p. m. a 7:30 p. m.',
    capacity: 36,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'lunes-t5',
    name: 'Turno 5',
    dayId: 'lunes',
    eventId: 'the-show',
    category: 'GT',
    startTime: '19:30',
    endTime: '22:30',
    label: '7:30 p. m. a 10:30 p. m.',
    capacity: 42,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },

  // MARTES - THE ZONE (4 turnos GT + Turno MESA)
  {
    id: 'martes-t1',
    name: 'Turno 1',
    dayId: 'martes',
    eventId: 'the-zone',
    category: 'GT',
    startTime: '08:30',
    endTime: '12:00',
    label: '8:30 a. m. – 12:00 p. m.',
    capacity: 50,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'martes-t2',
    name: 'Turno 2',
    dayId: 'martes',
    eventId: 'the-zone',
    category: 'GT',
    startTime: '12:30',
    endTime: '16:00',
    label: '12:30 p. m. – 4:00 p. m.',
    capacity: 50,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'martes-t3',
    name: 'Turno 3',
    dayId: 'martes',
    eventId: 'the-zone',
    category: 'GT',
    startTime: '16:00',
    endTime: '18:00',
    label: '4:00 p. m. – 6:00 p. m.',
    capacity: 50,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'martes-t4',
    name: 'Turno 4',
    dayId: 'martes',
    eventId: 'the-zone',
    category: 'GT',
    startTime: '18:00',
    endTime: '19:30',
    label: '6:00 p. m. – 7:30 p. m.',
    capacity: 19,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'shift_martes_mesa_mtqn17fi_ya2',
    name: 'Turno MESA',
    dayId: 'martes',
    eventId: 'the-zone',
    category: 'MESA',
    startTime: '08:00',
    endTime: '12:30',
    label: '8:00 a. m. – 12:30 p. m.',
    capacity: 18,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },

  // MIÉRCOLES - CARNIVAL (GT: 5 turnos)
  {
    id: 'miercoles-gt-t1',
    name: 'Turno 1',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GT',
    startTime: '06:50',
    endTime: '09:00',
    label: '6:50 a. m. a 9:00 a. m.',
    capacity: 19,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'miercoles-gt-t2',
    name: 'Turno 2',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GT',
    startTime: '08:50',
    endTime: '12:10',
    label: '8:50 a. m. a 12:10 p. m.',
    capacity: 50,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'miercoles-gt-t3',
    name: 'Turno 3',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GT',
    startTime: '12:00',
    endTime: '15:10',
    label: '12:00 m. a 3:10 p. m.',
    capacity: 50,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'miercoles-gt-t4',
    name: 'Turno 4',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GT',
    startTime: '15:00',
    endTime: '18:10',
    label: '3:00 p. m. a 6:10 p. m.',
    capacity: 50,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'miercoles-gt-t5',
    name: 'Turno 5',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GT',
    startTime: '18:00',
    endTime: '21:00',
    label: '6:00 p. m. a 9:00 p. m.',
    capacity: 19,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'shift_miercoles_mesa_mtqn2c1v_thu',
    name: 'Turno MESA',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'MESA',
    startTime: '06:30',
    endTime: '09:00',
    label: '6:30 a. m. – 9:00 a. m.',
    capacity: 18,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },

  // MIÉRCOLES - CARNIVAL GAP (3 turnos con 22 bases físicas oficiales)
  {
    id: 'miercoles-gap-t1',
    name: 'Turno 1',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GAP',
    startTime: '08:50',
    endTime: '12:10',
    label: '8:50 a. m. a 12:10 p. m.',
    capacity: 55,
    isActive: true,
    hasBases: true,
    forTypes: ['GAP'],
  },
  {
    id: 'miercoles-gap-t2',
    name: 'Turno 2',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GAP',
    startTime: '12:00',
    endTime: '15:10',
    label: '12:00 m. a 3:10 p. m.',
    capacity: 55,
    isActive: true,
    hasBases: true,
    forTypes: ['GAP'],
  },
  {
    id: 'miercoles-gap-t3',
    name: 'Turno 3',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GAP',
    startTime: '15:00',
    endTime: '18:10',
    label: '3:00 p. m. a 6:10 p. m.',
    capacity: 55,
    isActive: true,
    hasBases: true,
    forTypes: ['GAP'],
  },

  // JUEVES - THE CHALLENGE & THE GAMES (GT)
  {
    id: 'jueves-t1',
    name: 'Turno 1 — The Challenge',
    dayId: 'jueves',
    eventId: 'the-challenge',
    category: 'GT',
    startTime: '06:00',
    endTime: '13:00',
    label: '6:00 a. m. a 1:00 p. m.',
    capacity: 50,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
  {
    id: 'jueves-t2-gt',
    name: 'Turno 2 — The Games',
    dayId: 'jueves',
    eventId: 'the-challenge',
    category: 'GT',
    startTime: '13:00',
    endTime: '21:00',
    label: '1:00 p. m. a 9:00 p. m.',
    capacity: 50,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },

  // VIERNES - THE GAMES (GT)
  {
    id: 'viernes-gt',
    name: 'Turno 1',
    dayId: 'viernes',
    eventId: 'the-games',
    category: 'GT',
    startTime: '06:00',
    endTime: '21:30',
    label: '6:00 a. m. a 9:30 p. m.',
    capacity: 58,
    isActive: true,
    hasBases: false,
    forTypes: ['GT'],
  },
];

// DEFAULT INITIAL SUBTEAM REQUIREMENTS (Exact quotas requested by user)
export const DEFAULT_INITIAL_REQUIREMENTS: ShiftRequirement[] = [
  // LUNES - THE SHOW
  // Turno 1 (6:00 - 8:00, cap 19)
  { id: 'req_lunes_t1_log', dayId: 'lunes', shiftId: 'lunes-t1', groupType: 'GT', gtSubTeam: 'Logística', capacity: 17, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t1_rrpp', dayId: 'lunes', shiftId: 'lunes-t1', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 2, createdAt: new Date().toISOString() },
  // Turno 2 (8:00 - 12:30, cap 30)
  { id: 'req_lunes_t2_gen', dayId: 'lunes', shiftId: 'lunes-t2', groupType: 'GT', gtSubTeam: 'Generales', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t2_log', dayId: 'lunes', shiftId: 'lunes-t2', groupType: 'GT', gtSubTeam: 'Logística', capacity: 5, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t2_rrpp', dayId: 'lunes', shiftId: 'lunes-t2', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 4, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t2_mkt', dayId: 'lunes', shiftId: 'lunes-t2', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t2_gh', dayId: 'lunes', shiftId: 'lunes-t2', groupType: 'GT', gtSubTeam: 'GH', capacity: 4, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t2_seg', dayId: 'lunes', shiftId: 'lunes-t2', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 3, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t2_mesa', dayId: 'lunes', shiftId: 'lunes-t2', groupType: 'MESA', capacity: 18, createdAt: new Date().toISOString(), notes: 'MESA Directiva' },
  // Turno 3 (12:30 - 16:00, cap 36)
  { id: 'req_lunes_t3_gen', dayId: 'lunes', shiftId: 'lunes-t3', groupType: 'GT', gtSubTeam: 'Generales', capacity: 7, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t3_log', dayId: 'lunes', shiftId: 'lunes-t3', groupType: 'GT', gtSubTeam: 'Logística', capacity: 5, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t3_rrpp', dayId: 'lunes', shiftId: 'lunes-t3', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 4, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t3_mkt', dayId: 'lunes', shiftId: 'lunes-t3', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t3_gh', dayId: 'lunes', shiftId: 'lunes-t3', groupType: 'GT', gtSubTeam: 'GH', capacity: 4, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t3_seg', dayId: 'lunes', shiftId: 'lunes-t3', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 8, createdAt: new Date().toISOString() },
  // Turno 4 (16:00 - 19:30, cap 36)
  { id: 'req_lunes_t4_gen', dayId: 'lunes', shiftId: 'lunes-t4', groupType: 'GT', gtSubTeam: 'Generales', capacity: 7, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t4_log', dayId: 'lunes', shiftId: 'lunes-t4', groupType: 'GT', gtSubTeam: 'Logística', capacity: 5, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t4_rrpp', dayId: 'lunes', shiftId: 'lunes-t4', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 4, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t4_mkt', dayId: 'lunes', shiftId: 'lunes-t4', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t4_gh', dayId: 'lunes', shiftId: 'lunes-t4', groupType: 'GT', gtSubTeam: 'GH', capacity: 4, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t4_seg', dayId: 'lunes', shiftId: 'lunes-t4', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 8, createdAt: new Date().toISOString() },
  // Turno 5 (19:30 - 22:30, cap 42)
  { id: 'req_lunes_t5_gen', dayId: 'lunes', shiftId: 'lunes-t5', groupType: 'GT', gtSubTeam: 'Generales', capacity: 5, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t5_log', dayId: 'lunes', shiftId: 'lunes-t5', groupType: 'GT', gtSubTeam: 'Logística', capacity: 17, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t5_rrpp', dayId: 'lunes', shiftId: 'lunes-t5', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 2, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t5_mkt', dayId: 'lunes', shiftId: 'lunes-t5', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t5_gh', dayId: 'lunes', shiftId: 'lunes-t5', groupType: 'GT', gtSubTeam: 'GH', capacity: 2, createdAt: new Date().toISOString() },
  { id: 'req_lunes_t5_seg', dayId: 'lunes', shiftId: 'lunes-t5', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 8, createdAt: new Date().toISOString() },

  // MARTES - THE ZONE
  // Turno 1 (8:30 - 12:30, cap 50)
  { id: 'req_martes_t1_gen', dayId: 'martes', shiftId: 'martes-t1', groupType: 'GT', gtSubTeam: 'Generales', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_martes_t1_log', dayId: 'martes', shiftId: 'martes-t1', groupType: 'GT', gtSubTeam: 'Logística', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_martes_t1_rrpp', dayId: 'martes', shiftId: 'martes-t1', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_martes_t1_mkt', dayId: 'martes', shiftId: 'martes-t1', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_martes_t1_gh', dayId: 'martes', shiftId: 'martes-t1', groupType: 'GT', gtSubTeam: 'GH', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_martes_t1_seg', dayId: 'martes', shiftId: 'martes-t1', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 10, createdAt: new Date().toISOString() },
  // Turno 2 (12:30 - 16:00, cap 50)
  { id: 'req_martes_t2_gen', dayId: 'martes', shiftId: 'martes-t2', groupType: 'GT', gtSubTeam: 'Generales', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_martes_t2_log', dayId: 'martes', shiftId: 'martes-t2', groupType: 'GT', gtSubTeam: 'Logística', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_martes_t2_rrpp', dayId: 'martes', shiftId: 'martes-t2', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_martes_t2_mkt', dayId: 'martes', shiftId: 'martes-t2', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_martes_t2_gh', dayId: 'martes', shiftId: 'martes-t2', groupType: 'GT', gtSubTeam: 'GH', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_martes_t2_seg', dayId: 'martes', shiftId: 'martes-t2', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_martes_t2_mesa', dayId: 'martes', shiftId: 'martes-t2', groupType: 'MESA', capacity: 18, createdAt: new Date().toISOString(), notes: 'MESA Directiva' },
  // Turno 3 (16:00 - 19:30, cap 50)
  { id: 'req_martes_t3_gen', dayId: 'martes', shiftId: 'martes-t3', groupType: 'GT', gtSubTeam: 'Generales', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_martes_t3_log', dayId: 'martes', shiftId: 'martes-t3', groupType: 'GT', gtSubTeam: 'Logística', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_martes_t3_rrpp', dayId: 'martes', shiftId: 'martes-t3', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_martes_t3_mkt', dayId: 'martes', shiftId: 'martes-t3', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_martes_t3_gh', dayId: 'martes', shiftId: 'martes-t3', groupType: 'GT', gtSubTeam: 'GH', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_martes_t3_seg', dayId: 'martes', shiftId: 'martes-t3', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 10, createdAt: new Date().toISOString() },
  // Turno 4 (19:30 - 21:00, cap 19)
  { id: 'req_martes_t4_log', dayId: 'martes', shiftId: 'martes-t4', groupType: 'GT', gtSubTeam: 'Logística', capacity: 17, createdAt: new Date().toISOString() },
  { id: 'req_martes_t4_rrpp', dayId: 'martes', shiftId: 'martes-t4', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 2, createdAt: new Date().toISOString() },

  // MIÉRCOLES - CARNIVAL (GT)
  // Turno 1 (6:50 - 9:00, cap 19)
  { id: 'req_carnival_t1_log', dayId: 'miercoles', shiftId: 'miercoles-gt-t1', groupType: 'GT', gtSubTeam: 'Logística', capacity: 17, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t1_rrpp', dayId: 'miercoles', shiftId: 'miercoles-gt-t1', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 2, createdAt: new Date().toISOString() },
  // Turno 2 (8:50 - 12:10, cap 50)
  { id: 'req_carnival_t2_gen', dayId: 'miercoles', shiftId: 'miercoles-gt-t2', groupType: 'GT', gtSubTeam: 'Generales', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t2_log', dayId: 'miercoles', shiftId: 'miercoles-gt-t2', groupType: 'GT', gtSubTeam: 'Logística', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t2_rrpp', dayId: 'miercoles', shiftId: 'miercoles-gt-t2', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t2_mkt', dayId: 'miercoles', shiftId: 'miercoles-gt-t2', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t2_gh', dayId: 'miercoles', shiftId: 'miercoles-gt-t2', groupType: 'GT', gtSubTeam: 'GH', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t2_seg', dayId: 'miercoles', shiftId: 'miercoles-gt-t2', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t2_mesa', dayId: 'miercoles', shiftId: 'miercoles-gt-t2', groupType: 'MESA', capacity: 18, createdAt: new Date().toISOString(), notes: 'MESA Directiva' },
  // Turno 3 (12:00 - 15:10, cap 50)
  { id: 'req_carnival_t3_gen', dayId: 'miercoles', shiftId: 'miercoles-gt-t3', groupType: 'GT', gtSubTeam: 'Generales', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t3_log', dayId: 'miercoles', shiftId: 'miercoles-gt-t3', groupType: 'GT', gtSubTeam: 'Logística', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t3_rrpp', dayId: 'miercoles', shiftId: 'miercoles-gt-t3', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t3_mkt', dayId: 'miercoles', shiftId: 'miercoles-gt-t3', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t3_gh', dayId: 'miercoles', shiftId: 'miercoles-gt-t3', groupType: 'GT', gtSubTeam: 'GH', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t3_seg', dayId: 'miercoles', shiftId: 'miercoles-gt-t3', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t3_mesa', dayId: 'miercoles', shiftId: 'miercoles-gt-t3', groupType: 'MESA', capacity: 18, createdAt: new Date().toISOString(), notes: 'MESA Directiva' },
  // Turno 4 (15:00 - 18:10, cap 50)
  { id: 'req_carnival_t4_gen', dayId: 'miercoles', shiftId: 'miercoles-gt-t4', groupType: 'GT', gtSubTeam: 'Generales', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t4_log', dayId: 'miercoles', shiftId: 'miercoles-gt-t4', groupType: 'GT', gtSubTeam: 'Logística', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t4_rrpp', dayId: 'miercoles', shiftId: 'miercoles-gt-t4', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t4_mkt', dayId: 'miercoles', shiftId: 'miercoles-gt-t4', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t4_gh', dayId: 'miercoles', shiftId: 'miercoles-gt-t4', groupType: 'GT', gtSubTeam: 'GH', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t4_seg', dayId: 'miercoles', shiftId: 'miercoles-gt-t4', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 10, createdAt: new Date().toISOString() },
  // Turno 5 (18:00 - 21:00, cap 19)
  { id: 'req_carnival_t5_log', dayId: 'miercoles', shiftId: 'miercoles-gt-t5', groupType: 'GT', gtSubTeam: 'Logística', capacity: 17, createdAt: new Date().toISOString() },
  { id: 'req_carnival_t5_rrpp', dayId: 'miercoles', shiftId: 'miercoles-gt-t5', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 2, createdAt: new Date().toISOString() },
  // Turno MESA Carnival (6:30 - 9:00, cap 18)
  { id: 'req_carnival_mesa_t1', dayId: 'miercoles', shiftId: 'shift_miercoles_mesa_mtqn2c1v_thu', groupType: 'MESA', capacity: 18, createdAt: new Date().toISOString(), notes: 'MESA Directiva (6:30 a. m. – 9:00 a. m.)' },

  // JUEVES - THE CHALLENGE + THE GAMES
  // Turno 1 — The Challenge (6:00 - 13:00, cap 50)
  { id: 'req_jueves_t1_gen', dayId: 'jueves', shiftId: 'jueves-t1', groupType: 'GT', gtSubTeam: 'Generales', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_jueves_t1_log', dayId: 'jueves', shiftId: 'jueves-t1', groupType: 'GT', gtSubTeam: 'Logística', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_jueves_t1_rrpp', dayId: 'jueves', shiftId: 'jueves-t1', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_jueves_t1_mkt', dayId: 'jueves', shiftId: 'jueves-t1', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_jueves_t1_gh', dayId: 'jueves', shiftId: 'jueves-t1', groupType: 'GT', gtSubTeam: 'GH', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_jueves_t1_seg', dayId: 'jueves', shiftId: 'jueves-t1', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_jueves_t1_mesa', dayId: 'jueves', shiftId: 'jueves-t1', groupType: 'MESA', capacity: 18, createdAt: new Date().toISOString(), notes: 'MESA Directiva' },
  // Turno 2 — The Games GT (13:00 - 21:00, cap 50)
  { id: 'req_jueves_t2_gen', dayId: 'jueves', shiftId: 'jueves-t2-gt', groupType: 'GT', gtSubTeam: 'Generales', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_jueves_t2_log', dayId: 'jueves', shiftId: 'jueves-t2-gt', groupType: 'GT', gtSubTeam: 'Logística', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_jueves_t2_rrpp', dayId: 'jueves', shiftId: 'jueves-t2-gt', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_jueves_t2_mkt', dayId: 'jueves', shiftId: 'jueves-t2-gt', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_jueves_t2_gh', dayId: 'jueves', shiftId: 'jueves-t2-gt', groupType: 'GT', gtSubTeam: 'GH', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_jueves_t2_seg', dayId: 'jueves', shiftId: 'jueves-t2-gt', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_jueves_t2_mesa', dayId: 'jueves', shiftId: 'jueves-t2-gt', groupType: 'MESA', capacity: 18, createdAt: new Date().toISOString(), notes: 'MESA Directiva' },

  // VIERNES - THE GAMES (Turno 1: 6:00 - 21:30, cap 58)
  { id: 'req_viernes_gen', dayId: 'viernes', shiftId: 'viernes-gt', groupType: 'GT', gtSubTeam: 'Generales', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_viernes_log', dayId: 'viernes', shiftId: 'viernes-gt', groupType: 'GT', gtSubTeam: 'Logística', capacity: 18, createdAt: new Date().toISOString() },
  { id: 'req_viernes_rrpp', dayId: 'viernes', shiftId: 'viernes-gt', groupType: 'GT', gtSubTeam: 'RRPP', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_viernes_mkt', dayId: 'viernes', shiftId: 'viernes-gt', groupType: 'GT', gtSubTeam: 'Mercadeo', capacity: 8, createdAt: new Date().toISOString() },
  { id: 'req_viernes_gh', dayId: 'viernes', shiftId: 'viernes-gt', groupType: 'GT', gtSubTeam: 'GH', capacity: 6, createdAt: new Date().toISOString() },
  { id: 'req_viernes_seg', dayId: 'viernes', shiftId: 'viernes-gt', groupType: 'GT', gtSubTeam: 'Seguridad', capacity: 10, createdAt: new Date().toISOString() },
  { id: 'req_viernes_mesa', dayId: 'viernes', shiftId: 'viernes-gt', groupType: 'MESA', capacity: 18, createdAt: new Date().toISOString(), notes: 'MESA Directiva' },
];

// Backward-compatible shift lists
export const CARNIVAL_GT_SHIFTS: Shift[] = DEFAULT_INITIAL_SHIFTS.filter(
  (s) => s.dayId === 'miercoles' && s.category === 'GT'
);

export const CARNIVAL_GAP_SHIFTS: Shift[] = DEFAULT_INITIAL_SHIFTS.filter(
  (s) => s.dayId === 'miercoles' && s.category === 'GAP'
);

export const CARNIVAL_MESA_SHIFTS: Shift[] = DEFAULT_INITIAL_SHIFTS.filter(
  (s) => s.dayId === 'miercoles' && s.category === 'MESA'
);

// Backward-compatible EVENT_SCHEDULE
export const EVENT_SCHEDULE: EventDayDefinition[] = DEFAULT_INITIAL_EVENTS.map((event) => ({
  dayId: event.dayId,
  dayName: event.dayName,
  eventName: event.name,
  description: event.description || '',
  notes: event.notes,
  isCarnival: event.isCarnival,
  isDivided: event.isDivided,
  physicalBasesCount: event.isCarnival ? 30 : event.id.includes('games') ? 15 : undefined,
  shifts: DEFAULT_INITIAL_SHIFTS.filter((s) => s.dayId === event.dayId),
}));

// Helper to find shift by ID with legacy alias support
export function findShiftById(
  dayDefOrShifts: EventDayDefinition | ConfigurableShift[],
  shiftId: string
): Shift | undefined {
  const shifts: ConfigurableShift[] = Array.isArray(dayDefOrShifts)
    ? dayDefOrShifts
    : dayDefOrShifts?.shifts || [];

  const direct = shifts.find((s) => s.id === shiftId);
  if (direct) return direct;

  // Legacy aliases
  if (shiftId === 'miercoles-t1') {
    return shifts.find((s) => s.id === 'miercoles-gt-t1');
  }
  if (shiftId === 'miercoles-gap-t1' || shiftId === 'miercoles-t2') {
    return shifts.find((s) => s.id === 'miercoles-gap-t1') || shifts.find((s) => s.id === 'miercoles-gt-t2');
  }
  if (shiftId === 'miercoles-gap-t2' || shiftId === 'miercoles-t3') {
    return shifts.find((s) => s.id === 'miercoles-gap-t2') || shifts.find((s) => s.id === 'miercoles-gt-t3');
  }
  if (shiftId === 'miercoles-gap-t3' || shiftId === 'miercoles-t4') {
    return shifts.find((s) => s.id === 'miercoles-gap-t3') || shifts.find((s) => s.id === 'miercoles-gt-t4');
  }
  if (shiftId === 'miercoles-t5') return shifts.find((s) => s.id === 'miercoles-gt-t5');
  if (
    shiftId === 'jueves-t2-gt' ||
    shiftId === 'shift_jueves_mtqcifm4_nt5' ||
    shiftId === 'jueves-t2' ||
    shiftId === 'shift_jueves_gap_mtrxwlwl_l9j'
  ) {
    const s = shifts.find((x) => x.id === 'jueves-t2-gt' || x.id === shiftId);
    if (s) return s;
  }
  if (shiftId === 'jueves-t1' || shiftId === 'shift_jueves_gt_mtrxjh9q_r2t') {
    const s = shifts.find((x) => x.id === 'jueves-t1' || x.id === shiftId);
    if (s) return s;
  }
  if (shiftId === 'viernes-gap' || shiftId === 'viernes-gt') {
    const s = shifts.find((x) => x.id === 'viernes-gt' || x.id === shiftId);
    if (s) return s;
  }

  // Fallback to DEFAULT_INITIAL_SHIFTS if not in passed shifts
  const defaultDirect = DEFAULT_INITIAL_SHIFTS.find((s) => s.id === shiftId);
  if (defaultDirect) return defaultDirect;

  // Fallback for custom or dynamic MESA shifts (e.g. shift_lunes_mesa_..., shift_jueves_mesa_..., shift_viernes_mesa_...)
  if (shiftId && shiftId.startsWith('shift_')) {
    const sid = shiftId.toLowerCase();
    const isMesa = sid.includes('mesa');
    if (sid.includes('lunes')) {
      const match = shifts.find((s) => s.dayId === 'lunes' && (isMesa ? s.category === 'MESA' : true));
      if (match) return match;
      return {
        id: shiftId,
        name: isMesa ? 'Turno 1 — MESA' : 'Turno 1',
        dayId: 'lunes',
        eventId: 'the-show',
        category: (isMesa ? 'MESA' : 'GT') as any,
        startTime: '06:00',
        endTime: '08:00',
        label: '6:00 a. m. a 8:00 a. m.',
        capacity: 10,
        isActive: true,
      };
    }
    if (sid.includes('martes')) {
      const match = shifts.find((s) => s.dayId === 'martes' && (isMesa ? s.category === 'MESA' || s.id.includes('mesa') : true));
      if (match) return match;
      return {
        id: shiftId,
        name: isMesa ? 'Turno MESA' : 'Turno 1',
        dayId: 'martes',
        eventId: 'the-zone',
        category: (isMesa ? 'MESA' : 'GT') as any,
        startTime: isMesa ? '08:00' : '08:30',
        endTime: isMesa ? '12:30' : '12:00',
        label: isMesa ? '8:00 a. m. – 12:30 p. m.' : '8:30 a. m. – 12:00 p. m.',
        capacity: isMesa ? 18 : 50,
        isActive: true,
      };
    }
    if (sid.includes('miercoles')) {
      const match = shifts.find((s) => s.dayId === 'miercoles' && (isMesa ? s.category === 'MESA' : true));
      if (match) return match;
      return {
        id: shiftId,
        name: isMesa ? 'Turno 1 — Carnival (MESA)' : 'Turno 1',
        dayId: 'miercoles',
        eventId: 'carnival',
        category: (isMesa ? 'MESA' : 'GT') as any,
        startTime: '06:00',
        endTime: '10:00',
        label: '6:00 a. m. a 10:00 a. m.',
        capacity: 10,
        isActive: true,
      };
    }
    if (sid.includes('jueves')) {
      const match = shifts.find((s) => s.dayId === 'jueves' && (isMesa ? s.category === 'MESA' : true));
      if (match) return match;
      return {
        id: shiftId,
        name: isMesa ? 'Turno 1 — The Challenge (MESA)' : 'Turno 1 — The Challenge',
        dayId: 'jueves',
        eventId: 'the-challenge',
        category: (isMesa ? 'MESA' : 'GT') as any,
        startTime: '06:00',
        endTime: '13:00',
        label: '6:00 a. m. a 1:00 p. m.',
        capacity: 10,
        isActive: true,
      };
    }
    if (sid.includes('viernes')) {
      const match = shifts.find((s) => s.dayId === 'viernes' && (isMesa ? s.category === 'MESA' : true));
      if (match) return match;
      return {
        id: shiftId,
        name: isMesa ? 'Turno 1 — The Games (MESA)' : 'Turno 1 — The Games',
        dayId: 'viernes',
        eventId: 'the-games',
        category: (isMesa ? 'MESA' : 'GT') as any,
        startTime: '06:00',
        endTime: '21:30',
        label: '6:00 a. m. a 9:30 p. m.',
        capacity: 10,
        isActive: true,
      };
    }
  }

  return undefined;
}

export function calculateDurationHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const diff = endMins - startMins;
  return diff > 0 ? diff / 60 : 0;
}

export function areBasesEqual(
  baseA: string | number | undefined | null,
  baseB: string | number | undefined | null,
  nameA?: string,
  nameB?: string
): boolean {
  if (baseA === undefined || baseA === null || baseB === undefined || baseB === null) {
    if (nameA && nameB && nameA.toLowerCase().trim() === nameB.toLowerCase().trim()) return true;
    return false;
  }
  const cleanA = String(baseA).toLowerCase().replace(/^(?:carnival_|games_jueves_|games_viernes_|base[_-]?)/, '').trim();
  const cleanB = String(baseB).toLowerCase().replace(/^(?:carnival_|games_jueves_|games_viernes_|base[_-]?)/, '').trim();
  if (cleanA && cleanA === cleanB) return true;

  // Handle special bases aliases (20/toro, 21/speed/speedway, 22/arcade)
  const isToroA = cleanA === '20' || cleanA === '28' || cleanA === 'toro' || cleanA.includes('toro') || nameA?.toLowerCase().includes('toro');
  const isToroB = cleanB === '20' || cleanB === '28' || cleanB === 'toro' || cleanB.includes('toro') || nameB?.toLowerCase().includes('toro');
  if (isToroA && isToroB) return true;

  const isSpeedA = cleanA === '21' || cleanA === '29' || cleanA === 'speed' || cleanA === 'speedway' || cleanA.includes('speed') || nameA?.toLowerCase().includes('speed');
  const isSpeedB = cleanB === '21' || cleanB === '29' || cleanB === 'speed' || cleanB === 'speedway' || cleanB.includes('speed') || nameB?.toLowerCase().includes('speed');
  if (isSpeedA && isSpeedB) return true;

  const isArcadeA = cleanA === '22' || cleanA === '30' || cleanA === 'arcade' || cleanA.includes('arcade') || nameA?.toLowerCase().includes('arcade');
  const isArcadeB = cleanB === '22' || cleanB === '30' || cleanB === 'arcade' || cleanB.includes('arcade') || nameB?.toLowerCase().includes('arcade');
  if (isArcadeA && isArcadeB) return true;

  if (nameA && nameB && nameA.toLowerCase().trim() === nameB.toLowerCase().trim()) return true;
  return false;
}

export function doShiftsOverlap(shiftA: Shift, shiftB: Shift, bufferMinutes: number = 20): boolean {
  if (shiftA.id === shiftB.id) return true;
  // Explicitly allow consecutive Carnival GAP shifts (T1: 8:50-12:10, T2: 12:00-15:10, T3: 15:00-18:10)
  const isGapA = shiftA.id.includes('gap') || shiftA.name.toLowerCase().includes('gap') || shiftA.category === 'GAP';
  const isGapB = shiftB.id.includes('gap') || shiftB.name.toLowerCase().includes('gap') || shiftB.category === 'GAP';
  const isCarnivalA = shiftA.id.includes('carnival') || shiftA.id.includes('miercoles') || shiftA.dayId === 'miercoles';
  const isCarnivalB = shiftB.id.includes('carnival') || shiftB.dayId === 'miercoles';
  if (isCarnivalA && isCarnivalB && isGapA && isGapB) {
    // If they are different turns (e.g. T1 and T2), they don't block each other due to the 10 min overlap
    return false;
  }

  const [s1h, s1m] = shiftA.startTime.split(':').map(Number);
  const [e1h, e1m] = shiftA.endTime.split(':').map(Number);
  const [s2h, s2m] = shiftB.startTime.split(':').map(Number);
  const [e2h, e2m] = shiftB.endTime.split(':').map(Number);
  if (isNaN(s1h) || isNaN(s1m) || isNaN(e1h) || isNaN(e1m) || isNaN(s2h) || isNaN(s2m) || isNaN(e2h) || isNaN(e2m)) {
    return false;
  }
  const start1 = s1h * 60 + s1m;
  const end1 = e1h * 60 + e1m;
  const start2 = s2h * 60 + s2m;
  const end2 = e2h * 60 + e2m;
  const overlapMinutes = Math.min(end1, end2) - Math.max(start1, start2);
  // Transitions between consecutive shifts (e.g. 10 or 15 mins relay handover) do not constitute a conflicting overlap
  return overlapMinutes > bufferMinutes;
}

export function getShiftDurationMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return Math.max(0, end - start);
}

