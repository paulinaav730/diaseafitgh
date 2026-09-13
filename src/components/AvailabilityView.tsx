import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Person, AvailabilityRecord, ConfigurableShift, Shift } from '../types';
import {
  EVENT_SCHEDULE,
  CARNIVAL_GT_SHIFTS,
  CARNIVAL_GAP_SHIFTS,
  findShiftById,
} from '../data/eventStructure';
import { saveAvailability } from '../services/storageService';
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
} from 'lucide-react';

interface AvailabilityViewProps {
  people: Person[];
  availabilities: AvailabilityRecord[];
  shifts?: (ConfigurableShift | Shift)[];
}

export const AvailabilityView: React.FC<AvailabilityViewProps> = ({
  people,
  availabilities,
  shifts,
}) => {
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [selectedDayId, setSelectedDayId] = useState<string>('miercoles');
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
    return sortedPeople.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchDoc = p.documentId ? p.documentId.toLowerCase().includes(q) : false;
      const matchSub = p.gtSubTeam ? p.gtSubTeam.toLowerCase().includes(q) : false;
      const matchType = p.primaryType ? p.primaryType.toLowerCase().includes(q) : false;
      return matchName || matchDoc || matchSub || matchType;
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
    if (configuredMesa.length > 0) {
      return configuredMesa;
    }
    return CARNIVAL_GT_SHIFTS.map((s) => ({
      ...s,
      category: 'MESA' as const,
      forTypes: ['MESA' as const],
    }));
  }, [shifts]);

  // Non-Carnival day shifts
  const currentDayShifts = useMemo(() => {
    const configured = (shifts || []).filter(
      (s) => s.dayId === selectedDayId && s.isActive !== false
    );
    if (configured.length > 0) {
      return configured;
    }
    return currentDay.shifts;
  }, [shifts, selectedDayId, currentDay]);

  // When person or day changes, prefill current availability if already saved
  const handlePersonOrDayChange = (personId: string, dayId: string) => {
    setSelectedPersonId(personId);
    setSelectedDayId(dayId);
    setSaveMessage(null);

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
      await saveAvailability(selectedPersonId, selectedDayId, selectedShifts, notes);
      setSaveMessage('✓ Disponibilidad guardada correctamente.');
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err) {
      console.error(err);
      alert('Error al guardar la disponibilidad.');
    }
  };

  return (
    <div className="space-y-6 text-[#182535]">
      {/* Header */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-2xs">
        <h2 className="text-xl sm:text-2xl font-bold text-[#182535] tracking-wide font-dalek">
          REGISTRO DE DISPONIBILIDAD
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 font-montserrat">
          Registro por turno específico exacto. En CARNIVAL se diferencian estrictamente los 5 turnos de GT y los 3 turnos de GAP.
        </p>
      </div>

      {/* Form Container */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-2xs">
        <form onSubmit={handleSave} className="space-y-6 font-montserrat">
          {/* Person & Day selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#334155] flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#B83A24]" />
                  <span>Integrante / Staff *</span>
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
                    className="text-[11px] text-[#B83A24] hover:underline cursor-pointer flex items-center gap-1 font-medium"
                  >
                    <X className="w-3 h-3" />
                    Cambiar integrante
                  </button>
                )}
              </div>

              {people.length === 0 ? (
                <div className="p-3 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] text-xs text-[#64748B]">
                  No hay personas registradas aún. Agregue personas en la pestaña de Personas o mediante Importación Excel.
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Searchable input with Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <div className="relative flex items-center">
                      <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder={
                          selectedPerson
                            ? `Buscar o cambiar integrante... (Actual: ${selectedPerson.name})`
                            : "Escribe nombre, cédula o subequipo..."
                        }
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
                            setPersonSearchQuery('');
                          } else if (e.key === 'Escape') {
                            setIsPersonDropdownOpen(false);
                          }
                        }}
                        className="w-full min-h-[44px] pl-10 pr-16 py-2.5 bg-[#FAF6EC] text-[#182535] rounded-xl border border-[#E5DAC0] focus:outline-hidden focus:border-[#B83A24] text-xs font-medium placeholder:text-[#94A3B8]"
                      />

                      <div className="absolute right-2.5 flex items-center gap-1">
                        {personSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setPersonSearchQuery('');
                              searchInputRef.current?.focus();
                            }}
                            className="text-[#94A3B8] hover:text-[#182535] p-1 cursor-pointer"
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
                          className="text-[#94A3B8] hover:text-[#182535] p-1 cursor-pointer"
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
                      <div className="absolute z-40 left-0 right-0 mt-1.5 bg-[#FFFDF8] border border-[#EADDC7] rounded-2xl shadow-xl max-h-64 overflow-y-auto p-1.5 divide-y divide-[#FAF6EC]">
                        {filteredPeople.length === 0 ? (
                          <div className="p-4 text-center text-xs text-[#94A3B8]">
                            No se encontraron integrantes con &quot;{personSearchQuery}&quot;
                          </div>
                        ) : (
                          filteredPeople.slice(0, 60).map((p) => {
                            const isSelected = p.id === selectedPersonId;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  handlePersonOrDayChange(p.id, selectedDayId);
                                  setIsPersonDropdownOpen(false);
                                  setPersonSearchQuery('');
                                }}
                                className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#FDF2EE] border border-[#F6C7BA]'
                                    : 'hover:bg-[#FAF6EC]'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs text-[#182535] font-bold truncate flex items-center gap-1.5">
                                    <span>{p.name}</span>
                                    {p.primaryType === 'MESA' && (
                                      <Crown className="w-3 h-3 text-purple-700 shrink-0" />
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#64748B] flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span
                                      className={`px-1.5 py-0.5 rounded font-bold text-[9px] border ${
                                        p.primaryType === 'MESA'
                                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                                          : p.primaryType === 'GAP'
                                          ? 'bg-[#FDF2EE] text-[#B83A24] border-[#F6C7BA]'
                                          : 'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}
                                    >
                                      {p.primaryType}
                                    </span>
                                    {p.gtSubTeam && (
                                      <span className="text-[10px] text-[#475569] font-medium">
                                        • {p.gtSubTeam}
                                      </span>
                                    )}
                                    {p.documentId && (
                                      <span className="text-[10px] text-[#64748B] font-mono">
                                        • CC: {p.documentId}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected ? (
                                  <div className="w-5 h-5 rounded-full bg-[#B83A24] text-white flex items-center justify-center shrink-0">
                                    <Check className="w-3.5 h-3.5" />
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-[#94A3B8] font-medium shrink-0">
                                    Seleccionar
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                        {filteredPeople.length > 60 && (
                          <div className="p-2 text-center text-[11px] text-[#64748B] bg-[#FAF6EC] rounded-xl mt-1">
                            Mostrando los primeros 60 de {filteredPeople.length} integrantes. Escribe para afinar la búsqueda.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Person Info Card */}
                  {selectedPerson ? (
                    <div className="p-3 bg-[#FAF6EC] border border-[#E5DAC0] rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                            selectedPerson.primaryType === 'MESA'
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : selectedPerson.primaryType === 'GAP'
                              ? 'bg-[#FDF2EE] text-[#B83A24] border-[#F6C7BA]'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        >
                          {selectedPerson.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#182535] truncate flex items-center gap-1.5">
                            <span>{selectedPerson.name}</span>
                            {selectedPerson.primaryType === 'MESA' && (
                              <Crown className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-[#64748B] flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold text-[9px] border ${
                                selectedPerson.primaryType === 'MESA'
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : selectedPerson.primaryType === 'GAP'
                                  ? 'bg-[#FDF2EE] text-[#B83A24] border-[#F6C7BA]'
                                  : 'bg-blue-100 text-blue-800 border-blue-200'
                              }`}
                            >
                              {selectedPerson.primaryType}
                            </span>
                            {selectedPerson.gtSubTeam && (
                              <span className="text-[10px] text-[#475569] font-medium">
                                Subequipo: {selectedPerson.gtSubTeam}
                              </span>
                            )}
                            {selectedPerson.documentId && (
                              <span className="text-[10px] text-[#64748B] font-mono">
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
                        className="px-2.5 py-1.5 rounded-xl bg-white border border-[#E5DAC0] text-xs font-bold text-[#182535] hover:border-[#B83A24] hover:text-[#B83A24] transition-all cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
                      >
                        <Search className="w-3 h-3" />
                        Buscar otro
                      </button>
                    </div>
                  ) : (
                    <div className="px-3 py-2 bg-[#FAF6EC]/60 border border-dashed border-[#E5DAC0] rounded-xl text-[11px] text-[#64748B] flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-[#C87F17] shrink-0" />
                      <span>Escribe el nombre o cédula arriba para seleccionar al integrante.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#C87F17]" />
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
                        ? 'bg-[#B83A24] text-white shadow-xs font-dalek'
                        : 'bg-[#FAF6EC] text-[#64748B] hover:text-[#182535] hover:bg-[#F3EEDC] border border-[#EADDC7]'
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
            <div className="pt-4 border-t border-[#EADDC7] space-y-6">
              <div className="p-4 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] text-xs">
                <h4 className="font-bold text-[#182535] font-dalek tracking-wider flex items-center gap-2">
                  <span>CARNIVAL — ESTRUCTURA DE TURNOS POR ROL</span>
                </h4>
                <p className="text-[#64748B] text-[11px] mt-1 leading-relaxed">
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
                  <div className="flex items-center justify-between pb-2 border-b border-[#EADDC7]">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-[#FDF2EE] text-[#B83A24]">
                        <Grid className="w-4 h-4" />
                      </span>
                      <h4 className="text-sm font-bold text-[#182535] font-dalek tracking-wider">
                        CARNIVAL — GAP (3 TURNOS OFICIALES)
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FDF2EE] text-[#B83A24] font-mono font-bold border border-[#F6C7BA]">
                        30 BASES FÍSICAS
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const gapIds = CARNIVAL_GAP_SHIFTS.map((s) => s.id);
                          const remaining = selectedShifts.filter((id) => !gapIds.includes(id));
                          setSelectedShifts([...remaining, ...gapIds]);
                        }}
                        className="text-[11px] font-bold text-[#B83A24] hover:underline"
                      >
                        Marcar 3 de GAP
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {CARNIVAL_GAP_SHIFTS.map((shift) => {
                      const isChecked = selectedShifts.includes(shift.id);
                      return (
                        <div
                          key={shift.id}
                          onClick={() => handleToggleShift(shift.id)}
                          className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-start gap-3 select-none ${
                            isChecked
                              ? 'bg-[#FDF2EE] border-[#B83A24] shadow-xs'
                              : 'bg-[#FAF6EC] border-[#EADDC7] text-[#64748B] hover:border-[#B83A24]/40 hover:bg-[#FFFDF8]'
                          }`}
                        >
                          <div className="mt-0.5 text-[#B83A24]">
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-[#B83A24]" />
                            ) : (
                              <Square className="w-5 h-5 text-[#94A3B8]" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-[#182535]">{shift.name}</span>
                              <span className="text-[10px] font-mono text-[#B83A24] font-bold">GAP</span>
                            </div>
                            <div className="text-sm font-bold text-[#182535] mt-1 font-mono">
                              {shift.label}
                            </div>
                            <div className="text-[10px] text-[#64748B] mt-1">
                              30 Bases físicas compartidas
                            </div>
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
                  <div className="flex items-center justify-between pb-2 border-b border-[#EADDC7]">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-[#FAF6EC] text-[#182535]">
                        <Shield className="w-4 h-4" />
                      </span>
                      <h4 className="text-sm font-bold text-[#182535] font-dalek tracking-wider">
                        CARNIVAL — GT (5 TURNOS OFICIALES)
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#182535] text-white font-mono font-bold">
                        STAFF GENERAL
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const gtIds = CARNIVAL_GT_SHIFTS.map((s) => s.id);
                          const remaining = selectedShifts.filter((id) => !gtIds.includes(id));
                          setSelectedShifts([...remaining, ...gtIds]);
                        }}
                        className="text-[11px] font-bold text-[#182535] hover:underline"
                      >
                        Marcar 5 de GT
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {CARNIVAL_GT_SHIFTS.map((shift) => {
                      const isChecked = selectedShifts.includes(shift.id);
                      return (
                        <div
                          key={shift.id}
                          onClick={() => handleToggleShift(shift.id)}
                          className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-start gap-3 select-none ${
                            isChecked
                              ? 'bg-[#FAF6EC] border-[#182535] shadow-xs'
                              : 'bg-[#FAF6EC] border-[#EADDC7] text-[#64748B] hover:border-[#182535]/40 hover:bg-[#FFFDF8]'
                          }`}
                        >
                          <div className="mt-0.5 text-[#182535]">
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-[#182535]" />
                            ) : (
                              <Square className="w-5 h-5 text-[#94A3B8]" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-[#182535]">{shift.name}</span>
                              <span className="text-[10px] font-mono text-[#182535] font-bold">GT</span>
                            </div>
                            <div className="text-sm font-bold text-[#182535] mt-1 font-mono">
                              {shift.label}
                            </div>
                            <div className="text-[10px] text-[#64748B] mt-1">
                              Staff general campus
                            </div>
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
                  <div className="flex items-center justify-between pb-2 border-b border-[#EADDC7]">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-purple-100 text-purple-700">
                        <Crown className="w-4 h-4" />
                      </span>
                      <h4 className="text-sm font-bold text-[#182535] font-dalek tracking-wider">
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
                              : 'bg-[#FAF6EC] border-[#EADDC7] text-[#64748B] hover:border-purple-400 hover:bg-[#FFFDF8]'
                          }`}
                        >
                          <div className="mt-0.5 text-purple-700">
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-purple-700" />
                            ) : (
                              <Square className="w-5 h-5 text-[#94A3B8]" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-[#182535]">{shift.name}</span>
                              <span className="text-[10px] font-mono text-purple-700 font-bold bg-purple-100 px-1.5 py-0.5 rounded">
                                MESA
                              </span>
                            </div>
                            <div className="text-sm font-bold text-[#182535] mt-1 font-mono">
                              {shift.label}
                            </div>
                            <div className="text-[10px] text-[#64748B] mt-1">
                              {shift.startTime} - {shift.endTime} • Coordinación General
                            </div>
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
            <div className="pt-2 border-t border-[#EADDC7]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-[#182535] flex items-center gap-2 font-dalek tracking-wider">
                    <span>TURNOS PARA {currentDay.dayName.toUpperCase()}: {currentDay.eventName}</span>
                    {selectedDayId === 'lunes' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] font-semibold font-montserrat">
                        5 Turnos Definitivos
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Seleccione los turnos en los que este integrante puede participar:
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedShifts(currentDayShifts.map((s) => s.id))}
                    className={`text-[11px] font-bold hover:underline ${
                      selectedPerson?.primaryType === 'MESA' ? 'text-purple-700' : 'text-[#B83A24]'
                    }`}
                  >
                    Marcar todos
                  </button>
                  <span className="text-[#CBD5E1]">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedShifts([])}
                    className="text-[11px] font-medium text-[#64748B] hover:text-[#182535]"
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
                            : 'bg-[#FDF2EE] border-[#B83A24] shadow-xs'
                          : 'bg-[#FAF6EC] border-[#EADDC7] text-[#64748B] hover:border-[#B83A24]/40 hover:bg-[#FFFDF8]'
                      }`}
                    >
                      <div className={`mt-0.5 ${isMesaPerson ? 'text-purple-700' : 'text-[#B83A24]'}`}>
                        {isChecked ? (
                          <CheckSquare className={`w-5 h-5 ${isMesaPerson ? 'text-purple-700' : 'text-[#B83A24]'}`} />
                        ) : (
                          <Square className="w-5 h-5 text-[#94A3B8]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#182535]">{shift.name}</span>
                          <span className="text-[10px] font-mono text-[#64748B]">
                            {shift.startTime} - {shift.endTime}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-[#182535] mt-1 font-mono tracking-tight">
                          {shift.label}
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-1">
                          {isMesaPerson ? 'Apto para: MESA' : `Apto para: ${(shift.forTypes || ['GT']).join(' / ')}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#334155] mb-1">
              Observaciones de Disponibilidad (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Llega 15 minutos tarde por clase, disponible todo el bloque..."
              className="w-full min-h-[44px] px-3.5 py-2 bg-[#FAF6EC] text-[#182535] rounded-xl border border-[#E5DAC0] focus:outline-hidden focus:border-[#B83A24] text-xs"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-3 border-t border-[#EADDC7]">
            <div>
              {saveMessage && (
                <span className="text-xs font-bold text-[#16A34A] animate-in fade-in">
                  {saveMessage}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={people.length === 0}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#B83A24] hover:bg-[#9E2F1B] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all font-dalek tracking-wider"
            >
              <Check className="w-4 h-4" />
              <span>GUARDAR DISPONIBILIDAD</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
