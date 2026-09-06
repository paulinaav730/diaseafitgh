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

  // Filters for Shifts
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [subTeamFilter, setSubTeamFilter] = useState<string>('all');
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
      if (subTeamFilter !== 'all' && s.gtSubTeam !== subTeamFilter) return false;
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
    setEditingShift({
      ...shift,
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

    const payload = {
      ...editingShift,
      name: editingShift.name.trim(),
      dayId: editingShift.dayId,
      eventId: editingShift.eventId,
      category: editingShift.category,
      gtSubTeam: editingShift.category === 'GT' ? editingShift.gtSubTeam : undefined,
      startTime: editingShift.startTime || '06:00',
      endTime: editingShift.endTime || '08:00',
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

  // Available functions inside Shift Modal (filtered strictly by current category and gtSubTeam)
  const shiftModalAvailableFunctions = useMemo(() => {
    if (!editingShift || !editingShift.category) return [];
    return getFilteredFunctions(
      functions,
      editingShift.category,
      editingShift.category === 'GT' ? editingShift.gtSubTeam : undefined,
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
  const [baseEventFilter, setBaseEventFilter] = useState<string>('all');
  const filteredBases = useMemo(() => {
    return bases.filter((b) => {
      if (baseEventFilter !== 'all' && b.eventId !== baseEventFilter) return false;
      return true;
    });
  }, [bases, baseEventFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-2xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF8EC] text-[#C87F17] border border-[#E5A12E]/40 font-montserrat">
                <Shield className="w-3.5 h-3.5 text-[#B83A24]" />
                ADMINISTRACIÓN TOTAL
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-[#F1F5F9] text-[#475569]">
                Sincronización en Tiempo Real
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#182535] font-dalek tracking-wide">
              CONFIGURACIÓN DE TURNOS Y PROGRAMACIÓN
            </h1>
            <p className="text-sm text-[#64748B] mt-1 max-w-3xl font-montserrat">
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
                    '¿Deseas restaurar los turnos, eventos y bases predeterminados de DÍAS EAFIT 2026? Esto reiniciará la configuración a los 5 turnos de Carnival GT, 3 turnos Carnival GAP (30 bases), The Show (5 turnos), The Zone (4 turnos), The Challenge y The Games.',
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#182535] bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] shadow-2xs transition-all cursor-pointer"
              title="Restablece la programación predeterminada"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#B83A24]" />
              Restablecer Oficial
            </button>

            {activeSubTab === 'shifts' && (
              <button
                onClick={handleOpenCreateShift}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#B83A24] hover:bg-[#8F2714] shadow-xs hover:shadow-md transition-all cursor-pointer font-montserrat"
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#B83A24] hover:bg-[#8F2714] shadow-xs transition-all cursor-pointer font-montserrat"
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#B83A24] hover:bg-[#8F2714] shadow-xs transition-all cursor-pointer font-montserrat"
              >
                <Plus className="w-4 h-4" />
                AGREGAR BASE
              </button>
            )}
          </div>
        </div>

        {/* Terminology Banner */}
        <div className="mt-4 p-3 rounded-xl bg-[#FFF9ED] border border-[#E5A12E]/30 text-xs text-[#8A580C] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#C87F17] shrink-0" />
            <span>
              <strong>Terminología Oficial:</strong> <strong>GT</strong> = GRUPO DE TRABAJO • <strong>GAP</strong> = GRUPO DE APOYO • <strong>MESA</strong> = MESA
            </span>
          </div>
          <span className="text-[11px] text-[#A16207]">
            Una persona GT asignada temporalmente a GAP mantiene intacto su tipo principal.
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-5 border-b border-[#EADDC7] pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('shifts')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'shifts'
                ? 'bg-[#B83A24] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#182535] hover:bg-[#F8FAFC]'
            }`}
          >
            <Clock className="w-4 h-4" />
            Turnos ({shifts.length})
          </button>

          <button
            onClick={() => setActiveSubTab('events')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'events'
                ? 'bg-[#B83A24] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#182535] hover:bg-[#F8FAFC]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Eventos ({events.length})
          </button>

          <button
            onClick={() => setActiveSubTab('bases')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'bases'
                ? 'bg-[#B83A24] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#182535] hover:bg-[#F8FAFC]'
            }`}
          >
            <Layers className="w-4 h-4" />
            Bases Físicas ({bases.length})
          </button>

          <button
            onClick={() => setActiveSubTab('groups')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'groups'
                ? 'bg-[#B83A24] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#182535] hover:bg-[#F8FAFC]'
            }`}
          >
            <Users className="w-4 h-4" />
            Grupos de Trabajo ({GT_SUBTEAMS.length})
          </button>

          {onNavigateToFunctions && (
            <button
              onClick={onNavigateToFunctions}
              className="ml-auto px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#B83A24] bg-[#FFF5F2] hover:bg-[#FFE8E2] border border-[#F5C2B8] transition-all cursor-pointer flex items-center gap-1.5"
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
            <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-2xs">
              <span className="text-xs font-semibold text-[#64748B] block">Total Turnos</span>
              <span className="text-2xl font-black text-[#182535] font-dalek">{shifts.length}</span>
              <span className="text-[11px] text-[#16A34A] block mt-0.5">
                {shifts.filter((s) => s.isActive).length} activos
              </span>
            </div>

            <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-2xs">
              <span className="text-xs font-semibold text-[#64748B] block">Cupos Totales Programados</span>
              <span className="text-2xl font-black text-[#B83A24] font-dalek">
                {shifts.reduce((acc, s) => acc + (s.isActive ? s.capacity : 0), 0)}
              </span>
              <span className="text-[11px] text-[#64748B] block mt-0.5">en turnos activos</span>
            </div>

            <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-2xs">
              <span className="text-xs font-semibold text-[#64748B] block">GRUPO DE TRABAJO (GT)</span>
              <span className="text-2xl font-black text-[#0284C7] font-dalek">
                {shifts.filter((s) => s.category === 'GT').length}
              </span>
              <span className="text-[11px] text-[#0284C7] block mt-0.5">turnos específicos</span>
            </div>

            <div className="bg-white border border-[#E2E8F0] p-4 rounded-xl shadow-2xs">
              <span className="text-xs font-semibold text-[#64748B] block">GRUPO DE APOYO (GAP)</span>
              <span className="text-2xl font-black text-[#D97706] font-dalek">
                {shifts.filter((s) => s.category === 'GAP').length}
              </span>
              <span className="text-[11px] text-[#D97706] block mt-0.5">turnos en bases</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Day Filter */}
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="text-xs font-medium border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 bg-white text-[#182535] focus:outline-none focus:ring-1 focus:ring-[#B83A24]"
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
                className="text-xs font-medium border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 bg-white text-[#182535] focus:outline-none focus:ring-1 focus:ring-[#B83A24]"
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
                className="text-xs font-medium border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 bg-white text-[#182535] focus:outline-none focus:ring-1 focus:ring-[#B83A24]"
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
                className="text-xs font-medium border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 bg-white text-[#182535] focus:outline-none focus:ring-1 focus:ring-[#B83A24]"
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
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar turno..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#CBD5E1] focus:outline-none focus:ring-1 focus:ring-[#B83A24]"
              />
            </div>
          </div>

          {/* Shifts Cards / Table */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569] font-bold font-montserrat">
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
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredShifts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#94A3B8]">
                        No se encontraron turnos con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredShifts.map((shift) => {
                      const eventObj = events.find((e) => e.id === shift.eventId);
                      const assignedCount = assignments.filter((a) => a.shiftId === shift.id).length;
                      const durationHours = calculateDurationHours(shift.startTime, shift.endTime);

                      return (
                        <tr key={shift.id} className="hover:bg-[#FFFDF8] transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-extrabold text-[#182535] text-sm font-dalek tracking-wide">
                              {shift.name}
                            </div>
                            {shift.notes && (
                              <span className="text-[11px] text-[#64748B] block truncate max-w-xs" title={shift.notes}>
                                {shift.notes}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-[#182535] capitalize block">
                              {shift.dayId}
                            </span>
                            <span className="text-[11px] text-[#64748B] block">
                              {eventObj ? eventObj.name : shift.eventId}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  shift.category === 'GT'
                                    ? 'bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]'
                                    : shift.category === 'GAP'
                                    ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
                                    : 'bg-[#F3E8FF] text-[#7E22CE] border border-[#E9D5FF]'
                                }`}
                              >
                                {shift.category === 'GT'
                                  ? 'GRUPO DE TRABAJO (GT)'
                                  : shift.category === 'GAP'
                                  ? 'GRUPO DE APOYO (GAP)'
                                  : 'MESA'}
                              </span>

                              {shift.category === 'GT' && shift.gtSubTeam && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F1F5F9] text-[#334155] border border-[#E2E8F0]">
                                  {shift.gtSubTeam}
                                </span>
                              )}

                              {shift.hasBases && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
                                  Opera en Bases
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-[#182535] block">{shift.label}</span>
                            <span className="text-[11px] text-[#64748B]">
                              {shift.startTime} – {shift.endTime} ({durationHours}h)
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-[#182535] text-sm font-dalek">
                                {shift.capacity}
                              </span>
                              <span className="text-[11px] text-[#64748B]">cupos</span>
                            </div>
                            <span
                              className={`text-[11px] font-semibold ${
                                assignedCount >= shift.capacity ? 'text-[#16A34A]' : 'text-[#EA580C]'
                              }`}
                            >
                              {assignedCount} asignados
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {shift.specificFunctions && shift.specificFunctions.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {shift.specificFunctions.map((fnName) => (
                                  <span
                                    key={fnName}
                                    className="px-1.5 py-0.5 rounded bg-[#F8FAFC] border border-[#CBD5E1] text-[10px] font-medium text-[#334155]"
                                  >
                                    {fnName}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#94A3B8] italic">Todas las del grupo</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleShiftActive(shift)}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                                shift.isActive
                                  ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0] hover:bg-[#DCFCE7]'
                                  : 'bg-[#F8FAFC] text-[#94A3B8] border-[#E2E8F0] hover:bg-[#F1F5F9]'
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
                                className="p-1.5 rounded-lg text-[#0284C7] hover:bg-[#E0F2FE] transition-colors cursor-pointer"
                                title="Editar turno"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Duplicate Button */}
                              <button
                                onClick={() => handleDuplicateShift(shift.id)}
                                className="p-1.5 rounded-lg text-[#D97706] hover:bg-[#FEF3C7] transition-colors cursor-pointer"
                                title="Duplicar turno"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleRequestDeleteShift(shift)}
                                className="p-1.5 rounded-lg text-[#DC2626] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
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
                  className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-[#FEF8EC] text-[#C87F17] border border-[#E5A12E]/40 font-montserrat">
                        {ev.dayName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ev.isActive ? 'bg-[#F0FDF4] text-[#16A34A]' : 'bg-[#F1F5F9] text-[#94A3B8]'
                        }`}
                      >
                        {ev.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-[#182535] font-dalek tracking-wide">
                      {ev.name}
                    </h3>
                    <p className="text-xs text-[#64748B] mt-1 line-clamp-2">
                      {ev.description || 'Sin descripción'}
                    </p>

                    <div className="mt-3 pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs text-[#475569]">
                      <span>
                        <strong>{eventShifts.length}</strong> turnos
                      </span>
                      <span>
                        <strong>{totalCapacity}</strong> cupos totales
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingEvent({ ...ev });
                        setIsEventModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#0284C7] bg-[#E0F2FE] hover:bg-[#BAE6FD] transition-colors cursor-pointer flex items-center gap-1"
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
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#DC2626] bg-[#FEE2E2] hover:bg-[#FECACA] transition-colors cursor-pointer flex items-center gap-1"
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
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#475569]">Filtrar por Evento:</span>
              <select
                value={baseEventFilter}
                onChange={(e) => setBaseEventFilter(e.target.value)}
                className="text-xs font-medium border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 bg-white text-[#182535] focus:outline-none"
              >
                <option value="all">Todas las Bases ({bases.length})</option>
                <option value="carnival">Carnival (30 bases oficiales)</option>
                <option value="the-games">The Games (15 bases)</option>
              </select>
            </div>

            <span className="text-xs text-[#64748B]">
              Para el <strong>GRUPO DE APOYO (GAP)</strong>, el Admin puede modificar cupos, nombres y estados de cada base.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredBases.map((b) => {
              const displayName = getBaseDisplayName(b.id) || b.name;
              const assignmentsOnBase = assignments.filter((a) => String(a.baseNumber) === String(b.id));

              return (
                <div
                  key={String(b.id)}
                  className={`bg-white border rounded-xl p-3.5 shadow-2xs transition-all flex flex-col justify-between ${
                    b.isSpecial
                      ? 'border-[#F59E0B] bg-[#FFFBEB]/30'
                      : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#F1F5F9] text-[#64748B]">
                        {b.eventId || 'Base'}
                      </span>
                      {b.isSpecial && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#FEF3C7] text-[#B45309]">
                          Especial
                        </span>
                      )}
                    </div>

                    <h4 className="font-extrabold text-[#182535] text-sm truncate font-dalek tracking-wide">
                      {displayName}
                    </h4>

                    <div className="mt-2 text-[11px] text-[#64748B]">
                      Capacidad: <strong>{b.defaultCapacity}</strong> pers.
                    </div>
                    <div className="text-[11px] font-medium text-[#16A34A]">
                      {assignmentsOnBase.length} asignados
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#F1F5F9] flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditingBase({ ...b });
                        setIsBaseModalOpen(true);
                      }}
                      className="p-1 text-[#0284C7] hover:bg-[#E0F2FE] rounded transition-colors"
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
                      className="p-1 text-[#DC2626] hover:bg-[#FEE2E2] rounded transition-colors"
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
                (s) => s.category === 'GT' && s.gtSubTeam === subTeam
              );

              return (
                <div
                  key={subTeam}
                  className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#0369A1] font-montserrat">
                        GRUPO DE TRABAJO
                      </span>
                      <span className="text-xs font-bold text-[#182535]">
                        {membersCount} integrantes
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-[#182535] font-dalek tracking-wide">
                      {subTeam}
                    </h3>

                    <div className="mt-3 space-y-1.5">
                      <span className="text-xs font-semibold text-[#475569] block">
                        Funciones Creadas ({relatedFunctions.length}):
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {relatedFunctions.length === 0 ? (
                          <span className="text-[11px] text-[#94A3B8] italic">Sin funciones</span>
                        ) : (
                          relatedFunctions.map((f) => (
                            <span
                              key={f.id}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-[#F8FAFC] border border-[#E2E8F0] text-[#334155]"
                            >
                              {f.name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-xs text-[#64748B] flex items-center justify-between">
                    <span>Turnos configurados:</span>
                    <strong className="text-[#182535]">{subTeamShifts.length}</strong>
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
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#E2E8F0] my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#FFF5F2] text-[#B83A24]">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#182535] font-dalek tracking-wide">
                    {editingShift.id ? 'EDITAR TURNO' : 'CREAR NUEVO TURNO'}
                  </h3>
                  <p className="text-xs text-[#64748B] font-montserrat">
                    Configure el horario, cupos, categoría y funciones asociadas
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsShiftModalOpen(false);
                  setEditingShift(null);
                }}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-[#182535] hover:bg-[#F1F5F9]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShiftSubmit} className="space-y-4 mt-4">
              {/* Day and Event Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] mb-1 font-montserrat">
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
                    className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2 bg-white text-[#182535] focus:ring-1 focus:ring-[#B83A24]"
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
                  <label className="block text-xs font-bold text-[#475569] mb-1 font-montserrat">
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
                    className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2 bg-white text-[#182535] focus:ring-1 focus:ring-[#B83A24]"
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

              {/* Category and SubTeam */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] mb-1 font-montserrat">
                    CATEGORÍA *
                  </label>
                  <select
                    value={editingShift.category}
                    onChange={(e) => {
                      const cat = e.target.value as PersonType;
                      setEditingShift({
                        ...editingShift,
                        category: cat,
                        gtSubTeam: cat === 'GT' ? editingShift.gtSubTeam || 'Logística' : undefined,
                        hasBases: cat === 'GAP',
                        specificFunctions: [], // reset when category changes
                      });
                    }}
                    className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2 bg-white text-[#182535] focus:ring-1 focus:ring-[#B83A24]"
                    required
                  >
                    <option value="GT">GRUPO DE TRABAJO (GT)</option>
                    <option value="GAP">GRUPO DE APOYO (GAP)</option>
                    <option value="MESA">MESA</option>
                  </select>
                </div>

                {editingShift.category === 'GT' ? (
                  <div>
                    <label className="block text-xs font-bold text-[#475569] mb-1 font-montserrat">
                      GRUPO DE TRABAJO (SUB-EQUIPO) *
                    </label>
                    <select
                      value={editingShift.gtSubTeam || 'Logística'}
                      onChange={(e) => {
                        setEditingShift({
                          ...editingShift,
                          gtSubTeam: e.target.value as GtSubTeam,
                          specificFunctions: [], // automatically reset functions to match new group!
                        });
                      }}
                      className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2 bg-white text-[#182535] focus:ring-1 focus:ring-[#B83A24]"
                      required
                    >
                      {GT_SUBTEAMS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-[#475569] mb-1 font-montserrat">
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
                      className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2 bg-white text-[#182535] focus:ring-1 focus:ring-[#B83A24]"
                    >
                      <option value="yes">Sí (Asociado a bases físicas)</option>
                      <option value="no">No (Turno general)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Name and Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] mb-1 font-montserrat">
                    NOMBRE DEL TURNO *
                  </label>
                  <input
                    type="text"
                    value={editingShift.name || ''}
                    onChange={(e) => setEditingShift({ ...editingShift, name: e.target.value })}
                    placeholder="Ej. T1, T2, GT General"
                    className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2 focus:ring-1 focus:ring-[#B83A24]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] mb-1 font-montserrat">
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
                    className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2 focus:ring-1 focus:ring-[#B83A24]"
                    required
                  />
                </div>
              </div>

              {/* Hours (Start and End) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div>
                  <label className="block text-xs font-bold text-[#475569] mb-1 font-montserrat">
                    HORA DE INICIO (24H) *
                  </label>
                  <input
                    type="time"
                    value={editingShift.startTime || '06:00'}
                    onChange={(e) => setEditingShift({ ...editingShift, startTime: e.target.value })}
                    className="w-full text-xs font-semibold border border-[#CBD5E1] rounded-xl px-3 py-2 bg-white focus:ring-1 focus:ring-[#B83A24]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] mb-1 font-montserrat">
                    HORA DE FINALIZACIÓN (24H) *
                  </label>
                  <input
                    type="time"
                    value={editingShift.endTime || '08:00'}
                    onChange={(e) => setEditingShift({ ...editingShift, endTime: e.target.value })}
                    className="w-full text-xs font-semibold border border-[#CBD5E1] rounded-xl px-3 py-2 bg-white focus:ring-1 focus:ring-[#B83A24]"
                    required
                  />
                </div>

                <div className="sm:col-span-2 text-xs text-[#64748B] flex items-center justify-between pt-1">
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
                  <label className="block text-xs font-bold text-[#475569] font-montserrat">
                    FUNCIONES ESPECÍFICAS (OPCIONAL)
                  </label>
                  <span className="text-[11px] text-[#64748B]">
                    Filtrado para:{' '}
                    <strong>
                      {editingShift.category === 'GT'
                        ? `GT → ${editingShift.gtSubTeam || 'Logística'}`
                        : editingShift.category === 'GAP'
                        ? 'GRUPO DE APOYO'
                        : 'MESA'}
                    </strong>
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] max-h-36 overflow-y-auto space-y-1.5">
                  {shiftModalAvailableFunctions.length === 0 ? (
                    <span className="text-xs text-[#94A3B8] italic">
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
                                ? 'bg-[#FFF5F2] border-[#F5C2B8] text-[#B83A24] font-bold'
                                : 'bg-white border-[#E2E8F0] text-[#334155] hover:bg-[#F1F5F9]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSpecificFunction(fn.name)}
                              className="w-3.5 h-3.5 text-[#B83A24] rounded border-gray-300 focus:ring-[#B83A24]"
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
                  <label className="block text-xs font-bold text-[#475569] mb-1 font-montserrat">
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
                    className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2 bg-white"
                  >
                    <option value="active">Activo (Habilitado para asignaciones)</option>
                    <option value="inactive">Inactivo (Oculto)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] mb-1 font-montserrat">
                    NOTAS O INSTRUCCIONES
                  </label>
                  <input
                    type="text"
                    value={editingShift.notes || ''}
                    onChange={(e) => setEditingShift({ ...editingShift, notes: e.target.value })}
                    placeholder="Ej. Llevar chaleco y radio..."
                    className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsShiftModalOpen(false);
                    setEditingShift(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#B83A24] hover:bg-[#8F2714] shadow-xs cursor-pointer font-montserrat"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#F59E0B]">
            <div className="flex items-center gap-3 text-[#B45309] mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base font-dalek tracking-wide text-[#182535]">
                ¡POSIBLES CONFLICTOS DE HORARIO DETECTADOS!
              </h3>
            </div>

            <p className="text-xs text-[#475569] mb-3 font-montserrat">
              Al modificar el horario de este turno a{' '}
              <strong>
                {conflictPrompt.pendingShiftData.startTime} – {conflictPrompt.pendingShiftData.endTime}
              </strong>
              , las siguientes personas asignadas entrarán en solapamiento con otros de sus turnos programados para ese mismo día:
            </p>

            <div className="p-3 rounded-xl bg-[#FEF3C7]/40 border border-[#FDE68A] max-h-48 overflow-y-auto space-y-2 mb-4">
              {conflictPrompt.conflicts.map((c, idx) => (
                <div key={idx} className="text-xs">
                  <span className="font-bold text-[#182535]">{c.personName}:</span>{' '}
                  <span className="text-[#B45309]">
                    se solapa con turno "{c.conflictingShiftName}" ({c.conflictingHours})
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[#64748B] mb-4">
              ¿Deseas guardar el nuevo horario de todos modos y revisar las asignaciones manualmente?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConflictPrompt(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9]"
              >
                Cancelar y Ajustar Horario
              </button>
              <button
                onClick={handleConfirmShiftWithConflicts}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[#B45309] hover:bg-[#92400E]"
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-lg font-black text-[#182535] font-dalek tracking-wide">
                {editingEvent.id ? 'EDITAR EVENTO' : 'CREAR NUEVO EVENTO'}
              </h3>
              <button
                onClick={() => {
                  setIsEventModalOpen(false);
                  setEditingEvent(null);
                }}
                className="p-1 text-[#94A3B8] hover:text-[#182535]"
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
                <label className="block text-xs font-bold text-[#475569] mb-1">
                  NOMBRE DEL EVENTO *
                </label>
                <input
                  type="text"
                  value={editingEvent.name || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                  placeholder="Ej. THE SHOW, THE FESTIVAL"
                  className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] mb-1">
                    ID DEL DÍA *
                  </label>
                  <input
                    type="text"
                    value={editingEvent.dayId || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, dayId: e.target.value })}
                    placeholder="lunes, martes..."
                    className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] mb-1">
                    NOMBRE VISIBLE DEL DÍA *
                  </label>
                  <input
                    type="text"
                    value={editingEvent.dayName || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, dayName: e.target.value })}
                    placeholder="Lunes, Martes..."
                    className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1">
                  DESCRIPCIÓN
                </label>
                <textarea
                  rows={2}
                  value={editingEvent.description || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  placeholder="Detalles sobre el evento y actividades..."
                  className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-[#475569]">
                  <input
                    type="checkbox"
                    checked={editingEvent.isCarnival || false}
                    onChange={(e) => setEditingEvent({ ...editingEvent, isCarnival: e.target.checked })}
                    className="w-4 h-4 text-[#B83A24] rounded"
                  />
                  Es Día Carnival (30 bases físicas)
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-[#475569]">
                  <input
                    type="checkbox"
                    checked={editingEvent.isActive !== false}
                    onChange={(e) => setEditingEvent({ ...editingEvent, isActive: e.target.checked })}
                    className="w-4 h-4 text-[#B83A24] rounded"
                  />
                  Activo
                </label>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#B83A24] hover:bg-[#8F2714]"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-lg font-black text-[#182535] font-dalek tracking-wide">
                {editingBase.id !== undefined ? 'EDITAR BASE FÍSICA' : 'CREAR NUEVA BASE'}
              </h3>
              <button
                onClick={() => {
                  setIsBaseModalOpen(false);
                  setEditingBase(null);
                }}
                className="p-1 text-[#94A3B8] hover:text-[#182535]"
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
                <label className="block text-xs font-bold text-[#475569] mb-1">
                  NOMBRE DE LA BASE *
                </label>
                <input
                  type="text"
                  value={editingBase.name || ''}
                  onChange={(e) => setEditingBase({ ...editingBase, name: e.target.value })}
                  placeholder="Ej. Base 1, Base Toro, Base Speedway..."
                  className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] mb-1">
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
                    className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] mb-1">
                    EVENTO ASOCIADO
                  </label>
                  <select
                    value={editingBase.eventId || 'carnival'}
                    onChange={(e) => setEditingBase({ ...editingBase, eventId: e.target.value })}
                    className="w-full text-xs font-medium border border-[#CBD5E1] rounded-xl px-3 py-2"
                  >
                    <option value="carnival">Carnival</option>
                    <option value="the-games">The Games</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-[#475569]">
                  <input
                    type="checkbox"
                    checked={editingBase.isSpecial || false}
                    onChange={(e) => setEditingBase({ ...editingBase, isSpecial: e.target.checked })}
                    className="w-4 h-4 text-[#B83A24] rounded"
                  />
                  Base Especial (ej. Toro, Speedway, Arcade)
                </label>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBaseModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#64748B]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#B83A24] hover:bg-[#8F2714]"
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
      {deleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DC2626]">
            <div className="flex items-center gap-3 text-[#DC2626] mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base font-dalek tracking-wide text-[#182535]">
                {deleteConfirm.title}
              </h3>
            </div>

            <p className="text-xs text-[#475569] mb-3 font-montserrat">
              {deleteConfirm.warning}
            </p>

            {deleteConfirm.peopleNames && deleteConfirm.peopleNames.length > 0 && (
              <div className="p-3 rounded-xl bg-[#FEE2E2]/60 border border-[#FECACA] max-h-32 overflow-y-auto mb-4">
                <span className="text-[11px] font-bold text-[#991B1B] block mb-1">
                  Personas afectadas ({deleteConfirm.impactCount}):
                </span>
                <span className="text-xs text-[#7F1D1D]">
                  {deleteConfirm.peopleNames.join(', ')}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9]"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteDelete}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] shadow-xs"
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
