import React, { useState, useMemo, useEffect } from 'react';
import {
  Person,
  Assignment,
  PhysicalBase,
  GroupFunction,
  ShiftRequirement,
  GtSubTeam,
  PersonType,
  AvailabilityRecord,
  ConfigurableShift,
  Shift,
  AppEvent,
  ConfigurableBase,
  getEffectivePersonType,
} from '../types';
import {
  EVENT_SCHEDULE,
  CARNIVAL_PHYSICAL_BASES,
  THE_GAMES_JUEVES_BASES,
  THE_GAMES_VIERNES_BASES,
  CARNIVAL_GT_SHIFTS,
  CARNIVAL_GAP_SHIFTS,
  CARNIVAL_MESA_SHIFTS,
  getBaseDisplayName,
  findShiftById,
  doShiftsOverlap,
  areBasesEqual,
  DEFAULT_INITIAL_SHIFTS,
} from '../data/eventStructure';
import {
  GT_SUBTEAMS,
  getFilteredFunctions,
  CARNIVAL_GAP_OFFICIAL_FUNCTIONS,
  CarnivalGapFunction,
} from '../data/functionsCatalog';
import {
  assignPerson,
  removeAssignment,
  updateAssignmentFunction,
  saveShiftRequirement,
  deleteShiftRequirement,
  pullAssignmentsFromSupabase,
} from '../services/storageService';
import {
  CarnivalAutoAssignModal,
  CarnivalAutoPromptData,
  CarnivalPosteriorShiftStatus,
} from './CarnivalAutoAssignModal';
import {
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Grid,
  Info,
  Shield,
  Layers,
  Sparkles,
  Lock,
  Tag,
  Filter,
  Search,
  X,
  Check,
  Calendar,
  AlertCircle,
  UserCheck,
  Sliders,
  MapPin,
  Crown,
} from 'lucide-react';

interface AssignmentViewProps {
  people: Person[];
  assignments: Assignment[];
  availabilities?: AvailabilityRecord[];
  functions?: GroupFunction[];
  requirements?: ShiftRequirement[];
  shifts?: ConfigurableShift[];
  events?: AppEvent[];
  bases?: ConfigurableBase[];
  onNavigateToConfig?: () => void;
}

export const normalizeSubTeam = (sub?: string): string => {
  if (!sub) return '';
  const clean = sub
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^gt\s*[:\-]?\s*/i, '')
    .trim();
  if (clean.includes('segur')) return 'seguridad';
  if (clean.includes('logist')) return 'logistica';
  if (clean.includes('merc') || clean.includes('mkt')) return 'mercadeo';
  if (clean.includes('rrpp') || clean.includes('relac')) return 'rrpp';
  if (clean === 'gh' || clean.includes('gestion') || clean.includes('humana')) return 'gh';
  if (clean.includes('carniv')) return 'carnival';
  if (clean.includes('game')) return 'the games';
  if (clean.includes('gener')) return 'generales';
  return clean;
};

export const matchesGtSubTeam = (person: Person, requiredSubTeam?: string): boolean => {
  if (!requiredSubTeam) return true;
  const reqNorm = normalizeSubTeam(requiredSubTeam);
  if (!reqNorm) return true;

  if (person.gtSubTeam && normalizeSubTeam(person.gtSubTeam) === reqNorm) {
    return true;
  }

  if (Array.isArray(person.gtTeams) && person.gtTeams.some((t) => normalizeSubTeam(t) === reqNorm)) {
    return true;
  }

  if (person.notes && normalizeSubTeam(person.notes).includes(reqNorm)) {
    return true;
  }

  return false;
};

export const getCarnivalWindow = (
  sid?: string,
  sname?: string,
  slabel?: string,
  sstart?: string,
  send?: string
): string | null => {
  const str = `${sid || ''} ${sname || ''} ${slabel || ''}`.toLowerCase();

  // Early morning (GT T1: 6:50 - 9:00 AM)
  if (
    str.includes('gt-t1') ||
    /(?:gt.*t(?:urno)?\s*1\b|t(?:urno)?\s*1.*gt)/i.test(str) ||
    str.includes('6:50') ||
    str.includes('06:50') ||
    (sstart && sstart.startsWith('06:50'))
  ) {
    return 'T1_GT_EARLY';
  }

  // Morning (GT T2: 8:50 - 12:10 <===> GAP T1: 8:50 - 12:10)
  if (
    str.includes('gap-t1') ||
    str.includes('gt-t2') ||
    str.includes('miercoles-gap-t1') ||
    str.includes('miercoles-gt-t2') ||
    /(?:gap.*t(?:urno)?\s*1\b|t(?:urno)?\s*1.*gap)/i.test(str) ||
    /(?:gt.*t(?:urno)?\s*2\b|t(?:urno)?\s*2.*gt)/i.test(str) ||
    str.includes('8:50') ||
    str.includes('08:50') ||
    (sstart && (sstart.startsWith('08:50') || sstart.startsWith('8:50')))
  ) {
    return 'MORNING';
  }

  // Midday (GT T3: 12:00 - 3:10 <===> GAP T2: 12:00 - 3:10)
  if (
    str.includes('gap-t2') ||
    str.includes('gt-t3') ||
    str.includes('miercoles-gap-t2') ||
    str.includes('miercoles-gt-t3') ||
    /(?:gap.*t(?:urno)?\s*2\b|t(?:urno)?\s*2.*gap)/i.test(str) ||
    /(?:gt.*t(?:urno)?\s*3\b|t(?:urno)?\s*3.*gt)/i.test(str) ||
    str.includes('12:00') ||
    str.includes('12:10') ||
    str.includes('12:30') ||
    (sstart && (sstart.startsWith('12:00') || sstart.startsWith('12:10') || sstart.startsWith('12:30')))
  ) {
    return 'MIDDAY';
  }

  // Afternoon (GT T4: 3:00 - 6:10 <===> GAP T3: 3:00 - 6:10)
  if (
    str.includes('gap-t3') ||
    str.includes('gt-t4') ||
    str.includes('miercoles-gap-t3') ||
    str.includes('miercoles-gt-t4') ||
    /(?:gap.*t(?:urno)?\s*3\b|t(?:urno)?\s*3.*gap)/i.test(str) ||
    /(?:gt.*t(?:urno)?\s*4\b|t(?:urno)?\s*4.*gt)/i.test(str) ||
    str.includes('3:00') ||
    str.includes('15:00') ||
    str.includes('15:10') ||
    (sstart && (sstart.startsWith('15:00') || sstart.startsWith('3:00')))
  ) {
    return 'AFTERNOON';
  }

  // Evening (GT T5: 6:00 - 9:00 PM)
  if (
    str.includes('gt-t5') ||
    str.includes('miercoles-gt-t5') ||
    /(?:gt.*t(?:urno)?\s*5\b|t(?:urno)?\s*5.*gt)/i.test(str) ||
    str.includes('6:00 p') ||
    str.includes('18:00') ||
    (sstart && (sstart.startsWith('18:00') || sstart.startsWith('6:00')))
  ) {
    return 'T5_GT_LATE';
  }

  return null;
};

export const getCarnivalGapTurnNumber = (shift: ConfigurableShift | Shift): number => {
  const win = getCarnivalWindow(shift.id, shift.name, shift.label, shift.startTime, shift.endTime);
  if (win === 'MORNING') return 1;
  if (win === 'MIDDAY') return 2;
  if (win === 'AFTERNOON') return 3;
  if (shift.id === 'miercoles-gap-t1' || shift.id === 'miercoles-gt-t2') return 1;
  if (shift.id === 'miercoles-gap-t2' || shift.id === 'miercoles-gt-t3') return 2;
  if (shift.id === 'miercoles-gap-t3' || shift.id === 'miercoles-gt-t4') return 3;
  if (/t(?:urno)?\s*1\b/i.test(shift.name) || /t1/i.test(shift.id)) return 1;
  if (/t(?:urno)?\s*2\b/i.test(shift.name) || /t2/i.test(shift.id)) return 2;
  if (/t(?:urno)?\s*3\b/i.test(shift.name) || /t3/i.test(shift.id)) return 3;
  return 1;
};

export const getOfficialCarnivalGapShifts = (
  allShifts?: ConfigurableShift[]
): (ConfigurableShift | Shift)[] => {
  const source = allShifts && allShifts.length > 0 ? allShifts : DEFAULT_INITIAL_SHIFTS;
  const gapShifts = source.filter(
    (s) => s.dayId === 'miercoles' && (s.category === 'GAP' || s.hasBases)
  );

  const t1 =
    gapShifts.find((s) => getCarnivalGapTurnNumber(s) === 1) ||
    DEFAULT_INITIAL_SHIFTS.find((s) => s.id === 'miercoles-gap-t1')!;
  const t2 =
    gapShifts.find((s) => getCarnivalGapTurnNumber(s) === 2) ||
    DEFAULT_INITIAL_SHIFTS.find((s) => s.id === 'miercoles-gap-t2')!;
  const t3 =
    gapShifts.find((s) => getCarnivalGapTurnNumber(s) === 3) ||
    DEFAULT_INITIAL_SHIFTS.find((s) => s.id === 'miercoles-gap-t3')!;

  return [t1, t2, t3];
};

