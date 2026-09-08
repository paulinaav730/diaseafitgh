import { AppEvent, ConfigurableBase, ConfigurableShift, EventDayDefinition, PhysicalBase, Shift } from '../types';

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

// 30 Physical Bases for Carnival: 27 numbered bases + Base Toro + Base Speedway + Base Arcade
export const CARNIVAL_PHYSICAL_BASES: PhysicalBase[] = [
  ...Array.from({ length: 27 }, (_, i) => ({
    id: i + 1,
    name: `Base ${i + 1}`,
    code: `base-${i + 1}`,
    defaultCapacity: 2,
    isSpecial: false,
    isActive: true,
    eventId: 'carnival',
  })),
  { id: 28, code: 'toro', name: 'Base Toro', defaultCapacity: 2, isSpecial: true, isActive: true, eventId: 'carnival' },
  { id: 29, code: 'speedway', name: 'Base Speedway', defaultCapacity: 2, isSpecial: true, isActive: true, eventId: 'carnival' },
  { id: 30, code: 'arcade', name: 'Base Arcade', defaultCapacity: 2, isSpecial: true, isActive: true, eventId: 'carnival' },
];

// Helper to format base display name reliably
export function getBaseDisplayName(base: number | string | undefined | null): string {
  if (base === undefined || base === null || base === '' || base === 'null' || base === 'undefined') return '';
  const s = String(base).trim();
  if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
  if (s === '28' || s.toLowerCase() === 'toro' || s.toLowerCase() === 'base toro' || s === 'carnival_28') return 'Base Toro';
  if (s === '29' || s.toLowerCase() === 'speedway' || s.toLowerCase() === 'base speedway' || s === 'carnival_29') return 'Base Speedway';
  if (s === '30' || s.toLowerCase() === 'arcade' || s.toLowerCase() === 'base arcade' || s === 'carnival_30') return 'Base Arcade';
  if (s.toLowerCase().startsWith('base ')) return s;
  const match = s.match(/(?:carnival|games_jueves|games_viernes)_(\d+)/i);
  if (match) {
    const num = Number(match[1]);
    if (num === 28) return 'Base Toro';
    if (num === 29) return 'Base Speedway';
    if (num === 30) return 'Base Arcade';
    return `Base ${num}`;
  }
  return `Base ${s}`;
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
    defaultCapacity: b.defaultCapacity,
    capacity: b.defaultCapacity,
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
    notes: '4 turnos programados para GRUPO DE TRABAJO (GT).',
    isActive: true,
    order: 2,
  },
  {
    id: 'carnival',
    name: 'CARNIVAL',
    dayId: 'miercoles',
    dayName: 'Miércoles',
    description: 'Día de actividades simultáneas. Estructura diferenciada: GRUPO DE TRABAJO (GT) con 5 turnos y GRUPO DE APOYO (GAP) con 3 turnos en 30 bases físicas únicas.',
    notes: 'CARNIVAL GT: 5 turnos (6:50 AM – 9:00 PM). CARNIVAL GAP: 3 turnos (8:50 AM – 6:10 PM) con 30 bases físicas (Base 1-27 + Toro, Speedway, Arcade). MESA: Asignable a cualquier turno.',
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
      description: 'Mañana: The Challenge (GT). Tarde: The Games (GAP)',
      notes: 'Turno T1: GT. Turno T2: GAP.',
      isDivided: false,
    isActive: true,
    order: 4,
  },
  {
    id: 'the-games',
    name: 'THE GAMES',
    dayId: 'viernes',
    dayName: 'Viernes',
    description: 'Gran final de competencias. Equipo GRUPO DE TRABAJO (GT) todo el día y 15 bases físicas GRUPO DE APOYO (GAP).',
    notes: 'GAP opera en 15 bases físicas. GT da soporte de 6:00 AM a 9:30 PM.',
    isDivided: true,
    isActive: true,
    order: 5,
  },
];

