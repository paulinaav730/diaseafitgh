import React, { useState } from 'react';
import { Person, Assignment, AttendanceRecord, AttendanceStatus } from '../types';
import { EVENT_SCHEDULE, getBaseDisplayName, findShiftById } from '../data/eventStructure';
import { recordAttendance } from '../services/storageService';
import { CheckCircle2, XCircle, Clock, AlertCircle, Calendar, Users, Filter } from 'lucide-react';

interface AttendanceViewProps {
  people: Person[];
  assignments: Assignment[];
  attendances: AttendanceRecord[];
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  people,
  assignments,
  attendances,
}) => {
  const [selectedDayId, setSelectedDayId] = useState<string>('miercoles');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('miercoles-gt-t1');

  const currentDay = EVENT_SCHEDULE.find((d) => d.dayId === selectedDayId) || EVENT_SCHEDULE[0];
  const activeShift =
    currentDay.shifts.find((s) => s.id === selectedShiftId) || currentDay.shifts[0];

  const handleDaySelect = (dayId: string) => {
    setSelectedDayId(dayId);
    const dayObj = EVENT_SCHEDULE.find((d) => d.dayId === dayId);
    if (dayObj && dayObj.shifts.length > 0) {
      setSelectedShiftId(dayObj.shifts[0].id);
    }
  };

  const handleMark = async (personId: string, status: AttendanceStatus) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await recordAttendance({
      personId,
      dayId: selectedDayId,
      shiftId: activeShift.id,
      status,
      checkInTime: status === 'asistio' || status === 'tarde' || status === 'retiro_antes' ? timeStr : undefined,
    });
  };

  // Filter assignments for this shift
  const shiftAssignments = assignments.filter(
    (a) => a.dayId === selectedDayId && a.shiftId === activeShift.id
  );

  // Stats
  const shiftAttendances = attendances.filter(
    (at) => at.dayId === selectedDayId && at.shiftId === activeShift.id
  );
  const presentCount = shiftAttendances.filter((at) => at.status === 'asistio').length;
  const lateCount = shiftAttendances.filter((at) => at.status === 'tarde').length;
  const earlyCount = shiftAttendances.filter((at) => at.status === 'retiro_antes').length;
  const absentCount = shiftAttendances.filter((at) => at.status === 'inasistencia').length;
  const pendingCount = shiftAssignments.length - (presentCount + lateCount + earlyCount + absentCount);

  return (
    <div className="space-y-6 text-[#182535]">
      {/* Header */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-2xs">
        <h2 className="text-xl sm:text-2xl font-bold text-[#182535] tracking-wide font-dalek">
          CONTROL DE ASISTENCIA
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-montserrat">
          Marcación y verificación de asistencia en tiempo real por día y turno.
        </p>
      </div>

      {/* Selectors Bar */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        {/* Days */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {EVENT_SCHEDULE.map((d) => (
            <button
              key={d.dayId}
              onClick={() => handleDaySelect(d.dayId)}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wider transition-all whitespace-nowrap ${
                selectedDayId === d.dayId
                  ? 'bg-[#B83A24] text-white shadow-xs font-dalek'
                  : 'bg-[#FAF6EC] text-[#64748B] hover:text-[#182535] hover:bg-[#F3EEDC] font-montserrat border border-[#EADDC7]'
              }`}
            >
              {d.dayName}
            </button>
          ))}
        </div>

        {/* Shifts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {currentDay.shifts.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedShiftId(s.id)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
                activeShift.id === s.id
                  ? 'bg-[#FDF2EE] text-[#B83A24] border-[#B83A24] font-bold shadow-2xs'
                  : 'bg-[#FAF6EC] text-[#64748B] border-[#EADDC7] hover:text-[#182535]'
              }`}
            >
              {s.category && (
                <span
                  className={`mr-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    s.category === 'GAP'
                      ? 'bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A]'
                      : 'bg-[#182535] text-white'
                  }`}
                >
                  {s.category}
                </span>
              )}
              {s.name} ({s.label})
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI for this shift */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[#FFFDF8] border border-[#EADDC7] p-4 rounded-2xl shadow-2xs">
          <span className="text-[11px] text-[#64748B] uppercase font-semibold">Convocados</span>
          <div className="text-xl sm:text-2xl font-bold text-[#182535] mt-1 font-mono">{shiftAssignments.length}</div>
        </div>
        <div className="bg-[#FFFDF8] border border-[#BBF7D0] p-4 rounded-2xl shadow-2xs">
          <span className="text-[11px] text-[#16A34A] font-semibold uppercase">Asistió</span>
          <div className="text-xl sm:text-2xl font-bold text-[#16A34A] mt-1 font-mono">{presentCount}</div>
        </div>
        <div className="bg-[#FFFDF8] border border-[#FDE68A] p-4 rounded-2xl shadow-2xs">
          <span className="text-[11px] text-[#C87F17] font-semibold uppercase">Llegó Tarde</span>
          <div className="text-xl sm:text-2xl font-bold text-[#C87F17] mt-1 font-mono">{lateCount}</div>
        </div>
        <div className="bg-[#FFFDF8] border border-purple-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-[11px] text-purple-600 font-semibold uppercase">Se Retiró Antes</span>
          <div className="text-xl sm:text-2xl font-bold text-purple-700 mt-1 font-mono">{earlyCount}</div>
        </div>
        <div className="bg-[#FFFDF8] border border-[#F6C7BA] p-4 rounded-2xl shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] text-[#B83A24] font-semibold uppercase">Inasistencia</span>
          <div className="text-xl sm:text-2xl font-bold text-[#B83A24] mt-1 font-mono">{absentCount}</div>
        </div>
      </div>

      {/* Attendance List */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 border-b border-[#EADDC7] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-bold text-[#182535] font-dalek tracking-wide">
            LISTADO: {currentDay.eventName} — {activeShift.name} ({activeShift.label})
          </h3>
          <span className="text-xs text-[#64748B] font-mono bg-[#FAF6EC] px-2.5 py-1 rounded-xl border border-[#EADDC7] w-fit">
            {shiftAttendances.length} de {shiftAssignments.length} marcados
          </span>
        </div>

        {shiftAssignments.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B]">
            <Users className="w-10 h-10 text-[#C87F17] mx-auto mb-3" />
            <p className="font-semibold text-[#182535] text-sm font-dalek">0 personas asignadas a este turno</p>
            <p className="text-xs text-[#94A3B8] mt-1 font-montserrat">
              Asigne integrantes en la pestaña de Turnos y Bases para habilitar el pase de asistencia.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EADDC7]">
            {shiftAssignments.map((assign) => {
              const person = people.find((p) => p.id === assign.personId);
              const attendance = attendances.find(
                (at) =>
                  at.personId === assign.personId &&
                  at.dayId === selectedDayId &&
                  at.shiftId === activeShift.id
              );
              const status = attendance?.status || 'pendiente';

              return (
                <div
                  key={assign.id}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#FAF6EC]/50 transition-colors"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm sm:text-base text-[#182535]">{person?.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-[#FAF6EC] text-[#64748B] border border-[#EADDC7]">
                        {person?.documentId}
                      </span>
                      {assign.baseNumber && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-[#FDF2EE] text-[#B83A24] font-bold border border-[#F6C7BA]">
                          {assign.baseName || getBaseDisplayName(assign.baseNumber)}
                        </span>
                      )}
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                          status === 'asistio'
                            ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
                            : status === 'tarde'
                            ? 'bg-[#FEF8EC] text-[#C87F17] border-[#FDE68A]'
                            : status === 'retiro_antes'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : status === 'inasistencia'
                            ? 'bg-[#FDF2EE] text-[#B83A24] border-[#F6C7BA]'
                            : 'bg-[#FAF6EC] text-[#64748B] border-[#EADDC7]'
                        }`}
                      >
                        {status === 'asistio'
                          ? 'Asistió'
                          : status === 'tarde'
                          ? 'Llegó Tarde'
                          : status === 'retiro_antes'
                          ? 'Se retiró antes'
                          : status === 'inasistencia'
                          ? 'Inasistencia'
                          : 'Pendiente'}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-1 flex flex-wrap items-center gap-2">
                      <span>{assign.roleInBase || 'Staff'}</span>
                      <span>•</span>
                      <span>Rol: {person?.primaryType}</span>
                      {attendance?.checkInTime && (
                        <>
                          <span>•</span>
                          <span className="text-[#16A34A] font-mono text-xs font-bold">
                            Marcado: {attendance.checkInTime}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions status buttons - Touch friendly min-height 44px */}
                  <div className="flex flex-wrap items-center gap-1.5 self-start lg:self-center">
                    <button
                      onClick={() => handleMark(assign.personId, 'asistio')}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        status === 'asistio'
                          ? 'bg-[#16A34A] text-white shadow-xs'
                          : 'bg-[#FAF6EC] text-[#334155] border border-[#EADDC7] hover:border-[#16A34A]'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A] group-hover:text-white" />
                      <span>Asistió</span>
                    </button>

                    <button
                      onClick={() => handleMark(assign.personId, 'tarde')}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        status === 'tarde'
                          ? 'bg-[#C87F17] text-white shadow-xs'
                          : 'bg-[#FAF6EC] text-[#334155] border border-[#EADDC7] hover:border-[#C87F17]'
                      }`}
                    >
                      <Clock className="w-4 h-4 text-[#C87F17]" />
                      <span>Llegó Tarde</span>
                    </button>

                    <button
                      onClick={() => handleMark(assign.personId, 'retiro_antes')}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        status === 'retiro_antes'
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'bg-[#FAF6EC] text-[#334155] border border-[#EADDC7] hover:border-purple-600'
                      }`}
                    >
                      <AlertCircle className="w-4 h-4 text-purple-600" />
                      <span>Se Retiró Antes</span>
                    </button>

                    <button
                      onClick={() => handleMark(assign.personId, 'inasistencia')}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        status === 'inasistencia'
                          ? 'bg-[#B83A24] text-white shadow-xs'
                          : 'bg-[#FAF6EC] text-[#334155] border border-[#EADDC7] hover:border-[#B83A24]'
                      }`}
                    >
                      <XCircle className="w-4 h-4 text-[#B83A24]" />
                      <span>Inasistencia</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