export const AssignmentView: React.FC<AssignmentViewProps> = ({
  people,
  assignments,
  availabilities = [],
  functions = [],
  requirements = [],
  shifts,
  events,
  bases,
  onNavigateToConfig,
}) => {
  const [selectedDayId, setSelectedDayId] = useState<string>('lunes');
  // Sub-category selector for CARNIVAL: GT (default)
  const [carnivalCategory, setCarnivalCategory] = useState<'GAP' | 'GT' | 'MESA'>('GT');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('lunes-t1');
  const [selectedBaseNumber, setSelectedBaseNumber] = useState<number | string | null>(null);
  const [modalBase, setModalBase] = useState<PhysicalBase | null>(null);
  const [baseAssignTab, setBaseAssignTab] = useState<'GAP' | 'GT' | 'MESA'>('GT');

  // Requirement Creation Modal State
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);
  const [reqGroupType, setReqGroupType] = useState<PersonType>('GT');
  const [reqGtSubTeam, setReqGtSubTeam] = useState<GtSubTeam>('Logística');
  const [reqCapacity, setReqCapacity] = useState<number>(10);
  const [reqShowSpecificFunctions, setReqShowSpecificFunctions] = useState(false);
  const [reqSelectedFunctions, setReqSelectedFunctions] = useState<string[]>([]);
  const [reqNotes, setReqNotes] = useState('');

  // Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [activeRequirement, setActiveRequirement] = useState<ShiftRequirement | null>(null);
  const [modalPersonId, setModalPersonId] = useState('');
  const [modalAssignedType, setModalAssignedType] = useState<PersonType>('GT');
  const [modalGtSubTeam, setModalGtSubTeam] = useState<GtSubTeam | undefined>('Logística');
  const [modalAssignedFunction, setModalAssignedFunction] = useState('');
  const [modalRoleInBase, setModalRoleInBase] = useState('Staff General');
  const [modalAlert, setModalAlert] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContinuityLocked, setIsContinuityLocked] = useState(false);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const [showOnlyAvailableInModal, setShowOnlyAvailableInModal] = useState(true);
  const [shiftCategoryFilter, setShiftCategoryFilter] = useState<'ALL' | 'GT' | 'GAP' | 'MESA'>('ALL');
  const [activeRosterFilter, setActiveRosterFilter] = useState<string>('ALL');
  const [assignedRosterSearch, setAssignedRosterSearch] = useState<string>('');
  const [modalGtSubTeamFilter, setModalGtSubTeamFilter] = useState<string>('ALL');
  const [carnivalAutoPrompt, setCarnivalAutoPrompt] = useState<CarnivalAutoPromptData | null>(null);
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null);
  const [roleChangeSuccess, setRoleChangeSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!actionSuccessToast) return;
    const t = setTimeout(() => {
      setActionSuccessToast(null);
    }, 6000);
    return () => clearTimeout(t);
  }, [actionSuccessToast]);

  const currentDay = EVENT_SCHEDULE.find((d) => d.dayId === selectedDayId) || EVENT_SCHEDULE[0];
  const isCarnival = currentDay.isCarnival;
  const isDivided = currentDay.isDivided;

  // All active shifts for this day
  const allShiftsInDay = useMemo(() => {
    if (shifts && shifts.length > 0) {
      const activeInDay = shifts.filter((s) => s.dayId === selectedDayId && s.isActive !== false);
      if (activeInDay.length > 0) return activeInDay;
    }
    if (isDivided) {
      return isCarnival ? [...CARNIVAL_GT_SHIFTS, ...CARNIVAL_GAP_SHIFTS, ...(CARNIVAL_MESA_SHIFTS || [])] : currentDay.shifts;
    }
    return currentDay.shifts;
  }, [shifts, selectedDayId, isCarnival, isDivided, currentDay]);

  const gtShiftsInDay = useMemo(() => {
    return allShiftsInDay.filter((s) => (s.category === 'GT' || s.category === 'MESA') && !s.hasBases);
  }, [allShiftsInDay]);

  const gapShiftsInDay = useMemo(() => {
    return allShiftsInDay.filter((s) => s.category === 'GAP' || s.hasBases);
  }, [allShiftsInDay]);

  const mesaShiftsInDay = useMemo(() => {
    return allShiftsInDay.filter((s) => s.category === 'MESA' || s.name.toUpperCase().includes('MESA'));
  }, [allShiftsInDay]);

  // Active shifts available in this view (dynamically uses configurable shifts if present)
  const availableShifts = useMemo(() => {
    if (isDivided && isCarnival) {
      if (carnivalCategory === 'GAP') {
        const filtered = allShiftsInDay.filter((s) => s.category === 'GAP' || s.hasBases);
        if (filtered.length > 0) return filtered;
      } else if (carnivalCategory === 'MESA') {
        const filtered = allShiftsInDay.filter((s) => s.category === 'MESA' || s.name.toUpperCase().includes('MESA'));
        if (filtered.length > 0) return filtered;
      } else if (carnivalCategory === 'GT') {
        const filtered = allShiftsInDay.filter((s) => (s.category === 'GT' || s.category === 'MESA') && !s.hasBases);
        if (filtered.length > 0) return filtered;
      }
    }

    if (shiftCategoryFilter === 'GT') {
      return gtShiftsInDay.length > 0 ? gtShiftsInDay : allShiftsInDay;
    } else if (shiftCategoryFilter === 'GAP') {
      return gapShiftsInDay.length > 0 ? gapShiftsInDay : allShiftsInDay;
    } else if (shiftCategoryFilter === 'MESA') {
      return mesaShiftsInDay.length > 0 ? mesaShiftsInDay : allShiftsInDay;
    }

    return allShiftsInDay;
  }, [isDivided, isCarnival, carnivalCategory, shiftCategoryFilter, allShiftsInDay, gtShiftsInDay, gapShiftsInDay, mesaShiftsInDay]);

  // Current active shift object
  const activeShift =
    availableShifts.find((s) => s.id === selectedShiftId) ||
    availableShifts[0] || {
      id: 'default-shift',
      dayId: selectedDayId,
      name: 'Turno Estándar',
      startTime: '08:00',
      endTime: '12:00',
      category: 'GT' as PersonType,
      hasBases: false,
    };

  const handleDaySelect = (dayId: string) => {
    setSelectedDayId(dayId);
    setSelectedBaseNumber(null);
    setModalBase(null);
    const dayShifts = (shifts && shifts.length > 0 ? shifts : EVENT_SCHEDULE.find((d) => d.dayId === dayId)?.shifts || [])
      .filter((s) => s.dayId === dayId && s.isActive !== false);

    if (dayShifts.length > 0) {
      setSelectedShiftId(dayShifts[0].id);
    }
  };

  const handleCarnivalCategorySelect = (cat: 'GAP' | 'GT' | 'MESA') => {
    setCarnivalCategory(cat);
    setSelectedBaseNumber(null);
    setModalBase(null);
    if (cat === 'GAP') {
      setShiftCategoryFilter('GAP');
      const gapShift = allShiftsInDay.find((s) => s.category === 'GAP' || s.hasBases);
      if (gapShift) {
        setSelectedShiftId(gapShift.id);
      }
    } else if (cat === 'MESA') {
      setShiftCategoryFilter('MESA');
      const mesaShift = allShiftsInDay.find((s) => s.category === 'MESA' || s.name.toUpperCase().includes('MESA'));
      if (mesaShift) {
        setSelectedShiftId(mesaShift.id);
      }
    } else {
      setShiftCategoryFilter('GT');
      const gtShift = allShiftsInDay.find((s) => s.category === 'GT' && !s.hasBases);
      setSelectedShiftId(gtShift ? gtShift.id : (allShiftsInDay[0]?.id || 'miercoles-gt-t1'));
    }
  };

  const handleShiftCategoryFilterChange = (cat: 'ALL' | 'GT' | 'GAP' | 'MESA') => {
    setShiftCategoryFilter(cat);
    setSelectedBaseNumber(null);
    setModalBase(null);
    if (cat === 'GT') {
      const gtShift = allShiftsInDay.find((s) => (s.category === 'GT' || s.category === 'MESA') && !s.hasBases);
      if (gtShift) setSelectedShiftId(gtShift.id);
    } else if (cat === 'GAP') {
      const gapShift = allShiftsInDay.find((s) => s.category === 'GAP' || s.hasBases);
      if (gapShift) setSelectedShiftId(gapShift.id);
    } else if (cat === 'MESA') {
      const mesaShift = allShiftsInDay.find((s) => s.category === 'MESA' || s.name.toUpperCase().includes('MESA'));
      if (mesaShift) setSelectedShiftId(mesaShift.id);
    }
  };

  // Determine physical bases for current day & category (dynamically uses configurable bases if present)
  const physicalBases: PhysicalBase[] = useMemo(() => {
    if (selectedDayId === 'miercoles') {
      // Carnival ALWAYS has exactly 22 physical bases: BASE 1 to BASE 19, and BASE TORO (20), BASE SPEED (21), BASE ARCADE (22)
      return CARNIVAL_PHYSICAL_BASES.map((cb) => {
        const custom = (bases || []).find(
          (b) =>
            b.isActive &&
            (b.eventId === 'carnival' || b.dayId === 'miercoles') &&
            (String(b.id) === `carnival_${cb.id}` ||
              String(b.baseNumber) === String(cb.id) ||
              b.name.toLowerCase() === cb.name.toLowerCase())
        );
        const cap = custom?.gapCapacity || custom?.capacity || custom?.defaultCapacity || cb.gapCapacity || cb.defaultCapacity;
        return {
          id: cb.id,
          baseNumber: cb.id,
          baseLabel: cb.baseLabel,
          gameName: cb.gameName,
          name: cb.name,
          code: cb.code,
          gapCapacity: cap,
          defaultCapacity: cap,
          suggestedCapacity: cap,
          isSpecial: cb.isSpecial,
        };
      });
    }

    if (selectedDayId === 'jueves') {
      return THE_GAMES_JUEVES_BASES.map((b) => ({
        id: b.id,
        baseNumber: b.baseNumber || b.id,
        name: b.name,
        defaultCapacity: b.capacity || b.defaultCapacity || 2,
        suggestedCapacity: b.capacity || b.defaultCapacity || 2,
        isSpecial: b.isSpecial,
      }));
    }

    if (selectedDayId === 'viernes') {
      return THE_GAMES_VIERNES_BASES.map((b) => ({
        id: b.id,
        baseNumber: b.baseNumber || b.id,
        name: b.name,
        defaultCapacity: b.capacity || b.defaultCapacity || 2,
        suggestedCapacity: b.capacity || b.defaultCapacity || 2,
        isSpecial: b.isSpecial,
      }));
    }

    return [];
  }, [bases, selectedDayId]);

  // Active requirements for this day and shift
  const currentShiftRequirements = useMemo(() => {
    return requirements.filter(
      (r) => r.dayId === selectedDayId && r.shiftId === activeShift.id
    );
  }, [requirements, selectedDayId, activeShift.id]);

  // Assignments for current shift
  const currentShiftAssignments = useMemo(() => {
    return assignments.filter(
      (a) => a.dayId === selectedDayId && a.shiftId === activeShift.id
    );
  }, [assignments, selectedDayId, activeShift.id]);

  const assignedGtCount = useMemo(
    () => currentShiftAssignments.filter((a) => a.assignedType === 'GT').length,
    [currentShiftAssignments]
  );
  const assignedGapCount = useMemo(
    () => currentShiftAssignments.filter((a) => a.assignedType === 'GAP').length,
    [currentShiftAssignments]
  );
  const assignedMesaCount = useMemo(
    () => currentShiftAssignments.filter((a) => a.assignedType === 'MESA').length,
    [currentShiftAssignments]
  );

  // Lista estándar de Sub-Equipos de GT (con Logística y Mercadeo al frente como pidió el usuario)
  const PRIMARY_GT_SUBTEAMS = useMemo(
    () => ['Logística', 'Mercadeo', 'RRPP', 'Generales', 'GH', 'Seguridad', 'The Games', 'Carnival'],
    []
  );

  // Conteo en tiempo real de cada sub-equipo GT en el turno activo
  const gtSubTeamStats = useMemo(() => {
    const counts: Record<string, number> = {};
    PRIMARY_GT_SUBTEAMS.forEach((st) => {
      counts[st.toLowerCase()] = 0;
    });

    const extraTeams: string[] = [];

    currentShiftAssignments.forEach((assign) => {
      if (assign.assignedType === 'GT') {
        const person = people.find((p) => p.id === assign.personId);
        const team = (assign.gtSubTeam || person?.gtSubTeam || 'Generales').trim();
        const lower = team.toLowerCase();
        const matchedPrimary = PRIMARY_GT_SUBTEAMS.find((p) => p.toLowerCase() === lower);

        if (matchedPrimary) {
          counts[matchedPrimary.toLowerCase()] = (counts[matchedPrimary.toLowerCase()] || 0) + 1;
        } else if (team) {
          if (!extraTeams.some((e) => e.toLowerCase() === lower)) {
            extraTeams.push(team);
          }
          counts[lower] = (counts[lower] || 0) + 1;
        }
      }
    });

    const primaryList = PRIMARY_GT_SUBTEAMS.map((team) => ({
      team,
      filterId: `GT:${team}`,
      displayLabel: `GT ${team.toUpperCase()}`,
      count: counts[team.toLowerCase()] || 0,
    }));

    const extraList = extraTeams.map((team) => ({
      team,
      filterId: `GT:${team}`,
      displayLabel: `GT ${team.toUpperCase()}`,
      count: counts[team.toLowerCase()] || 0,
    }));

    return [...primaryList, ...extraList];
  }, [currentShiftAssignments, people, PRIMARY_GT_SUBTEAMS]);

  const filteredCurrentShiftAssignments = useMemo(() => {
    return currentShiftAssignments.filter((assign) => {
      const person = people.find((p) => p.id === assign.personId);
      const effectiveGtSubTeam = (
        assign.gtSubTeam || (assign.assignedType === 'GT' ? person?.gtSubTeam || 'Generales' : '')
      ).trim();

      // 1. Filtro principal / Sub-equipo GT
      if (activeRosterFilter === 'ALL') {
        // Mostrar todos
      } else if (activeRosterFilter === 'GT') {
        if (assign.assignedType !== 'GT') return false;
      } else if (activeRosterFilter.startsWith('GT:')) {
        if (assign.assignedType !== 'GT') return false;
        const targetTeam = activeRosterFilter.replace('GT:', '').toLowerCase();
        if (effectiveGtSubTeam.toLowerCase() !== targetTeam) return false;
      } else if (activeRosterFilter === 'MESA') {
        if (assign.assignedType !== 'MESA') return false;
      } else if (activeRosterFilter === 'GAP') {
        if (assign.assignedType !== 'GAP') return false;
      }

      // 2. Búsqueda rápida por texto
      if (assignedRosterSearch.trim()) {
        const q = assignedRosterSearch.toLowerCase().trim();
        const name = (person?.name || '').toLowerCase();
        const doc = (person?.documentId || '').toLowerCase();
        const sub = effectiveGtSubTeam.toLowerCase();
        const fn = (assign.assignedFunction || '').toLowerCase();
        const role = (assign.roleInBase || '').toLowerCase();
        if (!name.includes(q) && !doc.includes(q) && !sub.includes(q) && !fn.includes(q) && !role.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [currentShiftAssignments, activeRosterFilter, assignedRosterSearch, people]);

  const activeFilterLabel = useMemo(() => {
    if (activeRosterFilter === 'ALL') return 'Todos';
    if (activeRosterFilter === 'GT') return 'Todos los GT';
    if (activeRosterFilter === 'MESA') return 'MESA';
    if (activeRosterFilter === 'GAP') return 'GAP';
    if (activeRosterFilter.startsWith('GT:')) {
      return `GT ${activeRosterFilter.replace('GT:', '').toUpperCase()}`;
    }
    return activeRosterFilter;
  }, [activeRosterFilter]);

  // Whether current active shift is specifically for MESA
  const isShiftMesa = useMemo(() => {
    return (
      activeShift.category === 'MESA' ||
      activeShift.name.toUpperCase().includes('MESA') ||
      Boolean(activeShift.label && activeShift.label.toUpperCase().includes('MESA')) ||
      (Array.isArray(activeShift.forTypes) &&
        activeShift.forTypes.includes('MESA') &&
        !activeShift.forTypes.includes('GT') &&
        !activeShift.forTypes.includes('GAP'))
    );
  }, [activeShift]);

  // Open Requirement Creation Modal
  const handleOpenCreateRequirement = () => {
    setReqGroupType(isShiftMesa ? 'MESA' : isDivided && carnivalCategory === 'GAP' ? 'GAP' : 'GT');
    setReqGtSubTeam('Logística');
    setReqCapacity(isShiftMesa ? 18 : 10);
    setReqShowSpecificFunctions(false);
    setReqSelectedFunctions([]);
    setReqNotes('');
    setIsReqModalOpen(true);
  };

  const handleSaveRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reqCapacity < 1) return;

    await saveShiftRequirement({
      dayId: selectedDayId,
      shiftId: activeShift.id,
      groupType: reqGroupType,
      gtSubTeam: reqGroupType === 'GT' ? reqGtSubTeam : undefined,
      capacity: reqCapacity,
      specificFunctions:
        reqShowSpecificFunctions && reqSelectedFunctions.length > 0
          ? reqSelectedFunctions
          : undefined,
      notes: reqNotes.trim(),
    });

    setIsReqModalOpen(false);
  };

  const handleDeleteRequirement = async (reqId: string) => {
    if (confirm('¿Eliminar esta necesidad de cupo?')) {
      await deleteShiftRequirement(reqId);
    }
  };

  // Open Assign Modal for a specific requirement or base
  const handleOpenAssignModal = (
    req?: ShiftRequirement,
    baseId?: number | string,
    forceShiftId?: string
  ) => {
    if (forceShiftId) {
      setSelectedShiftId(forceShiftId);
    }
    setActiveRequirement(req || null);

    let targetBase: PhysicalBase | null = null;
    if (baseId !== undefined) {
      const foundInPhysical = physicalBases.find(
        (b) => String(b.id) === String(baseId) || String(b.baseNumber) === String(baseId)
      );
      if (foundInPhysical) {
        targetBase = foundInPhysical;
      } else {
        const foundInConfig = (bases || []).find(
          (b) => String(b.id) === String(baseId) || String(b.baseNumber) === String(baseId)
        );
        if (foundInConfig) {
          targetBase = {
            id: foundInConfig.id,
            baseNumber: foundInConfig.baseNumber || foundInConfig.id,
            name: foundInConfig.name,
            defaultCapacity: foundInConfig.capacity || foundInConfig.defaultCapacity || 2,
            suggestedCapacity: foundInConfig.capacity || foundInConfig.defaultCapacity || 2,
            isSpecial: foundInConfig.isSpecial,
          };
        } else {
          targetBase = {
            id: String(baseId),
            baseNumber: baseId,
            name: getBaseDisplayName(baseId),
            defaultCapacity: 2,
            suggestedCapacity: 2,
          };
        }
      }
    }

    setModalBase(targetBase);
    setSelectedBaseNumber(targetBase ? (targetBase.baseNumber || targetBase.id) : (baseId !== undefined ? baseId : null));
    setModalPersonId('');
    setModalAlert(null);
    setIsContinuityLocked(false);
    setCandidateSearchQuery('');
    setShowOnlyAvailableInModal(true);

    if (req) {
      const tabToUse: 'GAP' | 'GT' | 'MESA' =
        req.groupType === 'MESA' ? 'MESA' : req.groupType === 'GT' ? 'GT' : 'GAP';
      setBaseAssignTab(tabToUse);
      setModalAssignedType(req.groupType);
      setModalGtSubTeam(req.gtSubTeam);
      setModalAssignedFunction(
        req.specificFunctions && req.specificFunctions.length > 0
          ? req.specificFunctions[0]
          : ''
      );
      setModalRoleInBase(
        req.groupType === 'MESA'
          ? 'MESA'
          : req.groupType === 'GT'
          ? `GT ${req.gtSubTeam || ''}`
          : req.groupType
      );
    } else if (baseId !== undefined || targetBase !== null) {
      setBaseAssignTab('GAP');
      setModalAssignedType('GAP');
      setModalGtSubTeam(undefined);
      setModalAssignedFunction('Animación de base');
      setModalRoleInBase('Encargado de Base');
    } else {
      const isShiftMesa =
        activeShift.category === 'MESA' ||
        activeShift.name.toUpperCase().includes('MESA') ||
        (activeShift.label && activeShift.label.toUpperCase().includes('MESA'));
      const defaultTab: 'GAP' | 'GT' | 'MESA' = 'GT';
      setBaseAssignTab(defaultTab);
      setModalAssignedType(defaultTab);
      setModalGtSubTeam(undefined);
      setModalAssignedFunction('');
      setModalRoleInBase(isShiftMesa ? 'MESA' : 'Staff General');
    }

    setIsAssignModalOpen(true);
  };

  // Occupants of the currently selected base in the modal
  const currentBaseOccupants = useMemo(() => {
    if (!modalBase && selectedBaseNumber === null) return [];
    const bId = modalBase?.id ? String(modalBase.id) : (selectedBaseNumber !== null ? String(selectedBaseNumber) : undefined);
    const bNum = modalBase?.baseNumber !== undefined ? String(modalBase.baseNumber) : (selectedBaseNumber !== null ? String(selectedBaseNumber) : undefined);
    const bName = modalBase?.name;

    return currentShiftAssignments.filter((a) => {
      if (bId && (a.baseId === bId || String(a.baseId) === bId)) return true;
      if (bNum && (String(a.baseNumber) === bNum || String(a.baseId) === bNum)) return true;
      if (bName && a.baseName && a.baseName.toLowerCase() === bName.toLowerCase()) return true;
      return false;
    });
  }, [modalBase, selectedBaseNumber, currentShiftAssignments]);

  const isBaseFull = useMemo(() => {
    if (!activeShift?.hasBases && !modalBase) return false;
    if (!modalBase && selectedBaseNumber === null) return false;
    const maxCap = modalBase?.defaultCapacity || 2;
    return currentBaseOccupants.length >= maxCap;
  }, [activeShift, modalBase, selectedBaseNumber, currentBaseOccupants]);

  const getNextAvailableCarnivalGapFunction = (
    occupants: Assignment[]
  ): CarnivalGapFunction => {
    const used = new Set(
      occupants.map((a) => (a.assignedFunction || a.roleInBase || '').trim().toUpperCase())
    );
    for (const fn of CARNIVAL_GAP_OFFICIAL_FUNCTIONS) {
      if (!used.has(fn.toUpperCase())) {
        return fn;
      }
    }
    return 'VAR';
  };

  const handleManualFunctionChange = async (
    assignmentId: string,
    newFn: string,
    baseIdOrNum?: string | number
  ) => {
    setRoleChangeError(null);
    setRoleChangeSuccess(null);

    if (baseIdOrNum !== undefined && baseIdOrNum !== null) {
      const isCarnivalGap =
        selectedDayId === 'miercoles' &&
        (activeShift.category === 'GAP' || baseAssignTab === 'GAP');

      if (isCarnivalGap) {
        const occupantsInSameBase = currentBaseOccupants.filter((a) => a.id !== assignmentId);
        const isDuplicate = occupantsInSameBase.some(
          (a) => (a.assignedFunction || a.roleInBase || '').trim().toUpperCase() === newFn.trim().toUpperCase()
        );

        if (isDuplicate) {
          setRoleChangeError('Esta función ya está asignada en esta base.');
          setTimeout(() => setRoleChangeError(null), 4000);
          return false;
        }
      }
    }

    const res = await updateAssignmentFunction(assignmentId, newFn);
    if (!res.success) {
      setRoleChangeError(res.error || 'Error al actualizar la función.');
      setTimeout(() => setRoleChangeError(null), 4000);
      return false;
    }

    setRoleChangeSuccess(`Función actualizada a ${newFn}`);
    setTimeout(() => setRoleChangeSuccess(null), 3000);
    return true;
  };

  // Quota calculation: ONLY GT counts towards the GT shift cupo (MESA does NOT consume cupo)
  const shiftCupoFilledCount = useMemo(() => {
    if (isShiftMesa) {
      return assignedMesaCount;
    }
    if (activeShift.category === 'GAP') {
      return assignedGapCount;
    }
    // For GT shifts: ONLY GT fills the cupo
    return assignedGtCount;
  }, [isShiftMesa, activeShift.category, assignedMesaCount, assignedGapCount, assignedGtCount]);

  const isShiftFull = useMemo(() => {
    return Boolean(activeShift.capacity && shiftCupoFilledCount >= activeShift.capacity);
  }, [activeShift.capacity, shiftCupoFilledCount]);

  // Candidate pool calculation with strict availability, continuity, and GAP/GT/MESA rules
  const candidatePool = useMemo(() => {
    const isReqMesa = activeRequirement?.groupType === 'MESA';
    const isMesaRequirement = Boolean(isReqMesa);

    return people.map((person) => {
      const isMesa = person.primaryType === 'MESA';
      const effectiveType: PersonType = isMesa
        ? 'MESA'
        : (person.gtSubTeam || (Array.isArray(person.gtTeams) && person.gtTeams.length > 0))
        ? 'GT'
        : person.primaryType || 'GT';
      const isGt = effectiveType === 'GT';
      const isPersonActive = person.isActive !== false;

      // When a specific requirement explicitly specifies MESA, only MESA members match
      if (isMesaRequirement && !isMesa) {
        return {
          person,
          isPersonActive,
          isAlreadyAssigned: false,
          conflictingAssignment: undefined,
          isAvailableInShift: false,
          carnivalContinuityConflict: false,
          priorCarnivalBaseName: undefined,
          isCategoryAllowedForGap: false,
          isCategoryAllowedForGt: false,
          isCategoryAllowedForMesa: false,
          isEligibleForGap: false,
          isEligibleForGt: false,
          isEligibleForMesa: false,
          matchesRequirementGroup: false,
          matchingFunctionsList: [],
        };
      }

      // 1. Group / Subteam matching for requirements:
      let matchesRequirementGroup = true;
      if (activeRequirement) {
        if (activeRequirement.groupType === 'MESA') {
          matchesRequirementGroup = isMesa;
        } else if (activeRequirement.groupType === 'GT') {
          const matchesSub = matchesGtSubTeam(person, activeRequirement.gtSubTeam);
          matchesRequirementGroup = (isGt || isMesa) && matchesSub;
        } else if (activeRequirement.groupType === 'GAP') {
          matchesRequirementGroup =
            effectiveType === 'GAP' || (isGt && Boolean(person.alsoActsAsGap));
        }
      } else {
        matchesRequirementGroup = true;
      }

      // 2. Already assigned to this exact shift
      const isAlreadyAssigned = assignments.some(
        (a) =>
          a.personId === person.id &&
          a.dayId === selectedDayId &&
          a.shiftId === activeShift.id
      );

      // 3. Overlapping shift conflict on the same day:
      // Note: Thursday morning T1 (06:00-12:00) and afternoon T2 (13:00-21:00) do NOT overlap
      const conflictingAssignment = isMesa
        ? undefined
        : assignments.find((a) => {
            if (
              a.personId !== person.id ||
              a.dayId !== selectedDayId ||
              a.shiftId === activeShift.id
            ) {
              return false;
            }
            const allKnown = shifts && shifts.length > 0 ? shifts : currentDay.shifts;
            const otherShift = findShiftById(allKnown, a.shiftId);
            return otherShift ? doShiftsOverlap(otherShift, activeShift) : false;
          });

      // 4. Availability for this shift:
      const availRecord = availabilities.find(
        (av) => av.personId === person.id && av.dayId === selectedDayId
      );

      let isAvailableInShift = false;
      // RULE: MESA members must strictly have this shift or matching schedule registered in their availability
      if (availRecord && Array.isArray(availRecord.shiftIds) && availRecord.shiftIds.length > 0) {
        if (availRecord.shiftIds.includes(activeShift.id)) {
          isAvailableInShift = true;
        } else {
          // Check Miércoles (Carnival) aliases & time window matching
          if (selectedDayId === 'miercoles') {
            const allKnownShifts = shifts && shifts.length > 0 ? shifts : DEFAULT_INITIAL_SHIFTS;
            const activeWin = getCarnivalWindow(
              activeShift.id,
              activeShift.name,
              activeShift.label,
              activeShift.startTime,
              activeShift.endTime
            );

            if (activeWin) {
              for (const regId of availRecord.shiftIds) {
                const regShift = allKnownShifts.find((s) => s.id === regId);
                const regWin = getCarnivalWindow(
                  regId,
                  regShift?.name,
                  regShift?.label,
                  regShift?.startTime,
                  regShift?.endTime
                );
                if (regWin && regWin === activeWin) {
                  isAvailableInShift = true;
                  break;
                }
              }
            }
          }

          // Check Jueves aliases
          if (selectedDayId === 'jueves') {
            const isT1 = (sid: string) =>
              sid === 'jueves-t1' ||
              sid === 'shift_jueves_gt_mtrxjh9q_r2t' ||
              /(?:t1|turno\s*1)/i.test(sid);
            const isT2 = (sid: string) =>
              sid === 'jueves-t2' ||
              sid === 'jueves-t2-gt' ||
              sid === 'shift_jueves_mtqcifm4_nt5' ||
              sid === 'shift_jueves_gap_mtrxwlwl_l9j' ||
              /(?:t2|turno\s*2)/i.test(sid);

            if (isT1(activeShift.id) && availRecord.shiftIds.some(isT1)) {
              isAvailableInShift = true;
            } else if (isT2(activeShift.id) && availRecord.shiftIds.some(isT2)) {
              isAvailableInShift = true;
            }
          }

          // Check Viernes aliases
          if (selectedDayId === 'viernes') {
            if (availRecord.shiftIds.some((sid) => sid === 'viernes-gt' || sid === 'viernes-gap')) {
              isAvailableInShift = true;
            }
          }

          // Time & Turno matching
          if (!isAvailableInShift) {
            const allKnownShifts = shifts && shifts.length > 0 ? shifts : DEFAULT_INITIAL_SHIFTS;

            const timeToMinutes = (t?: string) => {
              if (!t) return null;
              const clean = t.trim();
              const isPM = /p\.?\s*m/i.test(clean);
              const isAM = /a\.?\s*m/i.test(clean);
              const numeric = clean.replace(/(?:a\.\s*m\.|p\.\s*m\.|am|pm)/gi, '').trim();
              const parts = numeric.split(':');
              if (parts.length < 2) return null;
              let h = parseInt(parts[0], 10);
              const m = parseInt(parts[1], 10);
              if (isNaN(h) || isNaN(m)) return null;
              if (isPM && h < 12) h += 12;
              if (isAM && h === 12) h = 0;
              return h * 60 + m;
            };

            const sAct = timeToMinutes(activeShift.startTime);
            const eAct = timeToMinutes(activeShift.endTime);

            for (const regId of availRecord.shiftIds) {
              const regShift = allKnownShifts.find((s) => s.id === regId);
              if (regShift && regShift.dayId === selectedDayId) {
                const sReg = timeToMinutes(regShift.startTime);
                const eReg = timeToMinutes(regShift.endTime);

                if (sReg !== null && eReg !== null && sAct !== null && eAct !== null) {
                  // Direct or close match (within 35 min on start and end)
                  if (Math.abs(sReg - sAct) <= 35 && Math.abs(eReg - eAct) <= 35) {
                    isAvailableInShift = true;
                    break;
                  }
                  // Overlap match: if they overlap by at least 60 minutes or 50% of the active shift
                  const overlapMins = Math.max(0, Math.min(eReg, eAct) - Math.max(sReg, sAct));
                  const actDuration = eAct - sAct;
                  if (overlapMins >= 60 || (actDuration > 0 && overlapMins / actDuration >= 0.5)) {
                    isAvailableInShift = true;
                    break;
                  }
                }

                // Fallback to turno number matching
                const extractTurno = (name: string, id: string) => {
                  const m = (name + ' ' + id).match(/\b(t[1-5]|turno\s*[1-5])\b/i);
                  return m ? m[0].toUpperCase().replace(/\s+/, '') : null;
                };
                const tActive = extractTurno(activeShift.name, activeShift.id);
                const tReg = extractTurno(regShift.name, regShift.id);
                if (tActive && tReg && tActive === tReg) {
                  isAvailableInShift = true;
                  break;
                }
              }
            }
          }
        }
      }

      // 5. Carnival continuity validation:
      let carnivalContinuityConflict = false;
      let priorCarnivalBaseName: string | undefined = undefined;
      if (selectedDayId === 'miercoles' && (modalBase || selectedBaseNumber !== null)) {
        const priorAssign = assignments.find(
          (a) =>
            a.personId === person.id &&
            a.dayId === 'miercoles' &&
            a.shiftId !== activeShift.id &&
            ((a.baseId && a.baseId !== 'null') || (a.baseNumber !== undefined && a.baseNumber !== null && a.baseNumber !== ''))
        );
        if (priorAssign) {
          const targetId = modalBase?.id ? String(modalBase.id) : (selectedBaseNumber !== null ? String(selectedBaseNumber) : undefined);
          const isSame = areBasesEqual(priorAssign.baseId || priorAssign.baseNumber, targetId, priorAssign.baseName, modalBase?.name);
          if (!isSame) {
            carnivalContinuityConflict = true;
            priorCarnivalBaseName = priorAssign.baseName || getBaseDisplayName(priorAssign.baseNumber || priorAssign.baseId);
          }
        }
      }

      // 6. Subteam and category classification
      const subTeamUpper = (person.gtSubTeam || '').toUpperCase();
      const isGeneralSubteam =
        subTeamUpper.includes('GENERAL') ||
        (person.gtTeams || []).some((t) => t.toUpperCase().includes('GENERAL'));
      const isCarnivalSubteam =
        subTeamUpper.includes('CARNIVAL') ||
        (person.gtTeams || []).some((t) => t.toUpperCase().includes('CARNIVAL'));

      // GAP Eligibility:
      let isCategoryAllowedForGap = false;
      if (effectiveType === 'GAP') {
        isCategoryAllowedForGap = true;
      } else if (isGt) {
        if (isCarnivalSubteam) {
          // GT CARNIVAL: NO pueden aparecer como GAP durante el miércoles de Carnival. Sí pueden aparecer como GAP: JUEVES, VIERNES.
          if (selectedDayId === 'jueves' || selectedDayId === 'viernes') {
            isCategoryAllowedForGap = true;
          }
        } else if (isGeneralSubteam) {
          // GT GENERALES: Sí pueden aparecer como GAP: MIÉRCOLES, JUEVES, VIERNES. No pueden aparecer como GAP: LUNES, MARTES.
          if (selectedDayId === 'miercoles' || selectedDayId === 'jueves' || selectedDayId === 'viernes') {
            isCategoryAllowedForGap = true;
          }
        } else if (person.alsoActsAsGap) {
          if (selectedDayId === 'miercoles' && isCarnivalSubteam) {
            isCategoryAllowedForGap = false;
          } else {
            isCategoryAllowedForGap = true;
          }
        }
      }
      // If person already has an active GAP assignment on this day, they are inherently allowed for GAP
      if (!isCategoryAllowedForGap) {
        const hasGapAssignmentOnDay = assignments.some(
          (a) => a.personId === person.id && a.dayId === selectedDayId && a.assignedType === 'GAP'
        );
        if (hasGapAssignmentOnDay && !(selectedDayId === 'miercoles' && isCarnivalSubteam)) {
          isCategoryAllowedForGap = true;
        }
      }

      // GT Eligibility:
      // - is GT or MESA (MESA participates in GT shifts / Turno MESA with GT logic)
      let isCategoryAllowedForGt = false;
      if (isGt || isMesa) {
        if (activeRequirement && activeRequirement.groupType === 'GT' && activeRequirement.gtSubTeam) {
          if (matchesGtSubTeam(person, activeRequirement.gtSubTeam)) {
            isCategoryAllowedForGt = true;
          }
        } else {
          isCategoryAllowedForGt = true;
        }
      }

      // MESA Eligibility:
      // - strictly primaryType === 'MESA' (only MESA candidates)
      const isCategoryAllowedForMesa = isMesa;

      // Functions check
      let matchesFunctions = true;
      let matchingFunctionsList: string[] = [];
      if (isMesa) {
        if (activeRequirement && activeRequirement.specificFunctions && activeRequirement.specificFunctions.length > 0) {
          matchingFunctionsList = (person.functions || []).filter((f) =>
            activeRequirement.specificFunctions!.includes(f)
          );
          matchesFunctions = matchingFunctionsList.length > 0;
        } else {
          matchingFunctionsList = person.functions && person.functions.length > 0 ? person.functions : ['MESA'];
          matchesFunctions = true;
        }
      } else if (activeRequirement && activeRequirement.specificFunctions && activeRequirement.specificFunctions.length > 0) {
        matchingFunctionsList = (person.functions || []).filter((f) =>
          activeRequirement.specificFunctions!.includes(f)
        );
        matchesFunctions = matchingFunctionsList.length > 0;
      } else {
        matchingFunctionsList = person.functions || [];
      }

      // Base prerequisite validity: active, not already in this shift, no shift overlap
      const baseAvailable =
        isPersonActive &&
        !isAlreadyAssigned &&
        !conflictingAssignment;

      const isEligibleForGap = baseAvailable && isCategoryAllowedForGap && matchesRequirementGroup && matchesFunctions;
      const isEligibleForGt = baseAvailable && isCategoryAllowedForGt && matchesRequirementGroup && matchesFunctions;
      const isEligibleForMesa = baseAvailable && isCategoryAllowedForMesa && matchesRequirementGroup && matchesFunctions;

      return {
        person,
        isPersonActive,
        isAlreadyAssigned,
        conflictingAssignment,
        isAvailableInShift,
        carnivalContinuityConflict,
        priorCarnivalBaseName,
        isCategoryAllowedForGap,
        isCategoryAllowedForGt,
        isCategoryAllowedForMesa,
        isEligibleForGap,
        isEligibleForGt,
        isEligibleForMesa,
        matchesRequirementGroup,
        matchingFunctionsList,
      };
    });
  }, [
    people,
    assignments,
    availabilities,
    selectedDayId,
    activeShift,
    activeRequirement,
    modalBase,
    selectedBaseNumber,
    shifts,
    currentDay,
    isShiftMesa,
  ]);

  const gapCandidatesCount = useMemo(() => {
    return candidatePool.filter((c) => c.isEligibleForGap && c.isAvailableInShift && !c.isAlreadyAssigned && !c.conflictingAssignment).length;
  }, [candidatePool]);

  const gtCandidatesCount = useMemo(() => {
    return candidatePool.filter((c) => c.isEligibleForGt && c.isAvailableInShift && !c.isAlreadyAssigned && !c.conflictingAssignment).length;
  }, [candidatePool]);

  const mesaCandidatesCount = useMemo(() => {
    return candidatePool.filter((c) => c.isEligibleForMesa && c.isAvailableInShift && !c.isAlreadyAssigned && !c.conflictingAssignment).length;
  }, [candidatePool]);

  // Filter candidates based on active requirement or active tab [GAP] vs [GT] vs [MESA]
  const filteredCandidates = useMemo(() => {
    const q = candidateSearchQuery.trim().toLowerCase();

    return candidatePool.filter((c) => {
      // Must be active
      if (!c.isPersonActive) return false;

      // Exclude already assigned in THIS shift or real shift overlap conflict
      if (c.isAlreadyAssigned || c.conflictingAssignment) return false;

      // Must have registered exact availability in this shift (strictly exclude unavailable persons)
      if (!c.isAvailableInShift) return false;

      // Filter by requirement or active Tab [GAP] vs [GT] vs [MESA]
      if (activeRequirement) {
        if (!c.matchesRequirementGroup) return false;
        if (activeRequirement.groupType === 'MESA') {
          if (!c.isEligibleForMesa) return false;
        } else if (activeRequirement.groupType === 'GT') {
          if (!c.isEligibleForGt) return false;
        } else if (activeRequirement.groupType === 'GAP') {
          if (!c.isEligibleForGap) return false;
        }
      } else {
        if (baseAssignTab === 'MESA') {
          if (!c.isEligibleForMesa) return false;
        } else if (baseAssignTab === 'GAP') {
          if (!c.isEligibleForGap) return false;
        } else {
          if (!c.isEligibleForGt) return false;
          // Filter candidate by GT Sub-team in modal
          if (modalGtSubTeamFilter !== 'ALL') {
            if (!matchesGtSubTeam(c.person, modalGtSubTeamFilter)) {
              return false;
            }
          }
        }
      }

      // Search query filter
      if (q) {
        const matchName = c.person.name.toLowerCase().includes(q);
        const matchDoc = (c.person.documentId || '').toLowerCase().includes(q);
        const matchUser = (c.person.username || '').toLowerCase().includes(q);
        if (!matchName && !matchDoc && !matchUser) return false;
      }

      return true;
    });
  }, [
    candidatePool,
    baseAssignTab,
    activeRequirement,
    candidateSearchQuery,
    showOnlyAvailableInModal,
    isShiftMesa,
    modalGtSubTeamFilter,
  ]);

  const handleQuickAssignCandidate = async (candidatePerson: Person, fnName: string) => {
    setIsSubmitting(true);
    try {
      const candidateInfo = candidatePool.find((c) => c.person.id === candidatePerson.id);
      if (candidateInfo && !candidateInfo.isAvailableInShift) {
        console.info(`Asignando a ${candidatePerson.name} fuera de su disponibilidad registrada`);
      }

      const isMesaPerson = candidatePerson.primaryType === 'MESA';

      // Tab or requirement determines assigned type; MESA is strictly assigned as MESA
      let assignedTypeToUse: PersonType = baseAssignTab;
      if (activeRequirement) {
        assignedTypeToUse = activeRequirement.groupType;
      }
      if (isMesaPerson) {
        assignedTypeToUse = 'MESA';
      }

      // Base identification
      const targetBaseObj = modalBase || (selectedBaseNumber !== null
        ? (physicalBases.find((b) => String(b.id) === String(selectedBaseNumber) || String(b.baseNumber) === String(selectedBaseNumber)) ||
           (bases || []).find((b) => String(b.id) === String(selectedBaseNumber) || String(b.baseNumber) === String(selectedBaseNumber)))
        : null);

      const baseIdToUse = targetBaseObj?.id ? String(targetBaseObj.id) : (selectedBaseNumber !== null ? String(selectedBaseNumber) : undefined);
      const baseNumToUse = targetBaseObj?.baseNumber !== undefined ? targetBaseObj.baseNumber : (selectedBaseNumber !== null ? selectedBaseNumber : undefined);
      const baseNameToUse = targetBaseObj?.name || (baseNumToUse !== undefined ? getBaseDisplayName(baseNumToUse) : undefined);

      // MANDATORY base_id check when assigning to a base
      if ((modalBase !== null || selectedBaseNumber !== null) && !baseIdToUse) {
        setModalAlert('Error: No se pudo resolver un base_id físico válido para esta base.');
        return;
      }

      let defaultRole = assignedTypeToUse === 'GAP'
        ? 'Encargado de Base'
        : (isMesaPerson ? 'Coordinación' : 'Staff General');

      if (
        selectedDayId === 'miercoles' &&
        assignedTypeToUse === 'GAP' &&
        (modalBase !== null || selectedBaseNumber !== null)
      ) {
        defaultRole = getNextAvailableCarnivalGapFunction(currentBaseOccupants);
      }

      const roleToAssign =
        fnName && fnName !== 'Encargado de Base' && fnName !== 'Base'
          ? fnName
          : defaultRole;

      const result = await assignPerson({
        personId: candidatePerson.id,
        dayId: selectedDayId,
        shiftId: activeShift.id,
        assignedType: assignedTypeToUse,
        gtSubTeam: assignedTypeToUse === 'GT' ? (activeRequirement?.gtSubTeam || candidatePerson.gtSubTeam || 'Logística') : undefined,
        assignedFunction: roleToAssign,
        baseId: baseIdToUse,
        baseNumber: baseNumToUse,
        baseName: baseNameToUse,
        roleInBase: roleToAssign,
        requirementId: activeRequirement ? activeRequirement.id : undefined,
      });

      if (!result.success) {
        setModalAlert(result.alertMessage || 'Error en la asignación.');
        return;
      }

      setModalAlert(null);
    } catch (err) {
      console.error(err);
      setModalAlert('Error al asignar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const evaluatePosteriorShiftEligibility = (
    person: Person,
    postShift: ConfigurableShift | Shift,
    postTurnNumber: number,
    targetBase: PhysicalBase
  ): CarnivalPosteriorShiftStatus => {
    // 1. Active status
    if (person.isActive === false) {
      return {
        shift: postShift,
        turnNumber: postTurnNumber,
        isAvailable: false,
        unavailableReason: 'Persona inactiva',
      };
    }

    // 2. GAP eligibility rule: GT Carnival cannot do GAP on Wednesday
    const isGtCarnival = person.primaryType === 'GT' && person.gtSubTeam === 'Carnival';
    if (isGtCarnival) {
      return {
        shift: postShift,
        turnNumber: postTurnNumber,
        isAvailable: false,
        unavailableReason: 'GT Carnival no habilitado para GAP',
      };
    }
    if (person.primaryType === 'MESA') {
      return {
        shift: postShift,
        turnNumber: postTurnNumber,
        isAvailable: false,
        unavailableReason: 'Personal MESA no asignable a base física',
      };
    }

    // 3. Availability registered for this shift
    const availRecord = availabilities.find(
      (av) => av.personId === person.id && av.dayId === 'miercoles'
    );
    let hasShiftAvailability = false;
    if (availRecord && Array.isArray(availRecord.shiftIds) && availRecord.shiftIds.length > 0) {
      if (availRecord.shiftIds.includes(postShift.id)) {
        hasShiftAvailability = true;
      } else {
        const allKnownShifts = shifts && shifts.length > 0 ? shifts : DEFAULT_INITIAL_SHIFTS;
        const targetWin = getCarnivalWindow(
          postShift.id,
          postShift.name,
          postShift.label,
          postShift.startTime,
          postShift.endTime
        );
        if (targetWin) {
          for (const regId of availRecord.shiftIds) {
            const regShift = allKnownShifts.find((s) => s.id === regId);
            const regWin = getCarnivalWindow(
              regId,
              regShift?.name,
              regShift?.label,
              regShift?.startTime,
              regShift?.endTime
            );
            if (regWin && regWin === targetWin) {
              hasShiftAvailability = true;
              break;
            }
          }
        }
      }
    }

    if (!hasShiftAvailability) {
      return {
        shift: postShift,
        turnNumber: postTurnNumber,
        isAvailable: false,
        unavailableReason: 'Sin disponibilidad registrada',
      };
    }

    // 4. Prior assignment check (No duplicate assignments in this shift)
    const existingInShift = assignments.find(
      (a) =>
        a.personId === person.id &&
        a.dayId === 'miercoles' &&
        (a.shiftId === postShift.id ||
          getCarnivalGapTurnNumber(
            findShiftById(shifts || DEFAULT_INITIAL_SHIFTS, a.shiftId) ||
              ({ id: a.shiftId, name: a.shiftId, label: a.shiftId, startTime: '', endTime: '' } as Shift)
          ) === postTurnNumber)
    );

    if (existingInShift) {
      const isSameBase = areBasesEqual(
        existingInShift.baseId || existingInShift.baseNumber,
        targetBase.id || targetBase.baseNumber,
        existingInShift.baseName,
        targetBase.name
      );

      return {
        shift: postShift,
        turnNumber: postTurnNumber,
        isAvailable: false,
        alreadyAssignedSameBase: isSameBase,
        unavailableReason: isSameBase
          ? 'Ya asignado(a) a esta base en este turno'
          : 'Ya asignado(a) a otra base/función en este turno',
      };
    }

    // 5. Schedule conflicts with other assignments on Wednesday
    const otherDayAssignments = assignments.filter(
      (a) =>
        a.personId === person.id &&
        a.dayId === 'miercoles' &&
        a.shiftId !== postShift.id &&
        getCarnivalGapTurnNumber(
          findShiftById(shifts || DEFAULT_INITIAL_SHIFTS, a.shiftId) ||
            ({ id: a.shiftId, name: a.shiftId, label: a.shiftId, startTime: '', endTime: '' } as Shift)
        ) !== postTurnNumber
    );

    const allKnownShifts = shifts && shifts.length > 0 ? shifts : DEFAULT_INITIAL_SHIFTS;
    for (const other of otherDayAssignments) {
      const otherShift = findShiftById(allKnownShifts, other.shiftId);
      if (otherShift) {
        // Between consecutive Carnival GAP shifts, consecutive shifts do not conflict
        const isOtherCarnivalGap =
          otherShift.dayId === 'miercoles' &&
          (otherShift.category === 'GAP' || otherShift.hasBases);
        if (isOtherCarnivalGap) {
          continue;
        }
        if (doShiftsOverlap(otherShift, postShift as Shift)) {
          return {
            shift: postShift,
            turnNumber: postTurnNumber,
            isAvailable: false,
            unavailableReason: `Conflicto con horario de ${otherShift.name}`,
          };
        }
      }
    }

    // 6. Base capacity in posterior shift
    const baseOccupants = assignments.filter((a) => {
      if (a.dayId !== 'miercoles') return false;
      if (a.personId === person.id) return false;
      const isPostShift =
        a.shiftId === postShift.id ||
        getCarnivalGapTurnNumber(
          findShiftById(shifts || DEFAULT_INITIAL_SHIFTS, a.shiftId) ||
            ({ id: a.shiftId, name: a.shiftId, label: a.shiftId, startTime: '', endTime: '' } as Shift)
        ) === postTurnNumber;
      if (!isPostShift) return false;
      return areBasesEqual(
        a.baseId || a.baseNumber,
        targetBase.id || targetBase.baseNumber,
        a.baseName,
        targetBase.name
      );
    });

    const maxBaseCap = targetBase.gapCapacity || targetBase.defaultCapacity || 2;
    if (baseOccupants.length >= maxBaseCap) {
      return {
        shift: postShift,
        turnNumber: postTurnNumber,
        isAvailable: false,
        unavailableReason: `BASE COMPLETA (${baseOccupants.length}/${maxBaseCap})`,
      };
    }

    // 7. Shift total capacity in posterior shift
    if (postShift.capacity) {
      const shiftGapOccupants = assignments.filter((a) => {
        if (a.dayId !== 'miercoles') return false;
        if (a.personId === person.id) return false;
        if (a.assignedType !== 'GAP') return false;
        return (
          a.shiftId === postShift.id ||
          getCarnivalGapTurnNumber(
            findShiftById(shifts || DEFAULT_INITIAL_SHIFTS, a.shiftId) ||
              ({ id: a.shiftId, name: a.shiftId, label: a.shiftId, startTime: '', endTime: '' } as Shift)
          ) === postTurnNumber
        );
      });
      if (shiftGapOccupants.length >= postShift.capacity) {
        return {
          shift: postShift,
          turnNumber: postTurnNumber,
          isAvailable: false,
          unavailableReason: `CUPO COMPLETO — NO HAY MÁS CUPOS (${shiftGapOccupants.length}/${postShift.capacity})`,
        };
      }
    }

    // All checks passed!
    return {
      shift: postShift,
      turnNumber: postTurnNumber,
      isAvailable: true,
    };
  };

  const handleCandidateAssignClick = (candidatePerson: Person, fnName: string) => {
    const isCarnivalGapAssignment =
      selectedDayId === 'miercoles' &&
      (activeShift.category === 'GAP' || carnivalCategory === 'GAP' || baseAssignTab === 'GAP') &&
      (modalBase !== null || selectedBaseNumber !== null);

    if (!isCarnivalGapAssignment) {
      handleQuickAssignCandidate(candidatePerson, fnName);
      return;
    }

    // Resolve target base object
    const targetBaseObj = modalBase || (selectedBaseNumber !== null
      ? (physicalBases.find((b) => String(b.id) === String(selectedBaseNumber) || String(b.baseNumber) === String(selectedBaseNumber)) ||
         (bases || []).find((b) => String(b.id) === String(selectedBaseNumber) || String(b.baseNumber) === String(selectedBaseNumber)))
      : null);

    if (!targetBaseObj) {
      handleQuickAssignCandidate(candidatePerson, fnName);
      return;
    }

    const gapShifts = getOfficialCarnivalGapShifts(shifts);
    const currentTurnNumber = getCarnivalGapTurnNumber(activeShift);
    const currentShiftIndex = currentTurnNumber - 1;
    const posteriorShifts = currentShiftIndex >= 0 ? gapShifts.slice(currentShiftIndex + 1) : [];

    // If no posterior shifts (e.g. Turno 3) -> assign directly without prompt (Rule 17)
    if (posteriorShifts.length === 0) {
      handleQuickAssignCandidate(candidatePerson, fnName);
      return;
    }

    const evaluatedStatuses: CarnivalPosteriorShiftStatus[] = posteriorShifts.map((pShift, idx) =>
      evaluatePosteriorShiftEligibility(
        candidatePerson,
        pShift,
        currentTurnNumber + 1 + idx,
        targetBaseObj as PhysicalBase
      )
    );

    const eligibleShifts = evaluatedStatuses.filter((s) => s.isAvailable).map((s) => s.shift);

    // If no posterior shifts are available -> assign directly without prompt (Rule 17)
    if (eligibleShifts.length === 0) {
      handleQuickAssignCandidate(candidatePerson, fnName);
      return;
    }

    // Prompt admin with intelligent confirmation
    setCarnivalAutoPrompt({
      candidate: candidatePerson,
      currentShift: activeShift,
      currentTurnNumber,
      targetBase: targetBaseObj as PhysicalBase,
      fnName,
      eligibleShifts,
      allPosteriorStatuses: evaluatedStatuses,
    });
  };

  const handleConfirmCarnivalBatchAssign = async () => {
    if (!carnivalAutoPrompt) return;
    const { candidate, currentShift, targetBase, fnName, eligibleShifts } = carnivalAutoPrompt;
    setIsSubmitting(true);

    try {
      const baseIdToUse = targetBase.id ? String(targetBase.id) : undefined;
      const baseNumToUse = targetBase.baseNumber !== undefined ? targetBase.baseNumber : undefined;
      const baseNameToUse = targetBase.name || (baseNumToUse !== undefined ? getBaseDisplayName(baseNumToUse) : undefined);

      const shiftsToAssign = [currentShift, ...eligibleShifts];
      let successCount = 0;
      const errors: string[] = [];

      for (const s of shiftsToAssign) {
        const res = await assignPerson({
          personId: candidate.id,
          dayId: 'miercoles',
          shiftId: s.id,
          assignedType: 'GAP',
          baseId: baseIdToUse,
          baseNumber: baseNumToUse,
          baseName: baseNameToUse,
          assignedFunction: fnName || 'Encargado de Base',
          roleInBase: fnName || 'Encargado de Base',
        });

        if (res.success) {
          successCount++;
        } else {
          errors.push(`${s.name}: ${res.alertMessage || 'Error'}`);
        }
      }

      // Background synchronization with Supabase
      pullAssignmentsFromSupabase().catch((err) => console.warn('Supabase pull post batch assign:', err));

      if (successCount === shiftsToAssign.length) {
        setActionSuccessToast(
          `¡${candidate.name} fue asignado(a) con éxito a los ${successCount} turnos de Carnival en ${baseNameToUse}! Guardado en Supabase.`
        );
      } else {
        setActionSuccessToast(
          `${candidate.name} fue asignado(a) a ${successCount} de ${shiftsToAssign.length} turnos. ${errors.join(' • ')}`
        );
      }

      setCarnivalAutoPrompt(null);
      setIsAssignModalOpen(false);
    } catch (err) {
      console.error(err);
      setModalAlert('Error en la asignación automática');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelCarnivalBatchAssign = async () => {
    if (!carnivalAutoPrompt) return;
    const { candidate, fnName } = carnivalAutoPrompt;
    setCarnivalAutoPrompt(null);
    // Assign only the current shift as requested by user ("SOLO ESTE TURNO")
    await handleQuickAssignCandidate(candidate, fnName);
    setIsAssignModalOpen(false);
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (confirm('¿Eliminar esta asignación?')) {
      await removeAssignment(assignmentId);
    }
  };

  return (
    <div className="space-y-6 text-[#182535]">
      {/* Header and Day Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#182535] tracking-wide font-dalek">
              ASIGNACIÓN DE TURNOS Y BASES
            </h2>
            {onNavigateToConfig && (
              <button
                onClick={onNavigateToConfig}
                title="Configurar y editar turnos, bases y eventos"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-[#B83A24] bg-[#FDF2EE] hover:bg-[#FBE4DD] border border-[#F6C7BA] transition-all shadow-2xs"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Configurar Turnos y Bases</span>
              </button>
            )}
          </div>
          <p className="text-xs text-[#64748B] mt-0.5 font-montserrat">
            Distribución operativa con cupos por GT/Grupo, funciones jerárquicas y bases físicas.
          </p>
        </div>

        {/* Day Selector Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {onNavigateToConfig && (
            <button
              onClick={onNavigateToConfig}
              title="Configurar y editar turnos, bases y eventos"
              className="sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#B83A24] bg-[#FDF2EE] hover:bg-[#FBE4DD] border border-[#F6C7BA] transition-all shadow-2xs"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configurar</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto bg-[#FAF6EC] border border-[#EADDC7] p-1.5 rounded-2xl shadow-2xs scrollbar-none">
            {EVENT_SCHEDULE.map((day) => {
              const isSelected = day.dayId === selectedDayId;
              return (
                <button
                  key={day.dayId}
                  onClick={() => handleDaySelect(day.dayId)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-wider whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[#B83A24] text-white shadow-xs font-dalek'
                      : 'text-[#64748B] hover:text-[#182535] hover:bg-[#FFFDF8] font-montserrat'
                  }`}
                >
                  {day.dayName}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CARNIVAL DEDICATED ARCHITECTURE PANEL (If Wednesday) */}
      {isCarnival && (
        <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#EADDC7]">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA] font-dalek">
                  {currentDay.dayName.toUpperCase()} • {currentDay.eventName}
                </span>
                <span className="text-xs text-[#C87F17] font-montserrat font-bold">
                  Estructura Oficial Diferenciada
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#182535] mt-1 font-dalek tracking-wide">
                DISTRIBUCIÓN OPERATIVA DE {currentDay.eventName.toUpperCase()}
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5 font-montserrat max-w-2xl leading-relaxed">
                Los turnos de <b>GT</b> y <b>GAP</b> son completamente independientes y NO se mezclan.
                GAP cuenta con exactamente <b>22 bases físicas únicas</b> (1 a 19 normales + 3 especiales: Toro, Speedway y Arcade) compartidas en sus 3 turnos.
              </p>
            </div>

            {/* Sub-Category Switcher for Carnival: GAP, GT, and MESA */}
            <div className="flex items-center gap-1.5 bg-[#FAF6EC] p-1.5 rounded-2xl border border-[#EADDC7] self-start lg:self-center">
              <button
                onClick={() => handleCarnivalCategorySelect('GAP')}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  carnivalCategory === 'GAP'
                    ? 'bg-[#B83A24] text-white shadow-xs font-montserrat'
                    : 'text-[#64748B] hover:text-[#182535] font-montserrat'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>GAP {isCarnival ? "(3 Turnos + 22 Bases)" : "(Bases Físicas)"}</span>
              </button>

              <button
                onClick={() => handleCarnivalCategorySelect('GT')}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  carnivalCategory === 'GT'
                    ? 'bg-[#182535] text-white shadow-xs font-montserrat'
                    : 'text-[#64748B] hover:text-[#182535] font-montserrat'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>GT {isCarnival ? "(5 Turnos)" : "(Soporte General)"}</span>
              </button>

              <button
                onClick={() => handleCarnivalCategorySelect('MESA')}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  carnivalCategory === 'MESA'
                    ? 'bg-purple-700 text-white shadow-xs font-montserrat'
                    : 'text-[#64748B] hover:text-purple-700 font-montserrat'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>MESA DIRECTIVA</span>
              </button>
            </div>
          </div>

          {/* Visual Blueprint Diagram */}
          {isCarnival && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1 text-xs font-montserrat">
            <div
              className={`p-4 rounded-2xl border transition-all ${
                carnivalCategory === 'GT'
                  ? 'bg-[#FAF6EC] border-[#182535] shadow-2xs'
                  : 'bg-[#FFFDF8] border-[#EADDC7] text-[#64748B]'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-[#182535] mb-2">
                <span className="flex items-center gap-1.5 text-[#182535]">
                  <Shield className="w-4 h-4" />
                  CARNIVAL — GT (GRUPO DE TRABAJO & MESA)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#182535] text-white font-mono">
                  5 TURNOS
                </span>
              </div>
              <ul className="space-y-1 text-[11px] font-mono">
                <li className="flex justify-between py-0.5 border-b border-[#EADDC7]/60">
                  <span className="font-bold text-[#182535]">T1</span>
                  <span>6:50 AM – 9:00 AM</span>
                </li>
                <li className="flex justify-between py-0.5 border-b border-[#EADDC7]/60">
                  <span className="font-bold text-[#182535]">T2</span>
                  <span>8:50 AM – 12:10 PM</span>
                </li>
                <li className="flex justify-between py-0.5 border-b border-[#EADDC7]/60">
                  <span className="font-bold text-[#182535]">T3</span>
                  <span>12:00 PM – 3:10 PM</span>
                </li>
                <li className="flex justify-between py-0.5 border-b border-[#EADDC7]/60">
                  <span className="font-bold text-[#182535]">T4</span>
                  <span>3:00 PM – 6:10 PM</span>
                </li>
                <li className="flex justify-between py-0.5">
                  <span className="font-bold text-[#182535]">T5</span>
                  <span>6:00 PM – 9:00 PM</span>
                </li>
              </ul>
            </div>

            <div
              className={`p-4 rounded-2xl border transition-all ${
                carnivalCategory === 'GAP'
                  ? 'bg-[#FAF6EC] border-[#B83A24] shadow-2xs'
                  : 'bg-[#FFFDF8] border-[#EADDC7] text-[#64748B]'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-[#B83A24] mb-2">
                <span className="flex items-center gap-1.5 text-[#B83A24]">
                  <Grid className="w-4 h-4" />
                  CARNIVAL — GAP (BASES FÍSICAS)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#B83A24] text-white font-mono">
                  3 TURNOS • 30 BASES
                </span>
              </div>
              <ul className="space-y-1 text-[11px] font-mono">
                <li className="flex justify-between py-0.5 border-b border-[#EADDC7]/60">
                  <span className="font-bold text-[#182535]">T1</span>
                  <span>8:50 AM – 12:10 PM</span>
                </li>
                <li className="flex justify-between py-0.5 border-b border-[#EADDC7]/60">
                  <span className="font-bold text-[#182535]">T2</span>
                  <span>12:00 PM – 3:10 PM</span>
                </li>
                <li className="flex justify-between py-0.5">
                  <span className="font-bold text-[#182535]">T3</span>
                  <span>3:00 PM – 6:10 PM</span>
                </li>
              </ul>
              <div className="mt-2 text-[10px] text-[#B83A24] font-medium">
                <strong>30 Bases Físicas:</strong> Base 1..27 + Toro, Speedway, Arcade.
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* SHIFTS SELECTION BAR */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EADDC7]">
          <div>
            <span className="text-xs font-bold text-[#C87F17] uppercase tracking-wide font-dalek">
              {currentDay.dayName} {isDivided ? `• ${carnivalCategory}` : `• ${currentDay.eventName}`}
            </span>
            <h3 className="text-base font-bold text-[#182535] font-montserrat mt-0.5">
              Turnos disponibles para {isDivided ? `${currentDay.eventName} (${carnivalCategory})` : currentDay.eventName}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B] font-mono">
              {availableShifts.length} turno(s) visible(s)
            </span>
          </div>
        </div>

        {/* Filter shifts by GT / GAP (only if GAP shifts exist) */}
        {gapShiftsInDay.length > 0 && (
          <div className="flex items-center gap-1.5 bg-[#FAF6EC] p-1.5 rounded-2xl border border-[#EADDC7] overflow-x-auto">
            <span className="text-[11px] font-bold text-[#64748B] px-2 font-montserrat hidden sm:inline">
              Filtrar turnos:
            </span>
            {[
              { id: 'ALL', label: `Todos (${allShiftsInDay.length})` },
              { id: 'GT', label: `GT (${gtShiftsInDay.length})` },
              { id: 'GAP', label: `GAP (${gapShiftsInDay.length})` },
              ...(mesaShiftsInDay.length > 0
                ? [{ id: 'MESA', label: `MESA (${mesaShiftsInDay.length})` }]
                : []),
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => handleShiftCategoryFilterChange(pill.id as any)}
                className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer font-montserrat whitespace-nowrap ${
                  shiftCategoryFilter === pill.id
                    ? pill.id === 'GAP'
                      ? 'bg-[#16A34A] text-white shadow-2xs'
                      : pill.id === 'GT'
                      ? 'bg-[#182535] text-white shadow-2xs'
                      : pill.id === 'MESA'
                      ? 'bg-purple-700 text-white shadow-2xs'
                      : 'bg-[#B83A24] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#182535] hover:bg-[#FFFDF8]'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}

        {/* Turnos pills */}
        <div className="flex flex-wrap items-center gap-2">
          {availableShifts.map((shift) => {
            const isSelected = shift.id === activeShift.id;
            const shiftAssigns = assignments.filter(
              (a) => a.dayId === selectedDayId && a.shiftId === shift.id
            );

            const isMesaPill =
              shift.category === 'MESA' ||
              shift.name.toUpperCase().includes('MESA') ||
              Boolean(shift.label && shift.label.toUpperCase().includes('MESA'));

            // "el cupo no se llena con la mesa, no cuentes en la mesa en el cupo solo al GT"
            const shiftGtAssigned = shiftAssigns.filter((a) => a.assignedType === 'GT').length;
            const shiftMesaAssigned = shiftAssigns.filter((a) => a.assignedType === 'MESA').length;
            const shiftGapAssigned = shiftAssigns.filter((a) => a.assignedType === 'GAP').length;

            const relevantFilled = isMesaPill
              ? shiftMesaAssigned
              : shift.category === 'GAP'
              ? shiftGapAssigned
              : shiftGtAssigned;

            return (
              <button
                key={shift.id}
                onClick={() => {
                  setSelectedShiftId(shift.id);
                  setSelectedBaseNumber(null);
                }}
                className={`min-h-[40px] flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  isSelected
                    ? isMesaPill
                      ? 'bg-[#C87F17] text-white border-[#C87F17] shadow-xs font-montserrat'
                      : 'bg-[#B83A24] text-white border-[#B83A24] shadow-xs font-montserrat'
                    : isMesaPill
                    ? 'bg-[#FAF6EC] text-[#C87F17] border-[#EADDC7] hover:text-[#182535] hover:bg-[#F3EEDC] font-montserrat'
                    : 'bg-[#FAF6EC] text-[#64748B] border-[#EADDC7] hover:text-[#182535] hover:bg-[#F3EEDC] font-montserrat'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="font-bold">{shift.name}</span>
                <span className="font-mono text-[11px] opacity-80">({shift.label})</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#EAE0CA] text-[#475569]'
                  }`}
                  title={`${relevantFilled} cupo(s) ocupados${!isMesaPill && shiftMesaAssigned > 0 ? ` (+${shiftMesaAssigned} MESA sin cupo)` : ''}`}
                >
                  {relevantFilled}{shift.capacity ? `/${shift.capacity}` : ''}
                  {!isMesaPill && shiftMesaAssigned > 0 ? ` (+${shiftMesaAssigned} M)` : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION: GESTIÓN DE CUPOS Y FUNCIONES POR TURNO (NUEVA LÓGICA) */}
      <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EADDC7]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-[#FAF6EC] text-[#B83A24] border border-[#EADDC7] font-dalek">
                {activeShift.name} ({activeShift.label})
              </span>
              <span className="text-xs font-bold text-[#182535] font-montserrat">
                Cupos y Funciones
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[#182535] mt-1 font-dalek tracking-wide">
              NECESIDADES DE TURNO POR GT / GAP / MESA
            </h3>
            <p className="text-xs text-[#64748B] font-montserrat mt-0.5 max-w-2xl">
              Defina el número de personas requerido por grupo (ej. <b>Logística T1 = 10 personas</b>) y opcionalmente asigne funciones específicas como filtro.
            </p>
          </div>

          <button
            onClick={handleOpenCreateRequirement}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white text-xs font-bold font-dalek tracking-wider flex items-center gap-2 shadow-xs transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>DEFINIR CUPO DE TURNO</span>
          </button>
        </div>

        {/* Requirements Cards */}
        {currentShiftRequirements.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#FAF6EC] border border-dashed border-[#EADDC7] text-center space-y-2">
            <Users className="w-8 h-8 text-[#C87F17] mx-auto opacity-75" />
            <div className="font-bold text-[#182535] text-xs">
              No hay necesidades de cupos específicas creadas para este turno
            </div>
            <p className="text-[11px] text-[#64748B] max-w-md mx-auto">
              Haga clic en &quot;<b>DEFINIR CUPO DE TURNO</b>&quot; para registrar, por ejemplo: <b>Logística T1 = 10 cupos</b> y asociarle funciones específicas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentShiftRequirements.map((req) => {
              // Calculate assigned people for this requirement
              // Strict rule: if requirement is GT, MESA members NEVER count towards this GT requirement
              const assignedToThisReq = currentShiftAssignments.filter(
                (a) =>
                  a.assignedType === req.groupType &&
                  (a.requirementId === req.id ||
                    (!req.gtSubTeam || normalizeSubTeam(a.gtSubTeam) === normalizeSubTeam(req.gtSubTeam)))
              );
              const progressPct = Math.min(
                100,
                Math.round((assignedToThisReq.length / req.capacity) * 100)
              );
              const isFull = assignedToThisReq.length >= req.capacity;

              return (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl bg-[#FFFDF8] border-2 border-[#EADDC7] hover:border-[#B83A24]/60 transition-all shadow-2xs flex flex-col justify-between space-y-3"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            req.groupType === 'GT'
                              ? 'bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA]'
                              : req.groupType === 'GAP'
                              ? 'bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A]'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {req.groupType === 'GT' ? `GT → ${req.gtSubTeam}` : req.groupType}
                        </span>
                        <h4 className="text-sm font-bold text-[#182535] mt-1 font-montserrat">
                          {req.groupType === 'GT'
                            ? `GT ${req.gtSubTeam} (${activeShift.name})`
                            : `${req.groupType} (${activeShift.name})`}
                        </h4>
                      </div>

                      <button
                        onClick={() => handleDeleteRequirement(req.id)}
                        className="text-[#64748B] hover:text-[#B83A24] p-1 rounded-lg transition-colors"
                        title="Eliminar necesidad"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Capacity and Progress */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#64748B]">Cupos asignados:</span>
                        <span className="font-bold text-[#182535]">
                          {assignedToThisReq.length} / {req.capacity} personas
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#FAF6EC] overflow-hidden border border-[#EADDC7]">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isFull ? 'bg-emerald-500' : 'bg-[#B83A24]'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Filtered functions */}
                    <div className="mt-3 pt-2.5 border-t border-[#EADDC7]/60">
                      <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
                        Filtro de Funciones:
                      </span>
                      {req.specificFunctions && req.specificFunctions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {req.specificFunctions.map((fnName) => (
                            <span
                              key={fnName}
                              className="px-2 py-0.5 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-bold text-[#16A34A]"
                            >
                              {fnName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#94A3B8] italic">
                          Sin filtro específico: cualquier integrante de{' '}
                          {req.groupType === 'GT' ? req.gtSubTeam : req.groupType}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-[#EADDC7] flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenAssignModal(req)}
                      disabled={isFull}
                      className={`min-h-[38px] w-full px-3 py-1.5 rounded-xl text-xs font-bold font-montserrat flex items-center justify-center gap-1.5 transition-all ${
                        isFull
                          ? 'bg-[#FAF6EC] text-[#94A3B8] border border-[#EADDC7] cursor-not-allowed'
                          : 'bg-[#182535] hover:bg-[#2A3F55] text-white shadow-2xs'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isFull ? 'Cupo Completo' : 'Asignar Personas'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CONDITIONAL: 19 PHYSICAL BASES FOR CARNIVAL GAP */}
      {activeShift.hasBases && physicalBases.length > 0 && (
        <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EADDC7]">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-[#FEF8EC] text-[#C87F17] border border-[#E5A12E]/40 font-dalek">
                  GAP • {activeShift.name} ({activeShift.label})
                </span>
                <span className="text-xs text-[#16A34A] font-semibold flex items-center gap-1 font-montserrat">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {physicalBases.length} Bases Físicas Oficiales
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#182535] font-dalek tracking-wide mt-1">
                ASIGNACIÓN DE BASES FÍSICAS {currentDay.eventName.toUpperCase()}
              </h3>
              <p className="text-xs text-[#64748B] font-montserrat">
                Bases 1 a 19 + Toro, Speed y Arcade — 22 bases oficiales con cupos específicos de GAP.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#B83A24] font-mono bg-[#FDF2EE] border border-[#F6C7BA] px-2.5 py-1 rounded-lg font-bold">
                Cupos GAP: 2 a 3 por base • 22 bases oficiales
              </span>
            </div>
          </div>

          {/* Grid of 22 physical bases */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {physicalBases.map((base) => {
              const baseAssignments = currentShiftAssignments.filter(
                (a) =>
                  String(a.baseId) === String(base.id) ||
                  String(a.baseId) === `carnival_${base.id}` ||
                  String(a.baseNumber) === String(base.id) ||
                  (base.baseNumber !== undefined && String(a.baseNumber) === String(base.baseNumber)) ||
                  (a.baseName && base.name && a.baseName.toLowerCase() === base.name.toLowerCase()) ||
                  (base.code && (a.baseNumber === base.code || a.baseId === base.code)) ||
                  (base.id === 20 && (a.baseNumber === '20' || a.baseNumber === '28' || a.baseId === 'carnival_20' || a.baseId === 'carnival_28' || a.baseId === 'toro' || a.baseNumber === 'toro' || String(a.baseName).toLowerCase() === 'base toro')) ||
                  (base.id === 21 && (a.baseNumber === '21' || a.baseNumber === '29' || a.baseId === 'carnival_21' || a.baseId === 'carnival_29' || a.baseId === 'speedway' || a.baseNumber === 'speedway' || a.baseId === 'speed' || a.baseNumber === 'speed' || String(a.baseName).toLowerCase() === 'base speed')) ||
                  (base.id === 22 && (a.baseNumber === '22' || a.baseNumber === '30' || a.baseId === 'carnival_22' || a.baseId === 'carnival_30' || a.baseId === 'arcade' || a.baseNumber === 'arcade' || String(a.baseName).toLowerCase() === 'base arcade'))
              );
              const isFull = baseAssignments.length >= base.defaultCapacity;
              const isSpecial = base.isSpecial;

              return (
                <div
                  key={base.id}
                  className={`bg-[#FFFDF8] border rounded-2xl p-4 flex flex-col justify-between transition-all relative shadow-2xs ${
                    isSpecial
                      ? 'border-[#E5A12E] bg-[#FEF8EC]'
                      : isFull
                      ? 'border-[#BBF7D0] bg-[#F0FDF4]'
                      : baseAssignments.length > 0
                      ? 'border-[#EADDC7] bg-[#FAF6EC]'
                      : 'border-[#EADDC7] hover:border-[#B83A24]'
                  }`}
                >
                  <div>
                    {/* Header of Base Card */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                            isSpecial
                              ? 'bg-[#FEF8EC] border border-[#E5A12E]/50 text-[#C87F17]'
                              : 'bg-[#FAF6EC] border border-[#EADDC7] text-[#182535]'
                          }`}
                        >
                          {isSpecial ? '★' : (base.baseNumber || String(base.id).replace(/^\D+/g, ''))}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-[#182535] text-xs font-montserrat truncate">
                            {base.baseLabel || (isSpecial ? base.name : `BASE ${base.baseNumber || base.id}`)}
                          </h4>
                          {base.gameName ? (
                            <p className="text-[11px] text-[#64748B] font-montserrat truncate">
                              {base.gameName}
                            </p>
                          ) : (
                            <p className="text-[11px] text-[#64748B] font-montserrat truncate">
                              {base.name}
                            </p>
                          )}
                          {isSpecial && (
                            <span className="text-[9px] uppercase font-bold text-[#C87F17] font-mono block">
                              Base Especial
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          isFull
                            ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
                            : baseAssignments.length > 0
                            ? 'bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA]'
                            : 'bg-[#FAF6EC] text-[#64748B] border border-[#EADDC7]'
                        }`}
                      >
                        {baseAssignments.length} / {base.defaultCapacity} GAP
                      </span>
                    </div>

                    {/* Occupants list */}
                    <div className="space-y-1.5 mt-3 min-h-[48px]">
                      {baseAssignments.length === 0 ? (
                        <div className="py-2 text-center text-[11px] text-[#94A3B8] italic">
                          Base vacía en este turno
                        </div>
                      ) : (
                        baseAssignments.map((assign) => {
                          const person = people.find((p) => p.id === assign.personId);
                          const fnLabel = (assign.assignedFunction || assign.roleInBase || 'Base').toUpperCase();
                          const isLider = fnLabel.includes('LÍDER') || fnLabel.includes('LIDER');
                          const isCalif = fnLabel.includes('CALIFICADOR');
                          const isVeedor = fnLabel.includes('VEEDOR');
                          const isVar = fnLabel.includes('VAR');

                          return (
                            <div
                              key={assign.id}
                              className="p-2 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] flex items-center justify-between text-xs"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-semibold text-[#182535] truncate flex items-center gap-1.5">
                                  <span>{person?.name || 'Persona'}</span>
                                </div>
                                <div className="text-[10px] text-[#64748B] font-mono truncate flex items-center gap-1.5 mt-0.5">
                                  <span>{person?.documentId}</span>
                                  <span>•</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-bold text-[9px] border ${
                                      isLider
                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                        : isCalif
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                        : isVeedor
                                        ? 'bg-sky-50 text-sky-800 border-sky-300'
                                        : isVar
                                        ? 'bg-purple-50 text-purple-800 border-purple-300'
                                        : 'bg-[#FAF6EC] text-[#64748B] border-[#EADDC7]'
                                    }`}
                                  >
                                    {assign.assignedFunction || assign.roleInBase || 'Base'}
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={() => handleRemoveAssignment(assign.id)}
                                title="Quitar de base"
                                className="min-h-[36px] min-w-[36px] text-[#64748B] hover:text-[#B83A24] p-1.5 rounded-lg hover:bg-[#FDF2EE] transition-colors flex items-center justify-center shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}

                      {/* Unassigned official functions indicator */}
                      {(() => {
                        const usedFns = new Set(
                          baseAssignments.map((a) => (a.assignedFunction || a.roleInBase || '').trim().toUpperCase())
                        );
                        const unassigned = CARNIVAL_GAP_OFFICIAL_FUNCTIONS.filter((f) => !usedFns.has(f.toUpperCase()));
                        if (unassigned.length === 0) return null;
                        return (
                          <div className="pt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-[#64748B]">
                            <span className="text-[9px] text-[#94A3B8] font-semibold">Disponibles:</span>
                            {unassigned.map((f) => (
                              <span
                                key={f}
                                className="px-1.5 py-0.5 rounded bg-[#FAF6EC] border border-[#EADDC7] text-[9px] font-mono text-[#64748B]"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Manage / Add Person to Base Button */}
                  <div className="mt-3 pt-3 border-t border-[#EADDC7]">
                    <button
                      onClick={() => handleOpenAssignModal(undefined, base.id)}
                      className={`min-h-[40px] w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isFull
                          ? 'bg-[#FAF6EC] hover:bg-[#F4ECE0] text-[#182535] border border-[#EADDC7]'
                          : 'bg-[#B83A24] hover:bg-[#9E2F1B] text-white shadow-2xs'
                      }`}
                    >
                      {isFull ? (
                        <>
                          <Shield className="w-3.5 h-3.5 text-[#B83A24]" />
                          <span>Gestionar Funciones ({baseAssignments.length}/{base.defaultCapacity})</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Asignar a Base ({baseAssignments.length}/{base.defaultCapacity})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GENERAL SHIFT ROSTER (PERSONAL ASIGNADO) */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EADDC7]">
          <div>
            <h4 className="text-base sm:text-lg font-bold text-[#182535] font-dalek tracking-wide">
              PERSONAL ASIGNADO A {activeShift.name} ({activeShift.label})
            </h4>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-xs font-montserrat text-[#64748B]">
                Cupo ocupado:{' '}
                <strong className={shiftCupoFilledCount >= (activeShift.capacity || 0) ? 'text-[#16A34A]' : 'text-[#182535]'}>
                  {shiftCupoFilledCount} / {activeShift.capacity || 0}
                </strong>{' '}
                {isShiftMesa ? 'MESA' : activeShift.category === 'GAP' ? 'GAP' : 'GT'}
              </p>
              {assignedMesaCount > 0 && !isShiftMesa && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                  +{assignedMesaCount} MESA (no ocupan cupo GT)
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => handleOpenAssignModal()}
            className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#B83A24] hover:bg-[#9E2F1B] text-white shadow-2xs transition-all self-start sm:self-auto font-dalek tracking-wider cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Asignar Persona a Turno</span>
          </button>
        </div>

        {/* Category & GT Sub-Team Filters */}
        <div className="space-y-2.5 pt-1">
          {/* Main Controls: Selector Dropdown + Search + Reset */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Primary Selector Dropdown ("Seleccionar y no copiar") */}
            <div className="flex items-center gap-2 bg-[#FAF6EC] p-1.5 px-3 rounded-2xl border border-[#EADDC7] overflow-x-auto">
              <Filter className="w-4 h-4 text-[#B83A24] shrink-0" />
              <label htmlFor="roster-filter-select" className="text-[11px] font-bold text-[#64748B] font-montserrat whitespace-nowrap">
                Seleccionar filtro:
              </label>
              <select
                id="roster-filter-select"
                value={activeRosterFilter}
                onChange={(e) => setActiveRosterFilter(e.target.value)}
                className="min-h-[34px] px-3 py-1.5 rounded-xl bg-white border border-[#EADDC7] text-xs font-bold text-[#182535] font-montserrat cursor-pointer hover:border-[#B83A24] focus:outline-hidden focus:ring-2 focus:ring-[#B83A24]/30"
              >
                <option value="ALL">Mostrar Todos ({currentShiftAssignments.length})</option>
                <optgroup label="── SUB-EQUIPOS DE GT ──">
                  <option value="GT">Todos los GT ({assignedGtCount})</option>
                  {gtSubTeamStats.map((st) => (
                    <option key={st.filterId} value={st.filterId}>
                      {st.displayLabel} ({st.count})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="── OTROS GRUPOS ──">
                  <option value="MESA">MESA ({assignedMesaCount})</option>
                  <option value="GAP">GAP ({assignedGapCount})</option>
                </optgroup>
              </select>
            </div>

            {/* Quick Search in Roster */}
            <div className="flex items-center gap-2">
              <div className="relative min-w-[200px] sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar asignado o GT..."
                  value={assignedRosterSearch}
                  onChange={(e) => setAssignedRosterSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] placeholder:text-[#94A3B8] focus:outline-hidden focus:border-[#B83A24]"
                />
                {assignedRosterSearch && (
                  <button
                    type="button"
                    onClick={() => setAssignedRosterSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#182535] p-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {(activeRosterFilter !== 'ALL' || assignedRosterSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveRosterFilter('ALL');
                    setAssignedRosterSearch('');
                  }}
                  className="text-[11px] font-bold text-[#B83A24] hover:underline cursor-pointer whitespace-nowrap hidden sm:inline"
                >
                  Ver todos ({currentShiftAssignments.length})
                </button>
              )}
            </div>
          </div>

          {/* Quick Click Filter Pills: Direct Selection without typing */}
          <div className="flex items-center gap-1.5 bg-[#FAF6EC] p-1.5 rounded-2xl border border-[#EADDC7] overflow-x-auto pb-2">
            <span className="text-[11px] font-bold text-[#64748B] px-2 font-montserrat shrink-0">
              Acceso rápido:
            </span>
            <button
              type="button"
              onClick={() => setActiveRosterFilter('ALL')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer font-montserrat whitespace-nowrap ${
                activeRosterFilter === 'ALL'
                  ? 'bg-[#182535] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#182535] hover:bg-[#FFFDF8]'
              }`}
            >
              Todos ({currentShiftAssignments.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveRosterFilter('GT')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer font-montserrat whitespace-nowrap ${
                activeRosterFilter === 'GT'
                  ? 'bg-[#182535] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#182535] hover:bg-[#FFFDF8]'
              }`}
            >
              Todos los GT ({assignedGtCount})
            </button>

            {/* Direct GT Sub-team Pills (Logística, Mercadeo, RRPP, Generales, etc.) */}
            {gtSubTeamStats.map((st) => {
              const isSelected = activeRosterFilter === st.filterId;
              return (
                <button
                  key={st.filterId}
                  type="button"
                  onClick={() => setActiveRosterFilter(st.filterId)}
                  className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer font-montserrat whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#B83A24] text-white shadow-2xs'
                      : st.count > 0
                      ? 'bg-[#FFFDF8] text-[#182535] hover:bg-[#FAF6EC] border border-[#EADDC7]'
                      : 'text-[#94A3B8] hover:text-[#182535] hover:bg-[#FFFDF8]'
                  }`}
                >
                  <span>{st.displayLabel}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : st.count > 0
                        ? 'bg-[#FAF6EC] text-[#B83A24] font-bold'
                        : 'bg-[#FAF6EC] text-[#94A3B8]'
                    }`}
                  >
                    {st.count}
                  </span>
                </button>
              );
            })}

            {/* MESA & GAP Pills */}
            {(assignedMesaCount > 0 || currentShiftRequirements.some((r) => r.groupType === 'MESA')) && (
              <button
                type="button"
                onClick={() => setActiveRosterFilter('MESA')}
                className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer font-montserrat whitespace-nowrap ${
                  activeRosterFilter === 'MESA'
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-purple-700 hover:bg-[#FFFDF8]'
                }`}
              >
                MESA ({assignedMesaCount})
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveRosterFilter('GAP')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer font-montserrat whitespace-nowrap ${
                activeRosterFilter === 'GAP'
                  ? 'bg-[#16A34A] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#16A34A] hover:bg-[#FFFDF8]'
              }`}
            >
              GAP ({assignedGapCount})
            </button>

            {activeRosterFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setActiveRosterFilter('ALL')}
                className="text-[11px] font-bold text-[#B83A24] hover:underline cursor-pointer ml-auto px-2 whitespace-nowrap"
              >
                Quitar filtro ({activeFilterLabel})
              </button>
            )}
          </div>
        </div>

        {currentShiftAssignments.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#64748B]">
            <Users className="w-10 h-10 text-[#C87F17] mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-[#182535] text-sm">0 Personas asignadas a este turno</p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Seleccione una necesidad de cupo arriba o pulse &quot;Asignar Persona a Turno&quot;.
            </p>
          </div>
        ) : filteredCurrentShiftAssignments.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#64748B] bg-[#FAF6EC]/60 rounded-2xl border border-dashed border-[#EADDC7]">
            <Users className="w-8 h-8 text-[#C87F17] mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-[#182535] text-sm">
              {assignedRosterSearch
                ? `No hay personas que coincidan con "${assignedRosterSearch}" en este turno`
                : `No hay personas de ${activeFilterLabel} asignadas en este turno`}
            </p>
            <button
              onClick={() => {
                setActiveRosterFilter('ALL');
                setAssignedRosterSearch('');
              }}
              className="mt-2 text-xs font-bold text-[#B83A24] hover:underline cursor-pointer"
            >
              Mostrar todas las asignaciones ({currentShiftAssignments.length})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCurrentShiftAssignments.map((assign) => {
              const person = people.find((p) => p.id === assign.personId);
              const isMesaAssign = assign.assignedType === 'MESA';
              const effectiveGtSubTeam =
                assign.gtSubTeam || (assign.assignedType === 'GT' ? person?.gtSubTeam || 'Generales' : undefined);
              return (
                <div
                  key={assign.id}
                  className="p-3.5 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-[#182535] truncate">{person?.name || 'Persona'}</div>
                    <div className="text-[11px] text-[#64748B] font-mono truncate">
                      {person?.documentId || ''}
                    </div>

                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (assign.assignedType === 'GT') {
                            setActiveRosterFilter(`GT:${effectiveGtSubTeam || 'Generales'}`);
                          } else {
                            setActiveRosterFilter(assign.assignedType);
                          }
                        }}
                        title={`Clic para filtrar por ${
                          assign.assignedType === 'GT' ? `GT ${effectiveGtSubTeam?.toUpperCase() || 'GENERALES'}` : assign.assignedType
                        }`}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-colors cursor-pointer hover:opacity-80 ${
                          isMesaAssign
                            ? 'bg-[#FEF8EC] text-[#C87F17] border-[#FDE68A]'
                            : assign.assignedType === 'GAP'
                            ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
                            : 'bg-[#FFFDF8] text-[#182535] border-[#EADDC7]'
                        }`}
                      >
                        {assign.assignedType === 'GT'
                          ? `GT: ${effectiveGtSubTeam || 'Generales'}`
                          : isMesaAssign
                          ? 'MESA'
                          : 'GAP'}
                      </button>
                      {assign.assignedFunction && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                          {assign.assignedFunction}
                        </span>
                      )}
                      {assign.baseNumber !== undefined && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A]">
                          {getBaseDisplayName(assign.baseNumber)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveAssignment(assign.id)}
                    className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-[#64748B] hover:text-[#B83A24] hover:bg-[#FDF2EE] transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                    title="Quitar turno"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: DEFINIR NECESIDAD DE CUPO (REQUERIMIENTO POR GT) */}
      {isReqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#EADDC7]">
              <div>
                <span className="text-[10px] font-bold text-[#B83A24] uppercase font-dalek tracking-wider">
                  {currentDay.eventName} • {activeShift.name} ({activeShift.label})
                </span>
                <h3 className="text-lg font-bold text-[#182535] font-dalek">
                  CREAR NECESIDAD DE TURNO
                </h3>
              </div>
              <button
                onClick={() => setIsReqModalOpen(false)}
                className="p-1 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRequirement} className="space-y-4 mt-4 text-xs font-montserrat">
              {/* Grupo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1">
                    Grupo Principal *
                  </label>
                  <select
                    value={reqGroupType}
                    onChange={(e) => {
                      const val = e.target.value as PersonType;
                      setReqGroupType(val);
                      setReqSelectedFunctions([]);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs font-semibold text-[#182535]"
                  >
                    <option value="GT">GT (Guías Técnicos)</option>
                    <option value="GAP">GAP (Guías de Apoyo y Protocolo)</option>
                    <option value="MESA">MESA (Comité Central)</option>
                  </select>
                </div>

                {/* Sub-equipo GT if GT */}
                {reqGroupType === 'GT' ? (
                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1">
                      Sub-Equipo GT *
                    </label>
                    <select
                      value={reqGtSubTeam}
                      onChange={(e) => {
                        setReqGtSubTeam(e.target.value as GtSubTeam);
                        setReqSelectedFunctions([]);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs font-semibold text-[#182535]"
                    >
                      {GT_SUBTEAMS.map((sub) => (
                        <option key={sub} value={sub}>
                          GT → {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1">
                      Cupos Necesarios *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={reqCapacity}
                      onChange={(e) => setReqCapacity(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs font-bold text-[#182535]"
                    />
                  </div>
                )}
              </div>

              {/* Capacity if GT */}
              {reqGroupType === 'GT' && (
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1">
                    Cupos Necesarios para {reqGtSubTeam} en {activeShift.name} *
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={reqCapacity}
                      onChange={(e) => setReqCapacity(Number(e.target.value))}
                      className="w-32 px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-sm font-bold text-[#182535]"
                    />
                    <span className="text-xs text-[#64748B]">
                      personas (El cupo total pertenece a <b>{reqGtSubTeam}</b>)
                    </span>
                  </div>
                </div>
              )}

              {/* SECCIÓN OPCIONAL: ASIGNAR FUNCIONES ESPECÍFICAS */}
              <div className="p-4 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#182535]">
                      Asignar Funciones Específicas
                    </span>
                    <span className="text-[10px] text-[#64748B] block">
                      Opcional: filtra a las personas que tengan estas funciones
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    id="toggleReqFunc"
                    checked={reqShowSpecificFunctions}
                    onChange={(e) => setReqShowSpecificFunctions(e.target.checked)}
                    className="w-4 h-4 accent-[#B83A24] rounded cursor-pointer"
                  />
                </div>

                {reqShowSpecificFunctions && (
                  <div className="pt-2 border-t border-[#EADDC7]/60 space-y-2">
                    <p className="text-[11px] text-[#475569]">
                      Seleccione las funciones exclusivas de{' '}
                      <b>{reqGroupType === 'GT' ? `GT → ${reqGtSubTeam}` : reqGroupType}</b>:
                    </p>

                    {(() => {
                      const availableCatalogFns = getFilteredFunctions(
                        functions,
                        reqGroupType,
                        reqGroupType === 'GT' ? reqGtSubTeam : undefined,
                        true
                      );

                      if (availableCatalogFns.length === 0) {
                        return (
                          <div className="p-2.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] text-[11px] text-[#64748B]">
                            No hay funciones específicas registradas para este grupo. Puede crearlas en la pestaña <b>FUNCIONES</b>.
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-wrap gap-2">
                          {availableCatalogFns.map((fn) => {
                            const isChecked = reqSelectedFunctions.includes(fn.name);
                            return (
                              <button
                                key={fn.id}
                                type="button"
                                onClick={() => {
                                  setReqSelectedFunctions((prev) =>
                                    prev.includes(fn.name)
                                      ? prev.filter((f) => f !== fn.name)
                                      : [...prev, fn.name]
                                  );
                                }}
                                className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                  isChecked
                                    ? 'bg-[#182535] text-white border-[#182535]'
                                    : 'bg-[#FFFDF8] text-[#475569] border-[#E2D6BC] hover:border-[#182535]'
                                }`}
                              >
                                {isChecked ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5 opacity-50" />
                                )}
                                <span>{fn.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Notas opcionales */}
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1">
                  Notas / Observaciones del Cupo
                </label>
                <input
                  type="text"
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  placeholder="Ej. Llevar chaleco reflectivo, coordinar con líder..."
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535]"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#EADDC7]">
                <button
                  type="button"
                  onClick={() => setIsReqModalOpen(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-[#64748B] hover:text-[#182535] text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white font-bold text-xs shadow-md transition-all font-dalek tracking-wider"
                >
                  Guardar Cupo de Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ASIGNAR PERSONAS AL TURNO / CUPO / BASE */}
      {isAssignModalOpen && (() => {
        const isContextMesa = activeRequirement?.groupType === 'MESA' || baseAssignTab === 'MESA' || isShiftMesa;
        const shiftRequiresBase = isContextMesa ? false : Boolean(activeShift.hasBases || modalBase !== null);
        const hasValidBase = isContextMesa ? true : Boolean(modalBase || selectedBaseNumber !== null);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
            <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-2.5 border-b border-[#EADDC7] shrink-0">
                <div>
                  {modalBase ? (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#B83A24] uppercase font-montserrat tracking-wide">
                          {modalBase.baseLabel || (modalBase.isSpecial ? modalBase.name : `BASE ${modalBase.baseNumber || modalBase.id}`)}
                        </span>
                        {modalBase.isSpecial && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-[#FEF8EC] border border-[#E5A12E]/50 text-[#C87F17] font-bold">
                            BASE ESPECIAL
                          </span>
                        )}
                        <span className="text-[11px] text-[#64748B] font-montserrat">
                          • {activeShift.name} ({activeShift.label})
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-[#182535] font-montserrat mt-0.5">
                        {modalBase.gameName || modalBase.name}
                      </h3>
                      <p className="text-xs text-[#64748B] mt-0.5 font-montserrat">
                        Cupo GAP de la base: <b className="text-[#182535] font-mono">{currentBaseOccupants.length} / {modalBase.defaultCapacity}</b>
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] font-bold text-[#B83A24] uppercase font-montserrat tracking-wide">
                        {currentDay.eventName} • {activeShift.name} ({activeShift.label})
                      </span>
                      <h3 className="text-lg sm:text-xl font-extrabold text-[#182535] font-montserrat">
                        {activeRequirement
                          ? `ASIGNAR A: ${
                              activeRequirement.groupType === 'GT'
                                ? `GT ${activeRequirement.gtSubTeam}`
                                : activeRequirement.groupType
                            }`
                          : selectedBaseNumber !== null
                          ? `ASIGNAR A ${getBaseDisplayName(selectedBaseNumber).toUpperCase()}`
                          : `ASIGNAR A ${activeShift.name}`}
                      </h3>
                      {activeRequirement ? (
                        <p className="text-xs text-[#64748B] mt-0.5">
                          Cupo objetivo: <b>{activeRequirement.capacity} personas ({activeRequirement.groupType})</b>
                        </p>
                      ) : (
                        <p className="text-xs text-[#64748B] mt-0.5">
                          Cupo del turno: <b>{shiftCupoFilledCount} / {activeShift.capacity || 0} {isShiftMesa ? 'MESA' : activeShift.category === 'GAP' ? 'GAP' : 'GT'}</b>
                          {assignedMesaCount > 0 && !isShiftMesa && (
                            <span className="ml-1 text-purple-700 font-medium">
                              ({assignedMesaCount} MESA asignados no ocupan cupo GT)
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="p-1 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Modal Body (Unified smooth scrolling for all screen sizes) */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 sm:pr-2 py-2 space-y-3 overscroll-contain">
                {/* Modal Alert if continuity or error */}
                {modalAlert && (
                  <div className="p-3 rounded-2xl bg-[#FEF8EC] border border-[#E5A12E]/40 text-[#C87F17] text-xs flex items-start gap-2 leading-relaxed">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#C87F17]" />
                    <span>{modalAlert}</span>
                  </div>
                )}

                {/* MANDATORY BASE SELECTION (for shifts requiring a base) */}
                {shiftRequiresBase && (
                  <div className="p-3.5 bg-[#FAF6EC] rounded-2xl border border-[#EADDC7] space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-bold text-[#182535] flex items-center gap-1.5 font-montserrat">
                        <MapPin className="w-3.5 h-3.5 text-[#B83A24]" />
                        <span>Base Física Obligatoria *</span>
                      </label>
                      {modalBase && (
                        <span
                          className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full font-bold border ${
                            isBaseFull
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          Ocupación: {currentBaseOccupants.length} / {modalBase.defaultCapacity} personas
                        </span>
                      )}
                    </div>

                    <select
                      value={
                        modalBase?.id
                          ? String(modalBase.id)
                          : selectedBaseNumber !== null
                          ? String(selectedBaseNumber)
                          : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setModalBase(null);
                          setSelectedBaseNumber(null);
                          return;
                        }
                        const found = physicalBases.find(
                          (b) => String(b.id) === val || String(b.baseNumber) === val
                        );
                        if (found) {
                          setModalBase(found);
                          setSelectedBaseNumber(found.baseNumber || found.id);
                        } else {
                          setModalBase({
                            id: val,
                            baseNumber: val,
                            name: getBaseDisplayName(val),
                            defaultCapacity: 2,
                            suggestedCapacity: 2,
                          });
                          setSelectedBaseNumber(val);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-[#FFFDF8] border border-[#E5DAC0] text-xs font-bold text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                    >
                      <option value="">-- Seleccionar Base Física (Obligatorio) --</option>
                      {physicalBases.map((b) => (
                        <option key={b.id} value={String(b.id)}>
                          {b.name} (Capacidad: {b.defaultCapacity})
                        </option>
                      ))}
                    </select>

                    {!hasValidBase && (
                      <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Debe seleccionar una base física antes de poder asignar a un candidato.
                      </p>
                    )}

                    {isBaseFull && (
                      <p className="text-[11px] text-amber-800 font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Esta base ha alcanzado su capacidad máxima ({modalBase?.defaultCapacity || 2} personas).
                      </p>
                    )}
                  </div>
                )}

                {/* 4 FUNCIONES OFICIALES GAP DE CARNIVAL (Solo visible en pestaña GAP) */}
                {selectedDayId === 'miercoles' && (modalBase || selectedBaseNumber !== null) && baseAssignTab === 'GAP' && (
                  <div className="p-3 bg-[#FFFDF8] rounded-2xl border border-[#B83A24]/30 space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-[#EADDC7]/60">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[#B83A24]" />
                        <h4 className="text-xs font-bold text-[#182535] font-montserrat">
                          Funciones Oficiales GAP de la Base
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FAF6EC] border border-[#EADDC7] text-[#64748B] font-bold">
                        Cupo: {currentBaseOccupants.length} / {modalBase?.defaultCapacity || 2} personas
                      </span>
                    </div>

                    {/* Toast Alerts for manual function changes */}
                    {roleChangeError && (
                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{roleChangeError}</span>
                      </div>
                    )}
                    {roleChangeSuccess && (
                      <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                        <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>{roleChangeSuccess}</span>
                      </div>
                    )}

                    {/* 4 Functions in a clean compact 2x2 grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {CARNIVAL_GAP_OFFICIAL_FUNCTIONS.map((fn, idx) => {
                        const occupant = currentBaseOccupants.find(
                          (a) => (a.assignedFunction || a.roleInBase || '').trim().toUpperCase() === fn.toUpperCase()
                        );
                        const person = occupant ? people.find((p) => p.id === occupant.personId) : null;

                        const isLider = fn.includes('LÍDER');
                        const isCalif = fn.includes('CALIFICADOR');
                        const isVeedor = fn.includes('VEEDOR');

                        return (
                          <div
                            key={fn}
                            className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                              occupant
                                ? isLider
                                ? 'bg-amber-50/70 border-amber-300'
                                : isCalif
                                ? 'bg-emerald-50/70 border-emerald-300'
                                : isVeedor
                                ? 'bg-sky-50/70 border-sky-300'
                                : 'bg-purple-50/70 border-purple-300'
                                : 'bg-[#FAF6EC]/80 border-[#EADDC7] text-[#64748B]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-[#182535] text-white text-[9px] flex items-center justify-center font-bold shrink-0 font-mono">
                                  {idx + 1}
                                </span>
                                <span className="text-[11px] font-bold text-[#182535] font-montserrat truncate">
                                  {fn}
                                </span>
                              </div>

                              {occupant && person ? (
                                <div className="text-[11px] font-semibold text-[#182535] truncate mt-0.5 ml-5.5">
                                  {person.name}
                                </div>
                              ) : (
                                <div className="text-[10px] text-[#94A3B8] italic mt-0.5 ml-5.5">
                                  {isBaseFull ? 'Sin asignar (Cupo lleno)' : 'Disponible al asignar'}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {occupant ? (
                                <>
                                  <select
                                    value={occupant.assignedFunction || occupant.roleInBase || fn}
                                    onChange={(e) =>
                                      handleManualFunctionChange(
                                        occupant.id,
                                        e.target.value,
                                        modalBase?.id || selectedBaseNumber || undefined
                                      )
                                    }
                                    className="text-[10px] py-1 px-1.5 rounded-lg bg-white border border-[#EADDC7] text-[#182535] font-bold cursor-pointer hover:border-[#B83A24] focus:outline-hidden"
                                    title="Cambiar función"
                                  >
                                    {CARNIVAL_GAP_OFFICIAL_FUNCTIONS.map((f) => (
                                      <option key={f} value={f}>
                                        {f}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAssignment(occupant.id)}
                                    className="p-1 rounded-lg text-[#64748B] hover:text-[#B83A24] hover:bg-[#FDF2EE] transition-colors cursor-pointer"
                                    title="Quitar de base"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                    isBaseFull
                                      ? 'bg-neutral-100 text-[#94A3B8] border border-neutral-200'
                                      : 'bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A]'
                                  }`}
                                >
                                  {isBaseFull ? 'Vacante' : 'Libre'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Subtle 1-line note */}
                    <p className="text-[10px] text-[#64748B] font-montserrat pt-0.5">
                      <span className="font-semibold text-[#182535]">Regla de cupos:</span> El cupo de la base ({modalBase?.defaultCapacity || 2}) rige las asignaciones. La función VAR no aumenta el cupo automáticamente.
                    </p>
                  </div>
                )}

                {/* [GAP] / [GT] / [MESA] TABS */}
                {!activeRequirement && (
                  <div className="flex items-center gap-2 p-1 bg-[#FAF6EC] rounded-2xl border border-[#EADDC7]">
                    {isShiftMesa ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setBaseAssignTab('GT');
                            setModalAssignedType('GT');
                          }}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer font-montserrat ${
                            baseAssignTab === 'GT'
                              ? 'bg-[#182535] text-white shadow-xs'
                              : 'text-[#64748B] hover:text-[#182535]'
                          }`}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>[GT] Selección GT ({gtCandidatesCount})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setBaseAssignTab('MESA');
                            setModalAssignedType('MESA');
                          }}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer font-montserrat ${
                            baseAssignTab === 'MESA'
                              ? 'bg-purple-700 text-white shadow-xs'
                              : 'text-[#64748B] hover:text-[#182535]'
                          }`}
                        >
                          <Crown className="w-3.5 h-3.5" />
                          <span>[MESA] Integrantes MESA ({mesaCandidatesCount})</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setBaseAssignTab('GAP');
                            setModalAssignedType('GAP');
                          }}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer font-montserrat ${
                            baseAssignTab === 'GAP'
                              ? 'bg-[#B83A24] text-white shadow-xs'
                              : 'text-[#64748B] hover:text-[#182535]'
                          }`}
                        >
                          <Grid className="w-3.5 h-3.5" />
                          <span>[GAP] Encargados de Base ({gapCandidatesCount})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setBaseAssignTab('GT');
                            setModalAssignedType('GT');
                          }}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer font-montserrat ${
                            baseAssignTab === 'GT'
                              ? 'bg-[#182535] text-white shadow-xs'
                              : 'text-[#64748B] hover:text-[#182535]'
                          }`}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>[GT] Apoyo / Logística ({gtCandidatesCount})</span>
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Search Control */}
                <div className="pt-2 pb-1 border-b border-[#EADDC7]/60">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar candidato por nombre, cédula o usuario..."
                      value={candidateSearchQuery}
                      onChange={(e) => setCandidateSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] placeholder:text-[#94A3B8] focus:outline-hidden focus:border-[#B83A24]"
                    />
                    {candidateSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setCandidateSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#182535] p-1"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* GT Sub-team Selection in Modal ("Seleccionar y no copiar") */}
                  {!activeRequirement && baseAssignTab === 'GT' && (
                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-1">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Filter className="w-3.5 h-3.5 text-[#B83A24]" />
                        <label htmlFor="modal-gt-select" className="text-[10px] font-bold text-[#64748B] font-montserrat">
                          Filtrar GT:
                        </label>
                        <select
                          id="modal-gt-select"
                          value={modalGtSubTeamFilter}
                          onChange={(e) => setModalGtSubTeamFilter(e.target.value)}
                          className="text-xs px-2 py-1 rounded-xl bg-white border border-[#EADDC7] text-[#182535] font-montserrat font-bold cursor-pointer hover:border-[#B83A24] focus:outline-hidden"
                        >
                          <option value="ALL">Todos los GT</option>
                          {GT_SUBTEAMS.map((st) => (
                            <option key={st} value={st}>
                              GT {st.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                        <button
                          type="button"
                          onClick={() => setModalGtSubTeamFilter('ALL')}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-bold font-montserrat whitespace-nowrap cursor-pointer transition-all ${
                            modalGtSubTeamFilter === 'ALL'
                              ? 'bg-[#182535] text-white shadow-2xs'
                              : 'bg-[#FAF6EC] text-[#64748B] hover:text-[#182535] border border-[#EADDC7]'
                          }`}
                        >
                          Todos
                        </button>
                        {GT_SUBTEAMS.map((subteam) => (
                          <button
                            key={subteam}
                            type="button"
                            onClick={() => setModalGtSubTeamFilter(subteam)}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold font-montserrat whitespace-nowrap cursor-pointer transition-all ${
                              modalGtSubTeamFilter === subteam
                                ? 'bg-[#B83A24] text-white shadow-2xs'
                                : 'bg-[#FAF6EC] text-[#64748B] hover:text-[#182535] border border-[#EADDC7]'
                            }`}
                          >
                            GT {subteam.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B] mt-1.5 px-1 font-montserrat">
                    <div className="flex items-center gap-2">
                      <span>
                        Candidatos disponibles: <b>{filteredCandidates.length}</b>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowOnlyAvailableInModal(!showOnlyAvailableInModal)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          showOnlyAvailableInModal
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                            : 'bg-[#FAF6EC] text-[#64748B] border border-[#EADDC7] hover:text-[#182535]'
                        }`}
                      >
                        {showOnlyAvailableInModal ? '✓ Solo con turno registrado' : 'Mostrando todo el personal'}
                      </button>
                    </div>
                    <span>
                      Categoría activa: <b>{baseAssignTab}</b>
                    </span>
                  </div>
                </div>

                {/* Candidate Pool List */}
                <div className="space-y-2 pt-1">
                  {filteredCandidates.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#FAF6EC] border border-dashed border-[#EADDC7] text-center space-y-2">
                      <Users className="w-8 h-8 text-[#94A3B8] mx-auto" />
                      <p className="font-bold text-[#182535] text-xs font-montserrat">
                        No hay candidatos disponibles en {baseAssignTab} para este turno
                      </p>
                      <p className="text-[11px] text-[#64748B] max-w-sm mx-auto">
                        Solo se muestran integrantes activos sin conflictos de horario. Puede hacer clic en &quot;Mostrando todo el personal&quot; arriba o buscar por nombre.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                    {filteredCandidates.map(({ person, matchingFunctionsList, carnivalContinuityConflict, priorCarnivalBaseName, isAvailableInShift }) => {
                      const isSelected = modalPersonId === person.id;
                      const selectedFunctionToUse =
                        isSelected && modalAssignedFunction
                          ? modalAssignedFunction
                          : matchingFunctionsList[0] || '';

                      const cannotAssign =
                        isSubmitting ||
                        (shiftRequiresBase && isBaseFull) ||
                        (shiftRequiresBase && !hasValidBase);

                      return (
                        <div
                          key={person.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-[#FEF8EC] border-[#B83A24] shadow-xs'
                              : 'bg-[#FFFDF8] border-[#EADDC7] hover:border-[#B83A24]/50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-[#182535]">
                                {person.name}
                              </span>
                              {(() => {
                                const effType = getEffectivePersonType(person);
                                return (
                                  <>
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                        effType === 'GT'
                                          ? 'bg-[#FDF2EE] text-[#B83A24]'
                                          : effType === 'GAP'
                                          ? 'bg-[#FEF8EC] text-[#C87F17]'
                                          : 'bg-purple-50 text-purple-700'
                                      }`}
                                    >
                                      {person.gtSubTeam ? `GT: ${person.gtSubTeam}` : effType}
                                    </span>
                                    {effType === 'MESA' && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FEF8EC] text-[#C87F17] border border-[#E5A12E]/40">
                                        MESA
                                      </span>
                                    )}
                                    {effType === 'GT' && person.alsoActsAsGap && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                                        + GAP Habilitado
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                              {carnivalContinuityConflict && priorCarnivalBaseName && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                  En otro turno: {priorCarnivalBaseName}
                                </span>
                              )}
                              {!isAvailableInShift && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                                  Sin turno registrado
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-[#64748B] font-mono mt-0.5">
                              C.C: {person.documentId || 'S/N'} • @{person.username || person.documentId}
                            </div>

                            {/* Health Badges if any */}
                            {(person.foodAllergies || person.dietaryRestrictions || person.medicalConditions) && (
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {person.foodAllergies && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                    Alergia: {person.foodAllergies}
                                  </span>
                                )}
                                {person.dietaryRestrictions && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    Dieta: {person.dietaryRestrictions}
                                  </span>
                                )}
                                {person.medicalConditions && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    Salud: {person.medicalConditions}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Show functions of person */}
                            <div className="flex items-center gap-1 flex-wrap mt-1.5">
                              <span className="text-[10px] text-[#64748B] font-bold">
                                Funciones:
                              </span>
                              {person.functions && person.functions.length > 0 ? (
                                person.functions.map((f, i) => {
                                  const isMatchingReq =
                                    activeRequirement?.specificFunctions?.includes(f);
                                  return (
                                    <span
                                      key={i}
                                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                        isMatchingReq
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                          : 'bg-[#FAF6EC] text-[#475569] border border-[#EADDC7]'
                                      }`}
                                    >
                                      {f}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-[10px] text-[#94A3B8]">Sin funciones registradas</span>
                              )}
                            </div>
                          </div>

                          {/* Function selection and Assign action */}
                          <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                            {matchingFunctionsList.length > 1 ? (
                              <select
                                value={selectedFunctionToUse}
                                onChange={(e) => {
                                  setModalPersonId(person.id);
                                  setModalAssignedFunction(e.target.value);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs font-semibold text-[#182535]"
                              >
                                {matchingFunctionsList.map((fn) => (
                                  <option key={fn} value={fn}>
                                    {fn}
                                  </option>
                                ))}
                              </select>
                            ) : matchingFunctionsList.length === 1 ? (
                              <span className="px-2 py-1 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[11px] font-bold text-[#16A34A]">
                                {matchingFunctionsList[0]}
                              </span>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => {
                                handleCandidateAssignClick(
                                  person,
                                  selectedFunctionToUse || matchingFunctionsList[0] || ''
                                );
                              }}
                              disabled={cannotAssign}
                              className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold font-montserrat flex items-center gap-1.5 shadow-2xs transition-all ${
                                cannotAssign
                                  ? 'bg-[#FAF6EC] text-[#94A3B8] border border-[#EADDC7] cursor-not-allowed'
                                  : baseAssignTab === 'GAP'
                                  ? 'bg-[#B83A24] hover:bg-[#9E2F1B] text-white cursor-pointer'
                                  : isShiftMesa || baseAssignTab === 'MESA' || activeRequirement?.groupType === 'MESA'
                                  ? 'bg-purple-700 hover:bg-purple-800 text-white cursor-pointer'
                                  : 'bg-[#182535] hover:bg-[#2A3F55] text-white cursor-pointer'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>
                                {shiftRequiresBase && isBaseFull
                                  ? 'Base Llena'
                                  : shiftRequiresBase && !hasValidBase
                                  ? 'Seleccione Base'
                                  : activeRequirement
                                  ? `Asignar a ${activeRequirement.gtSubTeam || activeRequirement.groupType}`
                                  : isShiftMesa || baseAssignTab === 'MESA'
                                  ? 'Asignar a MESA'
                                  : `Asignar ${baseAssignTab}`}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[#EADDC7] flex items-center justify-between shrink-0">
                <span className="text-xs text-[#64748B]">
                  {shiftCupoFilledCount} / {activeShift.capacity || 0} cupos {isShiftMesa ? 'MESA' : 'GT'} ocupados
                  {assignedMesaCount > 0 && !isShiftMesa && (
                    <span className="text-purple-700 font-medium ml-1">
                      (+{assignedMesaCount} MESA asignados)
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="min-h-[40px] px-5 py-2 rounded-xl bg-[#FAF6EC] hover:bg-[#F3EEDC] text-[#182535] border border-[#EADDC7] text-xs font-bold font-montserrat cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Carnival GAP Consecutive Shifts Auto-Assign Modal */}
      {carnivalAutoPrompt && (
        <CarnivalAutoAssignModal
          promptData={carnivalAutoPrompt}
          isSubmitting={isSubmitting}
          onConfirmAll={handleConfirmCarnivalBatchAssign}
          onConfirmCurrentOnly={handleCancelCarnivalBatchAssign}
          onClose={() => setCarnivalAutoPrompt(null)}
        />
      )}

      {/* Floating Action Success Toast */}
      {actionSuccessToast && (
        <div
          id="carnival-assignment-success-toast"
          className="fixed bottom-6 right-6 z-80 bg-[#182535] text-white px-5 py-3.5 rounded-2xl shadow-xl border border-[#2E3F53] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 max-w-md font-montserrat"
        >
          <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0" />
          <span className="text-xs font-semibold leading-tight">{actionSuccessToast}</span>
          <button
            type="button"
            onClick={() => setActionSuccessToast(null)}
            className="text-white/60 hover:text-white p-1 ml-auto shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
