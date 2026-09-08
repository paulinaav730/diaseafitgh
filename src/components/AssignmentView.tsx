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
  const [selectedDayId, setSelectedDayId] = useState<string>('miercoles');
  // Sub-category selector for CARNIVAL: GAP, GT, MESA
  const [carnivalCategory, setCarnivalCategory] = useState<'GAP' | 'GT' | 'MESA'>('GAP');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('miercoles-gap-t1');
  const [selectedBaseNumber, setSelectedBaseNumber] = useState<number | string | null>(null);

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

  const currentDay = EVENT_SCHEDULE.find((d) => d.dayId === selectedDayId) || EVENT_SCHEDULE[0];
  const isCarnival = currentDay.isCarnival;
  const isDivided = currentDay.isDivided;

  // Active shifts available in this view (dynamically uses configurable shifts if present)
  const availableShifts = useMemo(() => {
    if (shifts && shifts.length > 0) {
      const activeInDay = shifts.filter((s) => s.dayId === selectedDayId && s.isActive);
      if (activeInDay.length > 0) {
        if (isDivided) {
          if (carnivalCategory === 'GAP') {
            const filtered = activeInDay.filter((s) => s.category === 'GAP');
            if (filtered.length > 0) return filtered;
          } else if (carnivalCategory === 'GT') {
            const filtered = activeInDay.filter((s) => s.category === 'GT');
            if (filtered.length > 0) return filtered;
          } else {
            const filtered = activeInDay.filter((s) => s.category === 'MESA');
            if (filtered.length > 0) return filtered;
          }
        }
        return activeInDay;
      }
    }

    if (isDivided) {
      const baseShifts = isCarnival ? [...CARNIVAL_GT_SHIFTS, ...CARNIVAL_GAP_SHIFTS] : currentDay.shifts;
      if (carnivalCategory === 'GAP') return baseShifts.filter(s => s.category === 'GAP' || s.hasBases);
      if (carnivalCategory === 'GT') return baseShifts.filter(s => s.category === 'GT' && !s.hasBases);
      return baseShifts.filter(s => s.category === 'MESA');
    }
    return currentDay.shifts;
  }, [shifts, selectedDayId, isCarnival, carnivalCategory, currentDay]);

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
    if (dayId === 'miercoles') {
      if (carnivalCategory === 'GAP') {
        setSelectedShiftId('miercoles-gap-t1');
      } else if (carnivalCategory === 'GT') {
        setSelectedShiftId('miercoles-gt-t1');
      } else {
        setSelectedShiftId('miercoles-gt-t1');
      }
    } else {
      const dayObj = EVENT_SCHEDULE.find((d) => d.dayId === dayId);
      if (dayObj && dayObj.shifts.length > 0) {
        setSelectedShiftId(dayObj.shifts[0].id);
      }
    }
  };

  const handleCarnivalCategorySelect = (cat: 'GAP' | 'GT' | 'MESA') => {
    setCarnivalCategory(cat);
    setSelectedBaseNumber(null);
    if (cat === 'GAP') {
      setSelectedShiftId('miercoles-gap-t1');
    } else if (cat === 'GT') {
      setSelectedShiftId('miercoles-gt-t1');
    } else {
      setSelectedShiftId('miercoles-gt-t1');
    }
  };

  // Determine physical bases for current day & category (dynamically uses configurable bases if present)
  const physicalBases: PhysicalBase[] = useMemo(() => {
    if (bases && bases.length > 0) {
      if (isDivided && carnivalCategory === 'GAP') {
        const eventIdFilter = selectedDayId === 'miercoles' ? 'carnival' : 'the-games';
        return bases
          .filter((b) => b.isActive && (b.eventId === eventIdFilter || (!b.eventId && selectedDayId === 'miercoles')))
          .map((b) => ({
            baseNumber: b.baseNumber,
            name: b.name,
            suggestedCapacity: b.suggestedCapacity,
            isSpecial: b.isSpecial,
          }));
      }
    }

    if (isDivided && carnivalCategory === 'GAP') {
      if (selectedDayId === 'miercoles') return CARNIVAL_PHYSICAL_BASES; // 30 bases
      if (selectedDayId === 'jueves') return THE_GAMES_JUEVES_BASES || []; // Need to import this
      if (selectedDayId === 'viernes') return THE_GAMES_VIERNES_BASES || []; // Need to import this
    }

    return [];
  }, [bases, isDivided, carnivalCategory, selectedDayId]);

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

  // Open Requirement Creation Modal
  const handleOpenCreateRequirement = () => {
    setReqGroupType(isDivided && carnivalCategory === 'GAP' ? 'GAP' : 'GT');
    setReqGtSubTeam('Logística');
    setReqCapacity(10);
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
    setSelectedBaseNumber(baseId !== undefined ? baseId : null);
    setModalPersonId('');
    setModalAlert(null);
    setIsContinuityLocked(false);
    setCandidateSearchQuery('');
    setShowOnlyAvailableInModal(true);

    if (req) {
      setModalAssignedType(req.groupType);
      setModalGtSubTeam(req.gtSubTeam);
      setModalAssignedFunction(
        req.specificFunctions && req.specificFunctions.length > 0
          ? req.specificFunctions[0]
          : ''
      );
      setModalRoleInBase(req.groupType === 'GT' ? `GT ${req.gtSubTeam || ''}` : req.groupType);
    } else if (isDivided) {
      if (carnivalCategory === 'GAP' || baseId !== undefined) {
        setModalAssignedType('GAP');
        setModalGtSubTeam(undefined);
        setModalAssignedFunction('Animación de base');
        setModalRoleInBase('Encargado de Base');
      } else if (carnivalCategory === 'MESA') {
        setModalAssignedType('MESA');
        setModalGtSubTeam(undefined);
        setModalAssignedFunction('Coordinación');
        setModalRoleInBase('Coordinación / Mesa');
      } else {
        setModalAssignedType('GT');
        setModalGtSubTeam('Logística');
        setModalAssignedFunction('Apoyo logístico');
        setModalRoleInBase('Staff General');
      }
    } else {
      if (baseId !== undefined || activeShift.hasBases) {
        setModalAssignedType('GAP');
        setModalGtSubTeam(undefined);
        setModalAssignedFunction('Animación de base');
        setModalRoleInBase('Encargado de Base');
      } else {
        setModalAssignedType('GT');
        setModalGtSubTeam('Logística');
        setModalAssignedFunction('Apoyo logístico');
        setModalRoleInBase('Staff General');
      }
    }

    setIsAssignModalOpen(true);
  };

  // Candidate pool calculation based on GT/Group + Availability + Conflict + Functions
  const candidatePool = useMemo(() => {
    return people.map((person) => {
      const isMesa = person.primaryType === 'MESA';

      // 1. Group / Subteam matching:
      // RULE: MESA can be assigned to ANY shift and ANY requirement ("la mesa puede ser asignada a todos los turnos sin importar qué")
      let matchesGroup = false;
      if (activeRequirement) {
        if (activeRequirement.groupType === 'GT') {
          const isGt = person.primaryType === 'GT';
          const matchesSub =
            !activeRequirement.gtSubTeam ||
            person.gtSubTeam === activeRequirement.gtSubTeam ||
            (person.gtTeams && person.gtTeams.includes(activeRequirement.gtSubTeam));
          matchesGroup = isGt && matchesSub;
        } else if (activeRequirement.groupType === 'GAP') {
          matchesGroup = person.primaryType === 'GAP' || person.primaryType === 'GT';
        } else if (activeRequirement.groupType === 'MESA') {
          matchesGroup = person.primaryType === 'MESA';
        }
      } else {
        matchesGroup = true;
      }

      // 2. Already assigned to this exact shift
      const isAlreadyAssigned = assignments.some(
        (a) =>
          a.personId === person.id &&
          a.dayId === selectedDayId &&
          a.shiftId === activeShift.id
      );

      // 3. Overlapping shift conflict on the same day:
      // MESA has cross-shift leadership and is not blocked by overlapping hours
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
            const otherShift = findShiftById(currentDay, a.shiftId);
            return otherShift ? doShiftsOverlap(otherShift, activeShift) : false;
          });

      // 4. Availability for this shift:
      // For MESA: ALWAYS available across all days and shifts ("sin importar qué")
      // For GT and GAP: STRICT: A person is ONLY available if they explicitly registered availability for this day and shift
      const availRecord = availabilities.find(
        (av) => av.personId === person.id && av.dayId === selectedDayId
      );
      let isAvailableInShift = Boolean(
        availRecord &&
        Array.isArray(availRecord.shiftIds) &&
        availRecord.shiftIds.includes(activeShift.id)
      );

      // 5. Functions check (Rule 5 & 9)
      let matchesFunctions = true;
      let matchingFunctionsList: string[] = [];
      if (isMesa) {
        matchesFunctions = true;
        matchingFunctionsList =
          person.functions && person.functions.length > 0
            ? person.functions
            : ['Coordinación / Mesa'];
      } else if (
        activeRequirement &&
        activeRequirement.specificFunctions &&
        activeRequirement.specificFunctions.length > 0
      ) {
        matchingFunctionsList = (person.functions || []).filter((f) =>
          activeRequirement.specificFunctions!.includes(f)
        );
        matchesFunctions = matchingFunctionsList.length > 0;
      } else {
        matchingFunctionsList = person.functions || [];
      }

      const matchesPrerequisites =
        matchesGroup && !isAlreadyAssigned && !conflictingAssignment && matchesFunctions;

      const isEligible = matchesPrerequisites && isAvailableInShift;

      return {
        person,
        matchesGroup,
        isAlreadyAssigned,
        conflictingAssignment,
        isAvailableInShift,
        hasAvailRecord: isMesa || Boolean(availRecord && availRecord.shiftIds && availRecord.shiftIds.length > 0),
        matchesFunctions,
        matchingFunctionsList,
        matchesPrerequisites,
        isEligible,
      };
    });
  }, [
    people,
    assignments,
    availabilities,
    selectedDayId,
    activeShift,
    activeRequirement,
    currentDay,
  ]);

  const availableCandidatesCount = useMemo(() => {
    return candidatePool.filter((c) => c.isEligible).length;
  }, [candidatePool]);

  const filteredCandidates = useMemo(() => {
    const q = candidateSearchQuery.trim().toLowerCase();
    return candidatePool.filter((c) => {
      // Must match group, not already assigned, no overlapping conflict, and match functions
      if (!c.matchesPrerequisites) return false;

      // If toggle is active (default = true), only show people with confirmed shift availability
      if (showOnlyAvailableInModal && !c.isAvailableInShift) return false;

      // Search query filter
      if (q) {
        const matchName = c.person.name.toLowerCase().includes(q);
        const matchDoc = (c.person.documentId || '').toLowerCase().includes(q);
        const matchUser = (c.person.username || '').toLowerCase().includes(q);
        if (!matchName && !matchDoc && !matchUser) return false;
      }

      return true;
    });
  }, [candidatePool, candidateSearchQuery, showOnlyAvailableInModal]);

  const handleQuickAssignCandidate = async (candidatePerson: Person, fnName: string) => {
    setIsSubmitting(true);
    try {
      const result = await assignPerson({
        personId: candidatePerson.id,
        dayId: selectedDayId,
        shiftId: activeShift.id,
        assignedType: activeRequirement ? activeRequirement.groupType : candidatePerson.primaryType,
        gtSubTeam: activeRequirement?.gtSubTeam || candidatePerson.gtSubTeam,
        assignedFunction: fnName || undefined,
        baseNumber: selectedBaseNumber !== null ? selectedBaseNumber : undefined,
        roleInBase: fnName || 'Staff General',
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

            {/* Sub-Category Switcher for Carnival */}
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

              <button
                onClick={() => handleCarnivalCategorySelect('MESA')}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  carnivalCategory === 'MESA'
                    ? 'bg-[#C87F17] text-white shadow-xs font-montserrat'
                    : 'text-[#64748B] hover:text-[#182535] font-montserrat'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>MESA (Flexible)</span>
              </button>
            </div>
          </div>

          {/* Visual Blueprint Diagram */}
          {isCarnival && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1 text-xs font-montserrat">
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
                  CARNIVAL — GT
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
                  CARNIVAL — GAP
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

            <div
              className={`p-4 rounded-2xl border transition-all ${
                carnivalCategory === 'MESA'
                  ? 'bg-[#FEF8EC] border-[#C87F17] shadow-2xs'
                  : 'bg-[#FFFDF8] border-[#EADDC7] text-[#64748B]'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-[#C87F17] mb-2">
                <span className="flex items-center gap-1.5 text-[#C87F17]">
                  <Layers className="w-4 h-4" />
                  CARNIVAL — MESA
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C87F17] text-white font-mono">
                  CUALQUIER TURNO
                </span>
              </div>
              <p className="text-[11px] text-[#475569] leading-relaxed">
                MESA puede ser asignada a <b>cualquiera de los turnos</b> de Carnival (GT T1..T5 o GAP T1..T3), siempre que exista cupo y disponibilidad.
              </p>
              <div className="mt-2.5 p-2 rounded-xl bg-[#FEF8EC] border border-[#E5A12E]/40 text-[10px] text-[#C87F17] font-semibold flex items-center gap-1.5">
                <Lock className="w-3 h-3 shrink-0" />
                <span>Continuidad obligatoria si opera en bases GAP.</span>
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

          <span className="text-xs text-[#64748B] font-mono">
            {availableShifts.length} turno(s) configurado(s)
          </span>
        </div>

        {/* Turnos pills */}
        <div className="flex flex-wrap items-center gap-2">
          {availableShifts.map((shift) => {
            const isSelected = shift.id === activeShift.id;
            const shiftAssignCount = assignments.filter(
              (a) => a.dayId === selectedDayId && a.shiftId === shift.id
            ).length;

            return (
              <button
                key={shift.id}
                onClick={() => {
                  setSelectedShiftId(shift.id);
                  setSelectedBaseNumber(null);
                }}
                className={`min-h-[40px] flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  isSelected
                    ? 'bg-[#B83A24] text-white border-[#B83A24] shadow-xs font-montserrat'
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
      {isDivided && carnivalCategory === 'GAP' && activeShift.hasBases && physicalBases.length > 0 && (
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
                  String(a.baseNumber) === String(base.id) ||
                  a.baseName === base.name ||
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
            className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#B83A24] hover:bg-[#9E2F1B] text-white shadow-2xs transition-all self-start sm:self-auto font-dalek tracking-wider"
          >
            <Plus className="w-4 h-4" />
            <span>Asignar Persona a Turno</span>
          </button>
        </div>

        {currentShiftAssignments.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#64748B]">
            <Users className="w-10 h-10 text-[#C87F17] mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-[#182535] text-sm">0 Personas asignadas a este turno</p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Seleccione una necesidad de cupo arriba o pulse &quot;Asignar Persona a Turno&quot;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentShiftAssignments.map((assign) => {
              const person = people.find((p) => p.id === assign.personId);
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
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[#FFFDF8] text-[#182535] border border-[#EADDC7]">
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
                    className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-[#64748B] hover:text-[#B83A24] hover:bg-[#FDF2EE] transition-colors flex items-center justify-center shrink-0"
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

      {/* MODAL 2: ASIGNAR PERSONAS AL TURNO / CUPO (CON FILTRO DE FUNCIONES) */}
      {isAssignModalOpen && (
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
              <div className="my-3 p-3 rounded-2xl bg-[#FEF8EC] border border-[#E5A12E]/40 text-[#C87F17] text-xs flex items-start gap-2 leading-relaxed shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#C87F17]" />
                <span>{modalAlert}</span>
              </div>
            )}

            {/* Search & Availability Toggle Controls */}
            <div className="space-y-2 pt-2 pb-2 shrink-0 border-b border-[#EADDC7]/60">
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

              <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    checked={showOnlyAvailableInModal}
                    onChange={(e) => setShowOnlyAvailableInModal(e.target.checked)}
                    className="w-4 h-4 accent-[#B83A24] rounded cursor-pointer"
                  />
                  <span className="font-semibold text-[#182535]">
                    Solo personas con disponibilidad confirmada en este turno ({availableCandidatesCount})
                  </span>
                </label>

                <span className="text-[11px] text-[#64748B]">
                  Mostrando: <b>{filteredCandidates.length}</b> candidatos
                </span>
              </div>
            </div>

            {/* Candidate Pool List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
              {filteredCandidates.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#FAF6EC] border border-dashed border-[#EADDC7] text-center space-y-2">
                  <Users className="w-8 h-8 text-[#94A3B8] mx-auto" />
                  <p className="font-bold text-[#182535] text-xs">
                    {showOnlyAvailableInModal
                      ? 'No hay personas con disponibilidad confirmada para este turno'
                      : 'No se encontraron candidatos que coincidan con los filtros'}
                  </p>
                  <p className="text-[11px] text-[#64748B] max-w-sm mx-auto">
                    {showOnlyAvailableInModal
                      ? 'Puede desmarcar la casilla "Solo personas con disponibilidad confirmada" arriba si desea asignar a un integrante sin horario registrado.'
                      : 'Verifique si las personas del grupo tienen las funciones requeridas o amplíe la búsqueda.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCandidates.map(({ person, matchingFunctionsList, isAvailableInShift }) => {
                    const isSelected = modalPersonId === person.id;
                    const selectedFunctionToUse =
                      isSelected && modalAssignedFunction
                        ? modalAssignedFunction
                        : matchingFunctionsList[0] || '';

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
                          <div className="flex items-center gap-2">
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
                                Flexible (Todos los turnos)
                              </span>
                            )}
                            {person.primaryType === 'GT' && person.alsoActsAsGap && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FEF8EC] text-[#C87F17] border border-[#EADDC7]">
                                + GAP Generales
                              </span>
                            )}
                            {!isAvailableInShift && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Sin turno registrado
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-[#64748B] font-mono mt-0.5">
                            ID: {person.documentId} • @{person.username || person.documentId}
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
                              <span className="text-[10px] text-[#94A3B8]">Sin funciones</span>
                            )}
                          </div>
                        </div>

                        {/* Function selection and Assign action */}
                        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                          {/* Selector for which function to register in assignment */}
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
                                  Asignar: {fn}
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
                            disabled={isSubmitting}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white text-xs font-bold font-montserrat flex items-center gap-1 shadow-2xs transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Asignar Cupo</span>
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
                className="min-h-[40px] px-5 py-2 rounded-xl bg-[#FAF6EC] hover:bg-[#F3EEDC] text-[#182535] border border-[#EADDC7] text-xs font-bold font-montserrat"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
