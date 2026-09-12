import {
  Person,
  Assignment,
  AvailabilityRecord,
  AttendanceRecord,
  GroupFunction,
  ShiftRequirement,
  AppEvent,
  ConfigurableShift,
  ConfigurableBase,
  PhysicalBase,
} from '../types';
import { ExcelMaestroParsedRow } from './excelService';
import {
  CARNIVAL_PHYSICAL_BASES,
  getBaseDisplayName,
  DEFAULT_INITIAL_EVENTS,
  DEFAULT_INITIAL_SHIFTS,
  DEFAULT_INITIAL_BASES,
  DEFAULT_INITIAL_REQUIREMENTS,
  formatTimeRangeLabel,
  doShiftsOverlap,
  areBasesEqual,
} from '../data/eventStructure';
import { DEFAULT_GROUP_FUNCTIONS } from '../data/functionsCatalog';
import {
  insertSingleAssignmentToSupabase,
  deleteSingleAssignmentFromSupabase,
  pullAssignmentsFromSupabase,
  setupRealtimeSubscriptions,
  pushSingleShiftToSupabase,
  deleteSingleShiftFromSupabase,
  pushShiftsToSupabase,
} from './supabaseSync';
import { isSupabaseConfigured } from './supabaseClient';

// Storage keys
const STORAGE_KEYS = {
  PEOPLE: 'dias_eafit_people',
  ASSIGNMENTS: 'dias_eafit_assignments',
  AVAILABILITIES: 'dias_eafit_availabilities',
  ATTENDANCES: 'dias_eafit_attendances',
  FUNCTIONS: 'dias_eafit_functions',
  REQUIREMENTS: 'dias_eafit_shift_requirements',
  EVENTS: 'dias_eafit_events',
  SHIFTS: 'dias_eafit_shifts',
  BASES: 'dias_eafit_bases',
};

// Listeners for reactive updates
type Listener<T> = (data: T) => void;
const peopleListeners = new Set<Listener<Person[]>>();
const assignmentListeners = new Set<Listener<Assignment[]>>();
const availabilityListeners = new Set<Listener<AvailabilityRecord[]>>();
const attendanceListeners = new Set<Listener<AttendanceRecord[]>>();
const functionListeners = new Set<Listener<GroupFunction[]>>();
const requirementListeners = new Set<Listener<ShiftRequirement[]>>();
const eventListeners = new Set<Listener<AppEvent[]>>();
const shiftListeners = new Set<Listener<ConfigurableShift[]>>();
const baseListeners = new Set<Listener<ConfigurableBase[]>>();

// In-memory cache synced with storage
let peopleCache: Person[] = [];
let assignmentCache: Assignment[] = [];
let availabilityCache: AvailabilityRecord[] = [];
let attendanceCache: AttendanceRecord[] = [];
let functionCache: GroupFunction[] = [];
let requirementCache: ShiftRequirement[] = [];
let eventsCache: AppEvent[] = [];
let shiftsCache: ConfigurableShift[] = [];
let basesCache: ConfigurableBase[] = [];
let isInitialized = false;

// Cross-tab real-time sync listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (Object.values(STORAGE_KEYS).includes(e.key || '')) {
      isInitialized = false;
      initializeStorage();
    }
  });
}

// Helper to derive smart username from person fields
export function derivePersonUsername(p: {
  username?: string;
  epikId?: string;
  institutionalEmail?: string;
  email?: string;
  documentId?: string;
}): string {
  if (p.username && p.username.trim()) {
    return p.username.trim().toLowerCase().replace(/\s+/g, '').replace(/^@+/, '');
  }
  if (p.epikId && p.epikId.trim()) {
    return p.epikId.trim().toLowerCase().replace(/\s+/g, '').replace(/^@+/, '');
  }
  if (p.institutionalEmail && p.institutionalEmail.includes('@')) {
    return p.institutionalEmail.split('@')[0].trim().toLowerCase().replace(/^@+/, '');
  }
  if (p.email && p.email.includes('@')) {
    return p.email.split('@')[0].trim().toLowerCase().replace(/^@+/, '');
  }
  return (p.documentId || '').trim();
}

