import React, { useState } from 'react';
import { Person, Assignment, AvailabilityRecord, AttendanceRecord } from '../types';
import {
  EVENT_SCHEDULE,
  CARNIVAL_PHYSICAL_BASES,
  THE_GAMES_PHYSICAL_BASES,
  findShiftById,
  DEFAULT_INITIAL_SHIFTS,
  getShiftDurationMinutes,
} from '../data/eventStructure';
import { ConfigurableShift } from '../types';
import {
  Users,
  Calendar,
  MapPin,
  Clock,
  AlertTriangle,
  Utensils,
  Radio,
  Plus,
  FileSpreadsheet,
  Download,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Shirt,
} from 'lucide-react';
import { TabType } from './Navbar';
import { exportPeopleToExcel } from '../services/excelService';

interface DashboardViewProps {
  people: Person[];
  assignments: Assignment[];
  availabilities: AvailabilityRecord[];
  attendances: AttendanceRecord[];
  shifts?: ConfigurableShift[];
  onNavigate: (tab: TabType) => void;
  onOpenAddPerson: () => void;
  onOpenExcelImport?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  people,
  assignments,
  availabilities,
  attendances,
  shifts = [],
  onNavigate,
  onOpenAddPerson,
  onOpenExcelImport,
}) => {
  const [selectedDayId, setSelectedDayId] = useState<'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes'>('lunes');

  // Breakdown by person type
  const gtCount = people.filter((p) => p.primaryType === 'GT').length;
  const gapCount = people.filter((p) => p.primaryType === 'GAP').length;
  const mesaCount = people.filter((p) => p.primaryType === 'MESA').length;

  // Unassigned people: persons with 0 assignments
  const assignedPersonIds = new Set(assignments.map((a) => a.personId));
  const unassignedCount = people.filter((p) => !assignedPersonIds.has(p.id)).length;

  // Total required slots across the entire week:
  // Lunes: 5 shifts * ~35 = 175
  // Martes: 4 shifts * ~30 = 120
  // Miercoles: GT (5 shifts * 25 = 125) + GAP (3 shifts * 30 bases * 2 = 180) = 305
  // Jueves: 2 shifts + 15 bases * 2 = 60
  // Viernes: 2 shifts + 15 bases * 2 = 60
  const totalSlotsNeeded = 381;
  // Cupos operativos (GT + GAP): MESA no llena el cupo operativo ("solo al GT")
  const totalAssigned = assignments.filter((a) => a.assignedType !== 'MESA').length;
  const coveragePct = Math.min(100, Math.round((totalAssigned / (totalSlotsNeeded || 1)) * 100));
  const missingSlots = Math.max(0, totalSlotsNeeded - totalAssigned);

  // GT assignments count
  const gtAssignedCount = assignments.filter((a) => a.assignedType === 'GT').length;

  // Food calculations:
  // Compute approximate food requirements
  let totalLunches = 0;
  let totalSnacks = 0;

  // Group assignments by person and day
  const personDayHours = new Map<string, number>();
  assignments.forEach((asgn) => {
    const key = `${asgn.personId}_${asgn.dayId}`;
    const curr = personDayHours.get(key) || 0;
    const shiftDef =
      (shifts && shifts.find((s) => s.id === asgn.shiftId)) ||
      findShiftById(shifts || [], asgn.shiftId) ||
      findShiftById(asgn.dayId, asgn.shiftId) ||
      DEFAULT_INITIAL_SHIFTS.find((s) => s.id === asgn.shiftId);
    const durationHours = shiftDef
      ? getShiftDurationMinutes(shiftDef.startTime, shiftDef.endTime) / 60
      : 3.5;
    personDayHours.set(key, curr + durationHours);
  });

  personDayHours.forEach((hours) => {
    if (hours >= 9) {
      totalLunches += 1;
      totalSnacks += 2;
    } else if (hours >= 6) {
      totalLunches += 1;
      totalSnacks += 1;
    } else if (hours >= 3) {
      totalSnacks += 1;
    }
  });

  const totalMeals = totalLunches + totalSnacks;

  const currentDay = EVENT_SCHEDULE.find((d) => d.dayId === selectedDayId) || EVENT_SCHEDULE[0];

  return (
    <div className="space-y-6">
      {/* Top Banner exactly matching image.png */}
      <div className="bg-surface border border-tinta-200 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        {/* Subtle geometric / Nordic markers */}
        <div className="flex items-center justify-between text-[11px] text-tinta-400 font-mono tracking-widest uppercase mb-3">
          <span>›› DÍAS 2026 ‹‹</span>
          <span>❖ ᛟ RX ❖</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-lila-600 text-white text-xs font-bold font-sans tracking-wide">
                PANEL DE LA DIRECTORA
              </span>
              <span className="text-xs font-bold text-mostaza-600 font-sans">
                Cerebro de Distribución DÍAS EAFIT
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-tinta-900 font-display tracking-wider">
              CENTRO DE MANDO GENERAL
            </h1>

            <p className="text-xs sm:text-sm text-tinta-600 leading-relaxed font-sans">
              Cruce automático de disponibilidades, asignación inteligente, cálculo de horas y alimentación según el Artículo 36.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => exportPeopleToExcel(people)}
              className="px-5 py-3 rounded-2xl bg-mostaza-600 hover:bg-mostaza-700 text-white font-bold text-xs sm:text-sm font-display tracking-wider flex items-center gap-2 shadow-sm transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel Oficial</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6 Metric KPI Cards matching image.png */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. PERSONAS */}
        <div
          onClick={() => onNavigate('people')}
          className="bg-surface border border-tinta-200 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-lila-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-tinta-500 font-sans uppercase tracking-wider">
              Personas
            </span>
            <Users className="w-4 h-4 text-lila-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-tinta-900 font-sans">
            {people.length}
          </div>
          <div className="mt-2 text-[11px] text-tinta-500 font-sans truncate">
            GT: {gtCount} • GAP: {gapCount} • Mesa: {mesaCount}
          </div>
        </div>

        {/* 2. TURNOS */}
        <div
          onClick={() => onNavigate('assignments')}
          className="bg-surface border border-tinta-200 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-mostaza-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-tinta-500 font-sans uppercase tracking-wider">
              Turnos
            </span>
            <Calendar className="w-4 h-4 text-mostaza-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-tinta-900 font-sans">
            17
          </div>
          <div className="mt-2 text-[11px] text-tinta-500 font-sans truncate">
            {gtAssignedCount} / 188 cupos GT
          </div>
        </div>

        {/* 3. BASES GAP */}
        <div
          onClick={() => onNavigate('assignments')}
          className="bg-surface border border-tinta-200 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-lila-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-tinta-500 font-sans uppercase tracking-wider">
              Bases GAP
            </span>
            <MapPin className="w-4 h-4 text-lila-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-tinta-900 font-sans">
            45
          </div>
          <div className="mt-2 text-[11px] text-tinta-500 font-sans truncate">
            30 Carnival + 15 Games
          </div>
        </div>

        {/* 4. COBERTURA */}
        <div
          onClick={() => onNavigate('assignments')}
          className="bg-surface border border-tinta-200 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-turquesa-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-tinta-500 font-sans uppercase tracking-wider">
              Cobertura
            </span>
            <Clock className="w-4 h-4 text-turquesa-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-turquesa-600 font-sans">
            {coveragePct}%
          </div>
          <div className="mt-2 text-[11px] text-tinta-500 font-sans truncate">
            {totalAssigned} de {totalSlotsNeeded} cupos
          </div>
        </div>

        {/* 5. FALTANTES */}
        <div
          onClick={() => onNavigate('assignments')}
          className="bg-surface border border-tinta-200 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-mostaza-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-tinta-500 font-sans uppercase tracking-wider">
              Faltantes
            </span>
            <AlertTriangle className="w-4 h-4 text-mostaza-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-mostaza-500 font-sans">
            {missingSlots}
          </div>
          <div className="mt-2 text-[11px] text-tinta-500 font-sans truncate">
            Por asignar en la semana
          </div>
        </div>

        {/* 6. RACIONES */}
        <div
          onClick={() => onNavigate('food')}
          className="bg-surface border border-tinta-200 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-lila-600 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-tinta-500 font-sans uppercase tracking-wider">
              Raciones
            </span>
            <Utensils className="w-4 h-4 text-lila-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-tinta-900 font-sans">
            {totalMeals}
          </div>
          <div className="mt-2 text-[11px] text-tinta-500 font-sans truncate">
            {totalLunches} Alm. • {totalSnacks} Refr.
          </div>
        </div>
      </div>

      {/* ACCIONES RÁPIDAS matching image.png */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-mostaza-600" />
            <h2 className="text-base sm:text-lg font-bold text-tinta-900 font-display tracking-wider">
              ACCIONES RÁPIDAS
            </h2>
          </div>
          <span className="text-xs text-tinta-400 font-sans">Gestión directa</span>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none flex-wrap sm:flex-nowrap">
          {/* Control en Vivo */}
          <button
            onClick={() => onNavigate('attendance')}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-turquesa-700 hover:bg-turquesa-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs shrink-0 transition-all font-sans"
          >
            <Radio className="w-4 h-4" />
            <span>Control en Vivo</span>
          </button>

          {/* + Persona */}
          <button
            onClick={onOpenAddPerson}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-surface hover:bg-tinta-100 text-tinta-900 border border-tinta-200 text-xs font-bold flex items-center gap-2 shadow-2xs shrink-0 transition-all font-sans"
          >
            <Plus className="w-4 h-4 text-lila-600" />
            <span>+ Persona</span>
          </button>

          {/* Cargar Excel */}
          <button
            onClick={() => {
              if (onOpenExcelImport) onOpenExcelImport();
              else {
                onNavigate('people');
              }
            }}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-mostaza-50 hover:bg-mostaza-100 text-mostaza-600 border border-mostaza-300/40 text-xs font-bold flex items-center gap-2 shadow-2xs shrink-0 transition-all font-sans"
          >
            <FileSpreadsheet className="w-4 h-4 text-mostaza-600" />
            <span>Cargar Excel</span>
          </button>

          {/* Turnos GT */}
          <button
            onClick={() => onNavigate('assignments')}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-surface hover:bg-tinta-100 text-tinta-900 border border-tinta-200 text-xs font-bold flex items-center gap-2 shadow-2xs shrink-0 transition-all font-sans"
          >
            <Calendar className="w-4 h-4 text-tinta-500" />
            <span>Turnos GT</span>
          </button>

          {/* Bases GAP */}
          <button
            onClick={() => onNavigate('assignments')}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-surface hover:bg-tinta-100 text-tinta-900 border border-tinta-200 text-xs font-bold flex items-center gap-2 shadow-2xs shrink-0 transition-all font-sans"
          >
            <MapPin className="w-4 h-4 text-tinta-500" />
            <span>Bases GAP</span>
          </button>

          {/* Alimentación */}
          <button
            onClick={() => onNavigate('food')}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-surface hover:bg-tinta-100 text-tinta-900 border border-tinta-200 text-xs font-bold flex items-center gap-2 shadow-2xs shrink-0 transition-all font-sans"
          >
            <Utensils className="w-4 h-4 text-tinta-500" />
            <span>Alimentación</span>
          </button>

          {/* Camisetas */}
          <button
            onClick={() => onNavigate('shirts')}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-mostaza-50 hover:bg-mostaza-100 text-lila-600 border border-mostaza-300/40 text-xs font-bold flex items-center gap-2 shadow-2xs shrink-0 transition-all font-sans"
          >
            <Shirt className="w-4 h-4 text-lila-600" />
            <span>Camisetas (MESA x2)</span>
          </button>

          {/* Cobertura */}
          <button
            onClick={() => onNavigate('availability')}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-surface hover:bg-tinta-100 text-tinta-900 border border-tinta-200 text-xs font-bold flex items-center gap-2 shadow-2xs shrink-0 transition-all font-sans"
          >
            <Clock className="w-4 h-4 text-tinta-500" />
            <span>Cobertura</span>
          </button>
        </div>
      </div>

      {/* Alert Banner for Unassigned People matching image.png */}
      {unassignedCount > 0 && (
        <div className="bg-mostaza-50 border border-mostaza-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-mostaza-100 flex items-center justify-center text-mostaza-600 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-tinta-900 font-sans">
                {unassignedCount} Personas sin Asignación
              </h3>
              <p className="text-xs text-mostaza-800 font-sans">
                Miembros disponibles que aún no tienen turnos o bases asignadas.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('people')}
            className="px-4 py-2 rounded-xl bg-mostaza-300 hover:bg-mostaza-700 text-white text-xs font-bold font-sans shrink-0 shadow-xs transition-colors self-start sm:self-auto"
          >
            Ver Lista
          </button>
        </div>
      )}

      {/* PROGRAMACIÓN POR DÍA – DÍAS EAFIT matching image.png */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-tinta-900 font-display tracking-wider">
              PROGRAMACIÓN POR DÍA – DÍAS EAFIT
            </h2>
            <p className="text-xs text-tinta-500 font-sans">
              Selecciona el día para ver y gestionar la operación en tiempo real
            </p>
          </div>

          {/* Day Pills matching image.png */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'lunes', label: 'Lunes' },
              { id: 'martes', label: 'Martes' },
              { id: 'miercoles', label: 'Miércoles' },
              { id: 'jueves', label: 'Jueves' },
              { id: 'viernes', label: 'Viernes' },
            ].map((day) => {
              const isActive = selectedDayId === day.id;
              return (
                <button
                  key={day.id}
                  onClick={() => setSelectedDayId(day.id as any)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold font-sans transition-all shrink-0 ${
                    isActive
                      ? 'bg-lila-600 text-white shadow-xs'
                      : 'bg-surface text-tinta-700 hover:bg-tinta-100 border border-tinta-200'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Overview Card */}
        <div className="bg-surface border border-tinta-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-tinta-200/70 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-mostaza-600 font-sans">
                  {currentDay.dayName}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-lila-50 text-lila-600 font-bold border border-lila-200">
                  {currentDay.eventName}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-tinta-900 font-display tracking-wide mt-1">
                {currentDay.description}
              </h3>
            </div>

            <button
              onClick={() => onNavigate('assignments')}
              className="px-4 py-2 rounded-xl bg-lila-600 hover:bg-lila-700 text-white text-xs font-bold font-display tracking-wider flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
            >
              <span>Gestionar {currentDay.dayName}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Shifts and bases summary for this day */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentDay.shifts.map((shift) => {
              const shiftAssignments = assignments.filter(
                (a) => a.dayId === currentDay.dayId && a.shiftId === shift.id
              );
              const isMesaShift = shift.category === 'MESA' || shift.name.toUpperCase().includes('MESA');
              const gtCount = shiftAssignments.filter((a) => a.assignedType === 'GT').length;
              const mesaCount = shiftAssignments.filter((a) => a.assignedType === 'MESA').length;
              const gapCount = shiftAssignments.filter((a) => a.assignedType === 'GAP').length;
              const relevantCount = isMesaShift ? mesaCount : shift.category === 'GAP' ? gapCount : gtCount;

              return (
                <div
                  key={shift.id}
                  className="bg-tinta-50 border border-tinta-300 rounded-2xl p-3.5 space-y-2 hover:border-lila-600 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-tinta-900 font-display tracking-wide">
                      {shift.name} • {shift.label}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface font-bold text-tinta-500 border border-tinta-200">
                      {shift.category || 'GT'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-tinta-500 pt-1 border-t border-tinta-300/60">
                    <span>
                      {relevantCount} cupos {isMesaShift ? 'MESA' : 'GT'}
                      {!isMesaShift && mesaCount > 0 ? ` (+${mesaCount} M)` : ''}
                    </span>
                    <span className="font-semibold text-tinta-900">
                      {shift.hasBases ? 'Con Bases Físicas' : 'Turno Operativo'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
