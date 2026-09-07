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
  updatedAt: string;
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
  dietaryRestrictions?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
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
  id: number | string; // 1 to 27, 28, 29, 30 or 'toro', 'speedway', 'arcade'
  baseNumber?: number | string;
  name: string; // e.g. "Base 1" ... "Base 27", "Base Toro", "Base Speedway", "Base Arcade"
  code?: string;
  defaultCapacity: number; // default capacity per base (e.g. 2)
  suggestedCapacity?: number;
  isSpecial?: boolean; // true for Toro, Speedway, Arcade
  isActive?: boolean;
  eventId?: string; // e.g. 'carnival' | 'the-games'
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