// Initialize storage
export function initializeStorage(): void {
  if (isInitialized) return;

  try {
    const rawPeople = localStorage.getItem(STORAGE_KEYS.PEOPLE);
    const rawAssignments = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
    const rawAvailabilities = localStorage.getItem(STORAGE_KEYS.AVAILABILITIES);
    const rawAttendances = localStorage.getItem(STORAGE_KEYS.ATTENDANCES);
    const rawFunctions = localStorage.getItem(STORAGE_KEYS.FUNCTIONS);
    const rawRequirements = localStorage.getItem(STORAGE_KEYS.REQUIREMENTS);
    const rawEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
    const rawShifts = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    const rawBases = localStorage.getItem(STORAGE_KEYS.BASES);

    const parsedPeople: Person[] = rawPeople ? JSON.parse(rawPeople) : [];
    // Normalize usernames for any people missing them or set to documentId, and heal primaryType for GT members
    let hasHealedPeople = false;
    peopleCache = parsedPeople.map((p) => {
      let resolvedType = p.primaryType;
      if (
        resolvedType !== 'MESA' &&
        (p.gtSubTeam || (Array.isArray(p.gtTeams) && p.gtTeams.length > 0))
      ) {
        if (resolvedType !== 'GT') {
          resolvedType = 'GT';
          hasHealedPeople = true;
        }
      }
      const derived = derivePersonUsername(p);
      const newUsername =
        derived && (!p.username || p.username === p.documentId) ? derived : p.username;
      if (newUsername !== p.username) {
        hasHealedPeople = true;
      }
      return {
        ...p,
        primaryType: resolvedType,
        username: newUsername,
      };
    });
    if (hasHealedPeople) {
      localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(peopleCache));
    }
    assignmentCache = rawAssignments ? JSON.parse(rawAssignments) : [];
    availabilityCache = rawAvailabilities ? JSON.parse(rawAvailabilities) : [];
    attendanceCache = rawAttendances ? JSON.parse(rawAttendances) : [];

    // Initialize functions with default catalog if never set
    if (rawFunctions) {
      functionCache = JSON.parse(rawFunctions);
    } else {
      functionCache = [...DEFAULT_GROUP_FUNCTIONS];
      localStorage.setItem(STORAGE_KEYS.FUNCTIONS, JSON.stringify(functionCache));
    }

    // Initialize requirements with stored values, defaults, and user modifications
    const reqMap = new Map<string, ShiftRequirement>();
    DEFAULT_INITIAL_REQUIREMENTS.forEach((dr) => reqMap.set(dr.id, { ...dr }));

    if (rawRequirements) {
      try {
        const parsed = JSON.parse(rawRequirements);
        if (Array.isArray(parsed)) {
          parsed.forEach((r) => {
            if (r && r.id) {
              reqMap.set(r.id, r);
            }
          });
        }
      } catch (e) {
        console.warn('Error parsing rawRequirements from localStorage:', e);
      }
    }

    requirementCache = Array.from(reqMap.values());

    // Auto-heal any MESA or custom requirements referenced by existing assignments
    const mesaShiftsWithAssignments = new Map<
      string,
      { dayId: string; shiftId: string; count: number; reqId?: string }
    >();
    assignmentCache.forEach((a) => {
      if (a.assignedType === 'MESA' && a.shiftId && a.dayId) {
        const key = `${a.dayId}__${a.shiftId}`;
        const prev = mesaShiftsWithAssignments.get(key) || {
          dayId: a.dayId,
          shiftId: a.shiftId,
          count: 0,
          reqId: a.requirementId,
        };
        prev.count += 1;
        if (a.requirementId) prev.reqId = a.requirementId;
        mesaShiftsWithAssignments.set(key, prev);
      }
    });

    mesaShiftsWithAssignments.forEach((info) => {
      const hasMesaReq = requirementCache.some(
        (r) => r.dayId === info.dayId && r.shiftId === info.shiftId && r.groupType === 'MESA'
      );
      if (!hasMesaReq) {
        const restoredReq: ShiftRequirement = {
          id: info.reqId || `req_mesa_${info.dayId}_${info.shiftId}`,
          dayId: info.dayId,
          shiftId: info.shiftId,
          groupType: 'MESA',
          capacity: Math.max(18, info.count),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notes: 'MESA Directiva / Coordinación',
        };
        requirementCache.push(restoredReq);
      }
    });

    localStorage.setItem(STORAGE_KEYS.REQUIREMENTS, JSON.stringify(requirementCache));

    // Initialize events with clean non-divided defaults or stored customizations
    if (rawEvents) {
      try {
        const parsedEvents = JSON.parse(rawEvents);
        eventsCache =
          Array.isArray(parsedEvents) && parsedEvents.length > 0
            ? parsedEvents
            : [...DEFAULT_INITIAL_EVENTS];
      } catch (e) {
        eventsCache = [...DEFAULT_INITIAL_EVENTS];
      }
    } else {
      eventsCache = [...DEFAULT_INITIAL_EVENTS];
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(eventsCache));
    }

    // Initialize shifts with defaults and preserve user modifications / custom shifts
    const shiftMap = new Map<string, ConfigurableShift>();
    DEFAULT_INITIAL_SHIFTS.forEach((ds) => shiftMap.set(ds.id, { ...ds }));

    if (rawShifts) {
      try {
        const parsed = JSON.parse(rawShifts);
        if (Array.isArray(parsed)) {
          parsed.forEach((s) => {
            if (s && s.id) {
              // Ensure Thursday Turno 2 is updated to 13:00 - 21:00 (1 a 9) if still 12:30-18:00
              if (
                (s.id === 'jueves-t2-gt' || s.id === 'jueves-t2') &&
                s.startTime === '12:30' &&
                s.endTime === '18:00'
              ) {
                s.startTime = '13:00';
                s.endTime = '21:00';
                s.label = '1:00 p. m. a 9:00 p. m.';
              }
              shiftMap.set(s.id, s);
            }
          });
        }
      } catch (e) {
        console.warn('Error parsing rawShifts from localStorage:', e);
      }
    }

    shiftsCache = Array.from(shiftMap.values());

    // Heal any missing shifts referenced by assignments (such as dynamic MESA shifts)
    assignmentCache.forEach((a) => {
      if (a.shiftId && !shiftsCache.some((s) => s.id === a.shiftId)) {
        const sid = a.shiftId.toLowerCase();
        const isMesa = a.assignedType === 'MESA' || sid.includes('mesa');
        const dayId =
          a.dayId ||
          (sid.includes('lunes')
            ? 'lunes'
            : sid.includes('martes')
            ? 'martes'
            : sid.includes('miercoles')
            ? 'miercoles'
            : sid.includes('jueves')
            ? 'jueves'
            : sid.includes('viernes')
            ? 'viernes'
            : 'lunes');

        let name = isMesa ? 'Turno 1 — MESA' : 'Turno 1';
        let startTime = '06:00';
        let endTime = '08:00';
        let label = '6:00 a. m. a 8:00 a. m.';

        if (dayId === 'jueves') {
          name = isMesa ? 'Turno 1 — The Challenge (MESA)' : 'Turno 1 — The Challenge';
          startTime = '06:00';
          endTime = '13:00';
          label = '6:00 a. m. a 1:00 p. m.';
        } else if (dayId === 'viernes') {
          name = isMesa ? 'Turno 1 — The Games (MESA)' : 'Turno 1 — The Games';
          startTime = '06:00';
          endTime = '21:30';
          label = '6:00 a. m. a 9:30 p. m.';
        } else if (dayId === 'martes') {
          name = isMesa ? 'Turno 1 — The Zone (MESA)' : 'Turno 1 — The Zone';
          startTime = '08:30';
          endTime = '12:30';
          label = '8:30 a. m. a 12:30 p. m.';
        } else if (dayId === 'miercoles') {
          name = isMesa ? 'Turno 1 — Carnival (MESA)' : 'Turno 1 — Carnival';
          startTime = '06:00';
          endTime = '10:00';
          label = '6:00 a. m. a 10:00 a. m.';
        }

        const healedShift: ConfigurableShift = {
          id: a.shiftId,
          name,
          dayId,
          eventId:
            dayId === 'miercoles'
              ? 'carnival'
              : dayId === 'jueves'
              ? 'the-challenge'
              : dayId === 'viernes'
              ? 'the-games'
              : dayId === 'martes'
              ? 'the-zone'
              : 'the-show',
          category: (isMesa ? 'MESA' : 'GT') as any,
          startTime,
          endTime,
          label,
          capacity: 20,
          isActive: true,
          hasBases: false,
          forTypes: [(isMesa ? 'MESA' : 'GT') as any],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        shiftsCache.push(healedShift);
      }
    });

    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shiftsCache));

    // Migration map for old shift IDs to their new corresponding shift
    const SHIFT_MIGRATION_MAP: Record<string, string> = {
      'miercoles-gap-t1': 'miercoles-gt-t2',
      'miercoles-gap-t2': 'miercoles-gt-t3',
      'miercoles-gap-t3': 'miercoles-gt-t4',
      'miercoles-t1': 'miercoles-gt-t1',
      'miercoles-t2': 'miercoles-gt-t2',
      'miercoles-t3': 'miercoles-gt-t3',
      'miercoles-t4': 'miercoles-gt-t4',
      'miercoles-t5': 'miercoles-gt-t5',
      'jueves-t2': 'jueves-t2-gt',
      'shift_jueves_mtqcifm4_nt5': 'jueves-t2-gt',
      'shift_jueves_gap_mtrxwlwl_l9j': 'jueves-t2-gt',
      'shift_jueves_gt_mtrxjh9q_r2t': 'jueves-t1',
      'viernes-gap': 'viernes-gt',
    };

    // Migrate any assignments that referenced old shifts
    let hasMigratedAssignments = false;
    assignmentCache = assignmentCache.map((a) => {
      const targetId = SHIFT_MIGRATION_MAP[a.shiftId];
      if (targetId) {
        hasMigratedAssignments = true;
        return {
          ...a,
          shiftId: targetId,
        };
      }
      return a;
    });
    if (hasMigratedAssignments) {
      localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignmentCache));
    }

    // Migrate any availabilities referencing old shift IDs
    let hasMigratedAvail = false;
    availabilityCache = availabilityCache.map((av) => {
      if (Array.isArray(av.shiftIds)) {
        const mapped = Array.from(
          new Set(av.shiftIds.map((sid) => SHIFT_MIGRATION_MAP[sid] || sid))
        );
        if (JSON.stringify(mapped) !== JSON.stringify(av.shiftIds)) {
          hasMigratedAvail = true;
          return { ...av, shiftIds: mapped };
        }
      }
      return av;
    });
    if (hasMigratedAvail) {
      localStorage.setItem(STORAGE_KEYS.AVAILABILITIES, JSON.stringify(availabilityCache));
    }

    // Initialize bases with defaults if not set
    if (rawBases) {
      basesCache = JSON.parse(rawBases);
    } else {
      basesCache = [...DEFAULT_INITIAL_BASES];
      localStorage.setItem(STORAGE_KEYS.BASES, JSON.stringify(basesCache));
    }

    // Sync Carnival bases to 22 bases: 1 to 19 regular, and 20 (Toro), 21 (Speedway), 22 (Arcade)
    const carnivalBasesInCache = basesCache.filter(
      (b) => b.eventId === 'carnival' || String(b.id).startsWith('carnival_') || (b.dayId === 'miercoles' && !b.eventId)
    );
    const nonCarnivalBases = basesCache.filter(
      (b) => b.eventId !== 'carnival' && !String(b.id).startsWith('carnival_') && !(b.dayId === 'miercoles' && !b.eventId)
    );

    const hasInvalidCarnivalCount = carnivalBasesInCache.length !== 22;
    const hasSpecialWithWrongCap = carnivalBasesInCache.some(
      (b) => b.isSpecial && (b.capacity !== 1 || b.defaultCapacity !== 1)
    );
    const hasOldSpecialBases = carnivalBasesInCache.some(
      (b) =>
        ['28', '29', '30', 'carnival_28', 'carnival_29', 'carnival_30'].includes(String(b.id)) ||
        ['28', '29', '30'].includes(String(b.baseNumber)) ||
        (typeof b.baseNumber === 'number' && b.baseNumber > 22) ||
        (typeof b.baseNumber === 'string' && Number(b.baseNumber) > 22) ||
        (String(b.id) === 'carnival_17' && b.name.toLowerCase().includes('toro')) ||
        (String(b.id) === 'carnival_18' && b.name.toLowerCase().includes('speedway')) ||
        (String(b.id) === 'carnival_19' && b.name.toLowerCase().includes('arcade'))
    );

    if (hasInvalidCarnivalCount || hasOldSpecialBases || hasSpecialWithWrongCap) {
      const specialBaseMap: Record<string, { newId: string; newBaseNumber: string; newName: string }> = {
        '20': { newId: 'carnival_20', newBaseNumber: '20', newName: 'Base Toro' },
        'carnival_20': { newId: 'carnival_20', newBaseNumber: '20', newName: 'Base Toro' },
        '28': { newId: 'carnival_20', newBaseNumber: '20', newName: 'Base Toro' },
        'carnival_28': { newId: 'carnival_20', newBaseNumber: '20', newName: 'Base Toro' },
        'toro': { newId: 'carnival_20', newBaseNumber: '20', newName: 'Base Toro' },
        '21': { newId: 'carnival_21', newBaseNumber: '21', newName: 'Base Speedway' },
        'carnival_21': { newId: 'carnival_21', newBaseNumber: '21', newName: 'Base Speedway' },
        '29': { newId: 'carnival_21', newBaseNumber: '21', newName: 'Base Speedway' },
        'carnival_29': { newId: 'carnival_21', newBaseNumber: '21', newName: 'Base Speedway' },
        'speedway': { newId: 'carnival_21', newBaseNumber: '21', newName: 'Base Speedway' },
        '22': { newId: 'carnival_22', newBaseNumber: '22', newName: 'Base Arcade' },
        'carnival_22': { newId: 'carnival_22', newBaseNumber: '22', newName: 'Base Arcade' },
        '30': { newId: 'carnival_22', newBaseNumber: '22', newName: 'Base Arcade' },
        'carnival_30': { newId: 'carnival_22', newBaseNumber: '22', newName: 'Base Arcade' },
        'arcade': { newId: 'carnival_22', newBaseNumber: '22', newName: 'Base Arcade' },
      };

      const newCarnivalBases: ConfigurableBase[] = CARNIVAL_PHYSICAL_BASES.map((b) => {
        const existing = carnivalBasesInCache.find(
          (eb) =>
            String(eb.id) === `carnival_${b.id}` ||
            String(eb.baseNumber) === String(b.id) ||
            eb.name.toLowerCase() === b.name.toLowerCase()
        );
        const cap = b.isSpecial ? 1 : (existing?.capacity || existing?.defaultCapacity || b.defaultCapacity);
        return {
          id: 'carnival_' + b.id,
          name: b.name,
          baseNumber: String(b.id),
          defaultCapacity: cap,
          capacity: cap,
          isSpecial: b.isSpecial || false,
          isActive: true,
          eventId: 'carnival',
          dayId: 'miercoles',
          color: '#B83A24',
          orderIndex: Number(b.id) || 99,
        };
      });

      basesCache = [...newCarnivalBases, ...nonCarnivalBases];
      localStorage.setItem(STORAGE_KEYS.BASES, JSON.stringify(basesCache));
      baseListeners.forEach((fn) => fn([...basesCache]));

      let assignmentsChanged = false;
      assignmentCache = assignmentCache.map((a) => {
        if (a.dayId === 'miercoles') {
          const baseKey = String(a.baseId || a.baseNumber || '');
          if (specialBaseMap[baseKey]) {
            const mapped = specialBaseMap[baseKey];
            assignmentsChanged = true;
            return {
              ...a,
              baseId: mapped.newId,
              baseNumber: mapped.newBaseNumber,
              baseName: mapped.newName,
            };
          }
        }
        return a;
      });

      if (assignmentsChanged) {
        localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignmentCache));
        assignmentListeners.forEach((fn) => fn([...assignmentCache]));
      }
    }
    
    // Initialize Realtime
    setupRealtimeSubscriptions(async () => {
      const latestAssignments = await pullAssignmentsFromSupabase();
      if (latestAssignments) {
        assignmentCache = latestAssignments;
        localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignmentCache));
        assignmentListeners.forEach((fn) => fn([...assignmentCache]));
      }
    });

    // Ensure all local shifts are synced to Supabase shifts table in the background
    if (isSupabaseConfigured() && shiftsCache.length > 0) {
      pushShiftsToSupabase(shiftsCache).catch((err) =>
        console.warn('Background sync of shifts to Supabase:', err)
      );
    }
  } catch (error) {
    console.error('Error loading data from storage:', error);
    peopleCache = [];
    assignmentCache = [];
    availabilityCache = [];
    attendanceCache = [];
    functionCache = [...DEFAULT_GROUP_FUNCTIONS];
    requirementCache = [];
    eventsCache = [...DEFAULT_INITIAL_EVENTS];
    shiftsCache = [...DEFAULT_INITIAL_SHIFTS];
    basesCache = [...DEFAULT_INITIAL_BASES];
  }

  isInitialized = true;
  notifyAll();
}

