import React, { useState, useMemo, useEffect } from 'react';
import { Person, Assignment, ConfigurableShift, AppEvent, FoodDelivery } from '../types';
import * as XLSX from 'xlsx';
import { EVENT_SCHEDULE } from '../data/eventStructure';
import {
  Utensils, Coffee, Download, Search, X, Users, Check, AlertCircle
} from 'lucide-react';
import { recordFoodDelivery, subscribeToFoodDeliveries } from '../services/storageService';

interface FoodViewProps {
  people: Person[];
  assignments: Assignment[];
  shifts?: ConfigurableShift[];
  events?: AppEvent[];
}

export const FoodView: React.FC<FoodViewProps> = ({ people, assignments, shifts, events }) => {
  const [selectedDayId, setSelectedDayId] = useState<string>(EVENT_SCHEDULE[0].dayId);
  const [searchTerm, setSearchTerm] = useState('');
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

  const assignedPeople = useMemo(() => {
    const personIds = Array.from(new Set(dayAssignments.map((a) => a.personId)));
    const list = personIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [dayAssignments, people]);

  const filteredPeople = useMemo(() => {
    if (!searchTerm) return assignedPeople;
    const lower = searchTerm.toLowerCase();
    return assignedPeople.filter(p => 
      (p.name && p.name.toLowerCase().includes(lower)) ||
      (p.documentId && p.documentId.includes(lower))
    );
  }, [assignedPeople, searchTerm]);

  const getDelivery = (personId: string, type: 'almuerzo' | 'refrigerio') => {
    return foodDeliveries.find(fd => fd.personId === personId && fd.dayId === selectedDayId && fd.type === type);
  };

  const handleToggle = (personId: string, type: 'almuerzo' | 'refrigerio') => {
    const existing = getDelivery(personId, type);
    recordFoodDelivery({
      personId,
      dayId: selectedDayId,
      type,
      delivered: existing ? !existing.delivered : true,
      observations: existing?.observations || ''
    });
  };

  const handleObservationChange = (personId: string, type: 'almuerzo' | 'refrigerio', value: string) => {
    const existing = getDelivery(personId, type);
    recordFoodDelivery({
      personId,
      dayId: selectedDayId,
      type,
      delivered: existing ? existing.delivered : false,
      observations: value
    });
  };

  const exportToExcel = () => {
    const rows: any[] = [];
    const headers = ['Documento', 'Nombre', 'Restriccion Alimentaria', 'Almuerzo Entregado', 'Obs. Almuerzo', 'Refrigerio Entregado', 'Obs. Refrigerio'];
    rows.push(headers);

    assignedPeople.forEach(person => {
      const alm = getDelivery(person.id, 'almuerzo');
      const ref = getDelivery(person.id, 'refrigerio');
      rows.push([
        person.documentId || '',
        person.name || '',
        person.dietaryRestrictions || 'Ninguna',
        alm?.delivered ? 'Si' : 'No',
        alm?.observations || '',
        ref?.delivered ? 'Si' : 'No',
        ref?.observations || ''
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Alimentacion');
    XLSX.writeFile(workbook, 'Alimentacion_' + currentDay.dayName + '.xlsx');
  };

  const almCount = assignedPeople.filter(p => getDelivery(p.id, 'almuerzo')?.delivered).length;
  const refCount = assignedPeople.filter(p => getDelivery(p.id, 'refrigerio')?.delivered).length;

  return (
    <div className="space-y-6 text-[#182535]">
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#182535] tracking-wide font-dalek">
              CONTROL DE ALIMENTACION
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-montserrat">
              Marcacion interactiva de entrega de almuerzos y refrigerios.
            </p>
          </div>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-sm font-bold transition-all shadow-xs shrink-0"
          >
            <Download className="w-4 h-4" />
            Exportar Excel del Dia
          </button>
        </div>
      </div>

      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-4 flex flex-col gap-4 shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {eventDays.map((d) => (
            <button
              key={d.dayId}
              onClick={() => setSelectedDayId(d.dayId)}
              className={min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wider transition-all whitespace-nowrap }
            >
              {d.dayName}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#FFFDF8] border border-[#EADDC7] p-5 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FEF8EC] border-2 border-[#E5A12E]/40 flex items-center justify-center text-[#C87F17]">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Almuerzos Entregados</p>
              <p className="text-2xl font-black text-[#182535] font-mono">{almCount} <span className="text-sm text-[#94A3B8] font-normal">/ {assignedPeople.length}</span></p>
            </div>
          </div>
        </div>
        <div className="bg-[#FFFDF8] border border-[#EADDC7] p-5 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FEF8EC] border-2 border-[#E5A12E]/40 flex items-center justify-center text-[#C87F17]">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Refrigerios Entregados</p>
              <p className="text-2xl font-black text-[#182535] font-mono">{refCount} <span className="text-sm text-[#94A3B8] font-normal">/ {assignedPeople.length}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 border-b border-[#EADDC7] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-[#94A3B8]" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar persona..."
              className="block w-full pl-10 pr-10 py-2 sm:text-sm border-[#EADDC7] rounded-xl focus:ring-[#B83A24] focus:border-[#B83A24] bg-[#FAF6EC]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#182535]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {filteredPeople.length === 0 ? (
          <div className="p-12 text-center text-[#64748B]">
            <Users className="w-12 h-12 mx-auto text-[#CBD5E1] mb-3" />
            <p className="text-sm font-semibold">No hay personas para este dia o busqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#FAF6EC] border-b border-[#EADDC7] text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  <th className="p-4">Persona</th>
                  <th className="p-4 text-center">Almuerzo</th>
                  <th className="p-4">Obs. Almuerzo</th>
                  <th className="p-4 text-center">Refrigerio</th>
                  <th className="p-4">Obs. Refrigerio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EADDC7]">
                {filteredPeople.map(p => {
                  const alm = getDelivery(p.id, 'almuerzo');
                  const ref = getDelivery(p.id, 'refrigerio');

                  return (
                    <tr key={p.id} className="hover:bg-[#FAF6EC]/50 transition-colors">
                      <td className="p-4">
                        <p className="text-sm font-bold text-[#182535]">{p.name}</p>
                        <p className="text-[11px] text-[#64748B] font-mono">{p.documentId}</p>
                        {p.dietaryRestrictions && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                            <AlertCircle className="w-3 h-3" /> {p.dietaryRestrictions}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center align-middle">
                        <button
                          onClick={() => handleToggle(p.id, 'almuerzo')}
                          className={w-10 h-10 rounded-xl flex items-center justify-center transition-all mx-auto }
                        >
                          <Check className="w-6 h-6 stroke-[3]" />
                        </button>
                      </td>
                      <td className="p-4 align-middle">
                        <input
                          type="text"
                          placeholder="Observaciones..."
                          value={alm?.observations || ''}
                          onChange={(e) => handleObservationChange(p.id, 'almuerzo', e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-[#EADDC7] bg-white focus:outline-none focus:border-[#B83A24] focus:ring-1 focus:ring-[#B83A24]"
                        />
                      </td>
                      <td className="p-4 text-center align-middle">
                        <button
                          onClick={() => handleToggle(p.id, 'refrigerio')}
                          className={w-10 h-10 rounded-xl flex items-center justify-center transition-all mx-auto }
                        >
                          <Check className="w-6 h-6 stroke-[3]" />
                        </button>
                      </td>
                      <td className="p-4 align-middle">
                        <input
                          type="text"
                          placeholder="Observaciones..."
                          value={ref?.observations || ''}
                          onChange={(e) => handleObservationChange(p.id, 'refrigerio', e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-[#EADDC7] bg-white focus:outline-none focus:border-[#B83A24] focus:ring-1 focus:ring-[#B83A24]"
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