// DEFAULT INITIAL SHIFTS (Editable by Admin)
export const DEFAULT_INITIAL_SHIFTS: ConfigurableShift[] = [
  // LUNES - THE SHOW (5 turnos GT)
  {
    id: 'lunes-t1',
    name: 'T1',
    dayId: 'lunes',
    eventId: 'the-show',
    category: 'GT',
    startTime: '06:00',
    endTime: '08:00',
    label: '6:00 AM – 8:00 AM',
    capacity: 10,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'lunes-t2',
    name: 'T2',
    dayId: 'lunes',
    eventId: 'the-show',
    category: 'GT',
    startTime: '08:00',
    endTime: '12:30',
    label: '8:00 AM – 12:30 PM',
    capacity: 12,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'lunes-t3',
    name: 'T3',
    dayId: 'lunes',
    eventId: 'the-show',
    category: 'GT',
    startTime: '12:30',
    endTime: '16:00',
    label: '12:30 PM – 4:00 PM',
    capacity: 12,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'lunes-t4',
    name: 'T4',
    dayId: 'lunes',
    eventId: 'the-show',
    category: 'GT',
    startTime: '16:00',
    endTime: '19:30',
    label: '4:00 PM – 7:30 PM',
    capacity: 12,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'lunes-t5',
    name: 'T5',
    dayId: 'lunes',
    eventId: 'the-show',
    category: 'GT',
    startTime: '19:30',
    endTime: '22:30',
    label: '7:30 PM – 10:30 PM',
    capacity: 10,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },

  // MARTES - THE ZONE (4 turnos GT)
  {
    id: 'martes-t1',
    name: 'T1',
    dayId: 'martes',
    eventId: 'the-zone',
    category: 'GT',
    startTime: '08:30',
    endTime: '12:30',
    label: '8:30 AM – 12:30 PM',
    capacity: 12,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'martes-t2',
    name: 'T2',
    dayId: 'martes',
    eventId: 'the-zone',
    category: 'GT',
    startTime: '12:30',
    endTime: '16:00',
    label: '12:30 PM – 4:00 PM',
    capacity: 12,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'martes-t3',
    name: 'T3',
    dayId: 'martes',
    eventId: 'the-zone',
    category: 'GT',
    startTime: '16:00',
    endTime: '18:00',
    label: '4:00 PM – 6:00 PM',
    capacity: 12,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'martes-t4',
    name: 'T4',
    dayId: 'martes',
    eventId: 'the-zone',
    category: 'GT',
    startTime: '18:00',
    endTime: '19:30',
    label: '6:00 PM – 7:30 PM',
    capacity: 12,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },

  // MIÉRCOLES - CARNIVAL (GT: 5 turnos)
  {
    id: 'miercoles-gt-t1',
    name: 'T1',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GT',
    startTime: '06:50',
    endTime: '09:00',
    label: '6:50 AM – 9:00 AM',
    capacity: 15,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'miercoles-gt-t2',
    name: 'T2',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GT',
    startTime: '08:50',
    endTime: '12:10',
    label: '8:50 AM – 12:10 PM',
    capacity: 15,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'miercoles-gt-t3',
    name: 'T3',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GT',
    startTime: '12:00',
    endTime: '15:10',
    label: '12:00 PM – 3:10 PM',
    capacity: 15,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'miercoles-gt-t4',
    name: 'T4',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GT',
    startTime: '15:00',
    endTime: '18:10',
    label: '3:00 PM – 6:10 PM',
    capacity: 15,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'miercoles-gt-t5',
    name: 'T5',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GT',
    startTime: '18:00',
    endTime: '21:00',
    label: '6:00 PM – 9:00 PM',
    capacity: 15,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },

  // MIÉRCOLES - CARNIVAL (GAP: 3 turnos con 30 bases)
  {
    id: 'miercoles-gap-t1',
    name: 'T1',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GAP',
    startTime: '08:50',
    endTime: '12:10',
    label: '8:50 AM – 12:10 PM',
    capacity: 60, // 30 bases x 2
    isActive: true,
    hasBases: true,
    forTypes: ['GAP', 'GT', 'MESA'],
  },
  {
    id: 'miercoles-gap-t2',
    name: 'T2',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GAP',
    startTime: '12:00',
    endTime: '15:10',
    label: '12:00 PM – 3:10 PM',
    capacity: 60, // 30 bases x 2
    isActive: true,
    hasBases: true,
    forTypes: ['GAP', 'GT', 'MESA'],
  },
  {
    id: 'miercoles-gap-t3',
    name: 'T3',
    dayId: 'miercoles',
    eventId: 'carnival',
    category: 'GAP',
    startTime: '15:00',
    endTime: '18:10',
    label: '3:00 PM – 6:10 PM',
    capacity: 60, // 30 bases x 2
    isActive: true,
    hasBases: true,
    forTypes: ['GAP', 'GT', 'MESA'],
  },

  // JUEVES - THE CHALLENGE & THE GAMES
  {
    id: 'jueves-t1',
    name: 'T1 - Mañana GAP',
    dayId: 'jueves',
    eventId: 'the-challenge',
    category: 'GAP',
    startTime: '06:00',
    endTime: '12:00',
    label: '6:00 AM – 12:00 PM (Solo GAP)',
    capacity: 15,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'jueves-t2',
    name: 'T2 - The Games (GAP)',
    dayId: 'jueves',
    eventId: 'the-challenge',
    category: 'GAP',
    startTime: '13:00',
    endTime: '21:00',
    label: '1:00 PM – 9:00 PM (The Games)',
    capacity: 30, // 15 bases x 2
    isActive: true,
    hasBases: true,
    forTypes: ['GAP', 'GT', 'MESA'],
  },
  {
    id: 'jueves-t2-gt',
    name: 'T2 - The Games (GT)',
    dayId: 'jueves',
    eventId: 'the-challenge',
    category: 'GT',
    startTime: '13:00',
    endTime: '21:00',
    label: '1:00 PM – 9:00 PM (GT)',
    capacity: 25,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },

  // VIERNES - THE GAMES
  {
    id: 'viernes-gt',
    name: 'T1 - GT General',
    dayId: 'viernes',
    eventId: 'the-games',
    category: 'GT',
    startTime: '06:00',
    endTime: '21:30',
    label: 'GT: 6:00 AM – 9:30 PM',
    capacity: 25,
    isActive: true,
    hasBases: false,
    forTypes: ['GT', 'MESA'],
  },
  {
    id: 'viernes-gap',
    name: 'T1 - GAP Bases',
    dayId: 'viernes',
    eventId: 'the-games',
    category: 'GAP',
    startTime: '07:00',
    endTime: '21:00',
    label: 'GAP: 7:00 AM – 9:00 PM (15 bases)',
    capacity: 30, // 15 bases x 2
    isActive: true,
    hasBases: true,
    forTypes: ['GAP', 'GT', 'MESA'],
  },
];