function notifyAll() {
  peopleListeners.forEach((fn) => fn([...peopleCache]));
  assignmentListeners.forEach((fn) => fn([...assignmentCache]));
  availabilityListeners.forEach((fn) => fn([...availabilityCache]));
  attendanceListeners.forEach((fn) => fn([...attendanceCache]));
  functionListeners.forEach((fn) => fn([...functionCache]));
  requirementListeners.forEach((fn) => fn([...requirementCache]));
  eventListeners.forEach((fn) => fn([...eventsCache]));
  shiftListeners.forEach((fn) => fn([...shiftsCache]));
  baseListeners.forEach((fn) => fn([...basesCache]));
}

// ----------------- SUBSCRIPTIONS -----------------
export function subscribeToPeople(listener: Listener<Person[]>): () => void {
  initializeStorage();
  peopleListeners.add(listener);
  listener([...peopleCache]);
  return () => peopleListeners.delete(listener);
}

export function subscribeToAssignments(listener: Listener<Assignment[]>): () => void {
  initializeStorage();
  assignmentListeners.add(listener);
  listener([...assignmentCache]);
  return () => assignmentListeners.delete(listener);
}

export function subscribeToAvailabilities(listener: Listener<AvailabilityRecord[]>): () => void {
  initializeStorage();
  availabilityListeners.add(listener);
  listener([...availabilityCache]);
  return () => availabilityListeners.delete(listener);
}

export function subscribeToAttendances(listener: Listener<AttendanceRecord[]>): () => void {
  initializeStorage();
  attendanceListeners.add(listener);
  listener([...attendanceCache]);
  return () => attendanceListeners.delete(listener);
}

export function subscribeToFunctions(listener: Listener<GroupFunction[]>): () => void {
  initializeStorage();
  functionListeners.add(listener);
  listener([...functionCache]);
  return () => functionListeners.delete(listener);
}

export function subscribeToRequirements(listener: Listener<ShiftRequirement[]>): () => void {
  initializeStorage();
  requirementListeners.add(listener);
  listener([...requirementCache]);
  return () => requirementListeners.delete(listener);
}

export function subscribeToEvents(listener: Listener<AppEvent[]>): () => void {
  initializeStorage();
  eventListeners.add(listener);
  listener([...eventsCache]);
  return () => eventListeners.delete(listener);
}

export function subscribeToShifts(listener: Listener<ConfigurableShift[]>): () => void {
  initializeStorage();
  shiftListeners.add(listener);
  listener([...shiftsCache]);
  return () => shiftListeners.delete(listener);
}

export function subscribeToBases(listener: Listener<ConfigurableBase[]>): () => void {
  initializeStorage();
  baseListeners.add(listener);
  listener([...basesCache]);
  return () => baseListeners.delete(listener);
}

// ----------------- SYNCHRONOUS GETTERS (FOR COMPONENTS & EXCEL ENGINE) -----------------
export function getPeople(): Person[] {
  initializeStorage();
  return [...peopleCache];
}

export function getShifts(): ConfigurableShift[] {
  initializeStorage();
  return [...shiftsCache];
}

export function getEvents(): AppEvent[] {
  initializeStorage();
  return [...eventsCache];
}

export function getBases(): ConfigurableBase[] {
  initializeStorage();
  return [...basesCache];
}

export function getAvailabilities(): AvailabilityRecord[] {
  initializeStorage();
  return [...availabilityCache];
}

export function getAssignments(): Assignment[] {
  initializeStorage();
  return [...assignmentCache];
}

export function getShiftRequirements(): ShiftRequirement[] {
  initializeStorage();
  return [...requirementCache];
}

// ----------------- PEOPLE CRUD -----------------
export async function addPerson(
  personData: Omit<Person, 'id' | 'createdAt'>
): Promise<Person> {
  initializeStorage();
  const newPerson: Person = {
    ...personData,
    id: 'person_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    createdAt: new Date().toISOString(),
  };

  peopleCache = [...peopleCache, newPerson];
  localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(peopleCache));
  peopleListeners.forEach((fn) => fn([...peopleCache]));
  return newPerson;
}

export async function updatePerson(id: string, updates: Partial<Person>): Promise<void> {
  initializeStorage();
  peopleCache = peopleCache.map((p) => (p.id === id ? { ...p, ...updates } : p));
  localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(peopleCache));
  peopleListeners.forEach((fn) => fn([...peopleCache]));
}

export interface ImportBatchResult {
  added: number;
  updated: number;
  skipped: number;
}

export async function importPeopleBatch(
  newPeople: Array<Omit<Person, 'id' | 'createdAt'>>,
  options: { updateExisting: boolean } = { updateExisting: false }
): Promise<ImportBatchResult> {
  initializeStorage();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const personData of newPeople) {
    const cleanDoc = personData.documentId.trim();
    const cleanUser = (personData.username || '').trim().toLowerCase();

    // Check if person exists by documentId or username
    const existingIndex = peopleCache.findIndex(
      (p) =>
        p.documentId.trim() === cleanDoc ||
        (cleanUser && p.username && p.username.trim().toLowerCase() === cleanUser)
    );

    if (existingIndex >= 0) {
      if (options.updateExisting) {
        peopleCache[existingIndex] = {
          ...peopleCache[existingIndex],
          ...personData,
        };
        updated++;
      } else {
        skipped++;
      }
    } else {
      const newPerson: Person = {
        ...personData,
        id: 'person_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        createdAt: new Date().toISOString(),
      };
      peopleCache.push(newPerson);
      added++;
    }
  }

  localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(peopleCache));
  peopleListeners.forEach((fn) => fn([...peopleCache]));

  return { added, updated, skipped };
}

