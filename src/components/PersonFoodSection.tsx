import React, { useMemo } from 'react';
import { Utensils } from 'lucide-react';
import { Assignment, ConfigurableShift } from '../types';
import { DEFAULT_INITIAL_SHIFTS, EVENT_SCHEDULE, findShiftById } from '../data/eventStructure';
import { subscribeToAssignments, subscribeToShifts } from '../services/storageService';
import { formatWorked, mealText, mealsForMinutes, sumShiftMinutes } from '../services/foodRules';
import { Card, useCollection } from './league/ui';

/** Alimentación de una persona, día por día, según sus turnos asignados. */
export function usePersonFood(personId: string) {
  const assignments = useCollection<Assignment>(subscribeToAssignments);
  const shifts = useCollection<ConfigurableShift>(subscribeToShifts);
  return useMemo(() => {
    const mine = assignments.filter((a) => a.personId === personId);
    const days = Array.from(new Set(mine.map((a) => a.dayId)));
    const order = (d: string) => {
      const i = EVENT_SCHEDULE.findIndex((x) => x.dayId === d);
      return i < 0 ? 99 : i;
    };
    return days
      .sort((a, b) => order(a) - order(b))
      .map((dayId) => {
        const dayAssignments = mine.filter((a) => a.dayId === dayId);
        const minutes = sumShiftMinutes(
          dayAssignments.map(
            (a) => shifts.find((s) => s.id === a.shiftId) || findShiftById(shifts, a.shiftId) || DEFAULT_INITIAL_SHIFTS.find((s) => s.id === a.shiftId)
          )
        );
        const day = EVENT_SCHEDULE.find((d) => d.dayId === dayId);
        return { dayId, dayName: day?.dayName || dayId, eventName: day?.eventName || '', shiftCount: dayAssignments.length, minutes, meals: mealsForMinutes(minutes) };
      });
  }, [assignments, shifts, personId]);
}

export const PersonFoodSection: React.FC<{ personId: string }> = ({ personId }) => {
  const days = usePersonFood(personId);
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-tinta-200 flex items-center gap-2">
        <Utensils className="w-4 h-4 text-tinta-500" />
        <p className="text-sm font-semibold text-tinta-900">Alimentación</p>
      </div>
      {days.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-tinta-500">Sin turnos asignados: no hay alimentación por ahora.</p>
      ) : (
        <ul className="divide-y divide-tinta-100">
          {days.map((d) => (
            <li key={d.dayId} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-tinta-900">{d.dayName}</p>
                <p className="text-[11px] text-tinta-500">
                  {d.shiftCount} turno{d.shiftCount === 1 ? '' : 's'} · {formatWorked(d.minutes)}
                  {d.eventName && ` · ${d.eventName}`}
                </p>
              </div>
              <span
                className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold shrink-0 ${
                  d.meals.lunches || d.meals.snacks ? 'bg-lima-50 border-lima-200 text-lima-800' : 'bg-tinta-50 border-tinta-200 text-tinta-500'
                }`}
              >
                {mealText(d.meals)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="px-4 py-2 border-t border-tinta-100 text-[10px] text-tinta-500">Se suman todas las horas de los turnos del mismo día, sin redondear.</p>
    </Card>
  );
};
