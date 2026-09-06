import React, { useState } from 'react';
import { Person, Assignment } from '../types';
import { EVENT_SCHEDULE, findShiftById } from '../data/eventStructure';
import { Utensils, Coffee, Sun, AlertCircle } from 'lucide-react';

interface FoodViewProps {
  people: Person[];
  assignments: Assignment[];
}

export const FoodView: React.FC<FoodViewProps> = ({ people, assignments }) => {
  const [selectedDayId, setSelectedDayId] = useState<string>('lunes');

  const currentDay = EVENT_SCHEDULE.find((d) => d.dayId === selectedDayId) || EVENT_SCHEDULE[0];

  // Distinct persons assigned to this day
  const dayAssignments = assignments.filter((a) => a.dayId === selectedDayId);
  const assignedPersonIds = Array.from(new Set(dayAssignments.map((a) => a.personId)));

  // Helper to calculate shift duration in minutes
  const getShiftDurationMinutes = (startTime: string, endTime: string): number => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startTotal = startH * 60 + (startM || 0);
    const endTotal = endH * 60 + (endM || 0);
    return Math.max(0, endTotal - startTotal);
  };

  // Calculate meal entitlements strictly based on assigned hours
  // < 3h: ninguno
  // 3h a 5h: 1 refrigerio
  // 6h a 8h: 1 almuerzo + 1 refrigerio
  // >= 9h: 1 almuerzo + 2 refrigerios
  const mealEntitlements = assignedPersonIds.map((pid) => {
    const person = people.find((p) => p.id === pid);
    const personShifts = dayAssignments.filter((a) => a.personId === pid);

    let totalMinutes = 0;
    personShifts.forEach((asgn) => {
      const shiftDef = findShiftById(currentDay, asgn.shiftId);
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
    } else {
      lunches = 0;
      snacks = 0;
    }

    return {
      person,
      shifts: personShifts,
      totalHours,
      lunches,
      snacks,
    };
  });

  const totalLunchesCount = mealEntitlements.reduce((sum, m) => sum + m.lunches, 0);
  const totalSnacksCount = mealEntitlements.reduce((sum, m) => sum + m.snacks, 0);
  const totalNoFoodCount = mealEntitlements.filter((m) => m.lunches === 0 && m.snacks === 0).length;

  return (
    <div className="space-y-6 text-[#182535]">
      {/* Header */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-2xs">
        <h2 className="text-xl sm:text-2xl font-bold text-[#182535] tracking-wide font-dalek">
          GESTIÓN DE ALIMENTACIÓN
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-montserrat">
          Cálculo exacto según horas totales asignadas: &lt;3h (ninguno), 3h-5h (1 refrigerio), 6h-8h (1 almuerzo + 1 refrigerio), ≥9h (1 almuerzo + 2 refrigerios).
        </p>
      </div>

      {/* Day Selector */}
      <div className="flex items-center gap-2 overflow-x-auto bg-[#FFFDF8] border border-[#EADDC7] p-2 rounded-2xl pb-2 scrollbar-none shadow-2xs">
        {EVENT_SCHEDULE.map((d) => (
          <button
            key={d.dayId}
            onClick={() => setSelectedDayId(d.dayId)}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wider whitespace-nowrap transition-all ${
              selectedDayId === d.dayId
                ? 'bg-[#B83A24] text-white shadow-xs font-dalek'
                : 'text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC] font-montserrat'
            }`}
          >
            {d.dayName} ({d.eventName})
          </button>
        ))}
      </div>

      {/* Meal Totals Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Almuerzo */}
        <div className="bg-[#FFFDF8] border border-[#BBF7D0] rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#16A34A] uppercase tracking-wider font-montserrat">
              Total Almuerzos
            </span>
            <span className="p-2.5 rounded-2xl bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
              <Sun className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-bold text-[#182535] mt-2 font-mono">{totalLunchesCount}</div>
          <p className="text-[11px] text-[#64748B] mt-1 font-montserrat">
            Personas con 6 o más horas acumuladas en el día
          </p>
        </div>

        {/* Refrigerios */}
        <div className="bg-[#FFFDF8] border border-[#FDE68A] rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#C87F17] uppercase tracking-wider font-montserrat">
              Total Refrigerios
            </span>
            <span className="p-2.5 rounded-2xl bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A]">
              <Coffee className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-bold text-[#182535] mt-2 font-mono">{totalSnacksCount}</div>
          <p className="text-[11px] text-[#64748B] mt-1 font-montserrat">
            Raciones de refrigerio asignadas (1 o 2 por integrante)
          </p>
        </div>

        {/* Sin alimentación */}
        <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider font-montserrat">
              Sin Alimentación
            </span>
            <span className="p-2.5 rounded-2xl bg-[#FAF6EC] text-[#64748B] border border-[#EADDC7]">
              <AlertCircle className="w-5 h-5" />
            </span>
          </div>
          <div className="text-3xl font-bold text-[#64748B] mt-2 font-mono">{totalNoFoodCount}</div>
          <p className="text-[11px] text-[#64748B] mt-1 font-montserrat">
            Integrantes con menos de 3 horas acumuladas
          </p>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-[#EADDC7] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#182535] font-dalek tracking-wide">
              PLANILLA DE ALIMENTACIÓN: {currentDay.dayName.toUpperCase()} ({currentDay.eventName})
            </h3>
            <p className="text-xs text-[#64748B] font-montserrat">
              {assignedPersonIds.length} integrantes asignados para esta jornada
            </p>
          </div>
        </div>

        {mealEntitlements.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B]">
            <Utensils className="w-10 h-10 text-[#C87F17] mx-auto mb-3" />
            <p className="font-semibold text-[#182535] text-sm font-dalek">0 personas asignadas a {currentDay.dayName}</p>
            <p className="text-xs text-[#94A3B8] mt-1 font-montserrat">
              Las raciones de comida se calculan automáticamente cuando se asigna personal a los turnos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-montserrat">
              <thead className="bg-[#FAF6EC] text-[#64748B] text-[11px] uppercase border-b border-[#EADDC7] font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Persona</th>
                  <th className="py-3.5 px-4">Turnos Asignados</th>
                  <th className="py-3.5 px-4 text-center">Horas Totales</th>
                  <th className="py-3.5 px-4 text-center">Almuerzo</th>
                  <th className="py-3.5 px-4 text-center">Refrigerios</th>
                  <th className="py-3.5 px-4">Restricción Alimentaria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EADDC7] text-[#334155]">
                {mealEntitlements.map((entry) => {
                  const shiftLabels = entry.shifts
                    .map((s) => {
                      const def = findShiftById(currentDay, s.shiftId);
                      return def ? `${def.category ? `${def.category} ` : ''}${def.name}` : s.shiftId;
                    })
                    .join(', ');

                  return (
                    <tr key={entry.person?.id} className="hover:bg-[#FAF6EC]/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#182535]">
                        <div className="flex items-center gap-1.5">
                          <span>{entry.person?.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#FAF6EC] text-[#64748B] font-mono border border-[#EADDC7]">
                            {entry.person?.primaryType}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#64748B] font-normal font-mono block mt-0.5">
                          CC: {entry.person?.documentId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#334155] text-[11px]">
                        {shiftLabels}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-[#182535] text-xs">
                        {entry.totalHours}h
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {entry.lunches > 0 ? (
                          <span className="px-2.5 py-1 rounded-md bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] text-xs font-bold font-mono">
                            {entry.lunches} ALMUERZO
                          </span>
                        ) : (
                          <span className="text-[#94A3B8] text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {entry.snacks > 0 ? (
                          <span className="px-2.5 py-1 rounded-md bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A] text-xs font-bold font-mono">
                            {entry.snacks} REFRIGERIO{entry.snacks > 1 ? 'S' : ''}
                          </span>
                        ) : (
                          <span className="text-[#94A3B8] text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#64748B]">
                        {entry.person?.dietaryRestrictions || 'Ninguna'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