export interface ExcelMaestroImportResult {
  addedPeople: number;
  updatedPeople: number;
  skippedPeople: number;
  totalAvailabilitiesAdded: number;
}

/**
 * IMPORTS PEOPLE & AVAILABILITY FROM OFFICIAL EXCEL MAESTRO
 * 
 * STRICT RULES ENFORCED:
 * 1. ONE ROW = ONE PERSON. Multiple availabilities belong to that same person.
 * 2. EXCEL DOES NOT CREATE ASSIGNMENTS. Only registers people and availability records.
 * 3. NON-DESTRUCTIVE: Existing person updates DO NOT delete their assignments, attendance, or food records.
 * 4. AVAILABILITY RECORDS: Maps recognized shifts to official turn_ids in Supabase/Storage.
 */
export async function importExcelMaestroBatch(
  parsedRows: ExcelMaestroParsedRow[],
  options: { updateExisting: boolean } = { updateExisting: true }
): Promise<ExcelMaestroImportResult> {
  initializeStorage();

  let addedPeople = 0;
  let updatedPeople = 0;
  let skippedPeople = 0;
  let totalAvailabilitiesAdded = 0;

  for (const row of parsedRows) {
    if (!row.isValid) continue;

    const cleanDoc = row.documentId.trim();
    const cleanUser = (row.username || '').trim().toLowerCase().replace(/^@+/, '');
    const cleanInstEmail = (row.institutionalEmail || '').trim().toLowerCase();
    const cleanEpik = (row.epikId || '').trim().toLowerCase();
    const cleanEmail = (row.email || '').trim().toLowerCase();

    // Match existing person by row.matchedExistingPersonId or identifiers
    let existingIndex = -1;
    if (row.matchedExistingPersonId) {
      existingIndex = peopleCache.findIndex((p) => p.id === row.matchedExistingPersonId);
    }
    if (existingIndex < 0) {
      existingIndex = peopleCache.findIndex(
        (p) =>
          (cleanDoc && p.documentId.trim() === cleanDoc) ||
          (cleanUser && p.username && p.username.trim().toLowerCase().replace(/^@+/, '') === cleanUser) ||
          (cleanInstEmail &&
            ((p.institutionalEmail && p.institutionalEmail.trim().toLowerCase() === cleanInstEmail) ||
              p.email.trim().toLowerCase() === cleanInstEmail)) ||
          (cleanEpik && p.epikId && p.epikId.trim().toLowerCase() === cleanEpik) ||
          (cleanEmail &&
            (p.email.trim().toLowerCase() === cleanEmail ||
              (p.institutionalEmail && p.institutionalEmail.trim().toLowerCase() === cleanEmail)))
      );
    }

    let targetPersonId = '';

    if (existingIndex >= 0) {
      const existing = peopleCache[existingIndex];
      targetPersonId = existing.id;

      if (options.updateExisting) {
        // Non-destructive update of user fields (NEVER touches assignments or attendance)
        const derivedUser = derivePersonUsername({
          username: row.username,
          epikId: row.epikId || existing.epikId,
          institutionalEmail: row.institutionalEmail || existing.institutionalEmail,
          email: row.email || existing.email,
          documentId: row.documentId || existing.documentId,
        });

        peopleCache[existingIndex] = {
          ...existing,
          name: row.name || existing.name,
          fullName: row.fullName || existing.fullName || row.name,
          documentId: row.documentId || existing.documentId,
          username:
            (row.username && row.username.trim().toLowerCase().replace(/^@+/, '')) ||
            (existing.username && existing.username !== existing.documentId
              ? existing.username
              : derivedUser || existing.username),
          phone: row.phone || existing.phone,
          email: row.email || existing.email,
          institutionalEmail: row.institutionalEmail || existing.institutionalEmail,
          epikId: row.epikId || existing.epikId,
          externalExcelId: row.externalExcelId || existing.externalExcelId,
          startTimeExcel: row.startTimeExcel || existing.startTimeExcel,
          endTimeExcel: row.endTimeExcel || existing.endTimeExcel,
          shirtSize: row.shirtSize || existing.shirtSize,
          foodAllergies:
            row.foodAllergies && row.foodAllergies !== 'Ninguna'
              ? row.foodAllergies
              : existing.foodAllergies || row.foodAllergies || 'Ninguna',
          dietaryRestrictions:
            row.dietaryRestrictions && row.dietaryRestrictions !== 'Ninguna'
              ? row.dietaryRestrictions
              : existing.dietaryRestrictions || row.dietaryRestrictions || 'Ninguna',
          medicalConditions:
            row.medicalConditions && row.medicalConditions !== 'Ninguna'
              ? row.medicalConditions
              : existing.medicalConditions || row.medicalConditions || 'Ninguna',
          primaryType: row.primaryType || existing.primaryType,
          alsoActsAsGap: row.alsoActsAsGap !== undefined ? row.alsoActsAsGap : existing.alsoActsAsGap,
          gapRoleDescription: row.gapRoleDescription || existing.gapRoleDescription,
          gtTeams: row.gtTeams.length > 0 ? row.gtTeams : existing.gtTeams,
          gtSubTeam: row.gtSubTeam || existing.gtSubTeam,
          updatedAt: new Date().toISOString(),
        };
        updatedPeople++;
      } else {
        skippedPeople++;
      }
    } else {
      // NEW PERSON
      targetPersonId = 'person_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const derivedUser = derivePersonUsername({
        username: row.username,
        epikId: row.epikId,
        institutionalEmail: row.institutionalEmail,
        email: row.email,
        documentId: row.documentId,
      });

      const newPerson: Person = {
        id: targetPersonId,
        name: row.name,
        fullName: row.fullName || row.name,
        documentId: row.documentId,
        username:
          (row.username && row.username.trim().toLowerCase().replace(/^@+/, '')) ||
          derivedUser ||
          row.documentId,
        email:
          row.email ||
          (row.institutionalEmail ? row.institutionalEmail : `${row.documentId}@eafit.edu.co`),
        phone: row.phone,
        institutionalEmail: row.institutionalEmail,
        epikId: row.epikId,
        externalExcelId: row.externalExcelId,
        startTimeExcel: row.startTimeExcel,
        endTimeExcel: row.endTimeExcel,
        primaryType: row.primaryType,
        alsoActsAsGap: row.alsoActsAsGap || false,
        gapRoleDescription: row.gapRoleDescription,
        gtTeams: row.gtTeams,
        gtSubTeam: row.gtSubTeam,
        functions: [],
        roleTitle: 'Staff',
        shirtSize: row.shirtSize || 'M',
        foodAllergies: row.foodAllergies || 'Ninguna',
        dietaryRestrictions: row.dietaryRestrictions || 'Ninguna',
        medicalConditions: row.medicalConditions || 'Ninguna',
        notes: row.gt ? `GT: ${row.gt}` : '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      peopleCache.push(newPerson);
      addedPeople++;
    }

    // ---------------- SAVE AVAILABILITIES (EXCEL DOES NOT CREATE ASSIGNMENTS) ----------------
    for (const [dayId, recognizedMatches] of Object.entries(row.recognizedShiftsByDay)) {
      if (!recognizedMatches || recognizedMatches.length === 0) continue;

      const recognizedShiftIds = recognizedMatches.map((m) => m.shiftId);
      const existingAvIdx = availabilityCache.findIndex(
        (av) => av.personId === targetPersonId && av.dayId === dayId
      );

      if (existingAvIdx >= 0) {
        // Merge recognized shift IDs without deleting manually added ones
        const mergedShiftIds = Array.from(
          new Set([...availabilityCache[existingAvIdx].shiftIds, ...recognizedShiftIds])
        );
        availabilityCache[existingAvIdx] = {
          ...availabilityCache[existingAvIdx],
          shiftIds: mergedShiftIds,
          updatedAt: new Date().toISOString(),
        };
        totalAvailabilitiesAdded += recognizedShiftIds.length;
      } else {
        // Create new availability record
        const newAv: AvailabilityRecord = {
          id: 'avail_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          personId: targetPersonId,
          dayId,
          shiftIds: recognizedShiftIds,
          updatedAt: new Date().toISOString(),
        };
        availabilityCache.push(newAv);
        totalAvailabilitiesAdded += recognizedShiftIds.length;
      }
    }
  }

  // Persist both caches to storage
  localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(peopleCache));
  localStorage.setItem(STORAGE_KEYS.AVAILABILITIES, JSON.stringify(availabilityCache));

  peopleListeners.forEach((fn) => fn([...peopleCache]));
  availabilityListeners.forEach((fn) => fn([...availabilityCache]));

  return {
    addedPeople,
    updatedPeople,
    skippedPeople,
    totalAvailabilitiesAdded,
  };
}

