import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Person, AvailabilityRecord, ConfigurableShift, Shift, Assignment } from '../types';
import {
  EVENT_SCHEDULE,
  CARNIVAL_GT_SHIFTS,
  CARNIVAL_GAP_SHIFTS,
  DEFAULT_INITIAL_SHIFTS,
} from '../data/eventStructure';
import { saveAvailability, RemovedAssignmentInfo } from '../services/storageService';
import {
  Clock,
  CheckSquare,
  Square,
  Calendar,
  Check,
  User,
  Shield,
  Grid,
  Layers,
  AlertCircle,
  Crown,
  Search,
  X,
  ChevronDown,
  AlertTriangle,
  UserMinus,
  CheckCircle2,
} from 'lucide-react';

interface AvailabilityViewProps {
  people: Person[];
  availabilities: AvailabilityRecord[];
  shifts?: (ConfigurableShift | Shift)[];
  assignments?: Assignment[];
  onNavigate?: (tab: string) => void;
}

export const AvailabilityView: React.FC<AvailabilityViewProps> = ({
  people,
  availabilities,
  shifts,
  assignments = [],
  onNavigate,
}) => {
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [selectedDayId, setSelectedDayId] = useState<string>('miercoles');
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Notification state when assignments are automatically removed
  const [deassignedNotice, setDeassignedNotice] = useState<{
    personName: string;
    items: RemovedAssignmentInfo[];
  } | null>(null);

  // Searchable combobox state
  const [personSearchQuery, setPersonSearchQuery] = useState<string>('');
  const [isPersonDropdownOpen, setIsPersonDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPersonDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sortedPeople = useMemo(() => {
    return [...people].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [people]);

  const filteredPeople = useMemo(() => {
    const q = personSearchQuery.trim().toLowerCase();
    if (!q) return sortedPeople;
    return sortedPeople
      .filter((p) => {
        const matchName = p.name.toLowerCase().includes(q);
        const matchDoc = p.documentId ? p.documentId.toLowerCase().includes(q) : false;
        const matchSub = p.gtSubTeam ? p.gtSubTeam.toLowerCase().includes(q) : false;
        const matchType = p.primaryType ? p.primaryType.toLowerCase().includes(q) : false;
        return matchName || matchDoc || matchSub || matchType;
      })
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q);
        const bStarts = b.name.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      });
  }, [sortedPeople, personSearchQuery]);

  const selectedPerson = people.find((p) => p.id === selectedPersonId);

  const currentDay = EVENT_SCHEDULE.find((d) => d.dayId === selectedDayId) || EVENT_SCHEDULE[0];
  const isCarnival = currentDay.isCarnival;

  // MESA shifts for Carnival
  const carnivalMesaShifts = useMemo(() => {
    const configuredMesa = (shifts || []).filter(
      (s) =>
        s.dayId === 'miercoles' &&
        s.isActive !== false &&
        (s.category === 'MESA' || s.name.toUpperCase().includes('MESA'))
    );
    return configuredMesa;
  }, [shifts]);

  // Turnos GT y GAP de Carnival tal como están configurados (sin los oficiales eliminados)
  const carnivalGtShifts = useMemo(
    () =>
      (shifts || []).filter(
        (s) => s.dayId === 'miercoles' && s.isActive !== false && s.category === 'GT' && !s.name.toUpperCase().includes('MESA')
      ),
    [shifts]
  );
  const carnivalGapShifts = useMemo(
    () => (shifts || []).filter((s) => s.dayId === 'miercoles' && s.isActive !== false && (s.category === 'GAP' || s.hasBases)),
    [shifts]
  );

  // Non-Carnival day shifts
  const currentDayShifts = useMemo(() => {
    const configured = (shifts || []).filter(
      (s) => s.dayId === selectedDayId && s.isActive !== false
    );
    return configured;
  }, [shifts, selectedDayId]);

  // Helper to look up shift details across configured, defaults, GT, and GAP
  const lookupShift = (shiftId: string) => {
    return (
      (shifts || []).find((s) => s.id === shiftId) ||
      DEFAULT_INITIAL_SHIFTS.find((s) => s.id === shiftId) ||
      CARNIVAL_GT_SHIFTS.find((s) => s.id === shiftId) ||
      CARNIVAL_GAP_SHIFTS.find((s) => s.id === shiftId)
    );
  };

  // Active assignments for this person on the selected day
  const personAssignmentsOnDay = useMemo(() => {
    if (!selectedPersonId || !assignments || assignments.length === 0) return [];
    return assignments.filter((a) => {
      if (a.personId !== selectedPersonId) return false;
      const shiftObj = lookupShift(a.shiftId);
      const assignDay = a.dayId || shiftObj?.dayId;
      return assignDay && assignDay.toLowerCase() === selectedDayId.toLowerCase();
    });
  }, [selectedPersonId, selectedDayId, assignments, shifts]);

  // Assignments that will be automatically removed if saved with current unchecked shifts
  const assignmentsAtRiskOfRemoval = useMemo(() => {
    return personAssignmentsOnDay.filter((a) => !selectedShifts.includes(a.shiftId));
  }, [personAssignmentsOnDay, selectedShifts]);

  // Helper to render live assignment badge on each shift card
  const renderAssignmentStatusBadge = (shiftId: string, isChecked: boolean) => {
    const asgn = personAssignmentsOnDay.find((a) => a.shiftId === shiftId);
    if (!asgn) return null;

    if (isChecked) {
      const baseOrType =
        asgn.baseName ||
        (asgn.baseNumber !== undefined ? `Base ${asgn.baseNumber}` : asgn.assignedType || 'General');
      return (
        <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          <span className="truncate">
            Asignado(a): <strong>{baseOrType}</strong>
            {asgn.assignedFunction ? ` • ${asgn.assignedFunction}` : ''}
          </span>
        </div>
      );
    } else {
      return (
        <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-semibold animate-pulse">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="truncate">
            Se quitará automáticamente de este turno al guardar
          </span>
        </div>
      );
    }
  };

  // When person or day changes, prefill current availability if already saved
  const handlePersonOrDayChange = (personId: string, dayId: string) => {
    setSelectedPersonId(personId);
    setSelectedDayId(dayId);
    setSaveMessage(null);

    const personObj = people.find((p) => p.id === personId);
    if (personObj) {
      setPersonSearchQuery(personObj.name);
    }

    const existingRecord = availabilities.find(
      (a) => a.personId === personId && a.dayId === dayId
    );
    if (existingRecord) {
      setSelectedShifts(existingRecord.shiftIds);
      setNotes(existingRecord.notes || '');
    } else {
      setSelectedShifts([]);
      setNotes('');
    }
  };

  const handleToggleShift = (shiftId: string) => {
    if (selectedShifts.includes(shiftId)) {
      setSelectedShifts(selectedShifts.filter((id) => id !== shiftId));
    } else {
      setSelectedShifts([...selectedShifts, shiftId]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId) {
      alert('Por favor seleccione una persona.');
      return;
    }

    try {
      const result = await saveAvailability(
        selectedPersonId,
        selectedDayId,
        selectedShifts,
        notes
      );

      if (result.removedAssignments && result.removedAssignments.length > 0) {
        setDeassignedNotice({
          personName: selectedPerson?.name || 'El integrante',
          items: result.removedAssignments,
        });
        setSaveMessage(
          `✓ Disponibilidad guardada. Se retiró automáticamente de ${result.removedAssignments.length} turno(s) asignado(s).`
        );
      } else {
        setSaveMessage('✓ Disponibilidad guardada correctamente.');
        setTimeout(() => setSaveMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
      alert('Error al guardar la disponibilidad.');
    }
  };

  return (
    <div className="space-y-6 text-tinta-900">
      {/* Header */}
      <div className="bg-surface border border-tinta-200 rounded-3xl p-5 sm:p-6 shadow-2xs">
        <h2 className="text-xl sm:text-2xl font-bold text-tinta-900 tracking-wide font-display">
          REGISTRO DE DISPONIBILIDAD
        </h2>
        <p className="text-xs sm:text-sm text-tinta-500 mt-0.5 font-sans">
          Registro por turno específico exacto. En CARNIVAL se diferencian estrictamente los 5 turnos de GT y los 3 turnos de GAP.
        </p>
      </div>

      {/* Form Container */}
      <div className="bg-surface border border-tinta-200 rounded-3xl p-5 sm:p-6 shadow-2xs">
        <form onSubmit={handleSave} className="space-y-6 font-sans">
          {/* Person & Day selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-tinta-700 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-lila-600" />
                  <span>Buscar integrante por nombre *</span>
                </label>
                {selectedPerson && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPersonId('');
                      setSelectedShifts([]);
                      setNotes('');
                      setPersonSearchQuery('');
                      setIsPersonDropdownOpen(true);
                      setTimeout(() => searchInputRef.current?.focus(), 50);
                    }}
                    className="text-[11px] text-lila-600 hover:underline cursor-pointer flex items-center gap-1 font-medium"
                  >
                    <X className="w-3 h-3" />
                    Limpiar selección
                  </button>
                )}
              </div>

              {people.length === 0 ? (
                <div className="p-3 rounded-2xl bg-tinta-50 border border-tinta-200 text-xs text-tinta-500">
                  No hay personas registradas aún. Agregue personas en la pestaña de Personas o mediante Importación Excel.
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Searchable input with Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <div className="relative flex items-center">
                      <Search className="w-4 h-4 text-tinta-400 absolute left-3.5 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Escribe el nombre del integrante a buscar..."
                        value={personSearchQuery}
                        onChange={(e) => {
                          setPersonSearchQuery(e.target.value);
                          setIsPersonDropdownOpen(true);
                        }}
                        onFocus={() => setIsPersonDropdownOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && filteredPeople.length > 0 && isPersonDropdownOpen) {
                            e.preventDefault();
                            handlePersonOrDayChange(filteredPeople[0].id, selectedDayId);
                            setIsPersonDropdownOpen(false);
                          } else if (e.key === 'Escape') {
                            setIsPersonDropdownOpen(false);
                          }
                        }}
                        className="w-full min-h-[44px] pl-10 pr-16 py-2.5 bg-tinta-50 text-tinta-900 rounded-xl border border-tinta-300 focus:outline-hidden focus:border-lila-600 text-xs font-medium placeholder:text-tinta-400"
                      />

                      <div className="absolute right-2.5 flex items-center gap-1">
                        {personSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setPersonSearchQuery('');
                              setSelectedPersonId('');
                              setSelectedShifts([]);
                              setNotes('');
                              setIsPersonDropdownOpen(true);
                              searchInputRef.current?.focus();
                            }}
                            className="text-tinta-400 hover:text-tinta-900 p-1 cursor-pointer"
                            title="Limpiar búsqueda"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setIsPersonDropdownOpen(!isPersonDropdownOpen);
                            if (!isPersonDropdownOpen) {
                              setTimeout(() => searchInputRef.current?.focus(), 50);
                            }
                          }}
                          className="text-tinta-400 hover:text-tinta-900 p-1 cursor-pointer"
                          title="Ver lista"
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isPersonDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Autocomplete Dropdown List */}
                    {isPersonDropdownOpen && (
                      <div className="absolute z-40 left-0 right-0 mt-1.5 bg-surface border border-tinta-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto p-1.5 divide-y divide-tinta-50">
                        {filteredPeople.length === 0 ? (
                          <div className="p-4 text-center text-xs text-tinta-400">
                            No se encontraron integrantes con el nombre &quot;{personSearchQuery}&quot;
                          </div>
                        ) : (
                          filteredPeople.slice(0, 60).map((p) => {
                            const isSelected = p.id === selectedPersonId;
                            const existingForDay = availabilities.find(
                              (a) => a.personId === p.id && a.dayId === selectedDayId
                            );
                            const shiftsCount = existingForDay?.shiftIds.length || 0;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  handlePersonOrDayChange(p.id, selectedDayId);
                                  setIsPersonDropdownOpen(false);
                                }}
                                className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? 'bg-lila-50 border border-lila-200'
                                    : 'hover:bg-tinta-50'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs text-tinta-900 font-bold truncate flex items-center gap-1.5">
                                    <span>{p.name}</span>
                                    {p.primaryType === 'MESA' && (
                                      <Crown className="w-3 h-3 text-purple-700 shrink-0" />
                                    )}
                                  </div>
                                  <div className="text-[11px] text-tinta-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-bold text-[9px] border ${
                                        p.primaryType === 'MESA'
                                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                                          : p.primaryType === 'GAP'
                                          ? 'bg-lila-50 text-lila-600 border-lila-200'
                                          : 'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}
                                    >
                                      {p.primaryType}
                                    </span>
                                    {p.gtSubTeam && (
                                      <span className="text-[10px] text-tinta-600 font-medium">
                                        • {p.gtSubTeam}
                                      </span>
                                    )}
                                    {p.documentId && (
                                      <span className="text-[10px] text-tinta-500 font-mono">
                                        • CC: {p.documentId}
                                      </span>
                                    )}
                                    <span
                                      className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold border ${
                                        shiftsCount > 0
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-amber-50 text-amber-700 border-amber-200'
                                      }`}
                                    >
                                      {shiftsCount > 0 ? `${shiftsCount} turnos` : 'Sin turnos'}
                                    </span>
                                  </div>
                                </div>
                                {isSelected ? (
                                  <div className="w-5 h-5 rounded-full bg-lila-600 text-white flex items-center justify-center shrink-0">
                                    <Check className="w-3.5 h-3.5" />
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-tinta-400 font-medium shrink-0">
                                    Seleccionar
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                        {filteredPeople.length > 60 && (
                          <div className="p-2 text-center text-[11px] text-tinta-500 bg-tinta-50 rounded-xl mt-1">
                            Mostrando los primeros 60 de {filteredPeople.length} integrantes. Escribe para afinar la búsqueda.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Person Info Card */}
                  {selectedPerson ? (
                    <div className="p-3 bg-tinta-50 border border-tinta-300 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                            selectedPerson.primaryType === 'MESA'
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : selectedPerson.primaryType === 'GAP'
                              ? 'bg-lila-50 text-lila-600 border-lila-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        >
                          {selectedPerson.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-tinta-900 truncate flex items-center gap-1.5">
                            <span>{selectedPerson.name}</span>
                            {selectedPerson.primaryType === 'MESA' && (
                              <Crown className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-tinta-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold text-[9px] border ${
                                selectedPerson.primaryType === 'MESA'
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : selectedPerson.primaryType === 'GAP'
                                  ? 'bg-lila-50 text-lila-600 border-lila-200'
                                  : 'bg-blue-100 text-blue-800 border-blue-200'
                              }`}
                            >
                              {selectedPerson.primaryType}
                            </span>
                            {selectedPerson.gtSubTeam && (
                              <span className="text-[10px] text-tinta-600 font-medium">
                                Subequipo: {selectedPerson.gtSubTeam}
                              </span>
                            )}
                            {selectedPerson.documentId && (
                              <span className="text-[10px] text-tinta-500 font-mono">
                                • CC: {selectedPerson.documentId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPersonDropdownOpen(true);
                          setTimeout(() => searchInputRef.current?.focus(), 50);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white border border-tinta-300 text-xs font-bold text-tinta-900 hover:border-lila-600 hover:text-lila-600 transition-all cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
                      >
                        <Search className="w-3 h-3" />
                        Buscar otro
                      </button>
                    </div>
                  ) : (
                    <div className="px-3 py-2 bg-tinta-50/60 border border-dashed border-tinta-300 rounded-xl text-[11px] text-tinta-500 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-mostaza-600 shrink-0" />
                      <span>Escribe el nombre o cédula arriba para seleccionar al integrante.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-tinta-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-mostaza-600" />
                <span>Día del Evento</span>
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {EVENT_SCHEDULE.map((d) => (
                  <button
                    type="button"
                    key={d.dayId}
                    onClick={() => handlePersonOrDayChange(selectedPersonId, d.dayId)}
                    className={`min-h-[44px] py-2 px-1 rounded-xl text-xs font-bold transition-all text-center ${
                      selectedDayId === d.dayId
                        ? 'bg-lila-600 text-white shadow-xs font-display'
                        : 'bg-tinta-50 text-tinta-500 hover:text-tinta-900 hover:bg-tinta-100 border border-tinta-200'
                    }`}
                  >
                    {d.dayName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* TURNOS SECTION */}
          {isCarnival ? (
            /* CARNIVAL: SEPARATED GT AND GAP SECTIONS */
            <div className="pt-4 border-t border-tinta-200 space-y-6">
              <div className="p-4 rounded-2xl bg-tinta-50 border border-tinta-200 text-xs">
                <h4 className="font-bold text-tinta-900 font-display tracking-wider flex items-center gap-2">
                  <span>CARNIVAL — ESTRUCTURA DE TURNOS POR ROL</span>
                </h4>
                <p className="text-tinta-500 text-[11px] mt-1 leading-relaxed">
                  En CARNIVAL, <strong>GT</strong> tiene exactamente 5 turnos y <strong>GAP</strong> tiene únicamente 3 turnos.
                  NO se mezclan los turnos de GT con los de GAP.
                  {selectedPerson?.primaryType === 'GAP' &&
                    ' Como este integrante es GAP, se presentan sus 3 turnos oficiales.'}
                  {selectedPerson?.primaryType === 'GT' && !selectedPerson?.alsoActsAsGap &&
                    ' Como este integrante es GT, se presentan sus 5 turnos oficiales de GT.'}
                  {selectedPerson?.primaryType === 'GT' && selectedPerson?.alsoActsAsGap &&
                    ' Este integrante de GT también actúa como GAP (ej: GAP Generales Miércoles, Jueves y Viernes): puede registrar turnos tanto de GT como de GAP.'}
                  {selectedPerson?.primaryType === 'MESA' &&
                    ' Como integrante de MESA, sus asignaciones aplican exclusivamente para turnos y requerimientos de MESA.'}
                </p>
              </div>

              {/* GAP SHIFTS (Shown if GAP, GT dual, or no person selected) */}
              {(!selectedPerson || selectedPerson.primaryType === 'GAP' || selectedPerson.alsoActsAsGap) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-tinta-200">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-lila-50 text-lila-600">
                        <Grid className="w-4 h-4" />
                      </span>
                      <h4 className="text-sm font-bold text-tinta-900 font-display tracking-wider">
                        CARNIVAL — GAP (3 TURNOS OFICIALES)
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-lila-50 text-lila-600 font-mono font-bold border border-lila-200">
                        30 BASES FÍSICAS
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const gapIds = carnivalGapShifts.map((s) => s.id);
                          const remaining = selectedShifts.filter((id) => !gapIds.includes(id));
                          setSelectedShifts([...remaining, ...gapIds]);
                        }}
                        className="text-[11px] font-bold text-lila-600 hover:underline"
                      >
                        Marcar 3 de GAP
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {carnivalGapShifts.map((shift) => {
                      const isChecked = selectedShifts.includes(shift.id);
                      return (
                        <div
                          key={shift.id}
                          onClick={() => handleToggleShift(shift.id)}
                          className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-start gap-3 select-none ${
                            isChecked
                              ? 'bg-lila-50 border-lila-600 shadow-xs'
                              : 'bg-tinta-50 border-tinta-200 text-tinta-500 hover:border-lila-600/40 hover:bg-surface'
                          }`}
                        >
                          <div className="mt-0.5 text-lila-600">
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-lila-600" />
                            ) : (
                              <Square className="w-5 h-5 text-tinta-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-tinta-900">{shift.name}</span>
                              <span className="text-[10px] font-mono text-lila-600 font-bold">GAP</span>
                            </div>
                            <div className="text-sm font-bold text-tinta-900 mt-1 font-mono">
                              {shift.label}
                            </div>
                            <div className="text-[10px] text-tinta-500 mt-1">
                              30 Bases físicas compartidas
                            </div>
                            {renderAssignmentStatusBadge(shift.id, isChecked)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* GT SHIFTS (Shown if GT or no person selected) */}
              {(!selectedPerson || selectedPerson.primaryType === 'GT') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between pb-2 border-b border-tinta-200">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-tinta-50 text-tinta-900">
                        <Shield className="w-4 h-4" />
                      </span>
                      <h4 className="text-sm font-bold text-tinta-900 font-display tracking-wider">
                        CARNIVAL — GT (5 TURNOS OFICIALES)
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-tinta-900 text-white font-mono font-bold">
                        STAFF GENERAL
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const gtIds = carnivalGtShifts.map((s) => s.id);
                          const remaining = selectedShifts.filter((id) => !gtIds.includes(id));
                          setSelectedShifts([...remaining, ...gtIds]);
                        }}
                        className="text-[11px] font-bold text-tinta-900 hover:underline"
                      >
                        Marcar 5 de GT
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {carnivalGtShifts.map((shift) => {
                      const isChecked = selectedShifts.includes(shift.id);
                      return (
                        <div
                          key={shift.id}
                          onClick={() => handleToggleShift(shift.id)}
                          className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-start gap-3 select-none ${
                            isChecked
                              ? 'bg-tinta-50 border-tinta-900 shadow-xs'
                              : 'bg-tinta-50 border-tinta-200 text-tinta-500 hover:border-tinta-900/40 hover:bg-surface'
                          }`}
                        >
                          <div className="mt-0.5 text-tinta-900">
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-tinta-900" />
                            ) : (
                              <Square className="w-5 h-5 text-tinta-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-tinta-900">{shift.name}</span>
                              <span className="text-[10px] font-mono text-tinta-900 font-bold">GT</span>
                            </div>
                            <div className="text-sm font-bold text-tinta-900 mt-1 font-mono">
                              {shift.label}
                            </div>
                            <div className="text-[10px] text-tinta-500 mt-1">
                              Staff general campus
                            </div>
                            {renderAssignmentStatusBadge(shift.id, isChecked)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MESA SHIFTS (Shown if MESA or no person selected) */}
              {(!selectedPerson || selectedPerson.primaryType === 'MESA') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between pb-2 border-b border-tinta-200">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-purple-100 text-purple-700">
                        <Crown className="w-4 h-4" />
                      </span>
                      <h4 className="text-sm font-bold text-tinta-900 font-display tracking-wider">
                        CARNIVAL — MESA DIRECTIVA ({carnivalMesaShifts.length} TURNOS)
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-700 text-white font-mono font-bold">
                        EXCLUSIVO MESA
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const mesaIds = carnivalMesaShifts.map((s) => s.id);
                          const remaining = selectedShifts.filter((id) => !mesaIds.includes(id));
                          setSelectedShifts([...remaining, ...mesaIds]);
                        }}
                        className="text-[11px] font-bold text-purple-700 hover:underline"
                      >
                        Marcar todos MESA
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {carnivalMesaShifts.map((shift) => {
                      const isChecked = selectedShifts.includes(shift.id);
                      return (
                        <div
                          key={shift.id}
                          onClick={() => handleToggleShift(shift.id)}
                          className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-start gap-3 select-none ${
                            isChecked
                              ? 'bg-purple-50 border-purple-700 shadow-xs ring-1 ring-purple-600/30'
                              : 'bg-tinta-50 border-tinta-200 text-tinta-500 hover:border-purple-400 hover:bg-surface'
                          }`}
                        >
                          <div className="mt-0.5 text-purple-700">
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-purple-700" />
                            ) : (
                              <Square className="w-5 h-5 text-tinta-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-tinta-900">{shift.name}</span>
                              <span className="text-[10px] font-mono text-purple-700 font-bold bg-purple-100 px-1.5 py-0.5 rounded">
                                MESA
                              </span>
                            </div>
                            <div className="text-sm font-bold text-tinta-900 mt-1 font-mono">
                              {shift.label}
                            </div>
                            <div className="text-[10px] text-tinta-500 mt-1">
                              {shift.startTime} - {shift.endTime} • Coordinación General
                            </div>
                            {renderAssignmentStatusBadge(shift.id, isChecked)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* OTHER DAYS (Lunes, Martes, Jueves, Viernes) */
            <div className="pt-2 border-t border-tinta-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-tinta-900 flex items-center gap-2 font-display tracking-wider">
                    <span>TURNOS PARA {currentDay.dayName.toUpperCase()}: {currentDay.eventName}</span>
                    {selectedDayId === 'lunes' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-turquesa-50 text-turquesa-600 border border-turquesa-200 font-semibold font-sans">
                        5 Turnos Definitivos
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-tinta-500 mt-0.5">
                    Seleccione los turnos en los que este integrante puede participar:
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedShifts(currentDayShifts.map((s) => s.id))}
                    className={`text-[11px] font-bold hover:underline ${
                      selectedPerson?.primaryType === 'MESA' ? 'text-purple-700' : 'text-lila-600'
                    }`}
                  >
                    Marcar todos
                  </button>
                  <span className="text-tinta-300">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedShifts([])}
                    className="text-[11px] font-medium text-tinta-500 hover:text-tinta-900"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentDayShifts.map((shift) => {
                  const isChecked = selectedShifts.includes(shift.id);
                  const isMesaPerson = selectedPerson?.primaryType === 'MESA';
                  return (
                    <div
                      key={shift.id}
                      onClick={() => handleToggleShift(shift.id)}
                      className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-start gap-3 select-none ${
                        isChecked
                          ? isMesaPerson
                            ? 'bg-purple-50 border-purple-700 shadow-xs ring-1 ring-purple-600/30'
                            : 'bg-lila-50 border-lila-600 shadow-xs'
                          : 'bg-tinta-50 border-tinta-200 text-tinta-500 hover:border-lila-600/40 hover:bg-surface'
                      }`}
                    >
                      <div className={`mt-0.5 ${isMesaPerson ? 'text-purple-700' : 'text-lila-600'}`}>
                        {isChecked ? (
                          <CheckSquare className={`w-5 h-5 ${isMesaPerson ? 'text-purple-700' : 'text-lila-600'}`} />
                        ) : (
                          <Square className="w-5 h-5 text-tinta-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-tinta-900">{shift.name}</span>
                          <span className="text-[10px] font-mono text-tinta-500">
                            {shift.startTime} - {shift.endTime}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-tinta-900 mt-1 font-mono tracking-tight">
                          {shift.label}
                        </div>
                        <div className="text-[11px] text-tinta-500 mt-1">
                          {isMesaPerson ? 'Apto para: MESA' : `Apto para: ${(shift.forTypes || ['GT']).join(' / ')}`}
                        </div>
                        {renderAssignmentStatusBadge(shift.id, isChecked)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-tinta-700 mb-1">
              Observaciones de Disponibilidad (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Llega 15 minutos tarde por clase, disponible todo el bloque..."
              className="w-full min-h-[44px] px-3.5 py-2 bg-tinta-50 text-tinta-900 rounded-xl border border-tinta-300 focus:outline-hidden focus:border-lila-600 text-xs"
            />
          </div>

          {/* Real-time Pre-Save Warning if Assigned Shifts are Unchecked */}
          {assignmentsAtRiskOfRemoval.length > 0 && selectedPerson && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3 animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <strong className="font-bold text-amber-950 font-display tracking-wide text-xs">
                    AVISO: DESASIGNACIÓN AUTOMÁTICA AL GUARDAR
                  </strong>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 text-[10px] font-bold font-mono">
                    {assignmentsAtRiskOfRemoval.length} {assignmentsAtRiskOfRemoval.length === 1 ? 'turno afectado' : 'turnos afectados'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Has desmarcado la disponibilidad de <strong>{selectedPerson.name}</strong> en {assignmentsAtRiskOfRemoval.length === 1 ? 'un turno donde tiene una asignación activa' : `${assignmentsAtRiskOfRemoval.length} turnos donde tiene asignaciones activas`}. Al hacer clic en <strong>GUARDAR DISPONIBILIDAD</strong>, el sistema lo <strong>retirará automáticamente del turno</strong> y su cupo quedará libre:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  {assignmentsAtRiskOfRemoval.map((a) => {
                    const sObj = lookupShift(a.shiftId);
                    return (
                      <div
                        key={a.id}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-100/70 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between gap-2"
                      >
                        <span className="font-semibold truncate">
                          {sObj?.name || a.shiftId} {sObj?.label ? `(${sObj.label})` : ''}
                        </span>
                        <span className="text-[10px] text-amber-800 font-mono shrink-0">
                          {a.baseName || (a.baseNumber !== undefined ? `Base ${a.baseNumber}` : a.assignedType || '')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-between pt-3 border-t border-tinta-200">
            <div>
              {saveMessage && (
                <span className="text-xs font-bold text-turquesa-600 animate-in fade-in flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-turquesa-600" />
                  <span>{saveMessage}</span>
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={people.length === 0}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-lila-600 hover:bg-lila-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all font-display tracking-wider cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>GUARDAR DISPONIBILIDAD</span>
            </button>
          </div>
        </form>
      </div>

      {/* Deassignment Alert Notification Modal */}
      {deassignedNotice && (
        <div className="fixed inset-0 z-50 bg-tinta-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-tinta-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <UserMinus className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-tinta-900 font-display tracking-wider">
                  DESASIGNACIÓN AUTOMÁTICA
                </h3>
                <p className="text-[11px] text-tinta-500 mt-0.5">
                  Turnos actualizados y cupos liberados con éxito.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeassignedNotice(null)}
                className="text-tinta-400 hover:text-tinta-900 p-1 rounded-xl transition-colors cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed">
              Al retirar la disponibilidad de <strong>{deassignedNotice.personName}</strong>, se le retiró automáticamente de <strong>{deassignedNotice.items.length} {deassignedNotice.items.length === 1 ? 'turno asignado' : 'turnos asignados'}</strong>:
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 divide-y divide-tinta-50">
              {deassignedNotice.items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-white border border-tinta-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-tinta-900 flex items-center gap-1.5 truncate">
                      <span>{item.shiftName}</span>
                      {item.shiftLabel && (
                        <span className="text-[10px] font-mono text-tinta-500 font-normal">
                          • {item.shiftLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-tinta-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>Día: <strong>{item.dayName}</strong></span>
                      {item.baseName && (
                        <span>• <strong>{item.baseName}</strong></span>
                      )}
                      {item.assignedFunction && (
                        <span>• Función: <em>{item.assignedFunction}</em></span>
                      )}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 shrink-0 font-mono">
                    Cupo libre
                  </span>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-tinta-500 bg-tinta-50 p-3 rounded-xl border border-tinta-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Los cupos ya están disponibles de inmediato para asignar a otros integrantes.</span>
            </div>

            <div className="pt-2 border-t border-tinta-200 flex items-center justify-end gap-2">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setDeassignedNotice(null);
                    onNavigate('assignments');
                  }}
                  className="px-4 py-2 rounded-xl bg-tinta-50 border border-tinta-200 text-xs font-bold text-tinta-900 hover:bg-tinta-100 transition-all cursor-pointer"
                >
                  Ir a Asignaciones
                </button>
              )}
              <button
                type="button"
                onClick={() => setDeassignedNotice(null)}
                className="px-5 py-2.5 rounded-xl bg-lila-600 hover:bg-lila-700 text-white text-xs font-bold font-display tracking-wider transition-all cursor-pointer shadow-xs"
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
