// GT = GRUPO DE TRABAJO
// GAP = GRUPO DE APOYO
// MESA = MESA
export type PersonType = 'GT' | 'GAP' | 'MESA';

export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  GT: 'GRUPO DE TRABAJO (GT)',
  GAP: 'GRUPO DE APOYO (GAP)',
  MESA: 'MESA',
};

export const PERSON_TYPE_SHORT_LABELS: Record<PersonType, string> = {
  GT: 'Grupo de Trabajo',
  GAP: 'Grupo de Apoyo',
  MESA: 'MESA',
};

export type GtSubTeam =
  | 'Generales'
  | 'Finanzas'
  | 'Logística'
  | 'RRPP'
  | 'GH'
  | 'Mercadeo'
  | 'Seguridad'
  | 'Carnival'
  | 'The Games';

export interface GroupFunction {
  id: string;
  name: string;
  category: PersonType; // 'GT' (GRUPO DE TRABAJO) | 'GAP' (GRUPO DE APOYO) | 'MESA'
  gtSubTeam?: GtSubTeam; // defined if category === 'GT'
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ShiftRequirement {
  id: string;
  dayId: string;
  shiftId: string;
  groupType: PersonType; // 'GT' (GRUPO DE TRABAJO) | 'GAP' (GRUPO DE APOYO) | 'MESA'
  gtSubTeam?: GtSubTeam; // e.g. 'Logística' (if groupType === 'GT')
  baseNumber?: number | string; // e.g. Base Toro or Base 1 (optional for GAP)
  capacity: number; // e.g. 10 personas
  specificFunctions?: string[]; // array of function names (OPCIONAL filter)
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AttendanceStatus =
  | 'pendiente'
  | 'asistio'
  | 'tarde'
  | 'inasistencia'
  | 'retiro_antes';

export type UserRole = 'admin' | 'staff';

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: 'admin';
}

export interface CurrentUser {
  role: UserRole;
  /** Sesión emitida por el servidor (Supabase). Sin ella no se pueden hacer acciones protegidas. */
  sessionToken?: string;
  sessionExpiresAt?: string;
  adminData?: AdminUser;
  staffData?: Person;
}

export interface Person {
  id: string; // UUID in Supabase/Storage
  name: string;
  fullName?: string; // Nombre completo (Nombre y documento/identificación)
  documentId: string; // Documento de identidad / Cédula
  username?: string; // Individual Staff username (e.g. "aleja123")
  email: string; // Correo electrónico
  phone?: string; // Número de celular
  institutionalEmail?: string; // Correo institucional
  epikId?: string; // ID de EPIK
  externalExcelId?: string; // ID from Excel Maestro (col 1, not primary key)
  startTimeExcel?: string; // Hora de inicio del Excel (col 2)
  endTimeExcel?: string; // Hora de finalización del Excel (col 3)
  primaryType: PersonType; // GT (GRUPO DE TRABAJO), GAP (GRUPO DE APOYO), or MESA
  alsoActsAsGap?: boolean; // GT que también actúa o aparece de GAP (ej: Miércoles, Jueves y Viernes GAP Generales)
  gapRoleDescription?: string; // Descripción del rol o días de GAP (ej: "GAP Generales (Miércoles, Jueves y Viernes)")
  gtTeams?: string[]; // Multiple GT teams: e.g. ["Logística", "Seguridad"]
  gtSubTeam?: GtSubTeam; // Main GT sub-team if GT
  functions?: string[]; // Multiple functions: e.g. ["Montaje", "Apoyo logístico"]
  roleTitle?: string; // e.g. "Coordinador", "Líder de Base", "Staff"
  shirtSize?: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | string; // Talla de camiseta
  shirtDelivered?: boolean; // Estado de entrega de camisetas (true si se completó la cuota)
  shirtDeliveredCount?: number; // Cantidad de camisetas entregadas (MESA: 0, 1 o 2; GT/GAP: 0 o 1)
  shirtDeliveredAt?: string; // Fecha y hora ISO de la entrega
  shirtDeliveredBy?: string; // Nombre o identificador de quién entregó la(s) camiseta(s)
  shirtDeliveryNotes?: string; // Observaciones de entrega (ej. cambio de talla, etc.)
  foodAllergies?: string; // Alergias alimentarias (ej. Maní, Mariscos, Ninguna)
  dietaryRestrictions?: string; // Restricción de comidas (ej. Vegetariana, Vegana, Celíaca, Ninguna)
  medicalConditions?: string; // Algún tipo de enfermedad o condición médica (ej. Asma, Diabetes, Ninguna)
  notes?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Regla oficial DÍAS 2027:
 * MESA recibe 2 camisetas ("MESA SON DOS")
 * GT y GAP reciben 1 camiseta
 */
export function getPersonShirtQuota(p: Person): number {
  return p.primaryType === 'MESA' ? 2 : 1;
}

/**
 * Obtiene la cantidad de camisetas efectivamente entregadas a una persona
 */
export function getPersonShirtDeliveredCount(p: Person): number {
  if (typeof p.shirtDeliveredCount === 'number') {
    return Math.max(0, p.shirtDeliveredCount);
  }
  if (p.shirtDelivered) {
    return getPersonShirtQuota(p);
  }
  return 0;
}

/**
 * Verifica si la entrega de camisetas de una persona está completa al 100%
 */
export function isPersonShirtFullyDelivered(p: Person): boolean {
  const quota = getPersonShirtQuota(p);
  const delivered = getPersonShirtDeliveredCount(p);
  return delivered >= quota;
}

export function getEffectivePersonType(p: Person): PersonType {
  if (p.primaryType === 'MESA') return 'MESA';
  if (p.gtSubTeam || (Array.isArray(p.gtTeams) && p.gtTeams.length > 0)) return 'GT';
  return p.primaryType || 'GT';
}

// Configurable event
export interface AppEvent {
  id: string; // e.g. 'the-show', 'the-zone', 'carnival', 'the-challenge', 'the-games'
  name: string; // e.g. 'THE SHOW', 'CARNIVAL'
  dayId: string; // 'lunes', 'martes', 'miercoles', 'jueves', 'viernes' or custom
  dayName: string; // 'Lunes', 'Miércoles', etc.
  description?: string;
  notes?: string;
  isActive: boolean;
  isCarnival?: boolean;
  isDivided?: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Dynamic Configurable Shift
export interface ConfigurableShift {
  id: string; // e.g. 'lunes-t1', 'miercoles-gt-t1', 'shift_12345'
  name: string; // e.g. 'T1', 'T2', 'GT General'
  dayId: string; // 'lunes', 'martes', 'miercoles', 'jueves', 'viernes' or custom
  eventId: string; // linked to AppEvent id, e.g. 'the-show', 'carnival'
  category: PersonType; // 'GT' (GRUPO DE TRABAJO), 'GAP' (GRUPO DE APOYO), 'MESA'
  gtSubTeam?: GtSubTeam | string; // Primary GT sub-team (e.g. 'Logística')
  gtSubTeams?: (GtSubTeam | string)[]; // Multiple GT sub-teams supported (e.g. ['Logística', 'Seguridad'])
  startTime: string; // '06:00' (24h)
  endTime: string; // '08:00' (24h)
  label: string; // '6:00 AM – 8:00 AM'
  capacity: number; // e.g. 10 cupos
  isActive: boolean;
  hasBases?: boolean; // whether this shift operates on physical bases
  baseIds?: (number | string)[]; // linked base IDs if applicable
  specificFunctions?: string[]; // optional specific functions required
  notes?: string;
  forTypes?: PersonType[]; // legacy compatibility
  createdAt?: string;
  updatedAt?: string;
}

export type Shift = ConfigurableShift;
export type ShiftDefinition = ConfigurableShift;

export interface PhysicalBase {
  id: number | string; // 1 to 19, 20, 21, 22 or 'toro', 'speedway', 'arcade'
  baseNumber?: number | string;
  name: string; // e.g. "BASE 1 — Ring Toss", "BASE TORO", "BASE SPEED", "BASE ARCADE"
  baseLabel?: string; // e.g. "BASE 1" ... "BASE 19", "BASE TORO", "BASE SPEED", "BASE ARCADE"
  gameName?: string; // e.g. "Ring Toss", "Balance Maestro", ...
  gapCapacity?: number; // Total GAP required for this base
  code?: string;
  defaultCapacity: number; // default capacity per base (e.g. 3 or 2)
  capacity?: number;
  suggestedCapacity?: number;
  isSpecial?: boolean; // true for Toro, Speedway, Arcade
  isActive?: boolean;
  eventId?: string; // e.g. 'carnival' | 'the-games'
  dayId?: string;
  color?: string;
  orderIndex?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ConfigurableBase = PhysicalBase;

export interface EventDayDefinition {
  dayId: string;
  dayName: string;
  eventName: string;
  description: string;
  shifts: ShiftDefinition[];
  physicalBasesCount?: number; // 30 for Carnival, 15 for The Games
  isCarnival?: boolean;
  isDivided?: boolean;
  notes?: string;
}

export interface AvailabilityRecord {
  id: string;
  personId: string;
  dayId: string;
  shiftIds: string[]; // specific shift IDs selected
  notes?: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  personId: string;
  dayId: string;
  shiftId: string;
  assignedType: PersonType; // GT, GAP, or MESA
  gtSubTeam?: GtSubTeam | string; // e.g. "Logística"
  baseId?: string; // Real Supabase base_id: e.g. "carnival_4", "games_jueves_4"
  baseNumber?: number | string; // 1 to 27 or 28, 29, 30, 'toro', 'speedway', 'arcade'
  baseName?: string; // "Base 1", "Base Toro", "Base Speedway", "Base Arcade"
  assignedFunction?: string; // Specific function assigned for this shift (e.g. "Montaje")
  roleInBase?: string; // e.g. "Encargado de Base", "Apoyo"
  requirementId?: string; // linked ShiftRequirement if applicable
  notes?: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  assignmentId?: string;
  personId: string;
  dayId: string;
  shiftId: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
  updatedAt: string;
}

export interface FoodRule {
  id: string;
  mealType: 'desayuno' | 'almuerzo' | 'refrigerio' | 'cena';
  label: string;
  conditionDescription: string;
}

export interface FoodDelivery {
  id: string;
  personId: string;
  dayId: string;
  type: 'almuerzo' | 'refrigerio' | 'refrigerio_1' | 'refrigerio_2' | 'obs';
  delivered: boolean;
  observations?: string;
  updatedAt: string;
}


// =====================================================================
// CALENDARIO DÍAS
// =====================================================================

/** Tipos de actividad predefinidos. El administrador puede crear más (CustomEventType). */
export const BUILTIN_EVENT_TYPES = [
  'conectados',
  'expectadias',
  'decoracion',
  'the_show',
  'the_zone',
  'carnival',
  'the_challenge_games',
  'the_games',
  'capacitacion',
  'reto',
  'otro',
] as const;
export type BuiltinEventType = (typeof BUILTIN_EVENT_TYPES)[number];
/** Id de un tipo predefinido o de uno creado por el administrador */
export type CalendarEventType = string;

export const BUILTIN_EVENT_TYPE_LABELS: Record<BuiltinEventType, string> = {
  conectados: 'Conectados',
  expectadias: 'Expectadías',
  decoracion: 'Decoración',
  the_show: 'THE SHOW',
  the_zone: 'THE ZONE',
  carnival: 'CARNIVAL',
  the_challenge_games: 'THE CHALLENGE & THE GAMES',
  the_games: 'THE GAMES',
  capacitacion: 'Capacitación',
  reto: 'Reto',
  otro: 'Otras actividades',
};

/** Colores de marca disponibles para tipos personalizados */
export const EVENT_TYPE_COLORS = ['lila', 'turquesa', 'coral', 'mostaza', 'lima', 'tinta'] as const;
export type EventTypeColor = (typeof EVENT_TYPE_COLORS)[number];

export interface CustomEventType {
  id: string;
  name: string;
  color: EventTypeColor;
  createdBy?: string;
  createdAt?: string;
}

/**
 * Las capacitaciones son de dos clases:
 *  - 'invitacion': el administrador agrega a las personas que deben asistir.
 *  - 'abierta': abierta a todos los integrantes.
 */
export type TrainingMode = 'invitacion' | 'abierta';

export const TRAINING_MODE_LABELS: Record<TrainingMode, string> = {
  invitacion: 'Capacitación por invitación',
  abierta: 'Capacitación abierta',
};

/** A quién va dirigido un evento. Se pueden combinar varios grupos. */
export interface CalendarAudience {
  all: boolean; // Todos los integrantes
  gtTeams: string[]; // Uno o varios GT
  includeGap: boolean;
  includeMesa: boolean;
  personIds: string[]; // Personas específicas
}

/** Reglas de puntuación de un CONECTADOS (se congelan al cerrar la asistencia). */
export interface ConectadosScoring {
  maxGtPoints: number; // Puntos máximos que vale el CONECTADOS para cada GT
  individualPoints: {
    asistio: number;
    tarde: number;
    excusa: number;
  };
  /** Cómo cuenta una llegada tarde en el % del GT (1 = igual que asistir, 0.5 = media asistencia, 0 = no cuenta). */
  lateWeight: number;
  /** Criterio para excusas válidas en el % del GT. */
  excuseMode: 'excluir' | 'asistencia' | 'ausencia';
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD (hora de Colombia)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location?: string;
  type: CalendarEventType;
  trainingMode?: TrainingMode; // Solo capacitaciones
  audience: CalendarAudience;
  status: 'activo' | 'cancelado';
  scoring?: ConectadosScoring; // Solo CONECTADOS
  /** Control de asistencia por QR */
  attendanceEnabled?: boolean;
  /** Minutos antes del inicio en que se abre el registro por QR */
  checkinOpensMinutes?: number;
  /** Tolerancia: después de estos minutos desde el inicio se registra "llegó tarde" */
  lateAfterMinutes?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

/** Minutos de anticipación permitidos para recordatorios */
export const REMINDER_OFFSETS = [1440, 60, 15] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];
export const REMINDER_OFFSET_LABELS: Record<ReminderOffset, string> = {
  1440: '1 día antes',
  60: '1 hora antes',
  15: '15 minutos antes',
};

export interface EventReminderPreference {
  id: string; // `${eventId}__${personId}`
  eventId: string;
  personId: string;
  enabled: boolean;
  offsets: ReminderOffset[];
  updatedAt: string;
}

// =====================================================================
// DÍAS LEAGUE — DÍAS POINTS
// =====================================================================

export const LEAGUE_GTS: GtSubTeam[] = [
  'Generales',
  'Finanzas',
  'GH',
  'Mercadeo',
  'RRPP',
  'Logística',
  'Seguridad',
  'Carnival',
  'The Games',
];

/** Estados de asistencia a un evento. Mientras el evento está abierto, quien no ha llegado está PENDIENTE. */
export type AttendanceState = 'pendiente' | 'llego' | 'llego_tarde' | 'excusa' | 'no_asistio' | 'no_aplica';
/** @deprecated usar AttendanceState */
export type ConectadosStatus = AttendanceState;

export const ATTENDANCE_STATE_LABELS: Record<AttendanceState, string> = {
  pendiente: 'PENDIENTE',
  llego: 'LLEGÓ',
  llego_tarde: 'LLEGÓ TARDE',
  excusa: 'EXCUSA VÁLIDA',
  no_asistio: 'NO ASISTIÓ',
  no_aplica: 'NO HABILITADO',
};
/** @deprecated usar ATTENDANCE_STATE_LABELS */
export const CONECTADOS_STATUS_LABELS = ATTENDANCE_STATE_LABELS;

/** Asistencia de una persona a un evento del calendario */
export interface EventAttendance {
  id: string; // `${eventId}__${personId}`
  eventId: string;
  personId: string;
  status: AttendanceState;
  source: 'qr' | 'manual';
  /** Hora exacta del escaneo o del registro manual de llegada */
  checkedInAt?: string;
  observation?: string;
  excuseReason?: string;
  excuseEvidenceUrl?: string;
  excuseApprovedBy?: string;
  excuseApprovedAt?: string;
  updatedBy?: string;
  updatedAt: string;
}

/** Resultado congelado por GT al cerrar un CONECTADOS (no cambia aunque cambie el GT después). */
export interface ConectadosGtResult {
  gt: string;
  enabled: number; // Integrantes habilitados (denominador original)
  attended: number;
  late: number;
  excused: number;
  absent: number;
  pending?: number; // Solo en la vista previa (antes de cerrar)
  denominator: number; // Denominador realmente usado tras aplicar el criterio de excusas
  effectiveAttendance: number; // Numerador (asistencias + tardes ponderadas + excusas si cuentan)
  percentage: number; // 0..100
  points: number;
}

export interface ConectadosClosure {
  id: string; // = eventId
  eventId: string;
  scoring?: ConectadosScoring;
  results: ConectadosGtResult[];
  status: 'cerrado' | 'reabierto';
  closedAt: string;
  closedBy: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  updatedAt: string;
}

export type ChallengeStatus = 'pendiente' | 'activo' | 'finalizado' | 'cancelado';

export interface ChallengeEvidence {
  name: string;
  url: string;
}

export interface ChallengeResult {
  gt: string;
  position?: number;
  points: number;
}

export interface IndividualAward {
  personId: string;
  points: number;
  reason?: string;
}

export interface Challenge {
  id: string;
  name: string;
  description?: string;
  rules?: string;
  startDate: string;
  endDate: string;
  gtTeams: string[]; // GT participantes
  placements: { position: number; points: number }[]; // Puntos por puesto (opcional)
  status: ChallengeStatus;
  evidences: ChallengeEvidence[];
  results: ChallengeResult[];
  individualAwards: IndividualAward[];
  resultsRegisteredAt?: string;
  resultsRegisteredBy?: string;
  createdAt: string;
  updatedAt: string;
}

/** Actividad que entrega DÍAS POINTS por QR */
export interface PointActivity {
  id: string;
  name: string;
  description?: string;
  challengeId?: string;
  /** Puntos individuales para cada participante */
  individualPoints: number;
  /** Puntos que suma al GT del participante, por cada participante */
  gtPoints: number;
  /** Quién puede recibir los puntos */
  eligibility: CalendarAudience;
  /** qr_actividad: el integrante escanea el QR de la actividad · qr_personal: el admin escanea el QR del integrante */
  mechanism: 'qr_actividad' | 'qr_personal' | 'ambos';
  status: 'activa' | 'cerrada';
  date: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PointActivityClaim {
  id: string; // `${activityId}__${personId}`
  activityId: string;
  personId: string;
  source: 'qr_actividad' | 'qr_personal' | 'manual';
  registeredBy: string;
  claimedAt: string;
}

export type PointCategory = 'reto' | 'conectados' | 'actividad' | 'manual' | 'correccion';

export const POINT_CATEGORY_LABELS: Record<PointCategory, string> = {
  reto: 'Reto',
  conectados: 'Conectados',
  actividad: 'Actividad (QR)',
  manual: 'Manual',
  correccion: 'Corrección',
};

/** Movimiento del libro de DÍAS POINTS. Nunca se borra: se anula o se corrige dejando trazabilidad. */
export interface PointMovement {
  id: string;
  date: string; // Fecha de la actividad (YYYY-MM-DD)
  target: 'gt' | 'person';
  gt?: string; // GT que recibe (target gt) o GT de la persona al momento del registro
  personId?: string;
  points: number; // Puede ser negativo en correcciones
  category: PointCategory;
  sourceType?: 'conectados' | 'reto' | 'actividad' | 'manual';
  sourceId?: string;
  activityName: string;
  reason?: string;
  observation?: string;
  evidenceUrl?: string;
  /** Si corrige otro movimiento: cuál, y su valor anterior y nuevo */
  correctsId?: string;
  previousPoints?: number;
  newPoints?: number;
  registeredBy: string;
  createdAt: string;
  voided?: boolean;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

export interface LeagueSettings {
  id: 'default';
  defaultConectadosScoring: ConectadosScoring;
  /** Qué cuenta para el ranking equitativo de la liga */
  rankingConfig?: Partial<import('./services/leagueRanking').RankingConfig>;
  updatedAt: string;
}

/** Datos privados del Perfil DÍAS (solo con sesión) */
export interface PersonProfileData {
  personId: string;
  qrToken: string;
  photoUrl?: string;
  qrRenewedAt?: string;
  /** AAAA-MM-DD. Privada: solo la ve y la edita la administración. */
  birthDate?: string;
}

export interface AuditEntry {
  id: number | string;
  at: string;
  adminName: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}