export async function deletePerson(id: string): Promise<void> {
  initializeStorage();
  peopleCache = peopleCache.filter((p) => p.id !== id);
  // Also clean up their assignments, availability and attendance
  assignmentCache = assignmentCache.filter((a) => a.personId !== id);
  availabilityCache = availabilityCache.filter((av) => av.personId !== id);
  attendanceCache = attendanceCache.filter((at) => at.personId !== id);

  localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(peopleCache));
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignmentCache));
  localStorage.setItem(STORAGE_KEYS.AVAILABILITIES, JSON.stringify(availabilityCache));
  localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(attendanceCache));

  notifyAll();
}

export async function deletePeopleBatch(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  initializeStorage();
  const idSet = new Set(ids);
  peopleCache = peopleCache.filter((p) => !idSet.has(p.id));
  assignmentCache = assignmentCache.filter((a) => !idSet.has(a.personId));
  availabilityCache = availabilityCache.filter((av) => !idSet.has(av.personId));
  attendanceCache = attendanceCache.filter((at) => !idSet.has(at.personId));

  localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(peopleCache));
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignmentCache));
  localStorage.setItem(STORAGE_KEYS.AVAILABILITIES, JSON.stringify(availabilityCache));
  localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(attendanceCache));

  notifyAll();
}

export async function deleteAllPeople(): Promise<void> {
  initializeStorage();
  peopleCache = [];
  assignmentCache = [];
  availabilityCache = [];
  attendanceCache = [];

  localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.AVAILABILITIES, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify([]));

  notifyAll();
}

// ----------------- AVAILABILITY -----------------
export async function saveAvailability(
  personId: string,
  dayId: string,
  shiftIds: string[],
  notes?: string
): Promise<void> {
  initializeStorage();
  const existingIndex = availabilityCache.findIndex(
    (av) => av.personId === personId && av.dayId === dayId
  );

  const newRecord: AvailabilityRecord = {
    id: existingIndex >= 0 ? availabilityCache[existingIndex].id : 'avail_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    personId,
    dayId,
    shiftIds,
    notes,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    availabilityCache = availabilityCache.map((av, idx) =>
      idx === existingIndex ? newRecord : av
    );
  } else {
    availabilityCache = [...availabilityCache, newRecord];
  }

  localStorage.setItem(STORAGE_KEYS.AVAILABILITIES, JSON.stringify(availabilityCache));
  availabilityListeners.forEach((fn) => fn([...availabilityCache]));
}

// ----------------- ASSIGNMENTS WITH CONTINUITY AND CAPACITY CHECKS -----------------
export interface AssignmentResult {
  success: boolean;
  alertMessage?: string;
  assignment?: Assignment;
}

export async function assignPerson(
  assignmentData: Omit<Assignment, 'id' | 'updatedAt'>
): Promise<AssignmentResult> {
  initializeStorage();

  const { personId, dayId, shiftId, assignedType } = assignmentData;
  let rawBaseNumber = assignmentData.baseNumber;
  let rawBaseId = assignmentData.baseId;

  // Clean strings
  if (rawBaseNumber === 'null' || rawBaseNumber === 'undefined' || rawBaseNumber === '') {
    rawBaseNumber = undefined;
  }
  if (rawBaseId === 'null' || rawBaseId === 'undefined' || rawBaseId === '') {
    rawBaseId = undefined;
  }

  // Active person check
  const person = peopleCache.find((p) => p.id === personId);
  if (person && person.isActive === false) {
    return {
      success: false,
      alertMessage: 'La persona seleccionada se encuentra inactiva.',
    };
  }

  // Check if shift operates with physical bases
  const currentShift = shiftsCache.find((s) => s.id === shiftId);
  const officialShift = DEFAULT_INITIAL_SHIFTS.find((s) => s.id === shiftId);
  const shiftHasBases = currentShift?.hasBases ?? false;

  // Find base object if base assignment
  let resolvedBaseId: string | undefined = shiftHasBases ? rawBaseId : undefined;
  let resolvedBaseNumber: number | string | undefined = shiftHasBases ? rawBaseNumber : undefined;
  let resolvedBaseName: string | undefined = shiftHasBases ? assignmentData.baseName : undefined;
  let maxCapacity = 2;

  if (shiftHasBases && (rawBaseId || rawBaseNumber !== undefined)) {
    const targetBaseObj = basesCache.find(
      (b) =>
        (rawBaseId && (b.id === rawBaseId || String(b.baseNumber) === String(rawBaseId))) ||
        (rawBaseNumber !== undefined &&
          (String(b.baseNumber) === String(rawBaseNumber) ||
            String(b.id) === String(rawBaseNumber) ||
            b.name.toLowerCase() === String(rawBaseNumber).toLowerCase()))
    );

    if (targetBaseObj) {
      resolvedBaseId = String(targetBaseObj.id);
      resolvedBaseNumber = targetBaseObj.baseNumber || targetBaseObj.id;
      resolvedBaseName = targetBaseObj.name;
      maxCapacity = targetBaseObj.capacity || targetBaseObj.defaultCapacity || 2;
    } else {
      if (!resolvedBaseName && (resolvedBaseNumber !== undefined || resolvedBaseId)) {
        resolvedBaseName = getBaseDisplayName(resolvedBaseNumber || resolvedBaseId);
      }
    }
  }

  // Base continuity check for Carnival (only applies to shifts using bases)
  if (dayId === 'miercoles' && shiftHasBases) {
    const existingCarnivalWithBase = assignmentCache.find(
      (a) =>
        a.personId === personId &&
        a.dayId === 'miercoles' &&
        a.shiftId !== shiftId &&
        ((a.baseId && a.baseId !== 'null') || (a.baseNumber !== undefined && a.baseNumber !== null && a.baseNumber !== ''))
    );

    if (existingCarnivalWithBase) {
      const priorBase = existingCarnivalWithBase.baseNumber || existingCarnivalWithBase.baseId;
      const priorBaseName = existingCarnivalWithBase.baseName || getBaseDisplayName(priorBase);

      if (resolvedBaseNumber !== undefined || resolvedBaseId) {
        const currentBaseIdOrNum = resolvedBaseId || resolvedBaseNumber;
        const isSame = areBasesEqual(currentBaseIdOrNum, priorBase, resolvedBaseName, priorBaseName);
        if (!isSame) {
          console.info(`Asignación permitida en Carnival a base diferente: ${resolvedBaseName || currentBaseIdOrNum} (anterior: ${priorBaseName})`);
        }
      } else {
        resolvedBaseId = existingCarnivalWithBase.baseId;
        resolvedBaseNumber = existingCarnivalWithBase.baseNumber;
        resolvedBaseName = existingCarnivalWithBase.baseName;
      }
    }
  }

  // Base capacity validation (only applies to shifts using bases)
  if (shiftHasBases && (resolvedBaseId || resolvedBaseNumber !== undefined)) {
    const currentOccupants = assignmentCache.filter(
      (a) =>
        a.dayId === dayId &&
        a.shiftId === shiftId &&
        (
          (resolvedBaseId && a.baseId === resolvedBaseId) ||
          (resolvedBaseNumber !== undefined && String(a.baseNumber) === String(resolvedBaseNumber)) ||
          (resolvedBaseName && a.baseName === resolvedBaseName)
        ) &&
        a.personId !== personId
    );

    if (currentOccupants.length >= maxCapacity) {
      const displayName = resolvedBaseName || getBaseDisplayName(resolvedBaseNumber || resolvedBaseId);
      return {
        success: false,
        alertMessage: `CUPO COMPLETO: ${displayName} ya alcanzó su capacidad máxima de ${maxCapacity} personas en este turno.`,
      };
    }
  }

  // Shift total capacity validation
  // User Rule: "el cupo no se llena con la mesa, no cuentes en la mesa en el cupo solo al GT"
  const isMesaBeingAssigned = assignedType === 'MESA' || person?.primaryType === 'MESA';
  const isMesaShift = currentShift?.category === 'MESA' || officialShift?.category === 'MESA';

  // If a MESA member is being assigned, they do NOT consume GT cupo and shouldn't be blocked by GT cupo!
  // If a GT/GAP member is being assigned, MESA members do NOT count towards filling the shift cupo!
  if (!isMesaBeingAssigned) {
    const effectiveCapacity = currentShift?.capacity ?? officialShift?.capacity;
    if (effectiveCapacity) {
      const relevantOccupantsInShift = assignmentCache.filter(
        (a) =>
          a.dayId === dayId &&
          a.shiftId === shiftId &&
          a.personId !== personId &&
          (currentShift?.category === 'GAP' ? a.assignedType === 'GAP' : a.assignedType === 'GT')
      );
      if (relevantOccupantsInShift.length >= effectiveCapacity) {
        return {
          success: false,
          alertMessage: `CUPO COMPLETO — Este turno ya alcanzó su capacidad máxima de cupos GT (${relevantOccupantsInShift.length}/${effectiveCapacity}).`,
        };
      }
    }
  } else if (isMesaShift) {
    // If it's a dedicated MESA shift, check MESA capacity if defined
    const effectiveCapacity = currentShift?.capacity ?? officialShift?.capacity;
    if (effectiveCapacity) {
      const mesaOccupants = assignmentCache.filter(
        (a) =>
          a.dayId === dayId &&
          a.shiftId === shiftId &&
          a.personId !== personId &&
          a.assignedType === 'MESA'
      );
      if (mesaOccupants.length >= effectiveCapacity) {
        return {
          success: false,
          alertMessage: `CUPO COMPLETO — Este turno de MESA ya alcanzó su capacidad máxima (${mesaOccupants.length}/${effectiveCapacity}).`,
        };
      }
    }
  }

  const existingIndex = assignmentCache.findIndex(
    (a) => a.personId === personId && a.dayId === dayId && a.shiftId === shiftId
  );

  const normalizedAssignedType = assignedType || 'GT';

  const newAssignment: Assignment = {
    id:
      existingIndex >= 0
        ? assignmentCache[existingIndex].id
        : 'asgn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    personId,
    dayId,
    shiftId,
    assignedType: normalizedAssignedType,
    gtSubTeam: assignmentData.gtSubTeam,
    baseId: resolvedBaseId,
    baseNumber: resolvedBaseNumber,
    baseName: resolvedBaseName,
    assignedFunction: assignmentData.assignedFunction,
    roleInBase: assignmentData.roleInBase || assignmentData.assignedFunction,
    requirementId: assignmentData.requirementId,
    notes: assignmentData.notes,
    updatedAt: new Date().toISOString(),
  };

  // 1. Immediately save locally to ensure UI and persistence are instant and 100% reliable
  if (existingIndex >= 0) {
    assignmentCache = assignmentCache.map((a, idx) =>
      idx === existingIndex ? newAssignment : a
    );
  } else {
    assignmentCache = [...assignmentCache, newAssignment];
  }

  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignmentCache));
  assignmentListeners.forEach((fn) => fn([...assignmentCache]));

  // 2. Sync to Supabase in the background
  insertSingleAssignmentToSupabase(newAssignment).catch((err) => {
    console.warn('Background Supabase assignment sync:', err);
  });

  return { success: true, assignment: newAssignment };
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  initializeStorage();
  
  // 1. Immediately remove locally to ensure UI and persistence are instant
  assignmentCache = assignmentCache.filter((a) => a.id !== assignmentId);
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignmentCache));
  assignmentListeners.forEach((fn) => fn([...assignmentCache]));

  // 2. Remove in Supabase in background
  deleteSingleAssignmentFromSupabase(assignmentId).catch((err) => {
    console.warn('Background Supabase delete sync:', err);
  });
}





