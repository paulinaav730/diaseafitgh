import React, { useState, useMemo, useEffect } from 'react';
import { formatWorked, mealsForMinutes, sumShiftMinutes } from '../services/foodRules';
import { Person, Assignment, ConfigurableShift, AppEvent, FoodDelivery } from '../types';
import * as XLSX from 'xlsx';
import { EVENT_SCHEDULE, DEFAULT_INITIAL_SHIFTS } from '../data/eventStructure';
import {
  Utensils, Coffee, Download, Search, X, Users, Check, AlertCircle
} from 'lucide-react';
import { recordFoodDelivery, subscribeToFoodDeliveries } from '../services/storageService';

interface FoodControlViewProps {
  people: Person[];
  assignments: Assignment[];
  shifts?: ConfigurableShift[];
  events?: AppEvent[];
}

export const FoodControlView: React.FC<FoodControlViewProps> = ({ people, assignments, shifts, events }) => {
  const [selectedDayId, setSelectedDayIdState] = useState<string>(() => {
    return localStorage.getItem('dias_eafit_food_day') || EVENT_SCHEDULE[0].dayId;
  });

  const setSelectedDayId = (dayId: string) => {
    setSelectedDayIdState(dayId);
    localStorage.setItem('dias_eafit_food_day', dayId);
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRestrictionsOnly, setFilterRestrictionsOnly] = useState(false);
  const [foodDeliveries, setFoodDeliveries] = useState<FoodDelivery[]>([]);

  useEffect(() => {
    const unsub = subscribeToFoodDeliveries(setFoodDeliveries);
    return () => unsub();
  }, []);

  const eventDays = useMemo(() => {
    if (events && events.length > 0) {
      return events.map((ev) => ({
        dayId: ev.dayId,
        dayName: ev.dayName,
        eventName: ev.name,
      }));
    }
    return EVENT_SCHEDULE;
  }, [events]);

  const currentDay = eventDays.find((d) => d.dayId === selectedDayId) || eventDays[0] || EVENT_SCHEDULE[0];

  const dayAssignments = useMemo(() => {
    return assignments.filter((a) => a.dayId === selectedDayId);
  }, [assignments, selectedDayId]);

  // CALCULATION LOGIC EXACTLY LIKE FOODVIEW.TSX
  const allMealEntitlements = useMemo(() => {
    const personIds = Array.from(new Set(dayAssignments.map((a) => a.personId)));

    return personIds.map((pid) => {
      const person = people.find((p) => p.id === pid);
      const personShifts = dayAssignments.filter((a) => a.personId === pid);

      const totalMinutes = sumShiftMinutes(
        personShifts.map(
          (asgn) => (shifts && shifts.find((s) => s.id === asgn.shiftId)) || DEFAULT_INITIAL_SHIFTS.find((s) => s.id === asgn.shiftId)
        )
      );
      const { lunches, snacks } = mealsForMinutes(totalMinutes);

      return {
        person,
        totalMinutes,
        totalHours: formatWorked(totalMinutes),
        lunches,
        snacks,
      };
    }).filter(e => e.person); // remove undefined people
  }, [dayAssignments, people, shifts]);

  const filteredEntitlements = useMemo(() => {
    let list = allMealEntitlements;
    
    if (filterRestrictionsOnly) {
      list = list.filter(e => {
        const restrictions = e.person?.dietaryRestrictions?.trim().toLowerCase() || '';
        return restrictions !== '' && restrictions !== 'ninguna' && restrictions !== 'ninguno';
      });
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(e => 
        (e.person?.name && e.person.name.toLowerCase().includes(lower)) ||
        (e.person?.documentId && e.person.documentId.includes(lower))
      );
    }
    return list.sort((a, b) => (a.person?.name || '').localeCompare(b.person?.name || ''));
  }, [allMealEntitlements, searchTerm, filterRestrictionsOnly]);

  const getDelivery = (personId: string, type: 'almuerzo' | 'refrigerio_1' | 'refrigerio_2' | 'obs') => {
    return foodDeliveries.find(fd => fd.personId === personId && fd.dayId === selectedDayId && fd.type === type);
  };

  const handleToggle = (personId: string, type: 'almuerzo' | 'refrigerio_1' | 'refrigerio_2') => {
    const existing = getDelivery(personId, type);
    recordFoodDelivery({
      personId,
      dayId: selectedDayId,
      type: type as any,
      delivered: existing ? !existing.delivered : true,
      observations: ''
    });
  };

  const handleObservationChange = (personId: string, value: string) => {
    recordFoodDelivery({
      personId,
      dayId: selectedDayId,
      type: 'obs' as any,
      delivered: false,
      observations: value
    });
  };

  const exportToExcel = () => {
    const rows: any[] = [];
    const headers = ['Documento', 'Nombre', 'Restricción Alimentaria', 'Horas Asignadas', 'Almuerzo', 'Refrigerio 1', 'Refrigerio 2', 'Observaciones Generales'];
    rows.push(headers);

    filteredEntitlements.forEach(entry => {
      const p = entry.person!;
      const alm = getDelivery(p.id, 'almuerzo');
      const ref1 = getDelivery(p.id, 'refrigerio_1');
      const ref2 = getDelivery(p.id, 'refrigerio_2');
      const obs = getDelivery(p.id, 'obs');
      
      rows.push([
        p.documentId || '',
        p.name || '',
        p.dietaryRestrictions || 'Ninguna',
        entry.totalHours,
        entry.lunches > 0 ? (alm?.delivered ? 'Entregado' : 'Pendiente') : 'N/A',
        entry.snacks > 0 ? (ref1?.delivered ? 'Entregado' : 'Pendiente') : 'N/A',
        entry.snacks > 1 ? (ref2?.delivered ? 'Entregado' : 'Pendiente') : 'N/A',
        obs?.observations || ''
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Control Alimentacion');
    XLSX.writeFile(workbook, `Control_Alim_${currentDay.dayName}.xlsx`);
  };

  // Stats
  let totalLunchesNeeded = 0;
  let totalSnacksNeeded = 0;
  let deliveredLunches = 0;
  let deliveredSnacks = 0;

  allMealEntitlements.forEach(e => {
    totalLunchesNeeded += e.lunches;
    totalSnacksNeeded += e.snacks;
    if (e.lunches > 0 && getDelivery(e.person!.id, 'almuerzo')?.delivered) deliveredLunches++;
    if (e.snacks > 0 && getDelivery(e.person!.id, 'refrigerio_1')?.delivered) deliveredSnacks++;
    if (e.snacks > 1 && getDelivery(e.person!.id, 'refrigerio_2')?.delivered) deliveredSnacks++;
  });

  return (
    <div className="space-y-6 text-tinta-900">
      <div className="bg-surface border border-tinta-200 rounded-3xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-tinta-900 tracking-wide font-display">
              CONTROL DE ALIMENTACIÓN EN VIVO
            </h2>
            <p className="text-xs sm:text-sm text-tinta-500 mt-1 font-sans">
              Marca la entrega exacta según la cantidad de comida calculada por sus horas de turno.
            </p>
          </div>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-turquesa-600 hover:bg-turquesa-600 text-white rounded-xl text-sm font-bold transition-all shadow-xs shrink-0"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="bg-surface border border-tinta-200 rounded-3xl p-4 flex flex-col gap-4 shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {eventDays.map((d) => (
            <button
              key={d.dayId}
              onClick={() => setSelectedDayId(d.dayId)}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wider transition-all whitespace-nowrap ${
                selectedDayId === d.dayId
                  ? 'bg-lila-600 text-white shadow-xs font-display'
                  : 'bg-tinta-50 text-tinta-500 hover:text-tinta-900 hover:bg-tinta-100 font-sans border border-tinta-200'
              }`}
            >
              {d.dayName}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-tinta-200 p-5 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-mostaza-50 border-2 border-mostaza-300/40 flex items-center justify-center text-mostaza-600">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-tinta-500 uppercase tracking-wider">Almuerzos Entregados</p>
              <p className="text-2xl font-black text-tinta-900 font-mono">{deliveredLunches} <span className="text-sm text-tinta-400 font-normal">/ {totalLunchesNeeded}</span></p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-tinta-200 p-5 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-mostaza-50 border-2 border-mostaza-300/40 flex items-center justify-center text-mostaza-600">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-tinta-500 uppercase tracking-wider">Refrigerios Entregados</p>
              <p className="text-2xl font-black text-tinta-900 font-mono">{deliveredSnacks} <span className="text-sm text-tinta-400 font-normal">/ {totalSnacksNeeded}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-tinta-200 rounded-3xl overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 border-b border-tinta-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-tinta-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar persona..."
              className="block w-full pl-10 pr-10 py-2 sm:text-sm border-tinta-200 rounded-xl focus:ring-lila-600 focus:border-lila-600 bg-tinta-50"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-tinta-400 hover:text-tinta-900"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setFilterRestrictionsOnly(!filterRestrictionsOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-xs border ${
              filterRestrictionsOnly
                ? 'bg-coral-50 text-coral-600 border-coral-200'
                : 'bg-white text-tinta-500 border-tinta-200 hover:bg-tinta-50 hover:text-tinta-900'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            Solo Restricciones (Vegetarianos, etc.)
          </button>
        </div>

        {filteredEntitlements.length === 0 ? (
          <div className="p-12 text-center text-tinta-500">
            <Users className="w-12 h-12 mx-auto text-tinta-300 mb-3" />
            <p className="text-sm font-semibold">No hay personas con turno para este día.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-tinta-50 border-b border-tinta-200 text-[11px] font-bold text-tinta-500 uppercase tracking-wider">
                  <th className="p-4">Persona</th>
                  <th className="p-4 text-center">Almuerzo</th>
                  <th className="p-4 text-center">Refrigerio 1</th>
                  <th className="p-4 text-center">Refrigerio 2</th>
                  <th className="p-4">Observaciones Generales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tinta-200">
                {filteredEntitlements.map(entry => {
                  const p = entry.person!;
                  const alm = getDelivery(p.id, 'almuerzo');
                  const ref1 = getDelivery(p.id, 'refrigerio_1');
                  const ref2 = getDelivery(p.id, 'refrigerio_2');
                  const obs = getDelivery(p.id, 'obs');

                  return (
                    <tr key={p.id} className="hover:bg-tinta-50/50 transition-colors">
                      <td className="p-4">
                        <p className="text-sm font-bold text-tinta-900">{p.name}</p>
                        <p className="text-[11px] text-tinta-500 font-mono">{p.documentId}</p>
                        <div className="flex gap-2 flex-wrap mt-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-tinta-200 text-tinta-600">
                            {entry.totalHours}
                          </span>
                          {p.dietaryRestrictions && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-coral-50 text-coral-600 border border-coral-200">
                              <AlertCircle className="w-3 h-3" /> {p.dietaryRestrictions}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Almuerzo */}
                      <td className="p-4 text-center align-middle">
                        {entry.lunches > 0 ? (
                          <button
                            onClick={() => handleToggle(p.id, 'almuerzo')}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all mx-auto ${
                              alm?.delivered
                                ? 'bg-turquesa-600 text-white shadow-xs scale-105'
                                : 'bg-tinta-100 text-tinta-300 border-2 border-tinta-200 hover:border-tinta-400 hover:text-tinta-400'
                            }`}
                          >
                            <Check className="w-6 h-6 stroke-[3]" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-tinta-400 font-bold">N/A</span>
                        )}
                      </td>

                      {/* Refrigerio 1 */}
                      <td className="p-4 text-center align-middle">
                        {entry.snacks > 0 ? (
                          <button
                            onClick={() => handleToggle(p.id, 'refrigerio_1')}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all mx-auto ${
                              ref1?.delivered
                                ? 'bg-turquesa-600 text-white shadow-xs scale-105'
                                : 'bg-tinta-100 text-tinta-300 border-2 border-tinta-200 hover:border-tinta-400 hover:text-tinta-400'
                            }`}
                          >
                            <Check className="w-6 h-6 stroke-[3]" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-tinta-400 font-bold">N/A</span>
                        )}
                      </td>

                      {/* Refrigerio 2 */}
                      <td className="p-4 text-center align-middle">
                        {entry.snacks > 1 ? (
                          <button
                            onClick={() => handleToggle(p.id, 'refrigerio_2')}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all mx-auto ${
                              ref2?.delivered
                                ? 'bg-turquesa-600 text-white shadow-xs scale-105'
                                : 'bg-tinta-100 text-tinta-300 border-2 border-tinta-200 hover:border-tinta-400 hover:text-tinta-400'
                            }`}
                          >
                            <Check className="w-6 h-6 stroke-[3]" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-tinta-400 font-bold">N/A</span>
                        )}
                      </td>

                      <td className="p-4 align-middle">
                        <input
                          type="text"
                          placeholder="Escribe alguna novedad..."
                          value={obs?.observations || ''}
                          onChange={(e) => handleObservationChange(p.id, e.target.value)}
                          className="w-full text-xs px-3 py-2.5 rounded-lg border border-tinta-200 bg-white focus:outline-none focus:border-lila-600 focus:ring-1 focus:ring-lila-600"
                        />
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
