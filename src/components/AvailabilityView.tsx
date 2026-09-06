import React, { useState } from 'react';
import { Person, AvailabilityRecord } from '../types';
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
} from 'lucide-react';

interface AvailabilityViewProps {
  people: Person[];
  availabilities: AvailabilityRecord[];
}

export const AvailabilityView: React.FC<AvailabilityViewProps> = ({
  people,
  availabilities,
}) => {
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [selectedDayId, setSelectedDayId] = useState<string>('miercoles');
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const selectedPerson = people.find((p) => p.id === selectedPersonId);

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

  const currentDay = EVENT_SCHEDULE.find((d) => d.dayId === selectedDayId) || EVENT_SCHEDULE[0];
  const isCarnival = currentDay.isCarnival;

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
              <label className="block text-xs font-semibold text-[#334155] mb-1.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#B83A24]" />
                <span>Integrante / Staff *</span>
              </label>
              {people.length === 0 ? (
                <div className="p-3 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] text-xs text-[#64748B]">
                  No hay personas registradas aún. Agregue personas en la pestaña de Personas o mediante Importación Excel.
                </div>
              ) : (
                <select
                  value={selectedPersonId}
                  onChange={(e) => handlePersonOrDayChange(e.target.value, selectedDayId)}
                  required
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#FAF6EC] text-[#182535] rounded-xl border border-[#E5DAC0] focus:outline-hidden focus:border-[#B83A24] text-xs font-medium"
                >
                  <option value="">-- Seleccionar Integrante --</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.primaryType}) - Cédula: {p.documentId}
                    </option>
                  ))}
                </select>
              )}
              {selectedPerson && (
                <div className="mt-1.5 text-[11px] text-[#B83A24] flex items-center gap-1.5">
                  <span className="font-semibold text-[#64748B]">Tipo registrado:</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#FDF2EE] text-[#B83A24] font-bold border border-[#F6C7BA]">
                    {selectedPerson.primaryType}
                  </span>
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
                  {selectedPerson?.primaryType === 'GT' &&
                    ' Como este integrante es GT, se presentan sus 5 turnos oficiales.'}
                  {selectedPerson?.primaryType === 'MESA' &&
                    ' Como integrante de MESA, puede seleccionar cualquier turno válido de GT o GAP.'}
                </p>
              </div>

              {/* GAP SHIFTS (Shown if GAP, MESA, or no person selected) */}
              {(!selectedPerson || selectedPerson.primaryType === 'GAP' || selectedPerson.primaryType === 'MESA') && (
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

              {/* GT SHIFTS (Shown if GT, MESA, or no person selected) */}
              {(!selectedPerson || selectedPerson.primaryType === 'GT' || selectedPerson.primaryType === 'MESA') && (
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
                    onClick={() => setSelectedShifts(currentDay.shifts.map((s) => s.id))}
                    className="text-[11px] font-bold text-[#B83A24] hover:underline"
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
                {currentDay.shifts.map((shift) => {
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
                          <span className="text-[10px] font-mono text-[#64748B]">
                            {shift.startTime} - {shift.endTime}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-[#182535] mt-1 font-mono tracking-tight">
                          {shift.label}
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-1">
                          Apto para: {shift.forTypes.join(' / ')}
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