// ----------------- GROUP FUNCTIONS CRUD -----------------
export async function addGroupFunction(
  data: Omit<GroupFunction, 'id' | 'createdAt'>
): Promise<GroupFunction> {
  initializeStorage();
  const newFn: GroupFunction = {
    ...data,
    id: 'fn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    createdAt: new Date().toISOString(),
  };

  functionCache = [...functionCache, newFn];
  localStorage.setItem(STORAGE_KEYS.FUNCTIONS, JSON.stringify(functionCache));
  functionListeners.forEach((fn) => fn([...functionCache]));
  return newFn;
}

export async function updateGroupFunction(
  id: string,
  updates: Partial<GroupFunction>
): Promise<void> {
  initializeStorage();
  functionCache = functionCache.map((f) => (f.id === id ? { ...f, ...updates } : f));
  localStorage.setItem(STORAGE_KEYS.FUNCTIONS, JSON.stringify(functionCache));
  functionListeners.forEach((fn) => fn([...functionCache]));
}

export async function toggleGroupFunctionActive(id: string): Promise<void> {
  initializeStorage();
  functionCache = functionCache.map((f) =>
    f.id === id ? { ...f, isActive: !f.isActive } : f
  );
  localStorage.setItem(STORAGE_KEYS.FUNCTIONS, JSON.stringify(functionCache));
  functionListeners.forEach((fn) => fn([...functionCache]));
}

export interface FunctionUsageReport {
  peopleCount: number;
  assignmentsCount: number;
  peopleNames: string[];
}

export function checkFunctionUsage(
  functionName: string,
  category: string,
  gtSubTeam?: string
): FunctionUsageReport {
  initializeStorage();
  const cleanName = functionName.trim().toLowerCase();

  // Check people using this function
  const peopleUsing = peopleCache.filter((p) => {
    if (p.primaryType !== category) return false;
    if (category === 'GT' && gtSubTeam && p.gtSubTeam && p.gtSubTeam !== gtSubTeam) return false;
    return (p.functions || []).some((f) => f.trim().toLowerCase() === cleanName);
  });

  // Check assignments using this function
  const assignmentsUsing = assignmentCache.filter((a) => {
    return (
      (a.assignedFunction && a.assignedFunction.trim().toLowerCase() === cleanName) ||
      (a.roleInBase && a.roleInBase.trim().toLowerCase() === cleanName)
    );
  });

  return {
    peopleCount: peopleUsing.length,
    assignmentsCount: assignmentsUsing.length,
    peopleNames: peopleUsing.map((p) => p.name),
  };
}

export async function deleteGroupFunction(
  id: string,
  force = false
): Promise<{ success: boolean; warning?: string }> {
  initializeStorage();
  const targetFn = functionCache.find((f) => f.id === id);
  if (!targetFn) return { success: true };

  const usage = checkFunctionUsage(targetFn.name, targetFn.category, targetFn.gtSubTeam);

  if (!force && (usage.peopleCount > 0 || usage.assignmentsCount > 0)) {
    return {
      success: false,
      warning: `La función "${targetFn.name}" está asignada actualmente a ${usage.peopleCount} persona(s) y ${usage.assignmentsCount} asignación(es) activa(s). No se puede eliminar silenciosamente. Debe confirmar la eliminación forzada.`,
    };
  }

  functionCache = functionCache.filter((f) => f.id !== id);
  localStorage.setItem(STORAGE_KEYS.FUNCTIONS, JSON.stringify(functionCache));
  functionListeners.forEach((fn) => fn([...functionCache]));
  return { success: true };
}

export async function restoreDefaultFunctions(): Promise<void> {
  initializeStorage();
  functionCache = [...DEFAULT_GROUP_FUNCTIONS];
  localStorage.setItem(STORAGE_KEYS.FUNCTIONS, JSON.stringify(functionCache));
  functionListeners.forEach((fn) => fn([...functionCache]));
}

// ----------------- SHIFT REQUIREMENTS CRUD -----------------
export async function saveShiftRequirement(
  reqData: Omit<ShiftRequirement, 'id' | 'updatedAt'> & { id?: string }
): Promise<ShiftRequirement> {
  initializeStorage();

  let existingIdx = -1;
  if (reqData.id) {
    existingIdx = requirementCache.findIndex((r) => r.id === reqData.id);
  }
  if (existingIdx < 0) {
    existingIdx = requirementCache.findIndex(
      (r) =>
        r.dayId === reqData.dayId &&
        r.shiftId === reqData.shiftId &&
        r.groupType === reqData.groupType &&
        (reqData.groupType !== 'GT' || r.gtSubTeam === reqData.gtSubTeam)
    );
  }

  const id =
    reqData.id ||
    (existingIdx >= 0
      ? requirementCache[existingIdx].id
      : 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));

  const newReq: ShiftRequirement = {
    ...(existingIdx >= 0 ? requirementCache[existingIdx] : {}),
    ...reqData,
    id,
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    requirementCache = requirementCache.map((r, idx) => (idx === existingIdx ? newReq : r));
  } else {
    requirementCache = [...requirementCache, newReq];
  }

  localStorage.setItem(STORAGE_KEYS.REQUIREMENTS, JSON.stringify(requirementCache));
  requirementListeners.forEach((fn) => fn([...requirementCache]));
  return newReq;
}

export async function deleteShiftRequirement(id: string): Promise<void> {
  initializeStorage();
  requirementCache = requirementCache.filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.REQUIREMENTS, JSON.stringify(requirementCache));
  requirementListeners.forEach((fn) => fn([...requirementCache]));
}

