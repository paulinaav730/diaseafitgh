import React, { useState, useMemo } from 'react';
import {
  Person,
  PersonType,
  getPersonShirtQuota,
  getPersonShirtDeliveredCount,
  isPersonShirtFullyDelivered,
} from '../types';
import {
  updatePersonShirtDelivery,
  updatePersonShirtSize,
  batchUpdateShirtDelivery,
} from '../services/storageService';
import { exportShirtDeliveryExcel } from '../services/excelService';
import {
  Shirt,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Filter,
  Users,
  Shield,
  Check,
  X,
  RotateCcw,
  Sparkles,
  FileSpreadsheet,
  ChevronDown,
  Edit3,
  Calendar,
  Layers,
  ArrowUpDown,
} from 'lucide-react';

interface ShirtsViewProps {
  people: Person[];
}

const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const ShirtsView: React.FC<ShirtsViewProps> = ({ people }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<'ALL' | PersonType>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    'ALL' | 'PENDING' | 'PARTIAL' | 'DELIVERED'
  >('ALL');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('ALL');
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
  const [editingNotePerson, setEditingNotePerson] = useState<Person | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const activePeople = useMemo(
    () => people.filter((p) => p.isActive !== false),
    [people]
  );

  // Totales globales
  const totals = useMemo(() => {
    let grandTotalRequired = 0;
    let grandTotalDelivered = 0;

    let mesaPeopleCount = 0;
    let mesaShirtsRequired = 0;
    let mesaShirtsDelivered = 0;

    let gtPeopleCount = 0;
    let gtShirtsRequired = 0;
    let gtShirtsDelivered = 0;

    let gapPeopleCount = 0;
    let gapShirtsRequired = 0;
    let gapShirtsDelivered = 0;

    activePeople.forEach((p) => {
      const quota = getPersonShirtQuota(p);
      const delivered = getPersonShirtDeliveredCount(p);

      grandTotalRequired += quota;
      grandTotalDelivered += delivered;

      if (p.primaryType === 'MESA') {
        mesaPeopleCount++;
        mesaShirtsRequired += quota; // 2
        mesaShirtsDelivered += delivered;
      } else if (p.primaryType === 'GT') {
        gtPeopleCount++;
        gtShirtsRequired += quota; // 1
        gtShirtsDelivered += delivered;
      } else {
        gapPeopleCount++;
        gapShirtsRequired += quota; // 1
        gapShirtsDelivered += delivered;
      }
    });

    const grandTotalPending = Math.max(0, grandTotalRequired - grandTotalDelivered);
    const progressPct =
      grandTotalRequired > 0
        ? Math.round((grandTotalDelivered / grandTotalRequired) * 100)
        : 0;

    return {
      grandTotalRequired,
      grandTotalDelivered,
      grandTotalPending,
      progressPct,
      mesa: {
        peopleCount: mesaPeopleCount,
        required: mesaShirtsRequired,
        delivered: mesaShirtsDelivered,
        pending: Math.max(0, mesaShirtsRequired - mesaShirtsDelivered),
      },
      gt: {
        peopleCount: gtPeopleCount,
        required: gtShirtsRequired,
        delivered: gtShirtsDelivered,
        pending: Math.max(0, gtShirtsRequired - gtShirtsDelivered),
      },
      gap: {
        peopleCount: gapPeopleCount,
        required: gapShirtsRequired,
        delivered: gapShirtsDelivered,
        pending: Math.max(0, gapShirtsRequired - gapShirtsDelivered),
      },
    };
  }, [activePeople]);

  // Inventario por talla
  const sizeInventory = useMemo(() => {
    const sizeMap = new Map<
      string,
      {
        size: string;
        totalShirts: number;
        mesaShirts: number;
        gtShirts: number;
        gapShirts: number;
        totalDelivered: number;
        totalPending: number;
        peopleCount: number;
      }
    >();

    // Inicializar tallas estándar
    STANDARD_SIZES.forEach((size) => {
      sizeMap.set(size, {
        size,
        totalShirts: 0,
        mesaShirts: 0,
        gtShirts: 0,
        gapShirts: 0,
        totalDelivered: 0,
        totalPending: 0,
        peopleCount: 0,
      });
    });

    activePeople.forEach((p) => {
      const rawSize = (p.shirtSize || 'M').trim().toUpperCase();
      const size = rawSize || 'M';
      const quota = getPersonShirtQuota(p);
      const delivered = getPersonShirtDeliveredCount(p);

      if (!sizeMap.has(size)) {
        sizeMap.set(size, {
          size,
          totalShirts: 0,
          mesaShirts: 0,
          gtShirts: 0,
          gapShirts: 0,
          totalDelivered: 0,
          totalPending: 0,
          peopleCount: 0,
        });
      }

      const item = sizeMap.get(size)!;
      item.peopleCount++;
      item.totalShirts += quota;
      item.totalDelivered += delivered;

      if (p.primaryType === 'MESA') {
        item.mesaShirts += quota;
      } else if (p.primaryType === 'GT') {
        item.gtShirts += quota;
      } else {
        item.gapShirts += quota;
      }
    });

    // Calcular pendientes
    sizeMap.forEach((item) => {
      item.totalPending = Math.max(0, item.totalShirts - item.totalDelivered);
    });

    // Ordenar: estándar primero, luego otras
    const list = Array.from(sizeMap.values());
    return list.sort((a, b) => {
      const indexA = STANDARD_SIZES.indexOf(a.size);
      const indexB = STANDARD_SIZES.indexOf(b.size);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.size.localeCompare(b.size);
    });
  }, [activePeople]);

  // Lista filtrada
  const filteredPeople = useMemo(() => {
    return activePeople.filter((p) => {
      // Búsqueda por texto
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = (p.name || '').toLowerCase().includes(query);
        const matchFullName = (p.fullName || '').toLowerCase().includes(query);
        const matchDoc = (p.documentId || '').toLowerCase().includes(query);
        const matchUser = (p.username || '').toLowerCase().includes(query);
        const matchTeam = (p.gtSubTeam || '').toLowerCase().includes(query);
        if (!matchName && !matchFullName && !matchDoc && !matchUser && !matchTeam) {
          return false;
        }
      }

      // Filtro por grupo
      if (selectedGroupFilter !== 'ALL' && p.primaryType !== selectedGroupFilter) {
        return false;
      }

      // Filtro por talla
      if (selectedSizeFilter !== 'ALL') {
        const pSize = (p.shirtSize || 'M').trim().toUpperCase();
        if (pSize !== selectedSizeFilter) return false;
      }

      // Filtro por estado
      if (selectedStatusFilter !== 'ALL') {
        const quota = getPersonShirtQuota(p);
        const delivered = getPersonShirtDeliveredCount(p);

        if (selectedStatusFilter === 'DELIVERED' && delivered < quota) {
          return false;
        }
        if (selectedStatusFilter === 'PENDING' && delivered >= quota) {
          return false;
        }
        if (selectedStatusFilter === 'PARTIAL') {
          if (delivered === 0 || delivered >= quota) return false;
        }
      }

      return true;
    });
  }, [
    activePeople,
    searchTerm,
    selectedGroupFilter,
    selectedStatusFilter,
    selectedSizeFilter,
  ]);

  // Manejador de entrega para 1 persona
  const handleSetDeliveredCount = async (personId: string, count: number) => {
    try {
      await updatePersonShirtDelivery(personId, count);
    } catch (err) {
      console.error('Error al actualizar entrega de camiseta:', err);
    }
  };

  // Manejador de cambio de talla inline
  const handleChangeShirtSize = async (personId: string, newSize: string) => {
    try {
      await updatePersonShirtSize(personId, newSize);
    } catch (err) {
      console.error('Error al cambiar talla:', err);
    }
  };

  // Selección múltiple
  const handleToggleSelectPerson = (id: string) => {
    const next = new Set(selectedPersonIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPersonIds(next);
  };

  const handleSelectAllFiltered = () => {
    if (selectedPersonIds.size === filteredPeople.length) {
      setSelectedPersonIds(new Set());
    } else {
      setSelectedPersonIds(new Set(filteredPeople.map((p) => p.id)));
    }
  };

  // Entrega masiva a seleccionados
  const handleBatchDeliver = async (setDelivered: boolean) => {
    if (selectedPersonIds.size === 0) return;
    setIsSaving(true);
    try {
      await batchUpdateShirtDelivery(Array.from(selectedPersonIds), setDelivered);
      setSelectedPersonIds(new Set());
    } catch (err) {
      console.error('Error en entrega masiva:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Guardar nota
  const handleSaveNote = async () => {
    if (!editingNotePerson) return;
    try {
      await updatePersonShirtDelivery(
        editingNotePerson.id,
        getPersonShirtDeliveredCount(editingNotePerson),
        noteText.trim()
      );
      setEditingNotePerson(null);
    } catch (err) {
      console.error('Error al guardar nota:', err);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-montserrat">
      {/* Header oficial */}
      <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#FEF8EC] border-2 border-[#E5A12E]/40 text-[#B83A24] flex items-center justify-center shrink-0 shadow-xs">
              <Shirt className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold font-dalek text-[#182535] tracking-wide">
                  CONTROL Y ENTREGA DE CAMISETAS
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF8EC] text-[#C87F17] border border-[#E5A12E]/40">
                  DÍAS EAFIT 2026
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
                Inventario total, conteo por talla y registro de entrega individual a cada integrante.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => exportShirtDeliveryExcel(people)}
              className="px-4 py-2.5 rounded-xl bg-[#FFFDF8] hover:bg-[#F3EEDC] text-[#182535] border border-[#EADDC7] font-semibold text-xs transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
              title="Descargar reporte oficial en Excel con hojas de inventario y listado"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Banner de Regla Oficial */}
        <div className="mt-5 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#FEF8EC] via-[#FFFDF8] to-[#FEF8EC] border-2 border-[#E5A12E]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#B83A24] text-white flex items-center justify-center shrink-0 font-bold text-xs">
              ★
            </div>
            <div className="text-xs text-[#182535]">
              <span className="font-bold text-[#B83A24] uppercase tracking-wider">Regla Oficial DÍAS:</span>{' '}
              A cada persona de <strong className="text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded-md font-bold">MESA LE CORRESPONDEN 2 CAMISETAS</strong>.{' '}
              Los integrantes de <strong className="text-[#B83A24] bg-[#FDF2EE] px-1.5 py-0.5 rounded-md font-bold">GT</strong> y <strong className="text-[#C87F17] bg-[#FEF8EC] px-1.5 py-0.5 rounded-md font-bold">GAP</strong> reciben <strong>1 camiseta</strong>.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-bold font-mono">
              MESA: 2 c/u
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#FEF8EC] text-[#B83A24] border border-[#E5A12E]/40 font-bold font-mono">
              GT & GAP: 1 c/u
            </span>
          </div>
        </div>
      </div>

      {/* Tarjetas métricas globales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Camisas Requeridas */}
        <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Total Camisetas
            </span>
            <span className="p-1.5 rounded-lg bg-[#FEF8EC] text-[#C87F17]">
              <Shirt className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#182535] font-mono">
              {totals.grandTotalRequired}
            </span>
            <span className="text-xs text-[#64748B]">
              para {activePeople.length} personas
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] mt-1">
            Incluye 2 por cada MESA y 1 por cada GT/GAP
          </p>
        </div>

        {/* Camisas Entregadas */}
        <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Entregadas
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-700 font-mono">
              {totals.grandTotalDelivered}
            </span>
            <span className="text-xs text-[#64748B] font-mono">
              / {totals.grandTotalRequired} ({totals.progressPct}%)
            </span>
          </div>
          {/* Barra de progreso */}
          <div className="w-full bg-[#EADDC7]/40 rounded-full h-2 mt-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${totals.progressPct}%` }}
            />
          </div>
        </div>

        {/* Camisas Pendientes */}
        <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Pendientes
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-800 font-mono">
              {totals.grandTotalPending}
            </span>
            <span className="text-xs text-[#64748B]">por entregar</span>
          </div>
          <p className="text-[11px] text-[#64748B] mt-1">
            {totals.grandTotalPending === 0
              ? '¡Todas las camisetas han sido entregadas!'
              : 'Faltan entregar a los miembros de staff'}
          </p>
        </div>

        {/* Desglose de Grupos */}
        <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-2xl p-4 shadow-xs space-y-1.5">
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block">
            Desglose por Estructura
          </span>
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-purple-800 font-medium flex items-center gap-1">
              <Shield className="w-3 h-3" /> MESA (x2):
            </span>
            <span className="font-mono font-bold text-[#182535]">
              {totals.mesa.delivered} / {totals.mesa.required}{' '}
              <span className="text-[10px] text-[#64748B] font-normal">
                ({totals.mesa.peopleCount} pers.)
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#B83A24] font-medium flex items-center gap-1">
              <Users className="w-3 h-3" /> GT (x1):
            </span>
            <span className="font-mono font-bold text-[#182535]">
              {totals.gt.delivered} / {totals.gt.required}{' '}
              <span className="text-[10px] text-[#64748B] font-normal">
                ({totals.gt.peopleCount} pers.)
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#C87F17] font-medium flex items-center gap-1">
              <Users className="w-3 h-3" /> GAP (x1):
            </span>
            <span className="font-mono font-bold text-[#182535]">
              {totals.gap.delivered} / {totals.gap.required}{' '}
              <span className="text-[10px] text-[#64748B] font-normal">
                ({totals.gap.peopleCount} pers.)
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: INVENTARIO POR TALLA ("cuantas de cada una hay") */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EADDC7] pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#182535] flex items-center gap-2 font-dalek">
              <Shirt className="w-5 h-5 text-[#B83A24]" />
              INVENTARIO Y CONTEO POR TALLA
            </h2>
            <p className="text-xs text-[#64748B]">
              Visualiza cuántas camisetas se necesitan y cuántas van entregadas por cada talla (XS, S, M, L, XL, XXL).
            </p>
          </div>
          {selectedSizeFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedSizeFilter('ALL')}
              className="text-xs font-semibold text-[#B83A24] hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar filtro de talla ({selectedSizeFilter})
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {sizeInventory.map((item) => {
            const isSelected = selectedSizeFilter === item.size;
            const pct =
              item.totalShirts > 0
                ? Math.round((item.totalDelivered / item.totalShirts) * 100)
                : 0;

            return (
              <div
                key={item.size}
                onClick={() =>
                  setSelectedSizeFilter(isSelected ? 'ALL' : item.size)
                }
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#B83A24] bg-[#FDF2EE] shadow-sm'
                    : 'border-[#EADDC7] bg-[#FAF6EC]/60 hover:bg-[#F3EEDC] hover:border-[#D5C2A5]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="w-8 h-8 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] flex items-center justify-center font-dalek text-base font-extrabold text-[#182535] shadow-2xs">
                    {item.size}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ${
                      pct === 100
                        ? 'bg-emerald-100 text-emerald-800'
                        : pct > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-[#EADDC7]/60 text-[#64748B]'
                    }`}
                  >
                    {pct}%
                  </span>
                </div>

                <div className="my-2.5">
                  <span className="text-2xl font-extrabold font-mono text-[#182535] block">
                    {item.totalShirts}
                  </span>
                  <span className="text-[11px] text-[#64748B] block">
                    camisetas totales
                  </span>
                </div>

                <div className="space-y-1 pt-2 border-t border-[#EADDC7]/60 text-[10px] text-[#64748B]">
                  <div className="flex justify-between">
                    <span className="text-purple-800 font-semibold">MESA (x2):</span>
                    <span className="font-mono font-bold">{item.mesaShirts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#B83A24] font-semibold">GT (x1):</span>
                    <span className="font-mono font-bold">{item.gtShirts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#C87F17] font-semibold">GAP (x1):</span>
                    <span className="font-mono font-bold">{item.gapShirts}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-[#EADDC7]/40 text-[#182535]">
                    <span className="font-medium">Entregadas:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {item.totalDelivered}
                    </span>
                  </div>
                </div>

                {/* Mini Progress */}
                <div className="w-full bg-[#EADDC7]/60 rounded-full h-1.5 mt-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN 3: TABLA INTERACTIVA DE ENTREGA PERSONA A PERSONA */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Búsqueda */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, cédula, @usuario o equipo..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#FAF6EC] border border-[#E2D6BC] text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24] transition-all font-montserrat"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#182535] text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtros rápidos */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro Grupo */}
            <div className="flex items-center bg-[#FAF6EC] border border-[#E2D6BC] rounded-xl p-1 text-xs font-semibold">
              <button
                onClick={() => setSelectedGroupFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedGroupFilter === 'ALL'
                    ? 'bg-[#B83A24] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#182535]'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setSelectedGroupFilter('MESA')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedGroupFilter === 'MESA'
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'text-purple-800 hover:text-purple-950'
                }`}
              >
                MESA (2 c/u)
              </button>
              <button
                onClick={() => setSelectedGroupFilter('GT')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedGroupFilter === 'GT'
                    ? 'bg-[#B83A24] text-white shadow-2xs'
                    : 'text-[#B83A24] hover:text-[#8D2513]'
                }`}
              >
                GT (1 c/u)
              </button>
              <button
                onClick={() => setSelectedGroupFilter('GAP')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedGroupFilter === 'GAP'
                    ? 'bg-[#C87F17] text-white shadow-2xs'
                    : 'text-[#C87F17] hover:text-[#9A5F0C]'
                }`}
              >
                GAP (1 c/u)
              </button>
            </div>

            {/* Filtro Estado */}
            <div className="flex items-center bg-[#FAF6EC] border border-[#E2D6BC] rounded-xl p-1 text-xs font-semibold">
              <button
                onClick={() => setSelectedStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedStatusFilter === 'ALL'
                    ? 'bg-[#182535] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#182535]'
                }`}
              >
                Cualquiera
              </button>
              <button
                onClick={() => setSelectedStatusFilter('PENDING')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedStatusFilter === 'PENDING'
                    ? 'bg-amber-700 text-white shadow-2xs'
                    : 'text-amber-800 hover:text-amber-950'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setSelectedStatusFilter('PARTIAL')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedStatusFilter === 'PARTIAL'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-purple-700 hover:text-purple-900'
                }`}
                title="MESA con 1 de 2 camisas entregadas"
              >
                Parcial (1/2)
              </button>
              <button
                onClick={() => setSelectedStatusFilter('DELIVERED')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedStatusFilter === 'DELIVERED'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-emerald-800 hover:text-emerald-950'
                }`}
              >
                Entregadas
              </button>
            </div>

            {/* Filtro Talla Select */}
            <div className="relative">
              <select
                value={selectedSizeFilter}
                onChange={(e) => setSelectedSizeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#FAF6EC] border border-[#E2D6BC] text-xs font-semibold text-[#182535] focus:outline-hidden focus:border-[#B83A24] cursor-pointer"
              >
                <option value="ALL">Todas las tallas</option>
                {STANDARD_SIZES.map((sz) => (
                  <option key={sz} value={sz}>
                    Talla {sz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Acciones masivas cuando hay seleccionados */}
        {selectedPersonIds.size > 0 && (
          <div className="p-3 rounded-2xl bg-[#FEF8EC] border-2 border-[#E5A12E]/60 flex items-center justify-between gap-3 text-xs flex-wrap animate-fadeIn">
            <span className="font-semibold text-[#182535]">
              {selectedPersonIds.size} persona(s) seleccionada(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={isSaving}
                onClick={() => handleBatchDeliver(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Marcar entrega completa</span>
              </button>
              <button
                disabled={isSaving}
                onClick={() => handleBatchDeliver(false)}
                className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-[#182535] font-semibold transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Desmarcar (volver a pendiente)</span>
              </button>
              <button
                onClick={() => setSelectedPersonIds(new Set())}
                className="text-[#64748B] hover:text-[#182535] font-medium ml-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Contador de resultados */}
        <div className="flex items-center justify-between text-xs text-[#64748B] px-1">
          <span>
            Mostrando <strong>{filteredPeople.length}</strong> de {activePeople.length} personas
          </span>
          <button
            onClick={handleSelectAllFiltered}
            className="font-semibold text-[#B83A24] hover:underline cursor-pointer"
          >
            {selectedPersonIds.size === filteredPeople.length && filteredPeople.length > 0
              ? 'Deseleccionar todos'
              : 'Seleccionar todos los visibles'}
          </button>
        </div>

        {/* Listado de Personas */}
        {filteredPeople.length === 0 ? (
          <div className="p-10 text-center rounded-2xl bg-[#FAF6EC]/50 border border-[#EADDC7] space-y-2">
            <AlertCircle className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <p className="text-sm font-semibold text-[#182535]">
              No se encontraron personas con los filtros seleccionados
            </p>
            <p className="text-xs text-[#64748B]">
              Intenta cambiar los términos de búsqueda o limpiar los filtros activos.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredPeople.map((person) => {
              const quota = getPersonShirtQuota(person);
              const isMesa = person.primaryType === 'MESA';
              const deliveredCount = getPersonShirtDeliveredCount(person);
              const isFull = isPersonShirtFullyDelivered(person);
              const isPartial = deliveredCount > 0 && deliveredCount < quota;
              const isSelected = selectedPersonIds.has(person.id);

              return (
                <div
                  key={person.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                    isFull
                      ? 'bg-[#F0FDF4]/50 border-[#BBF7D0]'
                      : isPartial
                      ? 'bg-amber-50/40 border-amber-200'
                      : 'bg-[#FFFDF8] border-[#EADDC7]'
                  } hover:border-[#B83A24]/50 shadow-2xs`}
                >
                  {/* Columna Izquierda: Checkbox + Datos Personales */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectPerson(person.id)}
                      className="mt-1 w-4 h-4 rounded-sm border-[#D5C2A5] text-[#B83A24] focus:ring-[#B83A24] cursor-pointer"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-[#182535] truncate">
                          {person.fullName || person.name}
                        </span>

                        {/* Badge de Grupo */}
                        {isMesa ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1 font-montserrat">
                            <Shield className="w-3 h-3 text-purple-700" />
                            MESA • 2 CAMISAS
                          </span>
                        ) : person.primaryType === 'GT' ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA]">
                            GT • {person.gtSubTeam || person.gtTeams?.[0] || 'Trabajo'} (1 camisa)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A]">
                            GAP (1 camisa)
                          </span>
                        )}

                        {/* Badge de Estado */}
                        {isFull ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-700" />
                            Entregada ({deliveredCount}/{quota})
                          </span>
                        ) : isPartial ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-700" />
                            Parcial ({deliveredCount}/{quota})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF6EC] text-[#64748B] border border-[#EADDC7]">
                            Pendiente (0/{quota})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-[#64748B] flex-wrap">
                        <span>
                          Doc: <strong className="font-mono text-[#182535]">{person.documentId}</strong>
                        </span>
                        {person.username && (
                          <span className="font-mono text-[11px] text-[#94A3B8]">
                            @{person.username}
                          </span>
                        )}
                        {person.shirtDeliveredAt && (
                          <span className="text-[11px] text-emerald-800 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Entregado: {new Date(person.shirtDeliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {person.shirtDeliveryNotes && (
                          <span className="text-[11px] text-[#B83A24] bg-[#FDF2EE] px-1.5 py-0.5 rounded-sm italic">
                            «{person.shirtDeliveryNotes}»
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Columna Derecha: Talla y Controles de Entrega */}
                  <div className="flex items-center gap-3 shrink-0 flex-wrap justify-between lg:justify-end">
                    {/* Selector de Talla Rápido Inline */}
                    <div className="flex items-center gap-1.5 bg-[#FAF6EC] border border-[#E2D6BC] px-2.5 py-1.5 rounded-xl">
                      <span className="text-[11px] font-medium text-[#64748B]">Talla:</span>
                      <select
                        value={(person.shirtSize || 'M').trim().toUpperCase()}
                        onChange={(e) => handleChangeShirtSize(person.id, e.target.value)}
                        className="bg-transparent font-dalek font-extrabold text-[#182535] text-xs focus:outline-hidden cursor-pointer"
                        title="Cambiar talla si el integrante solicita cambio"
                      >
                        {STANDARD_SIZES.map((sz) => (
                          <option key={sz} value={sz}>
                            {sz}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* INTERACTIVE DELIVERY BUTTONS */}
                    {isMesa ? (
                      /* CONTROLES PARA MESA (2 CAMISAS) */
                      <div className="flex items-center gap-1.5">
                        {/* Camisa 1 */}
                        <button
                          onClick={() =>
                            handleSetDeliveredCount(
                              person.id,
                              deliveredCount >= 1 ? 0 : 1
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            deliveredCount >= 1
                              ? 'bg-purple-700 text-white shadow-2xs'
                              : 'bg-[#FAF6EC] text-[#64748B] hover:bg-purple-100 hover:text-purple-800 border border-[#EADDC7]'
                          }`}
                          title="Marcar / desmarcar Camiseta 1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Camisa 1</span>
                        </button>

                        {/* Camisa 2 */}
                        <button
                          onClick={() =>
                            handleSetDeliveredCount(
                              person.id,
                              deliveredCount >= 2 ? 1 : 2
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            deliveredCount >= 2
                              ? 'bg-purple-700 text-white shadow-2xs'
                              : 'bg-[#FAF6EC] text-[#64748B] hover:bg-purple-100 hover:text-purple-800 border border-[#EADDC7]'
                          }`}
                          title="Marcar / desmarcar Camiseta 2"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Camisa 2</span>
                        </button>

                        {/* Botón rápido Entregar Ambas o Desmarcar */}
                        {deliveredCount < 2 ? (
                          <button
                            onClick={() => handleSetDeliveredCount(person.id, 2)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                            title="Entregar las 2 camisetas juntas a MESA"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Entregar 2</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSetDeliveredCount(person.id, 0)}
                            className="p-1.5 rounded-xl text-[#94A3B8] hover:text-[#B83A24] hover:bg-[#FDF2EE] transition-all cursor-pointer"
                            title="Reiniciar entrega a 0"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      /* CONTROLES PARA GT Y GAP (1 CAMISA) */
                      <div className="flex items-center gap-2">
                        {deliveredCount === 0 ? (
                          <button
                            onClick={() => handleSetDeliveredCount(person.id, 1)}
                            className="px-4 py-1.5 rounded-xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Entregar Camiseta</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSetDeliveredCount(person.id, 0)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-100 hover:bg-red-100 text-emerald-800 hover:text-red-800 border border-emerald-300 hover:border-red-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer group"
                            title="Clic para desmarcar y volver a pendiente"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-700 group-hover:hidden" />
                            <RotateCcw className="w-3.5 h-3.5 text-red-700 hidden group-hover:inline" />
                            <span className="group-hover:hidden">Entregada (1/1)</span>
                            <span className="hidden group-hover:inline text-red-800">Desmarcar</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Botón Nota / Observación */}
                    <button
                      onClick={() => {
                        setEditingNotePerson(person);
                        setNoteText(person.shirtDeliveryNotes || '');
                      }}
                      className="p-2 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC] border border-transparent hover:border-[#EADDC7] transition-all cursor-pointer"
                      title={person.shirtDeliveryNotes ? 'Editar nota' : 'Agregar nota de entrega'}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL PARA AGREGAR/EDITAR NOTA DE ENTREGA */}
      {editingNotePerson && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EADDC7] pb-3">
              <div className="flex items-center gap-2">
                <Shirt className="w-5 h-5 text-[#B83A24]" />
                <h3 className="font-dalek text-lg text-[#182535]">
                  NOTA DE ENTREGA DE CAMISETA
                </h3>
              </div>
              <button
                onClick={() => setEditingNotePerson(null)}
                className="p-1 rounded-full text-[#64748B] hover:bg-[#FAF6EC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[#64748B]">
              Persona: <strong className="text-[#182535]">{editingNotePerson.fullName || editingNotePerson.name}</strong> ({editingNotePerson.primaryType})
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182535] mb-1">
                Observaciones (ej. cambio de talla, quién la retiró, etc.):
              </label>
              <textarea
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Escribe aquí cualquier observación relevante..."
                className="w-full p-3 rounded-xl bg-[#FAF6EC] border border-[#E2D6BC] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24] font-montserrat"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingNotePerson(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-[#FAF6EC]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNote}
                className="px-5 py-2 rounded-xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white text-xs font-bold font-dalek tracking-wider shadow-xs"
              >
                GUARDAR NOTA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
