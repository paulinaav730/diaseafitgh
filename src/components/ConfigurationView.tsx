import { BulkDeleteDialog } from './BulkDeleteDialog';
import React, { useState, useMemo } from 'react';
import {
  AppEvent,
  ConfigurableBase,
  ConfigurableShift,
  GroupFunction,
  GtSubTeam,
  Person,
  Assignment,
  PERSON_TYPE_LABELS,
  PersonType,
} from '../types';
import {
  saveShift,
  duplicateShift,
  deleteShift,
  checkShiftDeleteImpact,
  checkShiftTimeChangeConflicts,
  saveEvent,
  deleteEvent,
  saveBase,
  deleteBase,
  checkBaseDeleteImpact,
  checkShiftsBatchImpact,
  checkBasesBatchImpact,
  deleteShiftsBatch,
  deleteBasesBatch,
  restoreDefaultSchedule,
  ShiftConflictReport,
} from '../services/storageService';
import {
  formatTimeRangeLabel,
  calculateDurationHours,
  getBaseDisplayName,
} from '../data/eventStructure';
import { GT_SUBTEAMS, getFilteredFunctions } from '../data/functionsCatalog';
import {
  Clock,
  Calendar,
  Layers,
  Plus,
  Edit2,
  Copy,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Search,
  Users,
  Shield,
  Tag,
  Info,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface ConfigurationViewProps {
  shifts: ConfigurableShift[];
  events: AppEvent[];
  bases: ConfigurableBase[];
  functions: GroupFunction[];
  people: Person[];
  assignments: Assignment[];
  currentUserRole?: string;
  onNavigateToFunctions?: () => void;
}

type ConfigSubTab = 'shifts' | 'events' | 'bases' | 'groups';

export const ConfigurationView: React.FC<ConfigurationViewProps> = ({
  shifts,
  events,
  bases,
  functions,
  people,
  assignments,
  currentUserRole = 'admin',
  onNavigateToFunctions,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ConfigSubTab>('shifts');
  const [bulkDelete, setBulkDelete] = useState<'shifts' | 'bases' | null>(null);

  // Filters for Shifts
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [subTeamFilter, setSubTeamFilter] = useState<string>('all');
  const [baseEventFilter, setBaseEventFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [editingShift, setEditingShift] = useState<Partial<ConfigurableShift> | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  const [editingEvent, setEditingEvent] = useState<Partial<AppEvent> | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  const [editingBase, setEditingBase] = useState<Partial<ConfigurableBase> | null>(null);
  const [isBaseModalOpen, setIsBaseModalOpen] = useState(false);

  // Deletion confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'shift' | 'event' | 'base' | 'restore';
    id?: string | number;
    title: string;
    warning?: string;
    impactCount?: number;
    peopleNames?: string[];
  } | null>(null);

  // Time change conflicts prompt
  const [conflictPrompt, setConflictPrompt] = useState<{
    pendingShiftData: any;
    conflicts: ShiftConflictReport[];
  } | null>(null);

  // Filtered Shifts
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (dayFilter !== 'all' && s.dayId !== dayFilter) return false;
      if (eventFilter !== 'all' && s.eventId !== eventFilter) return false;
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (subTeamFilter !== 'all') {
        const matchesSubTeam =
          s.gtSubTeam === subTeamFilter ||
          (s.gtSubTeams && s.gtSubTeams.includes(subTeamFilter));
        if (!matchesSubTeam) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchNotes = (s.notes || '').toLowerCase().includes(q);
        const matchLabel = (s.label || '').toLowerCase().includes(q);
        if (!matchName && !matchNotes && !matchLabel) return false;
      }
      return true;
    });
  }, [shifts, dayFilter, eventFilter, categoryFilter, subTeamFilter, searchQuery]);

  // Unique days in events
  const dayOptions = useMemo(() => {
    const list: { dayId: string; dayName: string }[] = [];
    events.forEach((ev) => {
      if (!list.some((d) => d.dayId === ev.dayId)) {
        list.push({ dayId: ev.dayId, dayName: ev.dayName });
      }
    });
    return list;
  }, [events]);

  // Open Shift Create Modal
  const handleOpenCreateShift = () => {
    const defaultEvent = events[0];
    setEditingShift({
      name: 'T1',
      dayId: defaultEvent?.dayId || 'lunes',
      eventId: defaultEvent?.id || 'the-show',
      category: 'GT',
      gtSubTeam: 'Logística',
      gtSubTeams: ['Logística'],
      startTime: '06:00',
      endTime: '08:00',
      capacity: 10,
      isActive: true,
      hasBases: false,
      specificFunctions: [],
      notes: '',
    });
    setIsShiftModalOpen(true);
  };

  // Open Shift Edit Modal
  const handleOpenEditShift = (shift: ConfigurableShift) => {
    const initialSubTeams =
      shift.gtSubTeams && shift.gtSubTeams.length > 0
        ? [...shift.gtSubTeams]
        : shift.gtSubTeam
        ? [shift.gtSubTeam]
        : ['Logística'];

    setEditingShift({
      ...shift,
      gtSubTeams: initialSubTeams,
      gtSubTeam: initialSubTeams[0] || 'Logística',
      specificFunctions: shift.specificFunctions ? [...shift.specificFunctions] : [],
    });
    setIsShiftModalOpen(true);
  };

  // Duplicate Shift Handler
  const handleDuplicateShift = async (shiftId: string) => {
    await duplicateShift(shiftId);
  };

  // Save Shift with Conflict Detection
  const handleSaveShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift || !editingShift.name || !editingShift.dayId || !editingShift.eventId || !editingShift.category) {
      return;
    }

    const selectedSubTeams =
      editingShift.category === 'GT'
        ? editingShift.gtSubTeams && editingShift.gtSubTeams.length > 0
          ? editingShift.gtSubTeams
          : editingShift.gtSubTeam
          ? [editingShift.gtSubTeam]
          : ['Logística']
        : undefined;

    const cleanStartTime = (editingShift.startTime || '06:00').trim();
    const cleanEndTime = (editingShift.endTime || '08:00').trim();

    const payload = {
      ...editingShift,
      name: editingShift.name.trim(),
      dayId: editingShift.dayId,
      eventId: editingShift.eventId,
      category: editingShift.category,
      gtSubTeams: selectedSubTeams,
      gtSubTeam: selectedSubTeams && selectedSubTeams.length > 0 ? selectedSubTeams[0] : undefined,
      startTime: cleanStartTime,
      endTime: cleanEndTime,
      label: formatTimeRangeLabel(cleanStartTime, cleanEndTime),
      capacity: Number(editingShift.capacity) || 1,
      isActive: editingShift.isActive !== undefined ? editingShift.isActive : true,
      hasBases: editingShift.category === 'GAP' || editingShift.hasBases === true,
      specificFunctions: editingShift.specificFunctions || [],
      notes: editingShift.notes || '',
    };

    // If editing existing shift, check if hours changed and cause conflicts
    if (editingShift.id) {
      const conflicts = checkShiftTimeChangeConflicts(
        editingShift.id,
        payload.startTime,
        payload.endTime
      );

      if (conflicts.length > 0 && !conflictPrompt) {
        setConflictPrompt({
          pendingShiftData: payload,
          conflicts,
        });
        return;
      }
    }

    await saveShift(payload as any);
    setIsShiftModalOpen(false);
    setEditingShift(null);
    setConflictPrompt(null);
  };

  // Confirm shift save despite conflicts
  const handleConfirmShiftWithConflicts = async () => {
    if (!conflictPrompt) return;
    await saveShift(conflictPrompt.pendingShiftData);
    setConflictPrompt(null);
    setIsShiftModalOpen(false);
    setEditingShift(null);
  };

  // Request Shift Delete
  const handleRequestDeleteShift = (shift: ConfigurableShift) => {
    const impact = checkShiftDeleteImpact(shift.id);
    setDeleteConfirm({
      type: 'shift',
      id: shift.id,
      title: `Eliminar turno "${shift.name}" (${shift.label})`,
      warning:
        impact.count > 0
          ? `Este turno tiene ${impact.count} persona(s) asignada(s) actualmente (${impact.peopleNames.slice(0, 3).join(', ')}${impact.peopleNames.length > 3 ? '...' : ''}). Al eliminar este turno, sus asignaciones relacionadas también serán canceladas.`
          : '¿Estás seguro de que deseas eliminar este turno? Esta acción no se puede deshacer.',
      impactCount: impact.count,
      peopleNames: impact.peopleNames,
    });
  };

  // Execute confirmed delete
  const handleExecuteDelete = async () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'shift' && deleteConfirm.id) {
      await deleteShift(String(deleteConfirm.id), true);
    } else if (deleteConfirm.type === 'event' && deleteConfirm.id) {
      await deleteEvent(String(deleteConfirm.id), true);
    } else if (deleteConfirm.type === 'base' && deleteConfirm.id !== undefined) {
      await deleteBase(deleteConfirm.id, true);
    } else if (deleteConfirm.type === 'restore') {
      await restoreDefaultSchedule();
    }

    setDeleteConfirm(null);
  };

  // Available functions inside Shift Modal (filtered strictly by current category and all selected gtSubTeams)
  const shiftModalAvailableFunctions = useMemo(() => {
    if (!editingShift || !editingShift.category) return [];
    const subTeams =
      editingShift.category === 'GT'
        ? editingShift.gtSubTeams && editingShift.gtSubTeams.length > 0
          ? editingShift.gtSubTeams
          : editingShift.gtSubTeam
          ? [editingShift.gtSubTeam]
          : ['Logística']
        : undefined;

    return getFilteredFunctions(
      functions,
      editingShift.category,
      subTeams,
      true
    );
  }, [editingShift, functions]);

  // Toggle function in shift modal
  const handleToggleSpecificFunction = (fnName: string) => {
    if (!editingShift) return;
    const current = editingShift.specificFunctions || [];
    if (current.includes(fnName)) {
      setEditingShift({
        ...editingShift,
        specificFunctions: current.filter((f) => f !== fnName),
      });
    } else {
      setEditingShift({
        ...editingShift,
        specificFunctions: [...current, fnName],
      });
    }
  };

  // Toggle shift active status
  const handleToggleShiftActive = async (shift: ConfigurableShift) => {
    await saveShift({
      ...shift,
      isActive: !shift.isActive,
    });
  };

  // Bases Filter
  const filteredBases = useMemo(() => {
    return bases.filter((b) => {
      if (baseEventFilter !== 'all' && b.eventId !== baseEventFilter) return false;
      return true;
    });
  }, [bases, baseEventFilter]);

  const shiftFiltersActive =
    dayFilter !== 'all' || eventFilter !== 'all' || categoryFilter !== 'all' || subTeamFilter !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-surface border border-tinta-200 rounded-2xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-mostaza-50 text-mostaza-600 border border-mostaza-300/40 font-sans">
                <Shield className="w-3.5 h-3.5 text-lila-600" />
                ADMINISTRACIÓN TOTAL
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-tinta-100 text-tinta-600">
                Sincronización en Tiempo Real
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-tinta-900 font-display tracking-wide">
              CONFIGURACIÓN DE TURNOS Y PROGRAMACIÓN
            </h1>
            <p className="text-sm text-tinta-500 mt-1 max-w-3xl font-sans">
              Control total de la programación para el Administrador: crea, edita, duplica o elimina turnos, horarios, cupos, eventos y bases físicas sin tocar código.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() =>
                setDeleteConfirm({
                  type: 'restore',
                  title: 'Restablecer Programación Oficial Inicial',
                  warning:
                    '¿Deseas restaurar los turnos, eventos y bases predeterminados de DÍAS EAFIT 2027? Esto reiniciará la configuración a los 5 turnos de Carnival GT, 3 turnos Carnival GAP (22 bases), The Show (5 turnos), The Zone (4 turnos), The Challenge y The Games.',
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-tinta-500 hover:text-tinta-900 bg-white hover:bg-tinta-50 border border-tinta-200 shadow-2xs transition-all cursor-pointer"
              title="Restablece la programación predeterminada"
            >
              <RotateCcw className="w-3.5 h-3.5 text-lila-600" />
              Restablecer Oficial
            </button>

            {activeSubTab === 'shifts' && filteredShifts.length > 0 && (
              <button
                onClick={() => setBulkDelete('shifts')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-lila-600 bg-lila-50 hover:bg-lila-100 border border-lila-200 shadow-2xs transition-all cursor-pointer"
                title={shiftFiltersActive ? 'Eliminar los turnos que coinciden con los filtros' : 'Eliminar todos los turnos'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {shiftFiltersActive ? `Eliminar Filtrados (${filteredShifts.length})` : `Eliminar Todos (${filteredShifts.length})`}
              </button>
            )}

            {activeSubTab === 'bases' && filteredBases.length > 0 && (
              <button
                onClick={() => setBulkDelete('bases')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-lila-600 bg-lila-50 hover:bg-lila-100 border border-lila-200 shadow-2xs transition-all cursor-pointer"
                title={baseEventFilter !== 'all' ? 'Eliminar las bases del evento filtrado' : 'Eliminar todas las bases'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {baseEventFilter !== 'all' ? `Eliminar Filtradas (${filteredBases.length})` : `Eliminar Todas (${filteredBases.length})`}
              </button>
            )}

            {activeSubTab === 'shifts' && (
              <button
                onClick={handleOpenCreateShift}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-lila-600 hover:bg-lila-800 shadow-xs hover:shadow-md transition-all cursor-pointer font-sans"
              >
                <Plus className="w-4 h-4" />
                AGREGAR TURNO
              </button>
            )}

            {activeSubTab === 'events' && (
              <button
                onClick={() => {
                  setEditingEvent({
                    name: '',
                    dayId: 'lunes',
                    dayName: 'Lunes',
                    description: '',
                    isActive: true,
                    isCarnival: false,
                  });
                  setIsEventModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-lila-600 hover:bg-lila-800 shadow-xs transition-all cursor-pointer font-sans"
              >
                <Plus className="w-4 h-4" />
                AGREGAR EVENTO
              </button>
            )}

            {activeSubTab === 'bases' && (
              <button
                onClick={() => {
                  setEditingBase({
                    name: `Base ${bases.length + 1}`,
                    defaultCapacity: 2,
                    isSpecial: false,
                    isActive: true,
                    eventId: 'carnival',
                  });
                  setIsBaseModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-lila-600 hover:bg-lila-800 shadow-xs transition-all cursor-pointer font-sans"
              >
                <Plus className="w-4 h-4" />
                AGREGAR BASE
              </button>
            )}
          </div>
        </div>

        {/* Terminology Banner */}
        <div className="mt-4 p-3 rounded-xl bg-mostaza-50 border border-mostaza-300/30 text-xs text-mostaza-700 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-mostaza-600 shrink-0" />
            <span>
              <strong>Terminología Oficial:</strong> <strong>GT</strong> = GRUPO DE TRABAJO • <strong>GAP</strong> = GRUPO DE APOYO • <strong>MESA</strong> = MESA
            </span>
          </div>
          <span className="text-[11px] text-mostaza-700">
            Una persona GT asignada temporalmente a GAP mantiene intacto su tipo principal.
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-5 border-b border-tinta-200 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('shifts')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'shifts'
                ? 'bg-lila-600 text-white shadow-xs'
                : 'text-tinta-500 hover:text-tinta-900 hover:bg-tinta-50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Turnos ({shifts.length})
          </button>

          <button
            onClick={() => setActiveSubTab('events')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'events'
                ? 'bg-lila-600 text-white shadow-xs'
                : 'text-tinta-500 hover:text-tinta-900 hover:bg-tinta-50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Eventos ({events.length})
          </button>

          <button
            onClick={() => setActiveSubTab('bases')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'bases'
                ? 'bg-lila-600 text-white shadow-xs'
                : 'text-tinta-500 hover:text-tinta-900 hover:bg-tinta-50'
            }`}
          >
            <Layers className="w-4 h-4" />
            Bases Físicas ({bases.length})
          </button>

          <button
            onClick={() => setActiveSubTab('groups')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'groups'
                ? 'bg-lila-600 text-white shadow-xs'
                : 'text-tinta-500 hover:text-tinta-900 hover:bg-tinta-50'
            }`}
          >
            <Users className="w-4 h-4" />
            Grupos de Trabajo ({GT_SUBTEAMS.length})
          </button>

          {onNavigateToFunctions && (
            <button
              onClick={onNavigateToFunctions}
              className="ml-auto px-3.5 py-1.5 rounded-xl text-xs font-bold text-lila-600 bg-lila-50 hover:bg-lila-50 border border-lila-200 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Tag className="w-3.5 h-3.5" />
              Ver Catálogo de Funciones
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SUB-TAB: TURNOS                                            */}
      {/* ========================================================= */}
      {activeSubTab === 'shifts' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white border border-tinta-200 p-4 rounded-xl shadow-2xs">
              <span className="text-xs font-semibold text-tinta-500 block">Total Turnos</span>
              <span className="text-2xl font-black text-tinta-900 font-display">{shifts.length}</span>
              <span className="text-[11px] text-turquesa-600 block mt-0.5">
                {shifts.filter((s) => s.isActive).length} activos
              </span>
            </div>

            <div className="bg-white border border-tinta-200 p-4 rounded-xl shadow-2xs">
              <span className="text-xs font-semibold text-tinta-500 block">Cupos Totales Programados</span>
              <span className="text-2xl font-black text-lila-600 font-display">
                {shifts.reduce((acc, s) => acc + (s.isActive ? s.capacity : 0), 0)}
              </span>
              <span className="text-[11px] text-tinta-500 block mt-0.5">en turnos activos</span>
            </div>

            <div className="bg-white border border-tinta-200 p-4 rounded-xl shadow-2xs">
              <span className="text-xs font-semibold text-tinta-500 block">GRUPO DE TRABAJO (GT)</span>
              <span className="text-2xl font-black text-turquesa-700 font-display">
                {shifts.filter((s) => s.category === 'GT').length}
              </span>
              <span className="text-[11px] text-turquesa-700 block mt-0.5">turnos específicos</span>
            </div>

            <div className="bg-white border border-tinta-200 p-4 rounded-xl shadow-2xs">
              <span className="text-xs font-semibold text-tinta-500 block">GRUPO DE APOYO (GAP)</span>
              <span className="text-2xl font-black text-mostaza-500 font-display">
                {shifts.filter((s) => s.category === 'GAP').length}
              </span>
              <span className="text-[11px] text-mostaza-500 block mt-0.5">turnos en bases</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white border border-tinta-200 rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Day Filter */}
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="text-xs font-medium border border-tinta-300 rounded-lg px-2.5 py-1.5 bg-white text-tinta-900 focus:outline-none focus:ring-1 focus:ring-lila-600"
              >
                <option value="all">Todos los Días</option>
                {dayOptions.map((d) => (
                  <option key={d.dayId} value={d.dayId}>
                    {d.dayName}
                  </option>
                ))}
              </select>

              {/* Event Filter */}
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="text-xs font-medium border border-tinta-300 rounded-lg px-2.5 py-1.5 bg-white text-tinta-900 focus:outline-none focus:ring-1 focus:ring-lila-600"
              >
                <option value="all">Todos los Eventos</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.dayName})
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs font-medium border border-tinta-300 rounded-lg px-2.5 py-1.5 bg-white text-tinta-900 focus:outline-none focus:ring-1 focus:ring-lila-600"
              >
                <option value="all">Todas las Categorías</option>
                <option value="GT">GRUPO DE TRABAJO (GT)</option>
                <option value="GAP">GRUPO DE APOYO (GAP)</option>
                <option value="MESA">MESA</option>
              </select>

              {/* SubTeam Filter */}
              <select
                value={subTeamFilter}
                onChange={(e) => setSubTeamFilter(e.target.value)}
                className="text-xs font-medium border border-tinta-300 rounded-lg px-2.5 py-1.5 bg-white text-tinta-900 focus:outline-none focus:ring-1 focus:ring-lila-600"
              >
                <option value="all">Todos los Sub-Equipos GT</option>
                {GT_SUBTEAMS.map((st) => (
                  <option key={st} value={st}>
                    GT: {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-tinta-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar turno..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-tinta-300 focus:outline-none focus:ring-1 focus:ring-lila-600"
              />
            </div>
          </div>

          {/* Shifts Cards / Table */}
          <div className="bg-white border border-tinta-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-tinta-50 border-b border-tinta-200 text-tinta-600 font-bold font-sans">
                    <th className="py-3 px-4">Turno</th>
                    <th className="py-3 px-4">Día / Evento</th>
                    <th className="py-3 px-4">Categoría / Grupo</th>
                    <th className="py-3 px-4">Horario</th>
                    <th className="py-3 px-4">Cupos</th>
                    <th className="py-3 px-4">Funciones Específicas</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tinta-200">
                  {filteredShifts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-tinta-400">
                        No se encontraron turnos con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredShifts.map((shift) => {
                      const eventObj = events.find((e) => e.id === shift.eventId);
                      const isMesaShift = shift.category === 'MESA' || shift.name.toUpperCase().includes('MESA');
                      const shiftAssigns = assignments.filter((a) => a.shiftId === shift.id);
                      const gtCount = shiftAssigns.filter((a) => a.assignedType === 'GT').length;
                      const mesaCount = shiftAssigns.filter((a) => a.assignedType === 'MESA').length;
                      const gapCount = shiftAssigns.filter((a) => a.assignedType === 'GAP').length;
                      const cupoCount = isMesaShift
                        ? mesaCount
                        : shift.category === 'GAP'
                        ? gapCount
                        : gtCount;
                      const durationHours = calculateDurationHours(shift.startTime, shift.endTime);

                      return (
                        <tr key={shift.id} className="hover:bg-surface transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-extrabold text-tinta-900 text-sm font-display tracking-wide">
                              {shift.name}
                            </div>
                            {shift.notes && (
                              <span className="text-[11px] text-tinta-500 block truncate max-w-xs" title={shift.notes}>
                                {shift.notes}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-tinta-900 capitalize block">
                              {shift.dayId}
                            </span>
                            <span className="text-[11px] text-tinta-500 block">
                              {eventObj ? eventObj.name : shift.eventId}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  shift.category === 'GT'
                                    ? 'bg-turquesa-50 text-turquesa-700 border border-turquesa-200'
                                    : shift.category === 'GAP'
                                    ? 'bg-mostaza-100 text-mostaza-700 border border-mostaza-200'
                                    : 'bg-lila-50 text-lila-700 border border-lila-100'
                                }`}
                              >
                                {shift.category === 'GT'
                                  ? 'GRUPO DE TRABAJO (GT)'
                                  : shift.category === 'GAP'
                                  ? 'GRUPO DE APOYO (GAP)'
                                  : 'MESA'}
                              </span>

                              {shift.category === 'GT' && (
                                shift.gtSubTeams && shift.gtSubTeams.length > 1 ? (
                                  <span
                                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-lila-50 text-lila-600 border border-lila-100"
                                    title={shift.gtSubTeams.join(', ')}
                                  >
                                    {shift.gtSubTeams.length === GT_SUBTEAMS.length
                                      ? 'Todos los GT'
                                      : `${shift.gtSubTeams.length} sub-equipos`}
                                  </span>
                                ) : shift.gtSubTeam ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-tinta-100 text-tinta-700 border border-tinta-200">
                                    {shift.gtSubTeam}
                                  </span>
                                ) : null
                              )}

                              {shift.hasBases && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-turquesa-50 text-turquesa-600 border border-turquesa-200">
                                  Opera en Bases
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-tinta-900 block">{shift.label}</span>
                            <span className="text-[11px] text-tinta-500">
                              {shift.startTime} – {shift.endTime} ({durationHours}h)
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-tinta-900 text-sm font-display">
                                {shift.capacity}
                              </span>
                              <span className="text-[11px] text-tinta-500">cupos</span>
                            </div>
                            <span
                              className={`text-[11px] font-semibold ${
                                cupoCount >= shift.capacity ? 'text-turquesa-600' : 'text-mostaza-500'
                              }`}
                            >
                              {cupoCount} {isMesaShift ? 'MESA' : 'GT'} {cupoCount >= shift.capacity ? 'completos' : 'asignados'}
                            </span>
                            {!isMesaShift && mesaCount > 0 && (
                              <span className="text-[10px] text-purple-700 font-medium block">
                                +{mesaCount} MESA (sin cupo)
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {shift.specificFunctions && shift.specificFunctions.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {shift.specificFunctions.map((fnName) => (
                                  <span
                                    key={fnName}
                                    className="px-1.5 py-0.5 rounded bg-tinta-50 border border-tinta-300 text-[10px] font-medium text-tinta-700"
                                  >
                                    {fnName}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-tinta-400 italic">Todas las del grupo</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleShiftActive(shift)}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                                shift.isActive
                                  ? 'bg-turquesa-50 text-turquesa-600 border-turquesa-200 hover:bg-turquesa-100'
                                  : 'bg-tinta-50 text-tinta-400 border-tinta-200 hover:bg-tinta-100'
                              }`}
                              title="Click para cambiar estado"
                            >
                              {shift.isActive ? 'Activo' : 'Inactivo'}
                            </button>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Button */}
                              <button
                                onClick={() => handleOpenEditShift(shift)}
                                className="p-1.5 rounded-lg text-turquesa-700 hover:bg-turquesa-50 transition-colors cursor-pointer"
                                title="Editar turno"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Duplicate Button */}
                              <button
                                onClick={() => handleDuplicateShift(shift.id)}
                                className="p-1.5 rounded-lg text-mostaza-500 hover:bg-mostaza-100 transition-colors cursor-pointer"
                                title="Duplicar turno"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleRequestDeleteShift(shift)}
                                className="p-1.5 rounded-lg text-coral-600 hover:bg-coral-100 transition-colors cursor-pointer"
                                title="Eliminar turno"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB: EVENTOS                                           */}
      {/* ========================================================= */}
      {activeSubTab === 'events' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => {
              const eventShifts = shifts.filter((s) => s.eventId === ev.id);
              const totalCapacity = eventShifts.reduce((a, s) => a + (s.isActive ? s.capacity : 0), 0);

              return (
                <div
                  key={ev.id}
                  className="bg-white border border-tinta-200 rounded-xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-mostaza-50 text-mostaza-600 border border-mostaza-300/40 font-sans">
                        {ev.dayName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ev.isActive ? 'bg-turquesa-50 text-turquesa-600' : 'bg-tinta-100 text-tinta-400'
                        }`}
                      >
                        {ev.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-tinta-900 font-display tracking-wide">
                      {ev.name}
                    </h3>
                    <p className="text-xs text-tinta-500 mt-1 line-clamp-2">
                      {ev.description || 'Sin descripción'}
                    </p>

                    <div className="mt-3 pt-3 border-t border-tinta-100 flex items-center justify-between text-xs text-tinta-600">
                      <span>
                        <strong>{eventShifts.length}</strong> turnos
                      </span>
                      <span>
                        <strong>{totalCapacity}</strong> cupos totales
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-tinta-200 flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingEvent({ ...ev });
                        setIsEventModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-turquesa-700 bg-turquesa-50 hover:bg-turquesa-200 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>

                    <button
                      onClick={() => {
                        const shiftCount = eventShifts.length;
                        setDeleteConfirm({
                          type: 'event',
                          id: ev.id,
                          title: `Eliminar evento "${ev.name}"`,
                          warning:
                            shiftCount > 0
                              ? `Este evento tiene ${shiftCount} turno(s) vinculado(s). Al eliminar el evento, se eliminarán también todos sus turnos y asignaciones.`
                              : '¿Seguro que deseas eliminar este evento?',
                          impactCount: shiftCount,
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-coral-600 bg-coral-100 hover:bg-coral-200 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB: BASES FÍSICAS                                     */}
      {/* ========================================================= */}
      {activeSubTab === 'bases' && (
        <div className="space-y-4">
          <div className="bg-white border border-tinta-200 rounded-xl p-4 shadow-2xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-tinta-600">Filtrar por Evento:</span>
              <select
                value={baseEventFilter}
                onChange={(e) => setBaseEventFilter(e.target.value)}
                className="text-xs font-medium border border-tinta-300 rounded-lg px-2.5 py-1.5 bg-white text-tinta-900 focus:outline-none"
              >
                <option value="all">Todas las Bases ({bases.length})</option>
                <option value="carnival">Carnival ({bases.filter(b => b.eventId === 'carnival').length || 22} bases)</option>
                <option value="the-games">The Games ({bases.filter(b => b.eventId === 'the-games').length || 30} bases)</option>
              </select>
            </div>

            <span className="text-xs text-tinta-500">
              Para el <strong>GRUPO DE APOYO (GAP)</strong>, el Admin puede modificar cupos, nombres y estados de cada base.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredBases.map((b) => {
              const hasCleanName = b.name && !b.name.toLowerCase().startsWith('base base_') && !b.name.toLowerCase().startsWith('base_');
              const displayName = hasCleanName ? b.name : (getBaseDisplayName(b.name) || getBaseDisplayName(b.id) || b.name || `Base ${b.id}`);
              const assignmentsOnBase = assignments.filter((a) => String(a.baseNumber) === String(b.id));

              return (
                <div
                  key={String(b.id)}
                  className={`bg-white border rounded-xl p-3.5 shadow-2xs transition-all flex flex-col justify-between ${
                    b.isSpecial
                      ? 'border-mostaza-300 bg-mostaza-50/30'
                      : 'border-tinta-200 hover:border-tinta-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-tinta-100 text-tinta-500">
                        {b.eventId || 'Base'}
                      </span>
                      {b.isSpecial && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-mostaza-100 text-mostaza-700">
                          Especial
                        </span>
                      )}
                    </div>

                    <h4 className="font-extrabold text-tinta-900 text-sm truncate font-display tracking-wide">
                      {displayName}
                    </h4>

                    <div className="mt-2 text-[11px] text-tinta-500">
                      Capacidad: <strong>{b.defaultCapacity}</strong> pers.
                    </div>
                    <div className="text-[11px] font-medium text-turquesa-600">
                      {assignmentsOnBase.length} asignados
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-tinta-100 flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditingBase({ ...b, name: displayName });
                        setIsBaseModalOpen(true);
                      }}
                      className="p-1 text-turquesa-700 hover:bg-turquesa-50 rounded transition-colors"
                      title="Editar base"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        const impact = checkBaseDeleteImpact(b.id);
                        setDeleteConfirm({
                          type: 'base',
                          id: b.id,
                          title: `Eliminar ${displayName}`,
                          warning:
                            impact.count > 0
                              ? `Esta base tiene ${impact.count} asignación(es) activa(s).`
                              : '¿Confirmas la eliminación de esta base física?',
                          impactCount: impact.count,
                        });
                      }}
                      className="p-1 text-coral-600 hover:bg-coral-100 rounded transition-colors"
                      title="Eliminar base"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUB-TAB: GRUPOS DE TRABAJO (GT)                            */}
      {/* ========================================================= */}
      {activeSubTab === 'groups' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {GT_SUBTEAMS.map((subTeam) => {
              const membersCount = people.filter(
                (p) =>
                  p.primaryType === 'GT' &&
                  (p.gtSubTeam === subTeam || (p.gtTeams && p.gtTeams.includes(subTeam)))
              ).length;

              const relatedFunctions = functions.filter(
                (f) => f.category === 'GT' && f.gtSubTeam === subTeam && f.isActive
              );

              const subTeamShifts = shifts.filter(
                (s) =>
                  s.category === 'GT' &&
                  (s.gtSubTeam === subTeam || (s.gtSubTeams && s.gtSubTeams.includes(subTeam)))
              );

              return (
                <div
                  key={subTeam}
                  className="bg-white border border-tinta-200 rounded-xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-turquesa-50 text-turquesa-700 font-sans">
                        GRUPO DE TRABAJO
                      </span>
                      <span className="text-xs font-bold text-tinta-900">
                        {membersCount} integrantes
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-tinta-900 font-display tracking-wide">
                      {subTeam}
                    </h3>

                    <div className="mt-3 space-y-1.5">
                      <span className="text-xs font-semibold text-tinta-600 block">
                        Funciones Creadas ({relatedFunctions.length}):
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {relatedFunctions.length === 0 ? (
                          <span className="text-[11px] text-tinta-400 italic">Sin funciones</span>
                        ) : (
                          relatedFunctions.map((f) => (
                            <span
                              key={f.id}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-tinta-50 border border-tinta-200 text-tinta-700"
                            >
                              {f.name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-tinta-100 text-xs text-tinta-500 flex items-center justify-between">
                    <span>Turnos configurados:</span>
                    <strong className="text-tinta-900">{subTeamShifts.length}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREAR / EDITAR TURNO                                */}
      {/* ========================================================= */}
      {isShiftModalOpen && editingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-tinta-200 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-tinta-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-lila-50 text-lila-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-tinta-900 font-display tracking-wide">
                    {editingShift.id ? 'EDITAR TURNO' : 'CREAR NUEVO TURNO'}
                  </h3>
                  <p className="text-xs text-tinta-500 font-sans">
                    Configure el horario, cupos, categoría y funciones asociadas
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsShiftModalOpen(false);
                  setEditingShift(null);
                }}
                className="p-1 rounded-lg text-tinta-400 hover:text-tinta-900 hover:bg-tinta-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShiftSubmit} className="space-y-4 mt-4">
              {/* Day and Event Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-tinta-600 mb-1 font-sans">
                    DÍA *
                  </label>
                  <select
                    value={editingShift.dayId}
                    onChange={(e) => {
                      const newDay = e.target.value;
                      const matchedEvent = events.find((ev) => ev.dayId === newDay);
                      setEditingShift({
                        ...editingShift,
                        dayId: newDay,
                        eventId: matchedEvent ? matchedEvent.id : editingShift.eventId,
                      });
                    }}
                    className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2 bg-white text-tinta-900 focus:ring-1 focus:ring-lila-600"
                    required
                  >
                    {dayOptions.map((d) => (
                      <option key={d.dayId} value={d.dayId}>
                        {d.dayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-tinta-600 mb-1 font-sans">
                    EVENTO *
                  </label>
                  <select
                    value={editingShift.eventId}
                    onChange={(e) => {
                      const selEvent = events.find((ev) => ev.id === e.target.value);
                      setEditingShift({
                        ...editingShift,
                        eventId: e.target.value,
                        dayId: selEvent ? selEvent.dayId : editingShift.dayId,
                      });
                    }}
                    className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2 bg-white text-tinta-900 focus:ring-1 focus:ring-lila-600"
                    required
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name} ({ev.dayName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category and SubTeam Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-tinta-600 mb-1 font-sans">
                    CATEGORÍA *
                  </label>
                  <select
                    value={editingShift.category}
                    onChange={(e) => {
                      const cat = e.target.value as PersonType;
                      const defaultTeams =
                        cat === 'GT'
                          ? editingShift.gtSubTeams && editingShift.gtSubTeams.length > 0
                            ? editingShift.gtSubTeams
                            : ['Logística']
                          : undefined;

                      setEditingShift({
                        ...editingShift,
                        category: cat,
                        gtSubTeams: defaultTeams,
                        gtSubTeam: defaultTeams ? defaultTeams[0] : undefined,
                        hasBases: cat === 'GAP',
                        specificFunctions: [], // reset when category changes
                      });
                    }}
                    className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2 bg-white text-tinta-900 focus:ring-1 focus:ring-lila-600"
                    required
                  >
                    <option value="GT">GRUPO DE TRABAJO (GT)</option>
                    <option value="GAP">GRUPO DE APOYO (GAP)</option>
                    <option value="MESA">MESA</option>
                  </select>
                </div>

                {editingShift.category === 'GAP' ? (
                  <div>
                    <label className="block text-xs font-bold text-tinta-600 mb-1 font-sans">
                      ¿OPERA EN BASES FÍSICAS?
                    </label>
                    <select
                      value={editingShift.hasBases ? 'yes' : 'no'}
                      onChange={(e) =>
                        setEditingShift({
                          ...editingShift,
                          hasBases: e.target.value === 'yes',
                        })
                      }
                      className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2 bg-white text-tinta-900 focus:ring-1 focus:ring-lila-600"
                    >
                      <option value="yes">Sí (Asociado a bases físicas)</option>
                      <option value="no">No (Turno general)</option>
                    </select>
                  </div>
                ) : (
                  <div className="hidden sm:block" />
                )}

                {/* Sub-equipos GT con selección múltiple interactiva */}
                {editingShift.category === 'GT' && (
                  <div className="sm:col-span-2 p-3.5 rounded-2xl bg-tinta-50 border border-tinta-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-bold text-tinta-900 font-sans">
                          GRUPOS DE TRABAJO (SUB-EQUIPOS) *
                        </label>
                        <span className="text-[11px] text-tinta-500">
                          Seleccione uno o varios sub-equipos de GT para este turno
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const currentTeams =
                            editingShift.gtSubTeams && editingShift.gtSubTeams.length > 0
                              ? editingShift.gtSubTeams
                              : editingShift.gtSubTeam
                              ? [editingShift.gtSubTeam]
                              : ['Logística'];
                          const allSelected = currentTeams.length === GT_SUBTEAMS.length;
                          const newTeams = allSelected ? ['Logística'] : [...GT_SUBTEAMS];
                          setEditingShift({
                            ...editingShift,
                            gtSubTeams: newTeams,
                            gtSubTeam: newTeams[0],
                          });
                        }}
                        className="text-[11px] font-bold text-lila-600 hover:underline cursor-pointer transition-colors"
                      >
                        {(editingShift.gtSubTeams || []).length === GT_SUBTEAMS.length
                          ? 'Solo Logística'
                          : 'Seleccionar todos (8)'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {GT_SUBTEAMS.map((st) => {
                        const currentTeams =
                          editingShift.gtSubTeams && editingShift.gtSubTeams.length > 0
                            ? editingShift.gtSubTeams
                            : editingShift.gtSubTeam
                            ? [editingShift.gtSubTeam]
                            : ['Logística'];
                        const isSelected = currentTeams.includes(st);

                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              let updated: string[];
                              if (isSelected) {
                                if (currentTeams.length === 1) return; // Mínimo 1 seleccionado
                                updated = currentTeams.filter((s) => s !== st);
                              } else {
                                updated = [...currentTeams, st];
                              }
                              setEditingShift({
                                ...editingShift,
                                gtSubTeams: updated,
                                gtSubTeam: updated[0],
                              });
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-sans flex items-center justify-between border transition-all text-left cursor-pointer ${
                              isSelected
                                ? 'bg-white border-lila-600 text-lila-600 font-bold shadow-2xs ring-1 ring-lila-600/20'
                                : 'bg-tinta-50/70 border-tinta-300 text-tinta-600 hover:bg-white'
                            }`}
                          >
                            <span>{st}</span>
                            <div
                              className={`w-4 h-4 rounded-md flex items-center justify-center border text-[10px] transition-colors ${
                                isSelected
                                  ? 'bg-lila-600 border-lila-600 text-white'
                                  : 'border-tinta-300 bg-white text-transparent'
                              }`}
                            >
                              ✓
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-tinta-200/70 flex items-center justify-between text-[11px] text-tinta-500">
                      <span>
                        Seleccionados:{' '}
                        <strong className="text-tinta-900">
                          {(editingShift.gtSubTeams && editingShift.gtSubTeams.length > 0
                            ? editingShift.gtSubTeams
                            : [editingShift.gtSubTeam || 'Logística']
                          ).length === GT_SUBTEAMS.length
                            ? 'Todos los 8 sub-equipos'
                            : (editingShift.gtSubTeams && editingShift.gtSubTeams.length > 0
                                ? editingShift.gtSubTeams
                                : [editingShift.gtSubTeam || 'Logística']
                              ).join(', ')}
                        </strong>
                      </span>
                      <span className="font-semibold text-lila-600">
                        {(editingShift.gtSubTeams && editingShift.gtSubTeams.length > 0
                          ? editingShift.gtSubTeams
                          : [editingShift.gtSubTeam || 'Logística']
                        ).length}{' '}
                        de {GT_SUBTEAMS.length} grupos
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Name and Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-tinta-600 mb-1 font-sans">
                    NOMBRE DEL TURNO *
                  </label>
                  <input
                    type="text"
                    value={editingShift.name || ''}
                    onChange={(e) => setEditingShift({ ...editingShift, name: e.target.value })}
                    placeholder="Ej. T1, T2, GT General"
                    className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2 focus:ring-1 focus:ring-lila-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-tinta-600 mb-1 font-sans">
                    CUPOS (PERSONAS REQUERIDAS) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={editingShift.capacity || 10}
                    onChange={(e) =>
                      setEditingShift({ ...editingShift, capacity: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2 focus:ring-1 focus:ring-lila-600"
                    required
                  />
                </div>
              </div>

              {/* Hours (Start and End) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-tinta-50 border border-tinta-200">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-tinta-600 font-sans">
                      HORA DE INICIO (24H) *
                    </label>
                    <div className="flex items-center gap-1">
                      {['07:00', '08:30', '12:30', '16:00'].map((timePreset) => (
                        <button
                          key={timePreset}
                          type="button"
                          onClick={() => setEditingShift({ ...editingShift, startTime: timePreset })}
                          className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono transition-colors cursor-pointer ${
                            editingShift.startTime === timePreset
                              ? 'bg-lila-600 text-white font-bold'
                              : 'bg-white text-tinta-500 hover:bg-tinta-200 border border-tinta-300'
                          }`}
                          title={`Fijar a las ${timePreset}`}
                        >
                          {timePreset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="time"
                    value={editingShift.startTime || '06:00'}
                    onChange={(e) => setEditingShift({ ...editingShift, startTime: e.target.value })}
                    className="w-full text-xs font-semibold border border-tinta-300 rounded-xl px-3 py-2 bg-white focus:ring-1 focus:ring-lila-600"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-tinta-600 font-sans">
                      HORA DE FINALIZACIÓN (24H) *
                    </label>
                    <div className="flex items-center gap-1">
                      {['12:30', '16:00', '19:30', '22:30'].map((timePreset) => (
                        <button
                          key={timePreset}
                          type="button"
                          onClick={() => setEditingShift({ ...editingShift, endTime: timePreset })}
                          className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono transition-colors cursor-pointer ${
                            editingShift.endTime === timePreset
                              ? 'bg-lila-600 text-white font-bold'
                              : 'bg-white text-tinta-500 hover:bg-tinta-200 border border-tinta-300'
                          }`}
                          title={`Fijar a las ${timePreset}`}
                        >
                          {timePreset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="time"
                    value={editingShift.endTime || '08:00'}
                    onChange={(e) => setEditingShift({ ...editingShift, endTime: e.target.value })}
                    className="w-full text-xs font-semibold border border-tinta-300 rounded-xl px-3 py-2 bg-white focus:ring-1 focus:ring-lila-600"
                    required
                  />
                </div>

                <div className="sm:col-span-2 text-xs text-tinta-500 flex items-center justify-between pt-1">
                  <span>
                    Etiqueta visible: <strong>{formatTimeRangeLabel(editingShift.startTime || '06:00', editingShift.endTime || '08:00')}</strong>
                  </span>
                  <span>
                    Duración: <strong>{calculateDurationHours(editingShift.startTime || '06:00', editingShift.endTime || '08:00')} horas</strong>
                  </span>
                </div>
              </div>

              {/* Specific Functions (Dynamic Filter by Selected Group) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-tinta-600 font-sans">
                    FUNCIONES ESPECÍFICAS (OPCIONAL)
                  </label>
                  <span className="text-[11px] text-tinta-500">
                    Filtrado para:{' '}
                    <strong>
                      {editingShift.category === 'GT'
                        ? `GT → ${
                            (editingShift.gtSubTeams && editingShift.gtSubTeams.length > 0
                              ? editingShift.gtSubTeams
                              : [editingShift.gtSubTeam || 'Logística']
                            ).length === GT_SUBTEAMS.length
                              ? 'Todos los sub-equipos'
                              : (editingShift.gtSubTeams && editingShift.gtSubTeams.length > 0
                                  ? editingShift.gtSubTeams
                                  : [editingShift.gtSubTeam || 'Logística']
                                ).join(', ')
                          }`
                        : editingShift.category === 'GAP'
                        ? 'GRUPO DE APOYO'
                        : 'MESA'}
                    </strong>
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-tinta-200 bg-tinta-50 max-h-36 overflow-y-auto space-y-1.5">
                  {shiftModalAvailableFunctions.length === 0 ? (
                    <span className="text-xs text-tinta-400 italic">
                      No hay funciones creadas para este grupo. Puedes crearlas en la pestaña "Funciones".
                    </span>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {shiftModalAvailableFunctions.map((fn) => {
                        const isChecked = (editingShift.specificFunctions || []).includes(fn.name);
                        return (
                          <label
                            key={fn.id}
                            className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer border transition-colors ${
                              isChecked
                                ? 'bg-lila-50 border-lila-200 text-lila-600 font-bold'
                                : 'bg-white border-tinta-200 text-tinta-700 hover:bg-tinta-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSpecificFunction(fn.name)}
                              className="w-3.5 h-3.5 text-lila-600 rounded border-gray-300 focus:ring-lila-600"
                            />
                            <span className="truncate">{fn.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Status and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-tinta-600 mb-1 font-sans">
                    ESTADO
                  </label>
                  <select
                    value={editingShift.isActive ? 'active' : 'inactive'}
                    onChange={(e) =>
                      setEditingShift({
                        ...editingShift,
                        isActive: e.target.value === 'active',
                      })
                    }
                    className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2 bg-white"
                  >
                    <option value="active">Activo (Habilitado para asignaciones)</option>
                    <option value="inactive">Inactivo (Oculto)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-tinta-600 mb-1 font-sans">
                    NOTAS O INSTRUCCIONES
                  </label>
                  <input
                    type="text"
                    value={editingShift.notes || ''}
                    onChange={(e) => setEditingShift({ ...editingShift, notes: e.target.value })}
                    placeholder="Ej. Llevar chaleco y radio..."
                    className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-tinta-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsShiftModalOpen(false);
                    setEditingShift(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-tinta-500 hover:bg-tinta-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-lila-600 hover:bg-lila-800 shadow-xs cursor-pointer font-sans"
                >
                  {editingShift.id ? 'Guardar Cambios' : 'Crear Turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CONFLICTOS DE HORARIO DETECTADOS                    */}
      {/* ========================================================= */}
      {conflictPrompt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-mostaza-300">
            <div className="flex items-center gap-3 text-mostaza-700 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base font-display tracking-wide text-tinta-900">
                ¡POSIBLES CONFLICTOS DE HORARIO DETECTADOS!
              </h3>
            </div>

            <p className="text-xs text-tinta-600 mb-3 font-sans">
              Al modificar el horario de este turno a{' '}
              <strong>
                {conflictPrompt.pendingShiftData.startTime} – {conflictPrompt.pendingShiftData.endTime}
              </strong>
              , las siguientes personas asignadas entrarán en solapamiento con otros de sus turnos programados para ese mismo día:
            </p>

            <div className="p-3 rounded-xl bg-mostaza-100/40 border border-mostaza-200 max-h-48 overflow-y-auto space-y-2 mb-4">
              {conflictPrompt.conflicts.map((c, idx) => (
                <div key={idx} className="text-xs">
                  <span className="font-bold text-tinta-900">{c.personName}:</span>{' '}
                  <span className="text-mostaza-700">
                    se solapa con turno "{c.conflictingShiftName}" ({c.conflictingHours})
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-tinta-500 mb-4">
              ¿Deseas guardar el nuevo horario de todos modos y revisar las asignaciones manualmente?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConflictPrompt(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-tinta-500 hover:bg-tinta-100"
              >
                Cancelar y Ajustar Horario
              </button>
              <button
                onClick={handleConfirmShiftWithConflicts}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-mostaza-700 hover:bg-mostaza-800"
              >
                Guardar de Todas Formas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREAR / EDITAR EVENTO                               */}
      {/* ========================================================= */}
      {isEventModalOpen && editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-tinta-200">
            <div className="flex items-center justify-between pb-3 border-b border-tinta-200">
              <h3 className="text-lg font-black text-tinta-900 font-display tracking-wide">
                {editingEvent.id ? 'EDITAR EVENTO' : 'CREAR NUEVO EVENTO'}
              </h3>
              <button
                onClick={() => {
                  setIsEventModalOpen(false);
                  setEditingEvent(null);
                }}
                className="p-1 text-tinta-400 hover:text-tinta-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingEvent.name || !editingEvent.dayId) return;
                await saveEvent(editingEvent as any);
                setIsEventModalOpen(false);
                setEditingEvent(null);
              }}
              className="space-y-3.5 mt-4"
            >
              <div>
                <label className="block text-xs font-bold text-tinta-600 mb-1">
                  NOMBRE DEL EVENTO *
                </label>
                <input
                  type="text"
                  value={editingEvent.name || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                  placeholder="Ej. THE SHOW, THE FESTIVAL"
                  className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-tinta-600 mb-1">
                    ID DEL DÍA *
                  </label>
                  <input
                    type="text"
                    value={editingEvent.dayId || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, dayId: e.target.value })}
                    placeholder="lunes, martes..."
                    className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-tinta-600 mb-1">
                    NOMBRE VISIBLE DEL DÍA *
                  </label>
                  <input
                    type="text"
                    value={editingEvent.dayName || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, dayName: e.target.value })}
                    placeholder="Lunes, Martes..."
                    className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-tinta-600 mb-1">
                  DESCRIPCIÓN
                </label>
                <textarea
                  rows={2}
                  value={editingEvent.description || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  placeholder="Detalles sobre el evento y actividades..."
                  className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-tinta-600">
                  <input
                    type="checkbox"
                    checked={editingEvent.isCarnival || false}
                    onChange={(e) => setEditingEvent({ ...editingEvent, isCarnival: e.target.checked })}
                    className="w-4 h-4 text-lila-600 rounded"
                  />
                  Es Día Carnival (22 bases físicas)
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-tinta-600">
                  <input
                    type="checkbox"
                    checked={editingEvent.isActive !== false}
                    onChange={(e) => setEditingEvent({ ...editingEvent, isActive: e.target.checked })}
                    className="w-4 h-4 text-lila-600 rounded"
                  />
                  Activo
                </label>
              </div>

              <div className="pt-3 border-t border-tinta-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-tinta-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-lila-600 hover:bg-lila-800"
                >
                  Guardar Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREAR / EDITAR BASE FÍSICA                          */}
      {/* ========================================================= */}
      {isBaseModalOpen && editingBase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-tinta-200">
            <div className="flex items-center justify-between pb-3 border-b border-tinta-200">
              <h3 className="text-lg font-black text-tinta-900 font-display tracking-wide">
                {editingBase.id !== undefined ? 'EDITAR BASE FÍSICA' : 'CREAR NUEVA BASE'}
              </h3>
              <button
                onClick={() => {
                  setIsBaseModalOpen(false);
                  setEditingBase(null);
                }}
                className="p-1 text-tinta-400 hover:text-tinta-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingBase.name) return;
                await saveBase(editingBase as any);
                setIsBaseModalOpen(false);
                setEditingBase(null);
              }}
              className="space-y-3.5 mt-4"
            >
              <div>
                <label className="block text-xs font-bold text-tinta-600 mb-1">
                  NOMBRE DE LA BASE *
                </label>
                <input
                  type="text"
                  value={editingBase.name || ''}
                  onChange={(e) => setEditingBase({ ...editingBase, name: e.target.value })}
                  placeholder="Ej. Base 1, Base Toro, Base Speedway..."
                  className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-tinta-600 mb-1">
                    CAPACIDAD POR TURNO *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={editingBase.defaultCapacity || 2}
                    onChange={(e) =>
                      setEditingBase({ ...editingBase, defaultCapacity: parseInt(e.target.value, 10) || 2 })
                    }
                    className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-tinta-600 mb-1">
                    EVENTO ASOCIADO
                  </label>
                  <select
                    value={editingBase.eventId || 'carnival'}
                    onChange={(e) => setEditingBase({ ...editingBase, eventId: e.target.value })}
                    className="w-full text-xs font-medium border border-tinta-300 rounded-xl px-3 py-2"
                  >
                    <option value="carnival">Carnival</option>
                    <option value="the-games">The Games</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-tinta-600">
                  <input
                    type="checkbox"
                    checked={editingBase.isSpecial || false}
                    onChange={(e) => setEditingBase({ ...editingBase, isSpecial: e.target.checked })}
                    className="w-4 h-4 text-lila-600 rounded"
                  />
                  Base Especial (ej. Toro, Speedway, Arcade)
                </label>
              </div>

              <div className="pt-3 border-t border-tinta-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBaseModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-tinta-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-lila-600 hover:bg-lila-800"
                >
                  Guardar Base
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN                       */}
      {/* ========================================================= */}
      {bulkDelete && (() => {
        const isShifts = bulkDelete === 'shifts';
        const ids = isShifts ? filteredShifts.map((x) => x.id) : filteredBases.map((x) => x.id);
        const impact = isShifts ? checkShiftsBatchImpact(ids as string[]) : checkBasesBatchImpact(ids);
        const filtered = isShifts ? shiftFiltersActive : baseEventFilter !== 'all';
        return (
          <BulkDeleteDialog
            title={isShifts ? `Eliminar ${ids.length} turno${ids.length === 1 ? '' : 's'}` : `Eliminar ${ids.length} base${ids.length === 1 ? '' : 's'}`}
            impact={
              isShifts ? (
                <>
                  <p>
                    Se eliminarán <b>{filtered ? `los ${ids.length} turnos filtrados` : `todos los turnos (${ids.length})`}</b>.
                  </p>
                  <p>
                    También se eliminan sus <b>{impact.assignments} asignaciones</b> ({impact.people} persona{impact.people === 1 ? "" : "s"}), su asistencia de turno y sus cupos. Las personas y su disponibilidad no se borran.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Se eliminarán <b>{filtered ? `las ${ids.length} bases filtradas` : `todas las bases (${ids.length})`}</b>.
                  </p>
                  <p>
                    {impact.assignments > 0 ? (
                      <>
                        <b>{impact.assignments} asignaciones</b> ({impact.people} persona{impact.people === 1 ? "" : "s"}) quedarán <b>sin base</b>, pero conservan su turno.
                      </>
                    ) : (
                      'Ninguna asignación usa estas bases.'
                    )}
                  </p>
                </>
              )
            }
            onConfirm={async () => {
              if (isShifts) {
                const r = await deleteShiftsBatch(ids as string[]);
                if (r.error) throw new Error(`Se borraron en este dispositivo, pero Supabase respondió: ${r.error}`);
                return `Listo: se eliminaron ${r.shifts} turnos y ${r.assignments} asignaciones.`;
              }
              const r = await deleteBasesBatch(ids);
              if (r.error) throw new Error(`Se borraron en este dispositivo, pero Supabase respondió: ${r.error}`);
              return `Listo: se eliminaron ${r.bases} bases. ${r.assignments} asignaciones quedaron sin base.`;
            }}
            onClose={() => setBulkDelete(null)}
          />
        );
      })()}

      {deleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-coral-600">
            <div className="flex items-center gap-3 text-coral-600 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base font-display tracking-wide text-tinta-900">
                {deleteConfirm.title}
              </h3>
            </div>

            <p className="text-xs text-tinta-600 mb-3 font-sans">
              {deleteConfirm.warning}
            </p>

            {deleteConfirm.peopleNames && deleteConfirm.peopleNames.length > 0 && (
              <div className="p-3 rounded-xl bg-coral-100/60 border border-coral-200 max-h-32 overflow-y-auto mb-4">
                <span className="text-[11px] font-bold text-coral-700 block mb-1">
                  Personas afectadas ({deleteConfirm.impactCount}):
                </span>
                <span className="text-xs text-coral-700">
                  {deleteConfirm.peopleNames.join(', ')}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-tinta-200">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-tinta-500 hover:bg-tinta-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteDelete}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-coral-600 hover:bg-coral-600 shadow-xs"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