// ----------------- ATTENDANCE -----------------
export async function recordAttendance(
  attendanceData: Omit<AttendanceRecord, 'id' | 'updatedAt'>
): Promise<void> {
  initializeStorage();
  const { personId, dayId, shiftId } = attendanceData;

  const existingIndex = attendanceCache.findIndex(
    (at) => at.personId === personId && at.dayId === dayId && at.shiftId === shiftId
  );

  const newRecord: AttendanceRecord = {
    id: existingIndex >= 0 ? attendanceCache[existingIndex].id : 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
    ...attendanceData,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    attendanceCache = attendanceCache.map((at, idx) =>
      idx === existingIndex ? newRecord : at
    );
  } else {
    attendanceCache = [...attendanceCache, newRecord];
  }

  localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(attendanceCache));
  attendanceListeners.forEach((fn) => fn([...attendanceCache]));
}

// ----------------- DYNAMIC SHIFTS (ADMIN TOTAL CONTROL) -----------------
export interface ShiftConflictReport {
  personName: string;
  personId: string;
  conflictingShiftName: string;
  conflictingHours: string;
}

export function checkShiftTimeChangeConflicts(
  shiftId: string,
  newStartTime: string,
  newEndTime: string
): ShiftConflictReport[] {
  initializeStorage();
  const currentShift = shiftsCache.find((s) => s.id === shiftId);
  if (!currentShift) return [];

  const tempShift: ConfigurableShift = {
    ...currentShift,
    startTime: newStartTime,
    endTime: newEndTime,
  };

  const shiftAssignments = assignmentCache.filter((a) => a.shiftId === shiftId);
  const conflicts: ShiftConflictReport[] = [];

  for (const assign of shiftAssignments) {
    const person = peopleCache.find((p) => p.id === assign.personId);
    const personName = person ? person.name : 'Persona asignada';

    // Find other assignments for the same person on the same day
    const otherAssignments = assignmentCache.filter(
      (a) => a.personId === assign.personId && a.dayId === assign.dayId && a.shiftId !== shiftId
    );

    for (const other of otherAssignments) {
      const otherShift = shiftsCache.find((s) => s.id === other.shiftId);
      if (otherShift && otherShift.isActive && doShiftsOverlap(tempShift, otherShift)) {
        conflicts.push({
          personName,
          personId: assign.personId,
          conflictingShiftName: otherShift.name,
          conflictingHours: otherShift.label,
        });
      }
    }
  }

  return conflicts;
}

export function checkShiftDeleteImpact(shiftId: string): {
  count: number;
  peopleNames: string[];
} {
  initializeStorage();
  const assignments = assignmentCache.filter((a) => a.shiftId === shiftId);
  const peopleNames = assignments
    .map((a) => peopleCache.find((p) => p.id === a.personId)?.name || 'Persona')
    .filter((name, idx, self) => self.indexOf(name) === idx);

  return {
    count: assignments.length,
    peopleNames,
  };
}

export async function saveShift(
  shiftData: Partial<ConfigurableShift> & {
    name: string;
    dayId: string;
    eventId: string;
    category: ConfigurableShift['category'];
    startTime: string;
    endTime: string;
    capacity: number;
  }
): Promise<{ shift: ConfigurableShift; conflicts: ShiftConflictReport[] }> {
  initializeStorage();

  const id =
    shiftData.id ||
    `shift_${shiftData.dayId}_${shiftData.category.toLowerCase()}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`;

  const label =
    formatTimeRangeLabel(shiftData.startTime, shiftData.endTime);

  // Check if updating an existing shift with changed hours
  let conflicts: ShiftConflictReport[] = [];
  const existingIndex = shiftsCache.findIndex((s) => s.id === id);
  if (existingIndex >= 0) {
    const existing = shiftsCache[existingIndex];
    if (existing.startTime !== shiftData.startTime || existing.endTime !== shiftData.endTime) {
      conflicts = checkShiftTimeChangeConflicts(id, shiftData.startTime, shiftData.endTime);
    }
  }

  const newShift: ConfigurableShift = {
    id,
    name: shiftData.name.trim(),
    dayId: shiftData.dayId,
    eventId: shiftData.eventId,
    category: shiftData.category,
    gtSubTeam: shiftData.category === 'GT' ? (shiftData.gtSubTeam || (shiftData.gtSubTeams && shiftData.gtSubTeams[0])) : undefined,
    gtSubTeams: shiftData.category === 'GT' ? (shiftData.gtSubTeams || (shiftData.gtSubTeam ? [shiftData.gtSubTeam] : [])) : undefined,
    startTime: shiftData.startTime,
    endTime: shiftData.endTime,
    label,
    capacity: Number(shiftData.capacity) || 1,
    isActive: shiftData.isActive !== undefined ? shiftData.isActive : true,
    hasBases: shiftData.hasBases !== undefined ? shiftData.hasBases : shiftData.category === 'GAP',
    baseIds: shiftData.baseIds,
    specificFunctions: shiftData.specificFunctions || [],
    notes: shiftData.notes || '',
    forTypes: [shiftData.category],
    createdAt: existingIndex >= 0 ? shiftsCache[existingIndex].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    shiftsCache[existingIndex] = newShift;
  } else {
    shiftsCache.push(newShift);
  }

  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shiftsCache));
  shiftListeners.forEach((fn) => fn([...shiftsCache]));

  pushSingleShiftToSupabase(newShift).catch((err) =>
    console.warn('Error syncing shift to Supabase:', err)
  );

  return { shift: newShift, conflicts };
}

export async function duplicateShift(id: string): Promise<ConfigurableShift | null> {
  initializeStorage();
  const source = shiftsCache.find((s) => s.id === id);
  if (!source) return null;

  const newId = `shift_${source.dayId}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`;

  // Find sensible duplicate name, e.g. T1 -> T1 (Copia) or auto-increment
  let duplicateName = `${source.name} (Copia)`;
  const matchT = source.name.match(/^T(\d+)$/i);
  if (matchT) {
    const nextNum = parseInt(matchT[1], 10) + 1;
    const candidate = `T${nextNum}`;
    const exists = shiftsCache.some((s) => s.dayId === source.dayId && s.category === source.category && s.name.toUpperCase() === candidate);
    if (!exists) {
      duplicateName = candidate;
    }
  }

  const duplicated: ConfigurableShift = {
    ...source,
    id: newId,
    name: duplicateName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  shiftsCache.push(duplicated);
  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shiftsCache));
  shiftListeners.forEach((fn) => fn([...shiftsCache]));

  pushSingleShiftToSupabase(duplicated).catch((err) =>
    console.warn('Error syncing duplicated shift to Supabase:', err)
  );

  return duplicated;
}

export async function deleteShift(
  id: string,
  removeAssignments = false
): Promise<{ success: boolean; warning?: string }> {
  initializeStorage();
  const impact = checkShiftDeleteImpact(id);

  if (!removeAssignments && impact.count > 0) {
    return {
      success: false,
      warning: `Este turno tiene ${impact.count} persona(s) asignada(s) (${impact.peopleNames.slice(0, 3).join(', ')}${impact.peopleNames.length > 3 ? '...' : ''}). Al eliminarlo, sus asignaciones relacionadas también deberán gestionarse. Por favor confirma la eliminación.`,
    };
  }

  // Remove related assignments if confirmed
  if (impact.count > 0 && removeAssignments) {
    assignmentCache = assignmentCache.filter((a) => a.shiftId !== id);
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignmentCache));
    assignmentListeners.forEach((fn) => fn([...assignmentCache]));
  }

  shiftsCache = shiftsCache.filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shiftsCache));
  shiftListeners.forEach((fn) => fn([...shiftsCache]));

  deleteSingleShiftFromSupabase(id).catch((err) =>
    console.warn('Error deleting shift from Supabase:', err)
  );

  return { success: true };
}

// ----------------- DYNAMIC EVENTS (ADMIN TOTAL CONTROL) -----------------
export async function saveEvent(
  eventData: Partial<AppEvent> & { name: string; dayId: string; dayName: string }
): Promise<AppEvent> {
  initializeStorage();
  const id =
    eventData.id ||
    `event_${eventData.dayId}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`;

  const existingIdx = eventsCache.findIndex((e) => e.id === id);
  const newEvent: AppEvent = {
    id,
    name: eventData.name.trim().toUpperCase(),
    dayId: eventData.dayId.toLowerCase().trim(),
    dayName: eventData.dayName.trim(),
    description: eventData.description || '',
    notes: eventData.notes || '',
    isActive: eventData.isActive !== undefined ? eventData.isActive : true,
    isCarnival: eventData.isCarnival || false,
    order: eventData.order || eventsCache.length + 1,
    createdAt: existingIdx >= 0 ? eventsCache[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    eventsCache[existingIdx] = newEvent;
  } else {
    eventsCache.push(newEvent);
  }

  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(eventsCache));
  eventListeners.forEach((fn) => fn([...eventsCache]));
  return newEvent;
}

