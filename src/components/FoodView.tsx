import React, { useState, useMemo } from 'react';
import { Person, Assignment, ConfigurableShift, AppEvent, GtSubTeam } from '../types';
import { EVENT_SCHEDULE, findShiftById } from '../data/eventStructure';
import {
  Utensils,
  Coffee,
  Sun,
  AlertCircle,
  Search,
  X,
  Filter,
  Users,
  Shield,
  ArrowUpDown,
  ChevronDown,
  Check,
  Download,
  Copy,
  CheckCheck,
} from 'lucide-react';

interface FoodViewProps {
  people: Person[];
  assignments: Assignment[];
  shifts?: ConfigurableShift[];
  events?: AppEvent[];
}

const PRIMARY_GT_SUBTEAMS: GtSubTeam[] = [
  'Logística',
  'Mercadeo',
  'RRPP',
  'Generales',
  'GH',
  'Seguridad',
  'Carnival',
  'The Games',
];

type MealFilter = 'ALL' | 'ALMUERZO' | 'REFRIGERIO' | 'SIN_COMIDA' | 'RESTRICCION';
type SortField = 'name' | 'hours' | 'lunches' | 'snacks' | 'team';
type SortDirection = 'asc' | 'desc';

export const FoodView: React.FC<FoodViewProps> = ({ people, assignments, shifts, events }) => {
  const [selectedDayId, setSelectedDayId] = useState<string>('lunes');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTeamFilter, setActiveTeamFilter] = useState<string>('ALL');
  const [mealFilter, setMealFilter] = useState<MealFilter>('ALL');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Dynamic or default event schedule
  const eventDays = useMemo(() => {
    if (events && events.length > 0) {
      return events.map((ev) => ({
        dayId: ev.dayId,
        dayName: ev.dayName,
        eventName: ev.name,
        shifts: (shifts || []).filter((s) => s.dayId === ev.dayId),
      }));
    }
    return EVENT_SCHEDULE;
  }, [events, shifts]);

  const currentDay = eventDays.find((d) => d.dayId === selectedDayId) || eventDays[0] || EVENT_SCHEDULE[0];

  // Distinct persons assigned to this day
  const dayAssignments = useMemo(() => {
    return assignments.filter((a) => a.dayId === selectedDayId);
  }, [assignments, selectedDayId]);

  const assignedPersonIds = useMemo(() => {
    return Array.from(new Set(dayAssignments.map((a) => a.personId)));
  }, [dayAssignments]);

  // Helper to calculate shift duration in minutes
  const getShiftDurationMinutes = (startTime: string, endTime: string): number => {
    const [startH, startM] = (startTime || '00:00').split(':').map(Number);
    const [endH, endM] = (endTime || '00:00').split(':').map(Number);
    const startTotal = (startH || 0) * 60 + (startM || 0);
    const endTotal = (endH || 0) * 60 + (endM || 0);
    return Math.max(0, endTotal - startTotal);
  };

  // Calculate meal entitlements strictly based on assigned hours
  // < 3h: ninguno
  // 3h a 5h: 1 refrigerio
  // 6h a 8h: 1 almuerzo + 1 refrigerio
  // >= 9h: 1 almuerzo + 2 refrigerios
  const allMealEntitlements = useMemo(() => {
    return assignedPersonIds.map((pid) => {
      const person = people.find((p) => p.id === pid);
      const personShifts = dayAssignments.filter((a) => a.personId === pid);

      let totalMinutes = 0;
      personShifts.forEach((asgn) => {
        const shiftDef = shifts
          ? shifts.find((s) => s.id === asgn.shiftId)
          : findShiftById(currentDay, asgn.shiftId);
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

      // Determine effective group and subteam
      const primaryType = person?.primaryType || 'GT';
      const effectiveGroup = primaryType;

      // Effective GT subteam
      const assignedSub = personShifts.find((s) => s.gtSubTeam)?.gtSubTeam;
      const effectiveGtSubTeam = (
        assignedSub ||
        person?.gtSubTeam ||
        (effectiveGroup === 'GT' ? 'Generales' : '')
      ).trim();

      return {
        person,
        shifts: personShifts,
        totalHours,
        lunches,
        snacks,
        effectiveGroup,
        effectiveGtSubTeam,
      };
    });
  }, [assignedPersonIds, dayAssignments, people, shifts, currentDay]);

  // Extract all GT subteams with counts for current day
  const gtSubTeamStats = useMemo(() => {
    let totalGt = 0;
    let totalMesa = 0;
    let totalGap = 0;
    const counts: Record<string, number> = {};
    const discoveredExtraTeams: string[] = [];

    allMealEntitlements.forEach((entry) => {
      if (entry.effectiveGroup === 'MESA') {
        totalMesa++;
      } else if (entry.effectiveGroup === 'GAP') {
        totalGap++;
      } else {
        totalGt++;
        const sub = entry.effectiveGtSubTeam || 'Generales';
        const lower = sub.toLowerCase();
        const matched = PRIMARY_GT_SUBTEAMS.find((p) => p.toLowerCase() === lower);
        if (matched) {
          counts[matched.toLowerCase()] = (counts[matched.toLowerCase()] || 0) + 1;
        } else if (sub) {
          if (!discoveredExtraTeams.some((t) => t.toLowerCase() === lower)) {
            discoveredExtraTeams.push(sub);
          }
          counts[lower] = (counts[lower] || 0) + 1;
        }
      }
    });

    const primaryList = PRIMARY_GT_SUBTEAMS.map((team) => ({
      team,
      filterId: `GT:${team}`,
      label: `GT ${team.toUpperCase()}`,
      count: counts[team.toLowerCase()] || 0,
    }));

    const extraList = discoveredExtraTeams.map((team) => ({
      team,
      filterId: `GT:${team}`,
      label: `GT ${team.toUpperCase()}`,
      count: counts[team.toLowerCase()] || 0,
    }));

    return {
      totalAll: allMealEntitlements.length,
      totalGt,
      totalMesa,
      totalGap,
      subTeams: [...primaryList, ...extraList],
    };
  }, [allMealEntitlements]);

  // Filtered entitlements based on Search, GT/Team filter, and Meal filter
  const filteredMealEntitlements = useMemo(() => {
    return allMealEntitlements.filter((entry) => {
      const person = entry.person;

      // 1. Team / Sub-team filter
      if (activeTeamFilter === 'ALL') {
        // match all
      } else if (activeTeamFilter === 'GT') {
        if (entry.effectiveGroup !== 'GT') return false;
      } else if (activeTeamFilter.startsWith('GT:')) {
        if (entry.effectiveGroup !== 'GT') return false;
        const targetTeam = activeTeamFilter.replace('GT:', '').toLowerCase();
        const personSub = entry.effectiveGtSubTeam.toLowerCase();
        const matchesSub =
          personSub === targetTeam ||
          (person?.gtTeams || []).some((t) => t.toLowerCase() === targetTeam) ||
          entry.shifts.some((s) => (s.gtSubTeam || '').toLowerCase() === targetTeam);
        if (!matchesSub) return false;
      } else if (activeTeamFilter === 'MESA') {
        if (entry.effectiveGroup !== 'MESA') return false;
      } else if (activeTeamFilter === 'GAP') {
        if (entry.effectiveGroup !== 'GAP') return false;
      }

      // 2. Meal Status filter
      if (mealFilter === 'ALMUERZO') {
        if (entry.lunches === 0) return false;
      } else if (mealFilter === 'REFRIGERIO') {
        if (entry.snacks === 0) return false;
      } else if (mealFilter === 'SIN_COMIDA') {
        if (entry.lunches > 0 || entry.snacks > 0) return false;
      } else if (mealFilter === 'RESTRICCION') {
        const restr = (person?.dietaryRestrictions || '').trim().toLowerCase();
        if (!restr || restr === 'ninguna' || restr === 'no' || restr === 'ninguno' || restr === 'n/a') {
          return false;
        }
      }

      // 3. Text Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (person?.name || '').toLowerCase();
        const fullName = (person?.fullName || '').toLowerCase();
        const doc = (person?.documentId || '').toLowerCase();
        const user = (person?.username || '').toLowerCase();
        const sub = (entry.effectiveGtSubTeam || '').toLowerCase();
        const group = (entry.effectiveGroup || '').toLowerCase();
        const restr = (person?.dietaryRestrictions || '').toLowerCase();
        const shiftMatches = entry.shifts.some((s) => {
          const shiftDef = shifts
            ? shifts.find((sh) => sh.id === s.shiftId)
            : findShiftById(currentDay, s.shiftId);
          const shiftName = (shiftDef?.name || s.shiftId || '').toLowerCase();
          const fnName = (s.assignedFunction || '').toLowerCase();
          return shiftName.includes(q) || fnName.includes(q);
        });

        if (
          !name.includes(q) &&
          !fullName.includes(q) &&
          !doc.includes(q) &&
          !user.includes(q) &&
          !sub.includes(q) &&
          !group.includes(q) &&
          !restr.includes(q) &&
          !shiftMatches
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allMealEntitlements, activeTeamFilter, mealFilter, searchQuery, shifts, currentDay]);

  // Sorted entitlements
  const sortedMealEntitlements = useMemo(() => {
    return [...filteredMealEntitlements].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        const nameA = a.person?.name || '';
        const nameB = b.person?.name || '';
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === 'hours') {
        comparison = a.totalHours - b.totalHours;
      } else if (sortField === 'lunches') {
        comparison = a.lunches - b.lunches;
      } else if (sortField === 'snacks') {
        comparison = a.snacks - b.snacks;
      } else if (sortField === 'team') {
        const teamA = `${a.effectiveGroup}:${a.effectiveGtSubTeam}`;
        const teamB = `${b.effectiveGroup}:${b.effectiveGtSubTeam}`;
        comparison = teamA.localeCompare(teamB);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredMealEntitlements, sortField, sortDirection]);

  // Overall statistics for current day (full day)
  const totalDayLunches = allMealEntitlements.reduce((sum, m) => sum + m.lunches, 0);
  const totalDaySnacks = allMealEntitlements.reduce((sum, m) => sum + m.snacks, 0);
  const totalDayNoFood = allMealEntitlements.filter((m) => m.lunches === 0 && m.snacks === 0).length;

  // Filtered statistics (reflecting active filters)
  const filteredLunches = filteredMealEntitlements.reduce((sum, m) => sum + m.lunches, 0);
  const filteredSnacks = filteredMealEntitlements.reduce((sum, m) => sum + m.snacks, 0);
  const filteredNoFood = filteredMealEntitlements.filter((m) => m.lunches === 0 && m.snacks === 0).length;

  const isFilteringActive =
    searchQuery.trim() !== '' || activeTeamFilter !== 'ALL' || mealFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveTeamFilter('ALL');
    setMealFilter('ALL');
  };

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Copy Summary to Clipboard for Kitchen/Catering logistics
  const handleCopySummary = () => {
    const lines = [
      `PLANILLA DE ALIMENTACIÓN — DÍAS EAFIT 2026`,
      `Jornada: ${currentDay.dayName.toUpperCase()} (${currentDay.eventName})`,
      `Filtro activo: ${activeTeamFilter === 'ALL' ? 'Todos los grupos' : activeTeamFilter}`,
      `Total Personas: ${filteredMealEntitlements.length}`,
      `Total Almuerzos: ${filteredLunches}`,
      `Total Refrigerios: ${filteredSnacks}`,
      `Sin Alimentación: ${filteredNoFood}`,
      ``,
      `--- DETALLE POR PERSONA ---`,
    ];

    filteredMealEntitlements.forEach((e, idx) => {
      const p = e.person;
      const teamLabel = e.effectiveGroup === 'GT' ? `GT: ${e.effectiveGtSubTeam}` : e.effectiveGroup;
      const foodText = [
        e.lunches > 0 ? `${e.lunches} Almuerzo` : null,
        e.snacks > 0 ? `${e.snacks} Refrigerio${e.snacks > 1 ? 's' : ''}` : null,
        e.lunches === 0 && e.snacks === 0 ? 'Sin alimentación' : null,
      ]
        .filter(Boolean)
        .join(', ');
      const restr = p?.dietaryRestrictions ? ` [Restricción: ${p.dietaryRestrictions}]` : '';
      lines.push(`${idx + 1}. ${p?.name || 'S/N'} (${teamLabel}) — ${e.totalHours}h — ${foodText}${restr}`);
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Nombre',
      'Documento',
      'Grupo / Subequipo',
      'Horas Totales',
      'Almuerzos',
      'Refrigerios',
      'Restricción Alimentaria',
      'Turnos Asignados',
    ];

    const rows = filteredMealEntitlements.map((e) => {
      const shiftLabels = e.shifts
        .map((s) => {
          const def = shifts
            ? shifts.find((sh) => sh.id === s.shiftId)
            : findShiftById(currentDay, s.shiftId);
          return def ? `${def.category ? `${def.category} ` : ''}${def.name}` : s.shiftId;
        })
        .join('; ');

      const teamLabel = e.effectiveGroup === 'GT' ? `GT: ${e.effectiveGtSubTeam}` : e.effectiveGroup;

      return [
        `"${e.person?.name || ''}"`,
        `"${e.person?.documentId || ''}"`,
        `"${teamLabel}"`,
        `"${e.totalHours}h"`,
        `"${e.lunches}"`,
        `"${e.snacks}"`,
        `"${e.person?.dietaryRestrictions || 'Ninguna'}"`,
        `"${shiftLabels}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `alimentacion_${selectedDayId}_${activeTeamFilter.replace(':', '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-[#182535]">
      {/* Header */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#182535] tracking-wide font-dalek">
            GESTIÓN DE ALIMENTACIÓN
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-montserrat">
            Cálculo según horas totales asignadas: &lt;3h (ninguno), 3h-5h (1 refrigerio), 6h-8h (1 almuerzo + 1 refrigerio), ≥9h (1 almuerzo + 2 refrigerios).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button
            onClick={handleCopySummary}
            className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold text-[#182535] bg-[#FAF6EC] hover:bg-[#F3EEDC] border border-[#EADDC7] transition-all flex items-center gap-1.5 shadow-2xs font-montserrat cursor-pointer"
            title="Copiar lista resumida al portapapeles para cocina o proveedores"
          >
            {copiedSummary ? (
              <>
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                <span>Copiar Resumen</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportCsv}
            className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold text-[#B83A24] bg-[#FDF2EE] hover:bg-[#FBE4DD] border border-[#F6C7BA] transition-all flex items-center gap-1.5 shadow-2xs font-montserrat cursor-pointer"
            title="Descargar reporte en formato CSV / Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex items-center gap-2 overflow-x-auto bg-[#FFFDF8] border border-[#EADDC7] p-2 rounded-2xl pb-2 scrollbar-none shadow-2xs">
        {eventDays.map((d) => (
          <button
            key={d.dayId}
            onClick={() => setSelectedDayId(d.dayId)}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold tracking-wider whitespace-nowrap transition-all cursor-pointer ${
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
          <div className="text-3xl font-bold text-[#182535] mt-2 font-mono">
            {isFilteringActive ? filteredLunches : totalDayLunches}
          </div>
          <p className="text-[11px] text-[#64748B] mt-1 font-montserrat">
            {isFilteringActive
              ? `Filtrados (${filteredLunches} de ${totalDayLunches} en la jornada)`
              : 'Personas con 6 o más horas acumuladas en el día'}
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
          <div className="text-3xl font-bold text-[#182535] mt-2 font-mono">
            {isFilteringActive ? filteredSnacks : totalDaySnacks}
          </div>
          <p className="text-[11px] text-[#64748B] mt-1 font-montserrat">
            {isFilteringActive
              ? `Filtrados (${filteredSnacks} de ${totalDaySnacks} en la jornada)`
              : 'Raciones de refrigerio asignadas (1 o 2 por integrante)'}
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
          <div className="text-3xl font-bold text-[#64748B] mt-2 font-mono">
            {isFilteringActive ? filteredNoFood : totalDayNoFood}
          </div>
          <p className="text-[11px] text-[#64748B] mt-1 font-montserrat">
            {isFilteringActive
              ? `Filtrados (${filteredNoFood} de ${totalDayNoFood} en la jornada)`
              : 'Integrantes con menos de 3 horas acumuladas'}
          </p>
        </div>
      </div>

      {/* FILTER PANEL: GT SUB-TEAM SELECTOR + SEARCH + MEAL FILTER */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, documento (C.C.), usuario, turno o restricción..."
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs sm:text-sm text-[#182535] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#B83A24] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#182535] p-1 rounded-full transition-colors cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Direct Select Dropdown: GT / Subteam / Grupo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative min-w-[240px] sm:min-w-[280px]">
              <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
                Filtrar por GT / Sub-Equipo / Grupo:
              </label>
              <div className="relative">
                <select
                  value={activeTeamFilter}
                  onChange={(e) => setActiveTeamFilter(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-2xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs font-bold text-[#182535] focus:outline-none focus:border-[#B83A24] cursor-pointer shadow-2xs transition-all"
                >
                  <option value="ALL">TODOS LOS GRUPOS ({gtSubTeamStats.totalAll})</option>
                  <option value="GT">TODO GT — Todos los subequipos ({gtSubTeamStats.totalGt})</option>
                  <optgroup label="SUB-EQUIPOS GT (Seleccionar)">
                    {gtSubTeamStats.subTeams.map((sub) => (
                      <option key={sub.filterId} value={sub.filterId}>
                        GT → {sub.team} ({sub.count})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="OTROS GRUPOS">
                    <option value="MESA">MESA DIRECTIVA ({gtSubTeamStats.totalMesa})</option>
                    <option value="GAP">GAP — GRUPO DE APOYO ({gtSubTeamStats.totalGap})</option>
                  </optgroup>
                </select>
                <ChevronDown className="w-4 h-4 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Meal Filter Dropdown */}
            <div className="relative min-w-[170px]">
              <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
                Estado Alimentación:
              </label>
              <div className="relative">
                <select
                  value={mealFilter}
                  onChange={(e) => setMealFilter(e.target.value as MealFilter)}
                  className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-2xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs font-bold text-[#182535] focus:outline-none focus:border-[#B83A24] cursor-pointer shadow-2xs transition-all"
                >
                  <option value="ALL">TODOS</option>
                  <option value="ALMUERZO">CON ALMUERZO ({allMealEntitlements.filter((m) => m.lunches > 0).length})</option>
                  <option value="REFRIGERIO">CON REFRIGERIO ({allMealEntitlements.filter((m) => m.snacks > 0).length})</option>
                  <option value="SIN_COMIDA">SIN ALIMENTACIÓN ({totalDayNoFood})</option>
                  <option value="RESTRICCION">
                    CON RESTRICCIÓN ({allMealEntitlements.filter((m) => {
                      const r = (m.person?.dietaryRestrictions || '').trim().toLowerCase();
                      return r && r !== 'ninguna' && r !== 'no' && r !== 'n/a';
                    }).length})
                  </option>
                </select>
                <ChevronDown className="w-4 h-4 text-[#64748B] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick-Access Pills for GT Sub-Teams */}
        <div className="pt-2 border-t border-[#EADDC7]/70">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#B83A24]" />
              Acceso Rápido:
            </span>

            {/* Pill: TODOS */}
            <button
              onClick={() => setActiveTeamFilter('ALL')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTeamFilter === 'ALL'
                  ? 'bg-[#182535] text-white shadow-xs'
                  : 'bg-[#FAF6EC] text-[#64748B] hover:text-[#182535] hover:bg-[#F3EEDC] border border-[#EADDC7]'
              }`}
            >
              <span>TODOS</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTeamFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-[#EADDC7] text-[#182535]'
                }`}
              >
                {gtSubTeamStats.totalAll}
              </span>
            </button>

            {/* Pill: TODO GT */}
            <button
              onClick={() => setActiveTeamFilter('GT')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTeamFilter === 'GT'
                  ? 'bg-[#B83A24] text-white shadow-xs'
                  : 'bg-[#FAF6EC] text-[#64748B] hover:text-[#B83A24] hover:bg-[#FDF2EE] border border-[#EADDC7]'
              }`}
            >
              <span>TODO GT</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTeamFilter === 'GT' ? 'bg-white/20 text-white' : 'bg-[#F6C7BA] text-[#B83A24]'
                }`}
              >
                {gtSubTeamStats.totalGt}
              </span>
            </button>

            {/* Pills: Each GT Subteam */}
            {gtSubTeamStats.subTeams.map((sub) => {
              const isActive = activeTeamFilter === sub.filterId;
              return (
                <button
                  key={sub.filterId}
                  onClick={() => setActiveTeamFilter(sub.filterId)}
                  className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#B83A24] text-white shadow-xs'
                      : 'bg-[#FAF6EC] text-[#64748B] hover:text-[#B83A24] hover:bg-[#FDF2EE] border border-[#EADDC7]'
                  }`}
                >
                  <span>{sub.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#EADDC7] text-[#182535]'
                    }`}
                  >
                    {sub.count}
                  </span>
                </button>
              );
            })}

            {/* Pill: MESA */}
            <button
              onClick={() => setActiveTeamFilter('MESA')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTeamFilter === 'MESA'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-[#FAF6EC] text-[#64748B] hover:text-purple-700 hover:bg-purple-50 border border-[#EADDC7]'
              }`}
            >
              <span>MESA</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTeamFilter === 'MESA' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
                }`}
              >
                {gtSubTeamStats.totalMesa}
              </span>
            </button>

            {/* Pill: GAP */}
            <button
              onClick={() => setActiveTeamFilter('GAP')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTeamFilter === 'GAP'
                  ? 'bg-[#C87F17] text-white shadow-xs'
                  : 'bg-[#FAF6EC] text-[#64748B] hover:text-[#C87F17] hover:bg-[#FEF8EC] border border-[#EADDC7]'
              }`}
            >
              <span>GAP</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTeamFilter === 'GAP' ? 'bg-white/20 text-white' : 'bg-[#FDE68A] text-[#C87F17]'
                }`}
              >
                {gtSubTeamStats.totalGap}
              </span>
            </button>

            {/* Clear Filters Button */}
            {isFilteringActive && (
              <button
                onClick={handleResetFilters}
                className="min-h-[32px] px-2.5 py-1 rounded-xl text-xs font-bold text-[#B83A24] hover:bg-[#FDF2EE] border border-[#F6C7BA] transition-all flex items-center gap-1 shrink-0 ml-auto cursor-pointer"
                title="Restablecer todos los filtros"
              >
                <X className="w-3 h-3" />
                <span>Limpiar filtros</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Roster Table Container */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-[#EADDC7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-[#182535] font-dalek tracking-wide">
                PLANILLA DE ALIMENTACIÓN: {currentDay.dayName.toUpperCase()} ({currentDay.eventName})
              </h3>
              {activeTeamFilter !== 'ALL' && (
                <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA]">
                  {activeTeamFilter.startsWith('GT:')
                    ? `Filtro: ${activeTeamFilter.replace('GT:', 'GT ')}`
                    : `Filtro: ${activeTeamFilter}`}
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B] font-montserrat mt-0.5">
              Mostrando <b>{sortedMealEntitlements.length}</b> de{' '}
              <b>{allMealEntitlements.length}</b> integrantes asignados para esta jornada
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="text-[11px] text-[#64748B] font-bold">Ordenar por:</span>
            <button
              onClick={() => handleSortToggle('name')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all ${
                sortField === 'name'
                  ? 'bg-[#182535] text-white border-[#182535]'
                  : 'bg-[#FAF6EC] text-[#475569] border-[#EADDC7]'
              }`}
            >
              <span>Nombre</span>
              <ArrowUpDown className="w-3 h-3 opacity-70" />
            </button>
            <button
              onClick={() => handleSortToggle('hours')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all ${
                sortField === 'hours'
                  ? 'bg-[#182535] text-white border-[#182535]'
                  : 'bg-[#FAF6EC] text-[#475569] border-[#EADDC7]'
              }`}
            >
              <span>Horas</span>
              <ArrowUpDown className="w-3 h-3 opacity-70" />
            </button>
            <button
              onClick={() => handleSortToggle('team')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all ${
                sortField === 'team'
                  ? 'bg-[#182535] text-white border-[#182535]'
                  : 'bg-[#FAF6EC] text-[#475569] border-[#EADDC7]'
              }`}
            >
              <span>Grupo</span>
              <ArrowUpDown className="w-3 h-3 opacity-70" />
            </button>
          </div>
        </div>

        {allMealEntitlements.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B]">
            <Utensils className="w-10 h-10 text-[#C87F17] mx-auto mb-3" />
            <p className="font-semibold text-[#182535] text-sm font-dalek">
              0 personas asignadas a {currentDay.dayName}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1 font-montserrat">
              Las raciones de comida se calculan automáticamente cuando se asigna personal a los turnos en la pestaña <b>TURNOS Y BASES</b>.
            </p>
          </div>
        ) : sortedMealEntitlements.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#64748B] space-y-3">
            <Search className="w-9 h-9 text-[#94A3B8] mx-auto opacity-70" />
            <div>
              <p className="font-semibold text-[#182535] text-sm font-dalek">
                No se encontraron resultados
              </p>
              <p className="text-xs text-[#94A3B8] mt-1 font-montserrat max-w-md mx-auto">
                No hay integrantes que coincidan con la búsqueda &quot;{searchQuery}&quot; o con el filtro{' '}
                <b>{activeTeamFilter}</b>.
              </p>
            </div>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl bg-[#182535] hover:bg-[#2A3F55] text-white text-xs font-bold font-montserrat transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar filtros de búsqueda</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-montserrat">
              <thead className="bg-[#FAF6EC] text-[#64748B] text-[11px] uppercase border-b border-[#EADDC7] font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Persona</th>
                  <th className="py-3.5 px-4">Grupo / Sub-Equipo</th>
                  <th className="py-3.5 px-4">Turnos Asignados</th>
                  <th className="py-3.5 px-4 text-center">Horas Totales</th>
                  <th className="py-3.5 px-4 text-center">Almuerzo</th>
                  <th className="py-3.5 px-4 text-center">Refrigerios</th>
                  <th className="py-3.5 px-4">Restricción Alimentaria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EADDC7] text-[#334155]">
                {sortedMealEntitlements.map((entry) => {
                  const shiftLabels = entry.shifts
                    .map((s) => {
                      const def = shifts
                        ? shifts.find((sh) => sh.id === s.shiftId)
                        : findShiftById(currentDay, s.shiftId);
                      return def ? `${def.category ? `${def.category} ` : ''}${def.name}` : s.shiftId;
                    })
                    .join(', ');

                  const hasRestriction = Boolean(
                    entry.person?.dietaryRestrictions &&
                      entry.person.dietaryRestrictions.trim().toLowerCase() !== 'ninguna' &&
                      entry.person.dietaryRestrictions.trim().toLowerCase() !== 'no' &&
                      entry.person.dietaryRestrictions.trim().toLowerCase() !== 'ninguno' &&
                      entry.person.dietaryRestrictions.trim().toLowerCase() !== 'n/a'
                  );

                  return (
                    <tr key={entry.person?.id} className="hover:bg-[#FAF6EC]/60 transition-colors">
                      {/* Persona */}
                      <td className="py-3.5 px-4 font-semibold text-[#182535]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-[#182535]">{entry.person?.name}</span>
                          {entry.person?.username && (
                            <span className="text-[10px] text-[#64748B] font-mono">
                              @{entry.person.username}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#64748B] font-normal font-mono block mt-0.5">
                          C.C: {entry.person?.documentId || 'S/N'}
                        </span>
                      </td>

                      {/* Grupo / Sub-equipo Badge */}
                      <td className="py-3.5 px-4">
                        {entry.effectiveGroup === 'MESA' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
                            <Shield className="w-3 h-3" />
                            <span>MESA</span>
                          </span>
                        ) : entry.effectiveGroup === 'GAP' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A]">
                            <Users className="w-3 h-3" />
                            <span>GAP</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA]">
                            <span>GT: {entry.effectiveGtSubTeam || 'Generales'}</span>
                          </span>
                        )}
                        {entry.person?.alsoActsAsGap && entry.effectiveGroup === 'GT' && (
                          <span className="block mt-1 text-[10px] text-emerald-700 font-medium">
                            + Actúa de GAP
                          </span>
                        )}
                      </td>

                      {/* Turnos */}
                      <td className="py-3.5 px-4 font-mono text-[#334155] text-[11px] max-w-xs">
                        {shiftLabels}
                      </td>

                      {/* Horas Totales */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-[#182535] text-sm">
                        <span className="px-2 py-0.5 rounded-md bg-[#FAF6EC] border border-[#EADDC7]">
                          {entry.totalHours}h
                        </span>
                      </td>

                      {/* Almuerzo */}
                      <td className="py-3.5 px-4 text-center">
                        {entry.lunches > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] text-xs font-bold font-mono shadow-2xs">
                            <Sun className="w-3.5 h-3.5" />
                            <span>{entry.lunches} ALMUERZO</span>
                          </span>
                        ) : (
                          <span className="text-[#94A3B8] text-xs">—</span>
                        )}
                      </td>

                      {/* Refrigerios */}
                      <td className="py-3.5 px-4 text-center">
                        {entry.snacks > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A] text-xs font-bold font-mono shadow-2xs">
                            <Coffee className="w-3.5 h-3.5" />
                            <span>{entry.snacks} REFRIGERIO{entry.snacks > 1 ? 'S' : ''}</span>
                          </span>
                        ) : (
                          <span className="text-[#94A3B8] text-xs">—</span>
                        )}
                      </td>

                      {/* Restricción Alimentaria */}
                      <td className="py-3.5 px-4">
                        {hasRestriction ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 font-bold text-[11px]">
                            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{entry.person?.dietaryRestrictions}</span>
                          </span>
                        ) : (
                          <span className="text-[#94A3B8] text-xs">
                            {entry.person?.dietaryRestrictions || 'Ninguna'}
                          </span>
                        )}
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
