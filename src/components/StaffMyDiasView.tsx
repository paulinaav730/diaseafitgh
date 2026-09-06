import React, { useState } from 'react';
import { Person, Assignment, AttendanceRecord } from '../types';
import { EVENT_SCHEDULE, getBaseDisplayName, findShiftById } from '../data/eventStructure';
import {
  User,
  Calendar,
  Clock,
  MapPin,
  Utensils,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ShieldCheck,
  Award,
} from 'lucide-react';

interface StaffMyDiasViewProps {
  person: Person;
  assignments: Assignment[];
  attendances: AttendanceRecord[];
  onLogout: () => void;
}

export const StaffMyDiasView: React.FC<StaffMyDiasViewProps> = ({
  person,
  assignments,
  attendances,
  onLogout,
}) => {
  const [activeDayId, setActiveDayId] = useState<string>('lunes');

  // Filter only this staff person's assignments
  const myAssignments = assignments.filter((a) => a.personId === person.id);

  // Helper to calculate shift duration in minutes
  const getShiftDurationMinutes = (startTime: string, endTime: string): number => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startTotal = startH * 60 + (startM || 0);
    const endTotal = endH * 60 + (endM || 0);
    return Math.max(0, endTotal - startTotal);
  };

  // Compute daily totals and food entitlements for this person
  const getDailySummary = (dayId: string) => {
    const dayDef = EVENT_SCHEDULE.find((d) => d.dayId === dayId);
    if (!dayDef) return { totalHours: 0, lunches: 0, snacks: 0, dayAssignments: [] };

    const dayAssignments = myAssignments.filter((a) => a.dayId === dayId);
    let totalMinutes = 0;

    dayAssignments.forEach((asgn) => {
      const shiftDef = findShiftById(dayDef, asgn.shiftId);
      if (shiftDef) {
        totalMinutes += getShiftDurationMinutes(shiftDef.startTime, shiftDef.endTime);
      }
    });

    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    let lunches = 0;
    let snacks = 0;

    if (totalHours >= 9) {
      lunches = 1;
      snacks = 2;
    } else if (totalHours >= 6) {
      lunches = 1;
      snacks = 1;
    } else if (totalHours >= 3) {
      lunches = 0;
      snacks = 1;
    }

    return { totalHours, lunches, snacks, dayAssignments, dayDef };
  };

  const currentDaySummary = getDailySummary(activeDayId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Welcome Card */}
      <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden text-[#182535]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FEF8EC] border border-[#E5A12E]/40 text-[#C87F17] text-xs font-bold uppercase tracking-wider font-montserrat">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Portal de Staff • DÍAS EAFIT</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#182535] font-dalek tracking-wider">
              HOLA, {person.name.toUpperCase()}
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] font-montserrat">
              Consulta tu horario oficial, bases asignadas, alimentación y registro de asistencia.
            </p>
          </div>

          <button
            onClick={onLogout}
            className="min-h-[44px] self-start sm:self-center px-4 py-2.5 rounded-2xl bg-[#FDF2EE] hover:bg-[#FBE4DD] text-[#B83A24] border border-[#F6C7BA] text-xs font-bold flex items-center gap-2 transition-all shadow-2xs font-montserrat"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#EADDC7] text-xs font-montserrat">
          <div>
            <span className="text-[#64748B] text-[11px] block">Cédula</span>
            <span className="font-mono font-bold text-[#182535] text-sm">{person.documentId}</span>
          </div>
          <div>
            <span className="text-[#64748B] text-[11px] block">Tipo de Staff</span>
            <span
              className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-md font-bold text-xs ${
                person.primaryType === 'GT'
                  ? 'bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA]'
                  : person.primaryType === 'GAP'
                  ? 'bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A]'
                  : 'bg-purple-50 text-purple-700 border border-purple-200'
              }`}
            >
              {person.primaryType} {person.roleTitle ? `• ${person.roleTitle}` : ''}
            </span>
          </div>
          <div>
            <span className="text-[#64748B] text-[11px] block">Talla de Camiseta</span>
            <span className="font-bold text-[#182535] text-sm">{person.shirtSize || 'No registrada'}</span>
          </div>
          <div>
            <span className="text-[#64748B] text-[11px] block">Restricción Alimentaria</span>
            <span className="font-semibold text-[#182535] text-xs truncate block" title={person.dietaryRestrictions}>
              {person.dietaryRestrictions || 'Ninguna'}
            </span>
          </div>
        </div>
      </div>

      {/* Week Selector Tabs */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-2xl p-2 flex items-center gap-2 overflow-x-auto shadow-2xs scrollbar-none">
        {EVENT_SCHEDULE.map((day) => {
          const summary = getDailySummary(day.dayId);
          const hasTurnos = summary.dayAssignments.length > 0;
          const isActive = activeDayId === day.dayId;

          return (
            <button
              key={day.dayId}
              onClick={() => setActiveDayId(day.dayId)}
              className={`min-h-[44px] flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                isActive
                  ? 'bg-[#B83A24] text-white shadow-xs font-dalek'
                  : 'text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC] font-montserrat'
              }`}
            >
              <span className="uppercase tracking-wider">{day.dayName}</span>
              <span className="text-[10px] font-normal opacity-85 font-mono">
                {hasTurnos ? `${summary.dayAssignments.length} turno(s) • ${summary.totalHours}h` : 'Libre'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Day View */}
      <div className="space-y-4">
        {/* Day Header & Food Entitlement Bar */}
        <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C87F17] font-montserrat">
                {currentDaySummary.dayDef?.dayName}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-[#FDF2EE] text-[#B83A24] font-bold border border-[#F6C7BA]">
                {currentDaySummary.dayDef?.eventName}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#182535] font-dalek tracking-wide mt-1">
              {currentDaySummary.dayDef?.description}
            </h2>
          </div>

          {/* Alimentación badge for this day */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-[#FAF6EC] border border-[#E5DAC0] px-3.5 py-2 rounded-2xl text-xs flex items-center gap-2">
              <Utensils className="w-4 h-4 text-[#C87F17]" />
              <div>
                <span className="text-[#64748B] text-[10px] block font-semibold font-montserrat">Alimentación asignada:</span>
                <span className="font-bold text-[#182535] text-xs">
                  {currentDaySummary.lunches === 0 && currentDaySummary.snacks === 0 ? (
                    <span className="text-[#64748B] font-normal">Sin ración (&lt;3h acumuladas)</span>
                  ) : (
                    <>
                      {currentDaySummary.lunches > 0 && (
                        <span className="text-[#16A34A] mr-2 font-mono">
                          {currentDaySummary.lunches} Almuerzo
                        </span>
                      )}
                      {currentDaySummary.snacks > 0 && (
                        <span className="text-[#C87F17] font-mono">
                          {currentDaySummary.snacks} Refrigerio{currentDaySummary.snacks > 1 ? 's' : ''}
                        </span>
                      )}
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="bg-[#FAF6EC] border border-[#E5DAC0] px-3.5 py-2 rounded-2xl text-xs">
              <span className="text-[#64748B] text-[10px] block font-semibold font-montserrat">Horas totales:</span>
              <span className="font-mono font-bold text-[#182535] text-xs">{currentDaySummary.totalHours} Horas</span>
            </div>
          </div>
        </div>

        {/* Shift Cards */}
        {currentDaySummary.dayAssignments.length === 0 ? (
          <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-12 text-center text-[#64748B]">
            <Calendar className="w-12 h-12 text-[#C87F17] mx-auto mb-3" />
            <h3 className="text-lg font-bold text-[#182535] font-dalek tracking-wider">DÍA LIBRE / SIN ASIGNACIÓN</h3>
            <p className="text-xs text-[#64748B] mt-1 max-w-md mx-auto font-montserrat">
              No tienes turnos programados para este día. Disfruta tu tiempo o consulta a tu coordinador si esperabas una asignación.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentDaySummary.dayAssignments.map((asgn) => {
              const shiftDef = currentDaySummary.dayDef
                ? findShiftById(currentDaySummary.dayDef, asgn.shiftId)
                : undefined;
              const attendance = attendances.find(
                (at) =>
                  at.personId === person.id &&
                  at.dayId === activeDayId &&
                  at.shiftId === asgn.shiftId
              );
              const status = attendance?.status || 'pendiente';

              return (
                <div
                  key={asgn.id}
                  className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 shadow-2xs space-y-4 hover:border-[#B83A24] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[#EADDC7] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-xl bg-[#FDF2EE] text-[#B83A24] font-bold text-xs border border-[#F6C7BA]">
                        {shiftDef?.name || asgn.shiftId}
                      </span>
                      <h4 className="text-sm font-bold text-[#182535] font-montserrat">
                        {asgn.roleInBase || 'Integrante Staff'}
                      </h4>
                    </div>

                    {/* Attendance status pill */}
                    <span
                      className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
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

                  <div className="space-y-2 text-xs font-montserrat">
                    <div className="flex items-center gap-2 text-[#334155]">
                      <Clock className="w-4 h-4 text-[#B83A24] shrink-0" />
                      <span>
                        Horario: <strong className="text-[#182535] font-mono">{shiftDef?.label || 'Por confirmar'}</strong>
                      </span>
                    </div>

                    {asgn.baseNumber ? (
                      <div className="flex items-center gap-2 text-[#334155]">
                        <MapPin className="w-4 h-4 text-[#16A34A] shrink-0" />
                        <span>
                          Base asignada:{' '}
                          <strong className="text-[#16A34A] font-bold">
                            {asgn.baseName || getBaseDisplayName(asgn.baseNumber)}
                          </strong>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[#64748B]">
                        <MapPin className="w-4 h-4 text-[#94A3B8] shrink-0" />
                        <span>Operación general en campus (Sin base fija)</span>
                      </div>
                    )}

                    {attendance?.checkInTime && (
                      <div className="flex items-center gap-2 text-[#16A34A] pt-1">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Hora de registro en control: {attendance.checkInTime}</span>
                      </div>
                    )}

                    {asgn.notes && (
                      <div className="bg-[#FAF6EC] p-2.5 rounded-xl text-[11px] text-[#334155] border border-[#EADDC7] mt-2">
                        <span className="font-semibold text-[#64748B] block mb-0.5">Indicaciones:</span>
                        {asgn.notes}
                      </div>
                    )}
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