export async function deleteEvent(
  id: string,
  force = false
): Promise<{ success: boolean; warning?: string }> {
  initializeStorage();
  const relatedShifts = shiftsCache.filter((s) => s.eventId === id);

  if (!force && relatedShifts.length > 0) {
    return {
      success: false,
      warning: `Este evento tiene ${relatedShifts.length} turno(s) configurado(s). Para eliminarlo, confirme que desea eliminar también los turnos y sus datos.`,
    };
  }

  if (force && relatedShifts.length > 0) {
    const shiftIds = relatedShifts.map((s) => s.id);
    shiftsCache = shiftsCache.filter((s) => !shiftIds.includes(s.id));
    assignmentCache = assignmentCache.filter((a) => !shiftIds.includes(a.shiftId));
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shiftsCache));
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignmentCache));
    shiftListeners.forEach((fn) => fn([...shiftsCache]));
    assignmentListeners.forEach((fn) => fn([...assignmentCache]));
  }

  eventsCache = eventsCache.filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(eventsCache));
  eventListeners.forEach((fn) => fn([...eventsCache]));
  return { success: true };
}

// ----------------- DYNAMIC BASES (ADMIN TOTAL CONTROL) -----------------
export function checkBaseDeleteImpact(baseId: number | string): {
  count: number;
  peopleNames: string[];
} {
  initializeStorage();
  const cleanId = String(baseId);
  const assignments = assignmentCache.filter(
    (a) => String(a.baseNumber) === cleanId || (a.baseName && a.baseName.toLowerCase().includes(cleanId.toLowerCase()))
  );

  const peopleNames = assignments
    .map((a) => peopleCache.find((p) => p.id === a.personId)?.name || 'Persona')
    .filter((name, idx, self) => self.indexOf(name) === idx);

  return { count: assignments.length, peopleNames };
}

export async function saveBase(
  baseData: Partial<ConfigurableBase> & { name: string; defaultCapacity: number }
): Promise<ConfigurableBase> {
  initializeStorage();
  const id = baseData.id !== undefined ? baseData.id : `base_${Date.now()}`;
  const existingIdx = basesCache.findIndex((b) => String(b.id) === String(id));

  const newBase: ConfigurableBase = {
    id,
    name: baseData.name.trim(),
    code: baseData.code || `base-${id}`,
    defaultCapacity: Number(baseData.defaultCapacity) || 2,
    isSpecial: baseData.isSpecial || false,
    isActive: baseData.isActive !== undefined ? baseData.isActive : true,
    eventId: baseData.eventId,
    notes: baseData.notes || '',
    createdAt: existingIdx >= 0 ? basesCache[existingIdx].createdAt : new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    basesCache[existingIdx] = newBase;
  } else {
    basesCache.push(newBase);
  }

  localStorage.setItem(STORAGE_KEYS.BASES, JSON.stringify(basesCache));
  baseListeners.forEach((fn) => fn([...basesCache]));
  return newBase;
}

export async function deleteBase(
  id: number | string,
  force = false
): Promise<{ success: boolean; warning?: string }> {
  initializeStorage();
  const impact = checkBaseDeleteImpact(id);

  if (!force && impact.count > 0) {
    return {
      success: false,
      warning: `Esta base tiene ${impact.count} asignación(es) activa(s). Confirma si deseas eliminarla de todas formas.`,
    };
  }

  basesCache = basesCache.filter((b) => String(b.id) !== String(id));
  localStorage.setItem(STORAGE_KEYS.BASES, JSON.stringify(basesCache));
  baseListeners.forEach((fn) => fn([...basesCache]));
  return { success: true };
}

export async function restoreDefaultSchedule(): Promise<void> {
  initializeStorage();
  eventsCache = [...DEFAULT_INITIAL_EVENTS];
  shiftsCache = [...DEFAULT_INITIAL_SHIFTS];
  basesCache = [...DEFAULT_INITIAL_BASES];

  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(eventsCache));
  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shiftsCache));
  localStorage.setItem(STORAGE_KEYS.BASES, JSON.stringify(basesCache));

  eventListeners.forEach((fn) => fn([...eventsCache]));
  shiftListeners.forEach((fn) => fn([...shiftsCache]));
  baseListeners.forEach((fn) => fn([...basesCache]));
}

// ----------------- CLEAN RESET (STRICT ZERO STATE) -----------------
export function resetToEmptyState(): void {
  peopleCache = [];
  assignmentCache = [];
  availabilityCache = [];
  attendanceCache = [];

  localStorage.removeItem(STORAGE_KEYS.PEOPLE);
  localStorage.removeItem(STORAGE_KEYS.ASSIGNMENTS);
  localStorage.removeItem(STORAGE_KEYS.AVAILABILITIES);
  localStorage.removeItem(STORAGE_KEYS.ATTENDANCES);

  notifyAll();
}

// ----------------- EXPORT / IMPORT -----------------
export function exportAllData(): string {
  return JSON.stringify(
    {
      app: 'DIAS_EAFIT',
      version: '3.0',
      exportedAt: new Date().toISOString(),
      people: peopleCache,
      assignments: assignmentCache,
      availabilities: availabilityCache,
      attendances: attendanceCache,
      functions: functionCache,
      requirements: requirementCache,
      events: eventsCache,
      shifts: shiftsCache,
      bases: basesCache,
    },
    null,
    2
  );
}

export function importAllData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data.people)) return false;

    peopleCache = data.people || [];
    assignmentCache = data.assignments || [];
    availabilityCache = data.availabilities || [];
    attendanceCache = data.attendances || [];
    if (Array.isArray(data.functions)) {
      functionCache = data.functions;
      localStorage.setItem(STORAGE_KEYS.FUNCTIONS, JSON.stringify(functionCache));
    }
    if (Array.isArray(data.requirements)) {
      requirementCache = data.requirements;
      localStorage.setItem(STORAGE_KEYS.REQUIREMENTS, JSON.stringify(requirementCache));
    }
    if (Array.isArray(data.events)) {
      eventsCache = data.events;
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(eventsCache));
    }
    if (Array.isArray(data.shifts)) {
      shiftsCache = data.shifts;
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shiftsCache));
    }
    if (Array.isArray(data.bases)) {
      basesCache = data.bases;
      localStorage.setItem(STORAGE_KEYS.BASES, JSON.stringify(basesCache));
    }

    localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(peopleCache));
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignmentCache));
    localStorage.setItem(STORAGE_KEYS.AVAILABILITIES, JSON.stringify(availabilityCache));
    localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(attendanceCache));

    notifyAll();
    return true;
  } catch (err) {
    console.error('Failed to import data:', err);
    return false;
  }
}

// ----------------- CLOUD SYNCHRONIZATION HELPERS -----------------
export function replaceAllPeopleFromCloud(newPeople: Person[]): void {
  // Normalize usernames
  peopleCache = newPeople.map((p) => {
    const derived = derivePersonUsername(p);
    if (derived && (!p.username || p.username === p.documentId)) {
      return { ...p, username: derived };
    }
    return p;
  });
  localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(peopleCache));
  peopleListeners.forEach((fn) => fn([...peopleCache]));
}

export function replaceAllAssignmentsFromCloud(newAssignments: Assignment[]): void {
  assignmentCache = newAssignments;
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignmentCache));
  assignmentListeners.forEach((fn) => fn([...assignmentCache]));
}

export function replaceAllAvailabilitiesFromCloud(newAvail: AvailabilityRecord[]): void {
  availabilityCache = newAvail;
  localStorage.setItem(STORAGE_KEYS.AVAILABILITIES, JSON.stringify(availabilityCache));
  availabilityListeners.forEach((fn) => fn([...availabilityCache]));
}

export function replaceAllBasesFromCloud(newBases: PhysicalBase[]): void {
  basesCache = newBases;
  localStorage.setItem(STORAGE_KEYS.BASES, JSON.stringify(basesCache));
  baseListeners.forEach((fn) => fn([...basesCache]));
}

export function replaceAllShiftsFromCloud(newShifts: ConfigurableShift[]): void {
  if (!newShifts || newShifts.length === 0) return;
  const shiftMap = new Map<string, ConfigurableShift>();
  DEFAULT_INITIAL_SHIFTS.forEach((ds) => shiftMap.set(ds.id, { ...ds }));
  shiftsCache.forEach((cs) => shiftMap.set(cs.id, cs));
  newShifts.forEach((ns) => {
    if (ns && ns.id) {
      if (
        (ns.id === 'jueves-t2-gt' || ns.id === 'jueves-t2') &&
        ns.startTime === '12:30' &&
        ns.endTime === '18:00'
      ) {
        ns.startTime = '13:00';
        ns.endTime = '21:00';
        ns.label = '1:00 p. m. a 9:00 p. m.';
      }
      shiftMap.set(ns.id, ns);
    }
  });
  shiftsCache = Array.from(shiftMap.values());
  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shiftsCache));
  shiftListeners.forEach((fn) => fn([...shiftsCache]));
}


