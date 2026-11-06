import React, { useState } from 'react';
import {
  Person,
  Assignment,
  AttendanceRecord,
  ConfigurableShift,
  AppEvent,
  ConfigurableBase,
  getPersonShirtQuota,
  getPersonShirtDeliveredCount,
  isPersonShirtFullyDelivered,
} from '../types';
import { DiasLogo } from './DiasLogo';
import { useProfile, PersonalQrModal } from './PersonProfile';
import { QrCode, qrLink } from './league/QrCode';
import { EVENT_SCHEDULE, DEFAULT_INITIAL_SHIFTS, getBaseDisplayName, findShiftById } from '../data/eventStructure';
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
  Shirt,
} from 'lucide-react';

interface StaffMyDiasViewProps {
  person: Person;
  assignments: Assignment[];
  attendances: AttendanceRecord[];
  shifts?: ConfigurableShift[];
  events?: AppEvent[];
  bases?: ConfigurableBase[];
  onLogout: () => void;
}

export const StaffMyDiasView: React.FC<StaffMyDiasViewProps> = ({
  person,
  assignments,
  attendances,
  shifts,
  events,
  bases,
  onLogout,
}) => {
  const [activeDayId, setActiveDayId] = useState<string>('lunes');

  // Filter only this staff person's assignments
  const myAssignments = assignments.filter((a) => a.personId === person.id);

  // Helper to resolve shift accurately across configured shifts, schedule, and dynamic IDs
  const resolveShift = (shiftId: string, dayId: string) => {
    // 1. Check in configured shifts passed from storage/Supabase
    if (shifts && shifts.length > 0) {
      const found = shifts.find((s) => s.id === shiftId);
      if (found) return found;
      const fromHelper = findShiftById(shifts, shiftId);
      if (fromHelper) return fromHelper;
    }
    // 2. Check in EVENT_SCHEDULE
    const dayDef = EVENT_SCHEDULE.find((d) => d.dayId === dayId);
    if (dayDef) {
      const fromDayDef = findShiftById(dayDef, shiftId);
      if (fromDayDef) return fromDayDef;
    }
    // 3. Fallback to DEFAULT_INITIAL_SHIFTS
    const fromDefaults = DEFAULT_INITIAL_SHIFTS.find((s) => s.id === shiftId);
    if (fromDefaults) return fromDefaults;

    // 4. Fallback for dynamic shift IDs (e.g. shift_lunes_mesa_mtqmx0gh_vxu)
    if (shiftId && shiftId.startsWith('shift_')) {
      const sid = shiftId.toLowerCase();
      const isMesa = sid.includes('mesa');
      const dId = sid.includes('lunes')
        ? 'lunes'
        : sid.includes('martes')
        ? 'martes'
        : sid.includes('miercoles')
        ? 'miercoles'
        : sid.includes('jueves')
        ? 'jueves'
        : sid.includes('viernes')
        ? 'viernes'
        : dayId;

      if (dId === 'lunes') {
        return {
          id: shiftId,
          name: isMesa ? 'Turno 1 — MESA' : 'Turno 1',
          dayId: 'lunes',
          eventId: 'the-show',
          category: (isMesa ? 'MESA' : 'GT') as any,
          startTime: '06:00',
          endTime: '08:00',
          label: '6:00 a. m. a 8:00 a. m.',
        };
      }
      if (dId === 'martes') {
        return {
          id: shiftId,
          name: isMesa ? 'Turno MESA' : 'Turno 1',
          dayId: 'martes',
          eventId: 'the-zone',
          category: (isMesa ? 'MESA' : 'GT') as any,
          startTime: isMesa ? '08:00' : '08:30',
          endTime: isMesa ? '12:30' : '12:00',
          label: isMesa ? '8:00 a. m. – 12:30 p. m.' : '8:30 a. m. – 12:00 p. m.',
        };
      }
      if (dId === 'miercoles') {
        return {
          id: shiftId,
          name: isMesa ? 'Turno MESA' : 'Turno 1',
          dayId: 'miercoles',
          eventId: 'carnival',
          category: (isMesa ? 'MESA' : 'GT') as any,
          startTime: isMesa ? '06:30' : '06:50',
          endTime: '09:00',
          label: isMesa ? '6:30 a. m. a 9:00 a. m.' : '6:50 a. m. a 9:00 a. m.',
        };
      }
      if (dId === 'jueves') {
        return {
          id: shiftId,
          name: isMesa ? 'Turno 1 — The Challenge (MESA)' : 'Turno 1 — The Challenge',
          dayId: 'jueves',
          eventId: 'the-challenge',
          category: (isMesa ? 'MESA' : 'GT') as any,
          startTime: '06:00',
          endTime: '13:00',
          label: '6:00 a. m. a 1:00 p. m.',
        };
      }
      if (dId === 'viernes') {
        return {
          id: shiftId,
          name: isMesa ? 'Turno 1 — The Games (MESA)' : 'Turno 1 — The Games',
          dayId: 'viernes',
          eventId: 'the-games',
          category: (isMesa ? 'MESA' : 'GT') as any,
          startTime: '06:00',
          endTime: '21:30',
          label: '6:00 a. m. a 9:30 p. m.',
        };
      }
    }

    return undefined;
  };

  // Helper to calculate shift duration in minutes
  const getShiftDurationMinutes = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    if (isNaN(startH) || isNaN(endH)) return 0;
    const startTotal = startH * 60 + (startM || 0);
    const endTotal = endH * 60 + (endM || 0);
    return Math.max(0, endTotal - startTotal);
  };

  // Compute daily totals and food entitlements for this person
  const getDailySummary = (dayId: string) => {
    const dayDef = EVENT_SCHEDULE.find((d) => d.dayId === dayId);
    const dayAssignments = myAssignments.filter((a) => a.dayId === dayId);
    let totalMinutes = 0;

    dayAssignments.forEach((asgn) => {
      const shiftDef = resolveShift(asgn.shiftId, dayId);
      if (shiftDef && shiftDef.startTime && shiftDef.endTime) {
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
      <div className="bg-surface border-2 border-tinta-200 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden text-tinta-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4 min-w-0">
            {/* Logo DÍAS con el QR personal debajo */}
            <StaffLogoQr name={person.name} />
            <div className="space-y-2 min-w-0">
              <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-full bg-mostaza-50 border border-mostaza-300/40 text-mostaza-600 text-xs font-bold uppercase tracking-wider font-sans">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Portal de Staff • DÍAS EAFIT</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-tinta-900 font-display tracking-wider break-words [overflow-wrap:anywhere]">
                HOLA, {person.name.toUpperCase()}
              </h1>
              <p className="text-xs sm:text-sm text-tinta-500 font-sans">
                Consulta tu horario oficial, bases asignadas, alimentación y registro de asistencia.
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="min-h-[44px] self-start sm:self-center px-4 py-2.5 rounded-2xl bg-lila-50 hover:bg-lila-100 text-lila-600 border border-lila-200 text-xs font-bold flex items-center gap-2 transition-all shadow-2xs font-sans"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-tinta-200 text-xs font-sans">
          <div>
            <span className="text-tinta-500 text-[11px] block">Cédula</span>
            <span className="font-mono font-bold text-tinta-900 text-sm">{person.documentId}</span>
          </div>
          <div>
            <span className="text-tinta-500 text-[11px] block">Tipo de Staff</span>
            <span
              className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-md font-bold text-xs ${
                person.primaryType === 'GT'
                  ? 'bg-lila-50 text-lila-600 border border-lila-200'
                  : person.primaryType === 'GAP'
                  ? 'bg-mostaza-50 text-mostaza-600 border border-mostaza-200'
                  : 'bg-purple-50 text-purple-700 border border-purple-200'
              }`}
            >
              {person.primaryType} {person.roleTitle ? `• ${person.roleTitle}` : ''}
            </span>
          </div>
          <div>
            <span className="text-tinta-500 text-[11px] block flex items-center gap-1">
              <Shirt className="w-3 h-3 text-lila-600" />
              Camiseta Oficial
            </span>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span className="font-bold text-tinta-900 text-sm">
                Talla {person.shirtSize || 'M'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-mostaza-50 text-lila-600 border border-mostaza-300/40 font-mono">
                {getPersonShirtQuota(person)} {getPersonShirtQuota(person) === 2 ? 'camisetas' : 'camiseta'}
              </span>
            </div>
            <div className="mt-1">
              {isPersonShirtFullyDelivered(person) ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Entregada ({getPersonShirtDeliveredCount(person)}/{getPersonShirtQuota(person)})
                </span>
              ) : getPersonShirtDeliveredCount(person) > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                  <Clock className="w-3 h-3" /> Parcial ({getPersonShirtDeliveredCount(person)}/{getPersonShirtQuota(person)})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-tinta-500 bg-tinta-50 px-1.5 py-0.5 rounded-md border border-tinta-200">
                  <Clock className="w-3 h-3 text-amber-600" /> Pendiente entrega
                </span>
              )}
            </div>
          </div>
          <div>
            <span className="text-tinta-500 text-[11px] block">Alergias Alimentarias</span>
            <span className="font-semibold text-tinta-900 text-xs truncate block" title={person.foodAllergies}>
              {person.foodAllergies || 'Ninguna'}
            </span>
          </div>
          <div>
            <span className="text-tinta-500 text-[11px] block">Restricción de Comidas</span>
            <span className="font-semibold text-tinta-900 text-xs truncate block" title={person.dietaryRestrictions}>
              {person.dietaryRestrictions || 'Ninguna'}
            </span>
          </div>
          <div>
            <span className="text-tinta-500 text-[11px] block">Enfermedad o Condición</span>
            <span className="font-semibold text-tinta-900 text-xs truncate block" title={person.medicalConditions}>
              {person.medicalConditions || 'Ninguna'}
            </span>
          </div>
        </div>
      </div>

      {/* Week Selector Tabs */}
      <div className="bg-surface border border-tinta-200 rounded-2xl p-2 flex items-center gap-2 overflow-x-auto shadow-2xs scrollbar-none">
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
                  ? 'bg-lila-600 text-white shadow-xs font-display'
                  : 'text-tinta-500 hover:text-tinta-900 hover:bg-tinta-50 font-sans'
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
        <div className="bg-surface border border-tinta-200 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-mostaza-600 font-sans">
                {currentDaySummary.dayDef?.dayName}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-lila-50 text-lila-600 font-bold border border-lila-200">
                {currentDaySummary.dayDef?.eventName}
              </span>
            </div>
            <p className="text-sm sm:text-base text-tinta-700 font-sans leading-relaxed mt-2 max-w-2xl">
              {currentDaySummary.dayDef?.description}
            </p>
          </div>

          {/* Alimentación badge for this day */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-tinta-50 border border-tinta-300 px-3.5 py-2 rounded-2xl text-xs flex items-center gap-2">
              <Utensils className="w-4 h-4 text-mostaza-600" />
              <div>
                <span className="text-tinta-500 text-[10px] block font-semibold font-sans">Alimentación asignada:</span>
                <span className="font-bold text-tinta-900 text-xs">
                  {currentDaySummary.lunches === 0 && currentDaySummary.snacks === 0 ? (
                    <span className="text-tinta-500 font-normal">Sin ración (&lt;3h acumuladas)</span>
                  ) : (
                    <>
                      {currentDaySummary.lunches > 0 && (
                        <span className="text-turquesa-600 mr-2 font-mono">
                          {currentDaySummary.lunches} Almuerzo
                        </span>
                      )}
                      {currentDaySummary.snacks > 0 && (
                        <span className="text-mostaza-600 font-mono">
                          {currentDaySummary.snacks} Refrigerio{currentDaySummary.snacks > 1 ? 's' : ''}
                        </span>
                      )}
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="bg-tinta-50 border border-tinta-300 px-3.5 py-2 rounded-2xl text-xs">
              <span className="text-tinta-500 text-[10px] block font-semibold font-sans">Horas totales:</span>
              <span className="font-mono font-bold text-tinta-900 text-xs">{currentDaySummary.totalHours} Horas</span>
            </div>
          </div>
        </div>

        {/* Shift Cards */}
        {currentDaySummary.dayAssignments.length === 0 ? (
          <div className="bg-surface border border-tinta-200 rounded-3xl p-12 text-center text-tinta-500">
            <Calendar className="w-12 h-12 text-mostaza-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-tinta-900 font-display tracking-wider">DÍA LIBRE / SIN ASIGNACIÓN</h3>
            <p className="text-xs text-tinta-500 mt-1 max-w-md mx-auto font-sans">
              No tienes turnos programados para este día. Disfruta tu tiempo o consulta a tu coordinador si esperabas una asignación.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentDaySummary.dayAssignments.map((asgn) => {
              const shiftDef = resolveShift(asgn.shiftId, activeDayId);
              const attendance = attendances.find(
                (at) =>
                  at.personId === person.id &&
                  at.dayId === activeDayId &&
                  at.shiftId === asgn.shiftId
              );
              const status = attendance?.status || 'pendiente';
              const isMesa = asgn.assignedType === 'MESA' || asgn.roleInBase === 'MESA' || (shiftDef?.category as string) === 'MESA';
              const roleDisplay = asgn.roleInBase || (isMesa ? 'MESA' : 'Integrante Staff');
              const shiftNameDisplay = shiftDef?.name || (isMesa ? 'Turno MESA' : asgn.shiftId);
              const scheduleDisplay =
                shiftDef?.label ||
                (shiftDef?.startTime && shiftDef?.endTime
                  ? `${shiftDef.startTime} – ${shiftDef.endTime}`
                  : 'Por confirmar');

              return (
                <div
                  key={asgn.id}
                  className="bg-surface border border-tinta-200 rounded-3xl p-5 shadow-2xs space-y-4 hover:border-lila-600 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-tinta-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-xl bg-lila-50 text-lila-600 font-bold text-xs border border-lila-200">
                        {shiftNameDisplay}
                      </span>
                      <h4 className="text-sm font-bold text-tinta-900 font-sans">
                        {roleDisplay}
                      </h4>
                    </div>

                    {/* Attendance status pill */}
                    <span
                      className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                        status === 'asistio'
                          ? 'bg-turquesa-50 text-turquesa-600 border-turquesa-200'
                          : status === 'tarde'
                          ? 'bg-mostaza-50 text-mostaza-600 border-mostaza-200'
                          : status === 'retiro_antes'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : status === 'inasistencia'
                          ? 'bg-lila-50 text-lila-600 border-lila-200'
                          : 'bg-tinta-50 text-tinta-500 border-tinta-200'
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

                  <div className="space-y-2 text-xs font-sans">
                    <div className="flex items-center gap-2 text-tinta-700">
                      <Clock className="w-4 h-4 text-lila-600 shrink-0" />
                      <span>
                        Horario: <strong className="text-tinta-900 font-mono">{scheduleDisplay}</strong>
                      </span>
                    </div>

                    {asgn.baseNumber ? (
                      <div className="flex items-center gap-2 text-tinta-700">
                        <MapPin className="w-4 h-4 text-turquesa-600 shrink-0" />
                        <span>
                          Base asignada:{' '}
                          <strong className="text-turquesa-600 font-bold">
                            {asgn.baseName || getBaseDisplayName(asgn.baseNumber)}
                          </strong>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-tinta-500">
                        <MapPin className="w-4 h-4 text-tinta-400 shrink-0" />
                        <span>{isMesa ? 'Comité Central / Mesa Directiva' : 'Operación general en campus (Sin base fija)'}</span>
                      </div>
                    )}

                    {attendance?.checkInTime && (
                      <div className="flex items-center gap-2 text-turquesa-600 pt-1">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Hora de registro en control: {attendance.checkInTime}</span>
                      </div>
                    )}

                    {asgn.notes && (
                      <div className="bg-tinta-50 p-2.5 rounded-xl text-[11px] text-tinta-700 border border-tinta-200 mt-2">
                        <span className="font-semibold text-tinta-500 block mb-0.5">Indicaciones:</span>
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

/** Logo DÍAS y, debajo, el QR personal del integrante (toca para verlo en grande). */
const StaffLogoQr: React.FC<{ name: string }> = ({ name }) => {
  const { profile } = useProfile('me', false);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <DiasLogo variant="mark" className="h-10 sm:h-12 w-auto" />
      {profile ? (
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-1" title="Ver mi QR en grande">
          <QrCode value={qrLink('P', profile.qrToken)} size={92} label="Mi QR DÍAS" className="border border-tinta-200" />
          <span className="text-[10px] font-semibold text-tinta-600">Mi QR</span>
        </button>
      ) : (
        <div className="w-[92px] h-[92px] rounded-xl bg-tinta-100 animate-pulse" aria-label="Cargando QR" />
      )}
      {open && profile && <PersonalQrModal name={name} token={profile.qrToken} onClose={() => setOpen(false)} />}
    </div>
  );
};