// Backward-compatible shift lists
export const CARNIVAL_GT_SHIFTS: Shift[] = DEFAULT_INITIAL_SHIFTS.filter(
  (s) => s.dayId === 'miercoles' && s.category === 'GT'
);

export const CARNIVAL_GAP_SHIFTS: Shift[] = DEFAULT_INITIAL_SHIFTS.filter(
  (s) => s.dayId === 'miercoles' && s.category === 'GAP'
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
  if (shiftId === 'miercoles-t1') return shifts.find((s) => s.id === 'miercoles-gap-t1');
  if (shiftId === 'miercoles-t2') return shifts.find((s) => s.id === 'miercoles-gap-t2');
  if (shiftId === 'miercoles-t3') return shifts.find((s) => s.id === 'miercoles-gap-t3');
  if (shiftId === 'jueves-t2-gt' || shiftId === 'shift_jueves_mtqcifm4_nt5' || shiftId === 'jueves-t2' || shiftId === 'shift_jueves_gap_mtrxwlwl_l9j') {
    const s = shifts.find((x) => x.id === shiftId || x.id === 'shift_jueves_mtqcifm4_nt5' || x.id === 'shift_jueves_gap_mtrxwlwl_l9j' || x.id === 'jueves-t2-gt' || x.id === 'jueves-t2');
    if (s) return s;
  }
  if (shiftId === 'jueves-t1' || shiftId === 'shift_jueves_gt_mtrxjh9q_r2t') {
    const s = shifts.find((x) => x.id === shiftId || x.id === 'shift_jueves_gt_mtrxjh9q_r2t' || x.id === 'jueves-t1');
    if (s) return s;
  }

  // Fallback to DEFAULT_INITIAL_SHIFTS if not in passed shifts
  const defaultDirect = DEFAULT_INITIAL_SHIFTS.find((s) => s.id === shiftId);
  if (defaultDirect) return defaultDirect;

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

export function doShiftsOverlap(shiftA: Shift, shiftB: Shift): boolean {
  if (shiftA.id === shiftB.id) return true;
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
  return Math.max(start1, start2) < Math.min(end1, end2);
}
