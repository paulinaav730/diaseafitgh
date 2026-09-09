import React, { useState, useMemo } from 'react';
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
  AppEvent,
  ConfigurableBase,
} from '../types';
import {
  EVENT_SCHEDULE,
  CARNIVAL_PHYSICAL_BASES,
  THE_GAMES_JUEVES_BASES,
  THE_GAMES_VIERNES_BASES,
  CARNIVAL_GT_SHIFTS,
  CARNIVAL_GAP_SHIFTS,
  getBaseDisplayName,
  findShiftById,
  doShiftsOverlap,
  DEFAULT_INITIAL_SHIFTS,
} from '../data/eventStructure';
import { GT_SUBTEAMS, getFilteredFunctions } from '../data/functionsCatalog';
import {
  assignPerson,
  removeAssignment,
  saveShiftRequirement,
  deleteShiftRequirement,
} from '../services/storageService';
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
  const [carnivalCategory, setCarnivalCategory] = useState<'GAP' | 'GT'>('GT');
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
  const [shiftCategoryFilter, setShiftCategoryFilter] = useState<'ALL' | 'GT' | 'GAP'>('ALL');
  const [assignedTypeFilter, setAssignedTypeFilter] = useState<'ALL' | 'GT' | 'GAP' | 'MESA'>('ALL');

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
      return isCarnival ? [...CARNIVAL_GT_SHIFTS, ...CARNIVAL_GAP_SHIFTS] : currentDay.shifts;
    }
    return currentDay.shifts;
  }, [shifts, selectedDayId, isCarnival, isDivided, currentDay]);

  const gtShiftsInDay = useMemo(() => {
    return allShiftsInDay.filter((s) => (s.category === 'GT' || s.category === 'MESA') && !s.hasBases);
  }, [allShiftsInDay]);

  const gapShiftsInDay = useMemo(() => {
    return allShiftsInDay.filter((s) => s.category === 'GAP' || s.hasBases);
  }, [allShiftsInDay]);

  // Active shifts available in this view (dynamically uses configurable shifts if present)
  const availableShifts = useMemo(() => {
    if (isDivided && isCarnival) {
      if (carnivalCategory === 'GAP') {
        const filtered = allShiftsInDay.filter((s) => s.category === 'GAP' || s.hasBases);
        if (filtered.length > 0) return filtered;
      } else if (carnivalCategory === 'GT') {
        const filtered = allShiftsInDay.filter((s) => s.category === 'GT' && !s.hasBases);
        if (filtered.length > 0) return filtered;
      }
    }

    if (shiftCategoryFilter === 'GT') {
      return gtShiftsInDay.length > 0 ? gtShiftsInDay : allShiftsInDay;
    } else if (shiftCategoryFilter === 'GAP') {
      return gapShiftsInDay.length > 0 ? gapShiftsInDay : allShiftsInDay;
    }

    return allShiftsInDay;
  }, [isDivided, isCarnival, carnivalCategory, shiftCategoryFilter, allShiftsInDay, gtShiftsInDay, gapShiftsInDay]);

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

  const handleCarnivalCategorySelect = (cat: 'GAP' | 'GT') => {
    setCarnivalCategory(cat);
    setShiftCategoryFilter(cat);
    setSelectedBaseNumber(null);
    setModalBase(null);
    if (cat === 'GAP') {
      const gapShift = allShiftsInDay.find((s) => s.category === 'GAP' || s.hasBases);
      if (gapShift) {
        setSelectedShiftId(gapShift.id);
      }
    } else {
      const gtShift = allShiftsInDay.find((s) => s.category === 'GT' && !s.hasBases);
      setSelectedShiftId(gtShift ? gtShift.id : (allShiftsInDay[0]?.id || 'miercoles-gt-t1'));
    }
  };

  const handleShiftCategoryFilterChange = (cat: 'ALL' | 'GT' | 'GAP') => {
    setShiftCategoryFilter(cat);
    setSelectedBaseNumber(null);
    setModalBase(null);
    if (cat === 'GT') {
      const gtShift = allShiftsInDay.find((s) => (s.category === 'GT' || s.category === 'MESA') && !s.hasBases);
      if (gtShift) setSelectedShiftId(gtShift.id);
    } else if (cat === 'GAP') {
      const gapShift = allShiftsInDay.find((s) => s.category === 'GAP' || s.hasBases);
      if (gapShift) setSelectedShiftId(gapShift.id);
    }
  };

  // Determine physical bases for current day & category (dynamically uses configurable bases if present)
  const physicalBases: PhysicalBase[] = useMemo(() => {
    if (bases && bases.length > 0) {
      if (
        activeShift?.hasBases ||
        (isDivided && carnivalCategory === 'GAP') ||
        selectedDayId === 'jueves' ||
        selectedDayId === 'viernes'
      ) {
        const eventIdFilter = selectedDayId === 'miercoles' ? 'carnival' : 'the-games';
        const matched = bases.filter(
          (b) => b.isActive && (b.eventId === eventIdFilter || b.dayId === selectedDayId)
        );
        if (matched.length > 0) {
          return matched.map((b) => ({
            id: b.id,
            baseNumber: b.baseNumber || b.id,
            name: b.name,
            defaultCapacity: b.capacity || b.defaultCapacity || 2,
            suggestedCapacity: b.capacity || b.defaultCapacity || 2,
            isSpecial: b.isSpecial,
          }));
        }
      }
    }

    if (
      activeShift?.hasBases ||
      (isDivided && carnivalCategory === 'GAP') ||
      selectedDayId === 'jueves' ||
      selectedDayId === 'viernes'
    ) {
      if (selectedDayId === 'miercoles') return CARNIVAL_PHYSICAL_BASES;
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
    }

    return [];
  }, [bases, isDivided, carnivalCategory, selectedDayId, activeShift?.hasBases]);

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

  const filteredCurrentShiftAssignments = useMemo(() => {
    if (assignedTypeFilter === 'ALL') return currentShiftAssignments;
    return currentShiftAssignments.filter((a) => a.assignedType === assignedTypeFilter);
  }, [currentShiftAssignments, assignedTypeFilter]);

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
      const defaultTab: 'GAP' | 'GT' | 'MESA' = isShiftMesa ? 'MESA' : 'GT';
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

  const isShiftFull = useMemo(() => {
    return Boolean(activeShift.capacity && currentShiftAssignments.length >= activeShift.capacity);
  }, [activeShift, currentShiftAssignments]);

  // Candidate pool calculation with strict availability, continuity, and GAP/GT/MESA rules
  const candidatePool = useMemo(() => {
    const isReqMesa = activeRequirement?.groupType === 'MESA';
    const isMesaContext = isReqMesa || (!activeRequirement && isShiftMesa);

    return people.map((person) => {
      const isMesa = person.primaryType === 'MESA';
      const isPersonActive = person.isActive !== false;

      // RULE: MESA members ONLY appear for MESA shifts/requirements ("solo para los turnos que sea mesa")
      // And in MESA shifts/requirements, ONLY MESA members appear
      if (isMesaContext) {
        if (!isMesa) {
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
      } else {
        if (isMesa) {
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
      }

      // 1. Group / Subteam matching for requirements:
      let matchesRequirementGroup = true;
      if (activeRequirement) {
        if (activeRequirement.groupType === 'MESA') {
          matchesRequirementGroup = isMesa;
        } else if (activeRequirement.groupType === 'GT') {
          const isGt = person.primaryType === 'GT';
          const matchesSub =
            !activeRequirement.gtSubTeam ||
            person.gtSubTeam === activeRequirement.gtSubTeam ||
            (person.gtTeams && person.gtTeams.includes(activeRequirement.gtSubTeam));
          matchesRequirementGroup = isGt && matchesSub;
        } else if (activeRequirement.groupType === 'GAP') {
          matchesRequirementGroup =
            person.primaryType === 'GAP' || (person.primaryType === 'GT' && Boolean(person.alsoActsAsGap));
        }
      } else {
        if (isShiftMesa) {
          matchesRequirementGroup = isMesa;
        } else {
          matchesRequirementGroup = !isMesa;
        }
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
      if (isMesa) {
        isAvailableInShift = true;
      } else if (availRecord && Array.isArray(availRecord.shiftIds) && availRecord.shiftIds.length > 0) {
        if (availRecord.shiftIds.includes(activeShift.id)) {
          isAvailableInShift = true;
        } else {
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
            for (const regId of availRecord.shiftIds) {
              const regShift = allKnownShifts.find((s) => s.id === regId);
              if (regShift && regShift.dayId === selectedDayId) {
                if (
                  regShift.startTime &&
                  activeShift.startTime &&
                  regShift.startTime === activeShift.startTime &&
                  regShift.endTime === activeShift.endTime
                ) {
                  isAvailableInShift = true;
                  break;
                }
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
      // If assigning to a base on Wednesday, person must stay in the same physical base
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
          const priorKey = String(priorAssign.baseId || priorAssign.baseNumber);
          const targetId = modalBase?.id ? String(modalBase.id) : String(selectedBaseNumber);
          const targetNum = modalBase?.baseNumber !== undefined ? String(modalBase.baseNumber) : String(selectedBaseNumber);
          if (priorKey !== targetId && priorKey !== targetNum && priorAssign.baseName !== modalBase?.name) {
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
      // - primaryType === 'GAP'
      // - primaryType === 'GT' with dual role:
      //   * GT Generales or alsoActsAsGap: Wed, Thu, Fri
      //   * GT Carnival: Thu, Fri
      //   * MESA is NEVER allowed for GAP
      let isCategoryAllowedForGap = false;
      if (person.primaryType === 'GAP') {
        isCategoryAllowedForGap = true;
      } else if (person.primaryType === 'GT') {
        if (isGeneralSubteam || person.alsoActsAsGap) {
          if (selectedDayId === 'miercoles' || selectedDayId === 'jueves' || selectedDayId === 'viernes') {
            isCategoryAllowedForGap = true;
          }
        } else if (isCarnivalSubteam) {
          if (selectedDayId === 'jueves' || selectedDayId === 'viernes') {
            isCategoryAllowedForGap = true;
          }
        } else if (person.alsoActsAsGap) {
          isCategoryAllowedForGap = true;
        }
      }

      // GT Eligibility:
      // - strictly primaryType === 'GT' (MESA is NEVER allowed for GT)
      let isCategoryAllowedForGt = false;
      if (person.primaryType === 'GT') {
        if (activeRequirement && activeRequirement.groupType === 'GT' && activeRequirement.gtSubTeam) {
          if (
            person.gtSubTeam === activeRequirement.gtSubTeam ||
            (person.gtTeams || []).includes(activeRequirement.gtSubTeam)
          ) {
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

      // Base prerequisite validity: active, available, not already in this shift, no shift overlap, no carnival conflict
      const baseAvailable =
        isPersonActive &&
        isAvailableInShift &&
        !isAlreadyAssigned &&
        !conflictingAssignment &&
        !carnivalContinuityConflict;

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
    return candidatePool.filter((c) => c.isEligibleForGap).length;
  }, [candidatePool]);

  const gtCandidatesCount = useMemo(() => {
    return candidatePool.filter((c) => c.isEligibleForGt).length;
  }, [candidatePool]);

  const mesaCandidatesCount = useMemo(() => {
    return candidatePool.filter((c) => c.isEligibleForMesa).length;
  }, [candidatePool]);

  // Filter candidates based on active requirement or active tab [GAP] vs [GT] vs [MESA]
  const filteredCandidates = useMemo(() => {
    const q = candidateSearchQuery.trim().toLowerCase();

    return candidatePool.filter((c) => {
      // Must be active
      if (!c.isPersonActive) return false;

      // Exclude anyone not available in this shift (strictly no "Sin turno registrado" or "No disponible" candidates)
      if (!c.isAvailableInShift) return false;

      // Exclude already assigned or shift overlap conflict
      if (c.isAlreadyAssigned || c.conflictingAssignment) return false;

      // Exclude continuity conflicts
      if (c.carnivalContinuityConflict) return false;

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
        if (isShiftMesa || baseAssignTab === 'MESA') {
          if (!c.isEligibleForMesa) return false;
        } else if (baseAssignTab === 'GAP') {
          if (!c.isEligibleForGap) return false;
        } else {
          if (!c.isEligibleForGt) return false;
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
  }, [candidatePool, baseAssignTab, activeRequirement, candidateSearchQuery, isShiftMesa]);

  const handleQuickAssignCandidate = async (candidatePerson: Person, fnName: string) => {
    setIsSubmitting(true);
    try {
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

      const defaultRole = assignedTypeToUse === 'GAP'
        ? 'Encargado de Base'
        : (isMesaPerson ? 'Coordinación' : 'Staff General');

      const result = await assignPerson({
        personId: candidatePerson.id,
        dayId: selectedDayId,
        shiftId: activeShift.id,
        assignedType: assignedTypeToUse,
        gtSubTeam: assignedTypeToUse === 'GT' ? (activeRequirement?.gtSubTeam || candidatePerson.gtSubTeam || 'Logística') : undefined,
        assignedFunction: fnName || defaultRole,
        baseId: baseIdToUse,
        baseNumber: baseNumToUse,
        baseName: baseNameToUse,
        roleInBase: fnName || defaultRole,
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
                GAP cuenta con exactamente <b>30 bases físicas únicas</b> compartidas en sus 3 turnos.
              </p>
            </div>

            {/* Sub-Category Switcher for Carnival: GAP and GT */}
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
                <span>GAP {isCarnival ? "(3 Turnos + 30 Bases)" : "(Bases Físicas)"}</span>
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
            const shiftAssignCount = assignments.filter(
              (a) => a.dayId === selectedDayId && a.shiftId === shift.id
            ).length;

            const isMesaPill =
              shift.category === 'MESA' ||
              shift.name.toUpperCase().includes('MESA') ||
              (shift.label && shift.label.toUpperCase().includes('MESA'));

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
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#EAE0CA] text-[#475569]'
                  }`}
                >
                  {shiftAssignCount}
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
              const assignedToThisReq = currentShiftAssignments.filter(
                (a) =>
                  a.requirementId === req.id ||
                  (a.assignedType === req.groupType &&
                    (!req.gtSubTeam || a.gtSubTeam === req.gtSubTeam))
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

      {/* CONDITIONAL: 30 PHYSICAL BASES FOR CARNIVAL GAP */}
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
                Base 1 a 27 + Toro, Speedway y Arcade. Cada base admite 2 encargados con continuidad garantizada.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#B83A24] font-mono bg-[#FDF2EE] border border-[#F6C7BA] px-2.5 py-1 rounded-lg font-bold">
                Capacidad: 2 personas por base
              </span>
            </div>
          </div>

          {/* Grid of 30 physical bases */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {physicalBases.map((base) => {
              const baseAssignments = currentShiftAssignments.filter(
                (a) =>
                  String(a.baseId) === String(base.id) ||
                  String(a.baseNumber) === String(base.id) ||
                  (base.baseNumber !== undefined && String(a.baseNumber) === String(base.baseNumber)) ||
                  (a.baseName && base.name && a.baseName.toLowerCase() === base.name.toLowerCase()) ||
                  (base.code && a.baseNumber === base.code)
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
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                            isSpecial
                              ? 'bg-[#FEF8EC] border border-[#E5A12E]/50 text-[#C87F17]'
                              : 'bg-[#FAF6EC] border border-[#EADDC7] text-[#182535]'
                          }`}
                        >
                          {isSpecial ? '★' : base.id}
                        </span>
                        <div>
                          <h4 className="font-bold text-[#182535] text-xs">{base.name}</h4>
                          {isSpecial && (
                            <span className="text-[9px] uppercase font-bold text-[#C87F17] font-mono">
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
                        {baseAssignments.length} / {base.defaultCapacity}
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

                          return (
                            <div
                              key={assign.id}
                              className="p-2 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] flex items-center justify-between text-xs"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-semibold text-[#182535] truncate flex items-center gap-1">
                                  <span>{person?.name || 'Persona'}</span>
                                </div>
                                <div className="text-[10px] text-[#64748B] font-mono truncate">
                                  {person?.documentId} • {assign.assignedFunction || assign.roleInBase || 'Base'}
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
                    </div>
                  </div>

                  {/* Add Person to Base Button */}
                  <div className="mt-3 pt-3 border-t border-[#EADDC7]">
                    <button
                      onClick={() => handleOpenAssignModal(undefined, base.id)}
                      disabled={isFull}
                      className={`min-h-[40px] w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        isFull
                          ? 'bg-[#FAF6EC] text-[#94A3B8] cursor-not-allowed border border-[#EADDC7]'
                          : 'bg-[#B83A24] hover:bg-[#9E2F1B] text-white shadow-2xs'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isFull ? 'Base Completa' : 'Asignar a Base'}</span>
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
            <p className="text-xs text-[#64748B] font-montserrat">
              {currentShiftAssignments.length} / {activeShift.capacity} integrante(s) asignados a este turno general
            </p>
          </div>
          <button
            onClick={() => handleOpenAssignModal()}
            className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#B83A24] hover:bg-[#9E2F1B] text-white shadow-2xs transition-all self-start sm:self-auto font-dalek tracking-wider cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Asignar Persona a Turno</span>
          </button>
        </div>

        {/* Category Filter Pills: GT / MESA / GAP */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 bg-[#FAF6EC] p-1.5 rounded-2xl border border-[#EADDC7] overflow-x-auto">
            <span className="text-[11px] font-bold text-[#64748B] px-2 font-montserrat hidden sm:inline">
              Filtrar personal:
            </span>
            {[
              { id: 'ALL', label: `Todos (${currentShiftAssignments.length})` },
              { id: 'GT', label: `GT (${assignedGtCount})` },
              { id: 'GAP', label: `GAP (${assignedGapCount})` },
              ...(assignedMesaCount > 0 || currentShiftRequirements.some((r) => r.groupType === 'MESA')
                ? [{ id: 'MESA', label: `MESA (${assignedMesaCount})` }]
                : []),
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setAssignedTypeFilter(pill.id as any)}
                className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer font-montserrat whitespace-nowrap ${
                  assignedTypeFilter === pill.id
                    ? pill.id === 'GAP'
                      ? 'bg-[#16A34A] text-white shadow-2xs'
                      : pill.id === 'MESA'
                      ? 'bg-purple-700 text-white shadow-2xs'
                      : pill.id === 'GT'
                      ? 'bg-[#182535] text-white shadow-2xs'
                      : 'bg-[#B83A24] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#182535] hover:bg-[#FFFDF8]'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {assignedTypeFilter !== 'ALL' && (
            <button
              onClick={() => setAssignedTypeFilter('ALL')}
              className="text-[11px] font-bold text-[#B83A24] hover:underline cursor-pointer"
            >
              Ver todos ({currentShiftAssignments.length})
            </button>
          )}
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
              No hay personas con categoría {assignedTypeFilter} asignadas en este turno
            </p>
            <button
              onClick={() => setAssignedTypeFilter('ALL')}
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
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                          isMesaAssign
                            ? 'bg-[#FEF8EC] text-[#C87F17] border-[#FDE68A]'
                            : assign.assignedType === 'GAP'
                            ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
                            : 'bg-[#FFFDF8] text-[#182535] border-[#EADDC7]'
                        }`}
                      >
                        {assign.gtSubTeam ? `GT: ${assign.gtSubTeam}` : assign.assignedType}
                      </span>
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
            <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-3 border-b border-[#EADDC7] shrink-0">
                <div>
                  <span className="text-[10px] font-bold text-[#B83A24] uppercase font-dalek tracking-wider">
                    {currentDay.eventName} • {activeShift.name} ({activeShift.label})
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-[#182535] font-dalek">
                    {activeRequirement
                      ? `ASIGNAR A: ${
                          activeRequirement.groupType === 'GT'
                            ? `GT ${activeRequirement.gtSubTeam}`
                            : activeRequirement.groupType
                        }`
                      : modalBase
                      ? `ASIGNAR A ${modalBase.name.toUpperCase()}`
                      : selectedBaseNumber !== null
                      ? `ASIGNAR A ${getBaseDisplayName(selectedBaseNumber).toUpperCase()}`
                      : `ASIGNAR A ${activeShift.name}`}
                  </h3>
                  {activeRequirement && (
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Cupo objetivo: <b>{activeRequirement.capacity} personas</b> •{' '}
                      {activeRequirement.specificFunctions &&
                      activeRequirement.specificFunctions.length > 0 ? (
                        <span>
                          Filtro de funciones activas:{' '}
                          <b>{activeRequirement.specificFunctions.join(' · ')}</b>
                        </span>
                      ) : (
                        <span>Sin filtro: cualquier integrante del grupo</span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="p-1 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Alert if continuity or error */}
              {modalAlert && (
                <div className="my-2.5 p-3 rounded-2xl bg-[#FEF8EC] border border-[#E5A12E]/40 text-[#C87F17] text-xs flex items-start gap-2 leading-relaxed shrink-0">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#C87F17]" />
                  <span>{modalAlert}</span>
                </div>
              )}

              {/* MANDATORY BASE SELECTION (for shifts requiring a base) */}
              {shiftRequiresBase && (
                <div className="mt-3 p-3.5 bg-[#FAF6EC] rounded-2xl border border-[#EADDC7] space-y-2 shrink-0">
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

              {/* [GAP] / [GT] / [MESA] TABS */}
              {!activeRequirement && (
                <div className="mt-3 flex items-center gap-2 p-1 bg-[#FAF6EC] rounded-2xl border border-[#EADDC7] shrink-0">
                  {isShiftMesa ? (
                    <div className="flex-1 py-2 px-3 rounded-xl text-xs font-bold font-montserrat flex items-center justify-center gap-2 bg-purple-700 text-white shadow-xs">
                      <Crown className="w-3.5 h-3.5" />
                      <span>[MESA] Integrantes de MESA ({mesaCandidatesCount})</span>
                    </div>
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
              <div className="pt-3 pb-2 shrink-0 border-b border-[#EADDC7]/60">
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

                <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1.5 px-1 font-montserrat">
                  <span>
                    Mostrando candidatos disponibles: <b>{filteredCandidates.length}</b>
                  </span>
                  <span>
                    Categoría activa: <b>{baseAssignTab}</b>
                  </span>
                </div>
              </div>

              {/* Candidate Pool List */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
                {filteredCandidates.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-[#FAF6EC] border border-dashed border-[#EADDC7] text-center space-y-2">
                    <Users className="w-8 h-8 text-[#94A3B8] mx-auto" />
                    <p className="font-bold text-[#182535] text-xs font-montserrat">
                      No hay candidatos disponibles en {baseAssignTab} para este turno
                    </p>
                    <p className="text-[11px] text-[#64748B] max-w-sm mx-auto">
                      Solo se muestran integrantes activos con turno registrado confirmado y sin conflictos de horario o continuidad.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCandidates.map(({ person, matchingFunctionsList }) => {
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
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  person.primaryType === 'GT'
                                    ? 'bg-[#FDF2EE] text-[#B83A24]'
                                    : 'bg-[#FEF8EC] text-[#C87F17]'
                                }`}
                              >
                                {person.gtSubTeam ? `GT: ${person.gtSubTeam}` : person.primaryType}
                              </span>
                              {person.primaryType === 'MESA' && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FEF8EC] text-[#C87F17] border border-[#E5A12E]/40">
                                  MESA
                                </span>
                              )}
                              {person.primaryType === 'GT' && person.alsoActsAsGap && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                                  + GAP Habilitado
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-[#64748B] font-mono mt-0.5">
                              C.C: {person.documentId || 'S/N'} • @{person.username || person.documentId}
                            </div>

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
                                handleQuickAssignCandidate(
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

              {/* Modal Footer */}
              <div className="pt-3 border-t border-[#EADDC7] flex items-center justify-between shrink-0">
                <span className="text-xs text-[#64748B]">
                  {currentShiftAssignments.length} persona(s) asignadas en este turno
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
    </div>
  );
};
