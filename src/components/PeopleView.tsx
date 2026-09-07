import React, { useState, useMemo } from 'react';
import { Person, PersonType, GroupFunction, GtSubTeam, ConfigurableShift, AvailabilityRecord } from '../types';
import {
  addPerson,
  updatePerson,
  deletePerson,
  deletePeopleBatch,
  deleteAllPeople,
  getAssignments,
  getAvailabilities,
  getPeople,
} from '../services/storageService';
import { exportPeopleToOfficialExcel, downloadOfficialExcelMaestroTemplate } from '../services/excelService';
import { ExcelImportModal } from './ExcelImportModal';
import { GT_SUBTEAMS, getFilteredFunctions } from '../data/functionsCatalog';
import { isSupabaseConfigured, getSupabase } from '../services/supabaseClient';
import { syncAllToSupabase, pushPeopleToSupabase } from '../services/supabaseSync';
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Shield,
  AlertCircle,
  X,
  Check,
  Filter,
  FileSpreadsheet,
  Download,
  Phone,
  Mail,
  UserCheck,
  Tag,
  Key,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowDownAZ,
  ArrowUpZA,
  FilterX,
  ChevronDown,
  SlidersHorizontal,
  Cloud,
  RefreshCw,
  CheckSquare,
  Square,
} from 'lucide-react';

interface PeopleViewProps {
  people: Person[];
  functions?: GroupFunction[];
  shifts?: ConfigurableShift[];
  availabilities?: AvailabilityRecord[];
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
}

export const PeopleView: React.FC<PeopleViewProps> = ({
  people,
  functions = [],
  shifts = [],
  availabilities = [],
  isAddModalOpen,
  setIsAddModalOpen,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('Todos');
  const [gtFilter, setGtFilter] = useState<string>('Todos');
  const [shiftFilter, setShiftFilter] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<string>('Activo');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<PersonType | 'ALL'>('ALL');
  const [selectedGtSubTeamFilter, setSelectedGtSubTeamFilter] = useState<GtSubTeam | 'ALL'>('ALL');
  const [sortOption, setSortOption] = useState<'name-asc' | 'name-desc' | 'doc-asc' | 'doc-desc' | 'gt-asc' | 'recent'>('name-asc');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudBanner, setCloudBanner] = useState<{ message: string; isError: boolean } | null>(null);

  const handleCloudSync = async () => {
    if (!isSupabaseConfigured()) {
      setCloudBanner({
        message: 'Supabase no está configurado en las variables de entorno.',
        isError: true,
      });
      setTimeout(() => setCloudBanner(null), 5000);
      return;
    }
    setIsSyncingCloud(true);
    try {
      const res = await syncAllToSupabase(getPeople(), getAssignments(), getAvailabilities());
      setCloudBanner({
        message: res.message,
        isError: !res.success,
      });
      setTimeout(() => setCloudBanner(null), 5000);
    } catch (e: any) {
      setCloudBanner({
        message: e?.message || 'Error al conectar con Supabase',
        isError: true,
      });
      setTimeout(() => setCloudBanner(null), 5000);
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Column-specific filter states (Persona, Cédula/User, Tipo, GT/Funciones, Contacto)
  const [colFilterName, setColFilterName] = useState('');
  const [colFilterDoc, setColFilterDoc] = useState('');
  const [colFilterType, setColFilterType] = useState<PersonType | 'ALL'>('ALL');
  const [colFilterGt, setColFilterGt] = useState<GtSubTeam | 'ALL'>('ALL');
  const [colFilterContact, setColFilterContact] = useState('');
  const [showColumnFilters, setShowColumnFilters] = useState(true);

  // Bulk selection & deletion
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{
    isOpen: boolean;
    mode: 'selected' | 'filtered' | 'all';
    count: number;
    ids?: string[];
  } | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Count of active column-level filters
  const activeColFiltersCount = [
    colFilterName.trim() !== '',
    colFilterDoc.trim() !== '',
    colFilterType !== 'ALL',
    colFilterGt !== 'ALL',
    colFilterContact.trim() !== '',
  ].filter(Boolean).length;

  // Handler to reset all filters
  const handleResetAllFilters = () => {
    setSearchTerm('');
    setSelectedTypeFilter('ALL');
    setSelectedGtSubTeamFilter('ALL');
    setColFilterName('');
    setColFilterDoc('');
    setColFilterType('ALL');
    setColFilterGt('ALL');
    setColFilterContact('');
    setSortOption('name-asc');
    setSelectedIds(new Set());
  };

  // Form State
  const [formName, setFormName] = useState('');
  const [formDoc, setFormDoc] = useState('');
  const [formUser, setFormUser] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formType, setFormType] = useState<PersonType>('GT');
  const [formGtSubTeam, setFormGtSubTeam] = useState<GtSubTeam>('Logística');
  const [formGtSubTeams, setFormGtSubTeams] = useState<GtSubTeam[]>(['Logística']);
  const [formSelectedFunctions, setFormSelectedFunctions] = useState<string[]>([]);
  const [customFunctionInput, setCustomFunctionInput] = useState('');
  const [formRole, setFormRole] = useState('Staff');
  const [formAlsoActsAsGap, setFormAlsoActsAsGap] = useState(false);
  const [formGapRoleDesc, setFormGapRoleDesc] = useState('');
  const [formShirt, setFormShirt] = useState<'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'>('M');
  const [formDiet, setFormDiet] = useState('Ninguna');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Open add modal clean
  const handleOpenAdd = () => {
    setEditingPerson(null);
    setFormName('');
    setFormDoc('');
    setFormUser('');
    setFormEmail('');
    setFormPhone('');
    setFormType('GT');
    setFormAlsoActsAsGap(false);
    setFormGapRoleDesc('');
    setFormGtSubTeam('Logística');
    setFormGtSubTeams(['Logística']);
    setFormSelectedFunctions([]);
    setCustomFunctionInput('');
    setFormRole('Staff');
    setFormShirt('M');
    setFormDiet('Ninguna');
    setFormNotes('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Open edit modal
  const handleOpenEdit = (person: Person) => {
    setEditingPerson(person);
    setFormName(person.name);
    setFormDoc(person.documentId);
    setFormUser(person.username || '');
    setFormEmail(person.email);
    setFormPhone(person.phone || '');
    setFormType(person.primaryType);
    setFormAlsoActsAsGap(person.alsoActsAsGap || false);
    setFormGapRoleDesc(person.gapRoleDescription || '');
    const mainSub = (person.gtSubTeam ||
      (person.gtTeams && person.gtTeams[0]) ||
      'Logística') as GtSubTeam;
    const initialTeams =
      person.gtTeams && person.gtTeams.length > 0
        ? (person.gtTeams.filter((t) => GT_SUBTEAMS.includes(t as GtSubTeam)) as GtSubTeam[])
        : [GT_SUBTEAMS.includes(mainSub) ? mainSub : 'Logística'];

    setFormGtSubTeam(GT_SUBTEAMS.includes(mainSub) ? mainSub : 'Logística');
    setFormGtSubTeams(initialTeams.length > 0 ? initialTeams : ['Logística']);
    setFormSelectedFunctions(person.functions || []);
    setCustomFunctionInput('');
    setFormRole(person.roleTitle || 'Staff');
    setFormShirt(person.shirtSize || 'M');
    setFormDiet(person.dietaryRestrictions || 'Ninguna');
    setFormNotes(person.notes || '');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const toggleFunctionSelection = (fnName: string) => {
    setFormSelectedFunctions((prev) =>
      prev.includes(fnName) ? prev.filter((f) => f !== fnName) : [...prev, fnName]
    );
  };

  const handleAddCustomFunction = () => {
    if (!customFunctionInput.trim()) return;
    const name = customFunctionInput.trim();
    if (!formSelectedFunctions.includes(name)) {
      setFormSelectedFunctions((prev) => [...prev, name]);
    }
    setCustomFunctionInput('');
  };

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDoc.trim()) {
      setFormError('Por favor complete al menos Nombre y Cédula.');
      return;
    }

    const cleanUser = formUser.trim() || formDoc.trim();
    const selectedGtTeams =
      formType === 'GT'
        ? formGtSubTeams.length > 0
          ? formGtSubTeams
          : [formGtSubTeam]
        : [];
    const primaryGtSub = selectedGtTeams.length > 0 ? selectedGtTeams[0] : undefined;

    setIsSubmitting(true);
    try {
      if (editingPerson) {
        await updatePerson(editingPerson.id, {
          name: formName.trim(),
          documentId: formDoc.trim(),
          username: cleanUser,
          email: formEmail.trim(),
          phone: formPhone.trim(),
          primaryType: formType,
          alsoActsAsGap: formAlsoActsAsGap,
          gapRoleDescription: formGapRoleDesc.trim(),
          gtTeams: selectedGtTeams,
          gtSubTeam: formType === 'GT' ? primaryGtSub : undefined,
          functions: formSelectedFunctions,
          roleTitle: formRole.trim(),
          shirtSize: formShirt,
          dietaryRestrictions: formDiet.trim(),
          notes: formNotes.trim(),
        });
      } else {
        await addPerson({
          name: formName.trim(),
          documentId: formDoc.trim(),
          username: cleanUser,
          email: formEmail.trim(),
          phone: formPhone.trim(),
          primaryType: formType,
          alsoActsAsGap: formAlsoActsAsGap,
          gapRoleDescription: formGapRoleDesc.trim(),
          gtTeams: selectedGtTeams,
          gtSubTeam: formType === 'GT' ? primaryGtSub : undefined,
          functions: formSelectedFunctions,
          roleTitle: formRole.trim(),
          shirtSize: formShirt,
          dietaryRestrictions: formDiet.trim(),
          notes: formNotes.trim(),
        });
      }
      setIsAddModalOpen(false);
      setEditingPerson(null);

      // Sincronizar automáticamente con Supabase en segundo plano si está configurado
      if (isSupabaseConfigured()) {
        pushPeopleToSupabase(getPeople()).catch((err) =>
          console.warn('Background sync to Supabase failed:', err)
        );
      }
    } catch (err) {
      console.error(err);
      setFormError('Error al guardar la persona.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      confirm(
        `¿Está seguro de eliminar a "${name}"? Esta acción es definitiva y la persona NO volverá a aparecer automáticamente.`
      )
    ) {
      await deletePerson(id);
      if (isSupabaseConfigured()) {
        const client = getSupabase();
        if (client) {
          client
            .from('people')
            .delete()
            .eq('id', id)
            .then(
              ({ error }) => {
                if (error) console.warn('Error deleting from Supabase:', error);
              },
              (err) => console.warn('Exception deleting from Supabase:', err)
            );
        }
      }
    }
  };

  // Subteam member counts for GT
  const subTeamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    GT_SUBTEAMS.forEach((sub) => {
      counts[sub] = people.filter(
        (p) =>
          p.primaryType === 'GT' &&
          (p.gtSubTeam === sub || (p.gtTeams && p.gtTeams.includes(sub)))
      ).length;
    });
    return counts;
  }, [people]);

  // Filtered and Sorted people
  const filteredPeople = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    const nameQuery = colFilterName.toLowerCase().trim();
    const docQuery = colFilterDoc.toLowerCase().trim();
    const contactQuery = colFilterContact.toLowerCase().trim();

    // Determine effective type and GT subteam filters
    const effectiveType = colFilterType !== 'ALL' ? colFilterType : selectedTypeFilter;
    const effectiveGt =
      colFilterGt !== 'ALL'
        ? colFilterGt
        : effectiveType === 'GT'
        ? selectedGtSubTeamFilter
        : 'ALL';

    const filtered = people.filter((p) => {
      // 1. Global Search Query
      if (query) {
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesDoc = p.documentId.toLowerCase().includes(query);
        const matchesUser = !!(p.username && p.username.toLowerCase().includes(query));
        const matchesEmail = p.email.toLowerCase().includes(query);
        const matchesPhone = !!(p.phone && p.phone.toLowerCase().includes(query));
        const matchesSubTeam = !!(
          (p.gtSubTeam && p.gtSubTeam.toLowerCase().includes(query)) ||
          (p.gtTeams && p.gtTeams.some((t) => t.toLowerCase().includes(query)))
        );
        const matchesRole = !!(p.roleTitle && p.roleTitle.toLowerCase().includes(query));
        const matchesFunction = !!(
          p.functions && p.functions.some((f) => f.toLowerCase().includes(query))
        );

        if (
          !matchesName &&
          !matchesDoc &&
          !matchesUser &&
          !matchesEmail &&
          !matchesPhone &&
          !matchesSubTeam &&
          !matchesRole &&
          !matchesFunction
        ) {
          return false;
        }
      }

      // 2. Persona / Nombre Column Filter
      if (nameQuery && !p.name.toLowerCase().includes(nameQuery)) {
        return false;
      }

      // 3. Cédula & Usuario Column Filter
      if (docQuery) {
        const matchDoc = p.documentId.toLowerCase().includes(docQuery);
        const matchUser = !!(p.username && p.username.toLowerCase().includes(docQuery));
        if (!matchDoc && !matchUser) return false;
      }

      // 4. Category / Type Filter (ALL, GT, GAP, MESA)
      if (effectiveType !== 'ALL' && p.primaryType !== effectiveType) {
        return false;
      }

      // 5. GT Sub-Team Filter
      if (effectiveGt !== 'ALL') {
        const hasSubTeam =
          p.gtSubTeam === effectiveGt ||
          (p.gtTeams && p.gtTeams.includes(effectiveGt));
        if (!hasSubTeam) return false;
      }

      // 6. Contacto Column Filter (email, phone)
      if (contactQuery) {
        const matchEmail = p.email.toLowerCase().includes(contactQuery);
        const matchPhone = !!(p.phone && p.phone.toLowerCase().includes(contactQuery));
        if (!matchEmail && !matchPhone) return false;
      }

      return true;
    });

    // Sorting
    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
        case 'name-desc':
          return b.name.localeCompare(a.name, 'es', { sensitivity: 'base' });
        case 'doc-asc':
          return a.documentId.localeCompare(b.documentId, undefined, { numeric: true });
        case 'doc-desc':
          return b.documentId.localeCompare(a.documentId, undefined, { numeric: true });
        case 'gt-asc': {
          const aGt = a.gtSubTeam || (a.gtTeams && a.gtTeams[0]) || '';
          const bGt = b.gtSubTeam || (b.gtTeams && b.gtTeams[0]) || '';
          if (aGt && !bGt) return -1;
          if (!aGt && bGt) return 1;
          return aGt.localeCompare(bGt, 'es');
        }
        case 'recent': {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        }
        default:
          return a.name.localeCompare(b.name, 'es');
      }
    });
  }, [
    people,
    searchTerm,
    selectedTypeFilter,
    selectedGtSubTeamFilter,
    colFilterName,
    colFilterDoc,
    colFilterType,
    colFilterGt,
    colFilterContact,
    sortOption,
  ]);

  const gtCount = people.filter((p) => p.primaryType === 'GT').length;
  const gapCount = people.filter((p) => p.primaryType === 'GAP').length;
  const mesaCount = people.filter((p) => p.primaryType === 'MESA').length;

  const hasActiveFilters =
    activeColFiltersCount > 0 ||
    searchTerm.trim() !== '' ||
    selectedTypeFilter !== 'ALL' ||
    selectedGtSubTeamFilter !== 'ALL';

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllFilteredSelected =
    filteredPeople.length > 0 && filteredPeople.every((p) => selectedIds.has(p.id));
  const isSomeFilteredSelected =
    filteredPeople.some((p) => selectedIds.has(p.id)) && !isAllFilteredSelected;

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPeople.map((p) => p.id)));
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (!bulkDeleteModal) return;
    setIsDeletingBulk(true);
    try {
      if (bulkDeleteModal.mode === 'all') {
        const total = people.length;
        await deleteAllPeople();
        if (isSupabaseConfigured()) {
          const client = getSupabase();
          if (client) {
            await client.from('people').delete().neq('id', 'placeholder_impossible_id');
            await client.from('assignments').delete().neq('id', 'placeholder_impossible_id');
            await client.from('availabilities').delete().neq('id', 'placeholder_impossible_id');
          }
        }
        setCloudBanner({
          message: `Se han eliminado a todos los ${total} integrantes y sus asignaciones de la base de datos.`,
          isError: false,
        });
      } else {
        const idsToDelete =
          bulkDeleteModal.mode === 'selected'
            ? Array.from(selectedIds)
            : (bulkDeleteModal.ids || filteredPeople.map((p) => p.id));

        if (idsToDelete.length > 0) {
          await deletePeopleBatch(idsToDelete);
          if (isSupabaseConfigured()) {
            const client = getSupabase();
            if (client) {
              await client.from('people').delete().in('id', idsToDelete);
              await client.from('assignments').delete().in('person_id', idsToDelete);
              await client.from('availabilities').delete().in('person_id', idsToDelete);
            }
          }
          setCloudBanner({
            message: `Se han eliminado ${idsToDelete.length} integrantes correctamente.`,
            isError: false,
          });
        }
      }
      setSelectedIds(new Set());
      setBulkDeleteModal(null);
      setTimeout(() => setCloudBanner(null), 5000);
    } catch (err: any) {
      console.error(err);
      setCloudBanner({
        message: err?.message || 'Error al eliminar integrantes en lote.',
        isError: true,
      });
      setTimeout(() => setCloudBanner(null), 5000);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#182535] font-dalek tracking-wider">
              DIRECTORIO DE PERSONAL
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FAF6EC] text-[#64748B] font-bold border border-[#EADDC7] font-montserrat">
              {people.length} registros
            </span>
          </div>
          <p className="text-xs text-[#64748B] font-montserrat mt-1">
            Gestión de integrantes de GT, GAP y MESA con credenciales individuales para Staff.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botón Sincronizar Supabase (si está configurado) */}
          {isSupabaseConfigured() && (
            <button
              onClick={handleCloudSync}
              disabled={isSyncingCloud}
              className="min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-colors font-montserrat shadow-2xs cursor-pointer disabled:opacity-50"
              title="Sincronizar base de datos con Supabase en la nube"
            >
              <Cloud className={`w-4 h-4 text-emerald-600 ${isSyncingCloud ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isSyncingCloud ? 'Sincronizando...' : 'Sincronizar Supabase'}
              </span>
            </button>
          )}

          {/* Botón Eliminar Todos / Filtrados */}
          {people.length > 0 && (
            <button
              onClick={() =>
                setBulkDeleteModal({
                  isOpen: true,
                  mode: hasActiveFilters ? 'filtered' : 'all',
                  count: hasActiveFilters ? filteredPeople.length : people.length,
                  ids: filteredPeople.map((p) => p.id),
                })
              }
              className="min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-[#FDF2EE] hover:bg-[#FBE4DD] text-[#B83A24] border border-[#F6C7BA] font-bold text-xs flex items-center gap-1.5 transition-colors font-montserrat shadow-2xs cursor-pointer"
              title={
                hasActiveFilters
                  ? `Eliminar los ${filteredPeople.length} integrantes filtrados`
                  : `Eliminar a todos los ${people.length} integrantes de la base de datos`
              }
            >
              <Trash2 className="w-4 h-4 text-[#B83A24]" />
              <span className="hidden sm:inline">
                {hasActiveFilters
                  ? `Eliminar Filtrados (${filteredPeople.length})`
                  : `Eliminar a Todos (${people.length})`}
              </span>
              <span className="sm:hidden">Eliminar Todos</span>
            </button>
          )}

          {/* Botón IMPORTAR EXCEL */}
          <button
            onClick={() => setIsExcelModalOpen(true)}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#FEF8EC] hover:bg-[#FDF0D5] text-[#C87F17] border border-[#E5A12E]/50 font-bold text-xs flex items-center gap-2 shadow-2xs transition-all font-montserrat"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#C87F17]" />
            <span>IMPORTAR EXCEL</span>
          </button>

          {/* Botón Exportar */}
          <button
            onClick={() => exportPeopleToOfficialExcel(people, availabilities, shifts)}
            className="min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-[#FAF6EC] hover:bg-[#F3EEDC] text-[#334155] border border-[#EADDC7] font-bold text-xs flex items-center gap-1.5 transition-colors font-montserrat shadow-2xs"
            title="Exportar archivo oficial Excel Maestro (17 columnas)"
          >
            <Download className="w-4 h-4 text-[#B83A24]" />
            <span className="hidden sm:inline">Exportar Excel Maestro</span>
            <span className="sm:hidden">Exportar</span>
          </button>

          {/* Botón Nueva Persona */}
          <button
            onClick={handleOpenAdd}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all font-montserrat"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Nueva Persona</span>
          </button>
        </div>
      </div>

      {/* Cloud Sync Notification Banner */}
      {cloudBanner && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between border animate-in fade-in duration-200 ${
            cloudBanner.isError
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Cloud className={`w-4 h-4 shrink-0 ${cloudBanner.isError ? 'text-amber-600' : 'text-emerald-600'}`} />
            <span className="font-semibold">{cloudBanner.message}</span>
          </div>
          <button
            onClick={() => setCloudBanner(null)}
            className="text-xs p-1 hover:opacity-75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters, Sort & Search */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Buscar por nombre, cédula, usuario, sub-equipo o función..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#FFFDF8] border border-[#EADDC7] text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24] shadow-2xs font-montserrat"
            />
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-3.5 text-[#94A3B8] hover:text-[#182535] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Selector de Ordenamiento y Botón Rápido A-Z */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[200px]">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="w-full pl-9 pr-8 py-3 rounded-2xl bg-[#FFFDF8] border border-[#EADDC7] text-xs font-bold text-[#182535] focus:outline-hidden focus:border-[#B83A24] shadow-2xs font-montserrat appearance-none cursor-pointer"
              >
                <option value="name-asc">Nombre (A → Z)</option>
                <option value="name-desc">Nombre (Z → A)</option>
                <option value="doc-asc">Cédula (0 → 9)</option>
                <option value="doc-desc">Cédula (9 → 0)</option>
                <option value="gt-asc">Sub-Equipo GT (A → Z)</option>
                <option value="recent">Registro más reciente</option>
              </select>
              <ArrowUpDown className="w-4 h-4 text-[#B83A24] absolute left-3 top-3.5 pointer-events-none" />
              <div className="absolute right-3 top-4 pointer-events-none text-[8px] text-[#64748B]">
                ▼
              </div>
            </div>

            {/* Botón rápido A-Z / Z-A */}
            <button
              onClick={() =>
                setSortOption((prev) => (prev === 'name-asc' ? 'name-desc' : 'name-asc'))
              }
              title={sortOption === 'name-asc' ? 'Cambiar orden a Z → A' : 'Cambiar orden a A → Z'}
              className={`min-h-[44px] px-3.5 py-2.5 rounded-2xl border flex items-center gap-1.5 text-xs font-bold font-montserrat transition-all cursor-pointer shadow-2xs ${
                sortOption === 'name-asc' || sortOption === 'name-desc'
                  ? 'bg-[#FEF8EC] border-[#E5A12E]/60 text-[#C87F17]'
                  : 'bg-[#FFFDF8] border-[#EADDC7] text-[#64748B] hover:text-[#182535]'
              }`}
            >
              {sortOption === 'name-desc' ? (
                <>
                  <ArrowUpZA className="w-4 h-4 text-[#B83A24]" />
                  <span className="hidden sm:inline">Z → A</span>
                </>
              ) : (
                <>
                  <ArrowDownAZ className="w-4 h-4 text-[#B83A24]" />
                  <span className="hidden sm:inline">A → Z</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Categoría Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-[#FFFDF8] border border-[#EADDC7] p-1.5 rounded-2xl shadow-2xs overflow-x-auto">
            <span className="text-[11px] font-bold text-[#64748B] px-2 font-montserrat hidden sm:inline">
              Categoría:
            </span>
            {[
              { id: 'ALL', label: `Todos (${people.length})` },
              { id: 'GT', label: `GT (${gtCount})` },
              { id: 'GAP', label: `GAP (${gapCount})` },
              { id: 'MESA', label: `MESA (${mesaCount})` },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => {
                  setSelectedTypeFilter(btn.id as any);
                  if (btn.id !== 'GT') {
                    setSelectedGtSubTeamFilter('ALL');
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-montserrat whitespace-nowrap transition-all cursor-pointer ${
                  selectedTypeFilter === btn.id
                    ? 'bg-[#B83A24] text-white shadow-2xs'
                    : 'text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC]'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-[#64748B] font-montserrat px-2">
            Mostrando <strong>{filteredPeople.length}</strong> de {people.length} personas
          </div>
        </div>

        {/* Barra de Sub-Equipos GT cuando se selecciona GT */}
        {selectedTypeFilter === 'GT' && (
          <div className="p-3 bg-[#FAF6EC] border border-[#EADDC7] rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#182535] font-montserrat flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#B83A24]" />
                Filtrar por Sub-Equipo GT:
              </span>
              {selectedGtSubTeamFilter !== 'ALL' && (
                <button
                  onClick={() => setSelectedGtSubTeamFilter('ALL')}
                  className="text-[11px] font-bold text-[#B83A24] hover:underline cursor-pointer"
                >
                  Ver todos los GT ({gtCount})
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedGtSubTeamFilter('ALL')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all cursor-pointer border ${
                  selectedGtSubTeamFilter === 'ALL'
                    ? 'bg-[#B83A24] text-white border-[#B83A24] shadow-2xs'
                    : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
              >
                Todos los GT ({gtCount})
              </button>

              {GT_SUBTEAMS.map((sub) => {
                const count = subTeamCounts[sub] || 0;
                const isSelected = selectedGtSubTeamFilter === sub;
                return (
                  <button
                    key={sub}
                    onClick={() => setSelectedGtSubTeamFilter(sub)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#B83A24] text-white border-[#B83A24] shadow-2xs'
                        : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span>{sub}</span>{' '}
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* People List / Table */}
      {filteredPeople.length === 0 ? (
        <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-12 text-center space-y-3 shadow-2xs">
          <div className="w-16 h-16 rounded-full bg-[#FAF6EC] border border-[#EADDC7] text-[#94A3B8] flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#182535] font-dalek tracking-wide">
            {people.length === 0 ? 'NO HAY PERSONAS REGISTRADAS' : 'NO SE ENCONTRARON COINCIDENCIAS'}
          </h3>
          <p className="text-xs text-[#64748B] font-montserrat max-w-md mx-auto">
            {people.length === 0
              ? 'Puedes agregar personas individualmente o importar un archivo de Excel con los datos de tu equipo.'
              : 'Intenta modificar el término de búsqueda o el filtro de categoría.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              onClick={() => setIsExcelModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#FEF8EC] text-[#C87F17] border border-[#E5A12E]/40 text-xs font-bold flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Cargar Excel</span>
            </button>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-[#B83A24] text-white text-xs font-bold flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Crear Persona</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl overflow-hidden shadow-2xs">
          {/* Active Filter Chips Bar */}
          {(activeColFiltersCount > 0 || searchTerm || selectedTypeFilter !== 'ALL' || selectedGtSubTeamFilter !== 'ALL') && (
            <div className="bg-[#FAF6EC] border-b border-[#EADDC7] px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap text-xs font-montserrat">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#182535] text-[11px] flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-[#B83A24]" />
                  Filtros aplicados:
                </span>

                {searchTerm && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-[#EADDC7] text-[#182535] text-[11px] font-bold shadow-2xs">
                    <span>Búsqueda: "{searchTerm}"</span>
                    <button
                      onClick={() => setSearchTerm('')}
                      className="text-[#94A3B8] hover:text-[#B83A24] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {colFilterName && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-[#B83A24]/40 text-[#B83A24] text-[11px] font-bold shadow-2xs">
                    <span>Nombre: "{colFilterName}"</span>
                    <button
                      onClick={() => setColFilterName('')}
                      className="text-[#B83A24]/60 hover:text-[#B83A24] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {colFilterDoc && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-[#E5A12E]/50 text-[#C87F17] text-[11px] font-bold shadow-2xs">
                    <span>Cédula/@: "{colFilterDoc}"</span>
                    <button
                      onClick={() => setColFilterDoc('')}
                      className="text-[#C87F17]/60 hover:text-[#C87F17] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {(colFilterType !== 'ALL' || selectedTypeFilter !== 'ALL') && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-[#EADDC7] text-[#182535] text-[11px] font-bold shadow-2xs">
                    <span>Tipo: {colFilterType !== 'ALL' ? colFilterType : selectedTypeFilter}</span>
                    <button
                      onClick={() => {
                        setColFilterType('ALL');
                        setSelectedTypeFilter('ALL');
                      }}
                      className="text-[#94A3B8] hover:text-[#B83A24] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {(colFilterGt !== 'ALL' || selectedGtSubTeamFilter !== 'ALL') && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-[#B83A24]/40 text-[#B83A24] text-[11px] font-bold shadow-2xs">
                    <span>GT: {colFilterGt !== 'ALL' ? colFilterGt : selectedGtSubTeamFilter}</span>
                    <button
                      onClick={() => {
                        setColFilterGt('ALL');
                        setSelectedGtSubTeamFilter('ALL');
                      }}
                      className="text-[#B83A24]/60 hover:text-[#B83A24] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {colFilterContact && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-[#EADDC7] text-[#182535] text-[11px] font-bold shadow-2xs">
                    <span>Contacto: "{colFilterContact}"</span>
                    <button
                      onClick={() => setColFilterContact('')}
                      className="text-[#94A3B8] hover:text-[#B83A24] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setBulkDeleteModal({
                      isOpen: true,
                      mode: 'filtered',
                      count: filteredPeople.length,
                      ids: filteredPeople.map((p) => p.id),
                    })
                  }
                  className="text-[11px] font-bold text-[#B83A24] bg-[#FDF2EE] hover:bg-[#FBE4DD] px-2.5 py-1 rounded-xl border border-[#F6C7BA] flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  title="Eliminar solo las personas que coinciden con los filtros actuales"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#B83A24]" />
                  <span>Eliminar los {filteredPeople.length} filtrados</span>
                </button>

                <button
                  onClick={handleResetAllFilters}
                  className="text-[11px] font-bold text-[#64748B] hover:text-[#182535] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <FilterX className="w-3.5 h-3.5" />
                  <span>Restablecer todo</span>
                </button>
              </div>
            </div>
          )}

          {/* Selected Batch Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="bg-[#182535] text-white px-4 py-3 rounded-2xl mx-4 my-3 flex items-center justify-between gap-3 shadow-lg flex-wrap animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-[#C87F17] text-white flex items-center justify-center font-bold text-xs">
                  {selectedIds.size}
                </div>
                <span className="text-xs font-bold font-montserrat">
                  {selectedIds.size === 1
                    ? '1 persona seleccionada'
                    : `${selectedIds.size} personas seleccionadas`}
                  <span className="text-[#94A3B8] font-normal ml-1">
                    (de {filteredPeople.length} visibles)
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedIds(new Set(filteredPeople.map((p) => p.id)))}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold font-montserrat transition-colors cursor-pointer"
                >
                  Seleccionar todos ({filteredPeople.length})
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold font-montserrat transition-colors cursor-pointer"
                >
                  Deseleccionar
                </button>
                <button
                  onClick={() =>
                    setBulkDeleteModal({
                      isOpen: true,
                      mode: 'selected',
                      count: selectedIds.size,
                      ids: Array.from(selectedIds),
                    })
                  }
                  className="px-3.5 py-1.5 rounded-xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white text-xs font-bold font-montserrat flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Seleccionados ({selectedIds.size})</span>
                </button>
              </div>
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF6EC] text-[#64748B] font-bold border-b border-[#EADDC7]">
                {/* Row 1: Column Titles with Sort & Indicators */}
                <tr>
                  {/* Selector / Checkbox */}
                  <th className="p-3.5 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeFilteredSelected;
                      }}
                      onChange={toggleSelectAllFiltered}
                      className="w-4 h-4 rounded text-[#B83A24] border-[#CBD5E1] focus:ring-[#B83A24] cursor-pointer"
                      title={isAllFilteredSelected ? 'Deseleccionar todos' : 'Seleccionar todos los visibles'}
                    />
                  </th>

                  {/* Persona */}
                  <th className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() =>
                          setSortOption((prev) => (prev === 'name-asc' ? 'name-desc' : 'name-asc'))
                        }
                        className="flex items-center gap-1.5 hover:text-[#182535] font-bold cursor-pointer group"
                        title="Ordenar por Nombre (clic para A-Z o Z-A)"
                      >
                        <span className="font-montserrat text-xs text-[#182535]">Persona</span>
                        {sortOption === 'name-asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#B83A24]" />
                        ) : sortOption === 'name-desc' ? (
                          <ArrowDown className="w-3.5 h-3.5 text-[#B83A24]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
                        )}
                      </button>
                      {colFilterName && (
                        <span className="w-2 h-2 rounded-full bg-[#B83A24]" title="Filtro de nombre activo" />
                      )}
                    </div>
                  </th>

                  {/* Cédula & Usuario */}
                  <th className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() =>
                          setSortOption((prev) => (prev === 'doc-asc' ? 'doc-desc' : 'doc-asc'))
                        }
                        className="flex items-center gap-1.5 hover:text-[#182535] font-bold cursor-pointer group"
                        title="Ordenar por Cédula (clic para 0-9 o 9-0)"
                      >
                        <span className="font-montserrat text-xs text-[#182535]">Cédula & Usuario</span>
                        {sortOption === 'doc-asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#B83A24]" />
                        ) : sortOption === 'doc-desc' ? (
                          <ArrowDown className="w-3.5 h-3.5 text-[#B83A24]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
                        )}
                      </button>
                      {colFilterDoc && (
                        <span className="w-2 h-2 rounded-full bg-[#C87F17]" title="Filtro de documento activo" />
                      )}
                    </div>
                  </th>

                  {/* Tipo Principal */}
                  <th className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-montserrat text-xs text-[#182535]">Tipo Principal</span>
                      {(colFilterType !== 'ALL' || selectedTypeFilter !== 'ALL') && (
                        <span className="w-2 h-2 rounded-full bg-[#B83A24]" title="Filtro de tipo activo" />
                      )}
                    </div>
                  </th>

                  {/* GT / Funciones */}
                  <th className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() =>
                          setSortOption((prev) => (prev === 'gt-asc' ? 'name-asc' : 'gt-asc'))
                        }
                        className="flex items-center gap-1.5 hover:text-[#182535] font-bold cursor-pointer group"
                        title="Ordenar por Sub-Equipo GT"
                      >
                        <span className="font-montserrat text-xs text-[#182535]">GT / Funciones</span>
                        {sortOption === 'gt-asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#B83A24]" />
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
                        )}
                      </button>
                      {(colFilterGt !== 'ALL' || selectedGtSubTeamFilter !== 'ALL') && (
                        <span className="w-2 h-2 rounded-full bg-[#B83A24]" title="Filtro de GT activo" />
                      )}
                    </div>
                  </th>

                  {/* Contacto */}
                  <th className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-montserrat text-xs text-[#182535]">Contacto</span>
                      {colFilterContact && (
                        <span className="w-2 h-2 rounded-full bg-[#B83A24]" title="Filtro de contacto activo" />
                      )}
                    </div>
                  </th>

                  {/* Acciones & Toggle Filtros */}
                  <th className="p-3.5 text-right">
                    <button
                      onClick={() => setShowColumnFilters(!showColumnFilters)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold font-montserrat transition-all cursor-pointer border ${
                        showColumnFilters
                          ? 'bg-[#FEF8EC] text-[#C87F17] border-[#E5A12E]/60 shadow-2xs'
                          : 'bg-white text-[#64748B] border-[#EADDC7] hover:text-[#182535]'
                      }`}
                      title={showColumnFilters ? 'Ocultar campos de filtro' : 'Mostrar campos de filtro por columna'}
                    >
                      <Filter className="w-3 h-3 text-[#B83A24]" />
                      <span>{showColumnFilters ? 'Filtros ON' : 'Filtrar'}</span>
                    </button>
                  </th>
                </tr>

                {/* Row 2: Direct Column Filter Inputs & Selects */}
                {showColumnFilters && (
                  <tr className="bg-[#FEF8EC]/60 border-t border-[#EADDC7]">
                    {/* Checkbox placeholder */}
                    <th className="p-2.5 w-12 text-center text-[#94A3B8] font-normal text-xs">
                      —
                    </th>

                    {/* Filtro Nombre */}
                    <th className="p-2.5 font-normal">
                      <div className="relative">
                        <input
                          type="text"
                          value={colFilterName}
                          onChange={(e) => setColFilterName(e.target.value)}
                          placeholder="Filtrar nombre..."
                          className={`w-full pl-7 pr-6 py-1.5 rounded-xl bg-white border text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24] font-montserrat shadow-2xs transition-colors ${
                            colFilterName ? 'border-[#B83A24] font-semibold ring-1 ring-[#B83A24]/20' : 'border-[#EADDC7]'
                          }`}
                        />
                        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2 top-2.5 pointer-events-none" />
                        {colFilterName && (
                          <button
                            onClick={() => setColFilterName('')}
                            className="absolute right-2 top-2.5 text-[#94A3B8] hover:text-[#B83A24] cursor-pointer"
                            title="Borrar filtro"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* Filtro Cédula / Usuario */}
                    <th className="p-2.5 font-normal">
                      <div className="relative">
                        <input
                          type="text"
                          value={colFilterDoc}
                          onChange={(e) => setColFilterDoc(e.target.value)}
                          placeholder="Cédula o @user..."
                          className={`w-full pl-7 pr-6 py-1.5 rounded-xl bg-white border text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24] font-montserrat shadow-2xs transition-colors ${
                            colFilterDoc ? 'border-[#C87F17] font-semibold ring-1 ring-[#C87F17]/20' : 'border-[#EADDC7]'
                          }`}
                        />
                        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2 top-2.5 pointer-events-none" />
                        {colFilterDoc && (
                          <button
                            onClick={() => setColFilterDoc('')}
                            className="absolute right-2 top-2.5 text-[#94A3B8] hover:text-[#B83A24] cursor-pointer"
                            title="Borrar filtro"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* Filtro Tipo Principal */}
                    <th className="p-2.5 font-normal">
                      <div className="relative">
                        <select
                          value={colFilterType !== 'ALL' ? colFilterType : selectedTypeFilter}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setColFilterType(val);
                            setSelectedTypeFilter(val);
                            if (val !== 'GT') {
                              setColFilterGt('ALL');
                              setSelectedGtSubTeamFilter('ALL');
                            }
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-xl bg-white border text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24] font-montserrat shadow-2xs appearance-none cursor-pointer ${
                            (colFilterType !== 'ALL' || selectedTypeFilter !== 'ALL')
                              ? 'border-[#B83A24] font-bold text-[#B83A24]'
                              : 'border-[#EADDC7]'
                          }`}
                        >
                          <option value="ALL">Todos los tipos ({people.length})</option>
                          <option value="GT">GT ({gtCount})</option>
                          <option value="GAP">GAP ({gapCount})</option>
                          <option value="MESA">MESA ({mesaCount})</option>
                        </select>
                        <div className="absolute right-2.5 top-2.5 pointer-events-none text-[8px] text-[#64748B]">
                          ▼
                        </div>
                      </div>
                    </th>

                    {/* Filtro GT / Sub-Equipos */}
                    <th className="p-2.5 font-normal">
                      <div className="relative">
                        <select
                          value={colFilterGt !== 'ALL' ? colFilterGt : selectedGtSubTeamFilter}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setColFilterGt(val);
                            setSelectedGtSubTeamFilter(val);
                            if (val !== 'ALL') {
                              setColFilterType('GT');
                              setSelectedTypeFilter('GT');
                            }
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-xl bg-white border text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24] font-montserrat shadow-2xs appearance-none cursor-pointer ${
                            (colFilterGt !== 'ALL' || selectedGtSubTeamFilter !== 'ALL')
                              ? 'border-[#B83A24] font-bold text-[#B83A24]'
                              : 'border-[#EADDC7]'
                          }`}
                        >
                          <option value="ALL">Todos los GT ({gtCount})</option>
                          {GT_SUBTEAMS.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub} ({subTeamCounts[sub] || 0})
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-2.5 top-2.5 pointer-events-none text-[8px] text-[#64748B]">
                          ▼
                        </div>
                      </div>
                    </th>

                    {/* Filtro Contacto */}
                    <th className="p-2.5 font-normal">
                      <div className="relative">
                        <input
                          type="text"
                          value={colFilterContact}
                          onChange={(e) => setColFilterContact(e.target.value)}
                          placeholder="Email o tel..."
                          className={`w-full pl-7 pr-6 py-1.5 rounded-xl bg-white border text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24] font-montserrat shadow-2xs transition-colors ${
                            colFilterContact ? 'border-[#B83A24] font-semibold ring-1 ring-[#B83A24]/20' : 'border-[#EADDC7]'
                          }`}
                        />
                        <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2 top-2.5 pointer-events-none" />
                        {colFilterContact && (
                          <button
                            onClick={() => setColFilterContact('')}
                            className="absolute right-2 top-2.5 text-[#94A3B8] hover:text-[#B83A24] cursor-pointer"
                            title="Borrar filtro"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* Acciones: Limpiar filtros */}
                    <th className="p-2.5 text-right font-normal">
                      {activeColFiltersCount > 0 ? (
                        <button
                          onClick={handleResetAllFilters}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-[#FDF2EE] hover:bg-[#FBE4DD] text-[#B83A24] border border-[#F6C7BA] font-bold text-[11px] flex items-center justify-center gap-1 font-montserrat cursor-pointer transition-colors shadow-2xs"
                          title="Limpiar filtros de columna"
                        >
                          <FilterX className="w-3 h-3" />
                          <span>Limpiar</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#94A3B8] block text-center font-montserrat">
                          —
                        </span>
                      )}
                    </th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-[#EADDC7]/60">
                {filteredPeople.map((person) => (
                  <tr key={person.id} className="hover:bg-[#FAF6EC]/60 transition-colors">
                    {/* Checkbox Selector */}
                    <td className="p-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(person.id)}
                        onChange={() => toggleSelect(person.id)}
                        className="w-4 h-4 rounded text-[#B83A24] border-[#CBD5E1] focus:ring-[#B83A24] cursor-pointer"
                      />
                    </td>

                    {/* Persona */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#FAF6EC] border border-[#EADDC7] text-[#B83A24] font-bold font-dalek flex items-center justify-center shrink-0">
                          {person.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[#182535]">{person.name}</div>
                          <div className="text-[11px] text-[#64748B]">
                            {person.roleTitle || 'Staff'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Cédula & Usuario */}
                    <td className="p-4">
                      <div className="font-mono text-xs font-bold text-[#182535]">
                        {person.documentId}
                      </div>
                      <div className="text-[11px] font-mono text-[#C87F17] flex items-center gap-1 mt-0.5">
                        <Key className="w-3 h-3" />
                        <span>@{person.username || person.documentId}</span>
                      </div>
                    </td>

                    {/* Tipo Principal */}
                    <td className="p-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          person.primaryType === 'GT'
                            ? 'bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA]'
                            : person.primaryType === 'GAP'
                            ? 'bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A]'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {person.primaryType}
                      </span>
                    </td>

                    {/* GT / Funciones */}
                    <td className="p-4 text-[#475569]">
                      <div className="space-y-1">
                        {person.primaryType === 'GT' && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] text-[#64748B] font-bold">GT:</span>
                            {person.gtTeams && person.gtTeams.length > 1 ? (
                              <span
                                className="px-2 py-0.5 rounded-md bg-[#FFF5F2] border border-[#FADCD5] text-[11px] font-bold text-[#B83A24]"
                                title={person.gtTeams.join(', ')}
                              >
                                {person.gtTeams.join(', ')}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-[#FAF6EC] border border-[#EADDC7] text-[11px] font-bold text-[#B83A24]">
                                {person.gtSubTeam || (person.gtTeams && person.gtTeams[0]) || 'Generales'}
                              </span>
                            )}
                          </div>
                        )}
                        {person.functions && person.functions.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {person.functions.map((f, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-bold text-[#16A34A]"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#94A3B8]">Sin funciones registradas</span>
                        )}
                      </div>
                    </td>

                    {/* Contacto */}
                    <td className="p-4 text-xs text-[#64748B]">
                      <div className="truncate max-w-[180px]">{person.email}</div>
                      {person.phone && <div className="text-[11px] text-[#94A3B8]">{person.phone}</div>}
                    </td>

                    {/* Acciones */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(person)}
                          className="p-2 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC] transition-colors"
                          title="Editar persona"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(person.id, person.name)}
                          className="p-2 rounded-xl text-[#B83A24] hover:bg-[#FDF2EE] transition-colors"
                          title="Eliminar persona"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-[#EADDC7]/70">
            {/* Mobile Filters Toggle & Panel */}
            <div className="p-3 bg-[#FAF6EC] border-b border-[#EADDC7]">
              <button
                onClick={() => setShowColumnFilters(!showColumnFilters)}
                className="w-full py-2.5 px-3 rounded-xl bg-white border border-[#EADDC7] text-xs font-bold text-[#182535] flex items-center justify-between shadow-2xs cursor-pointer font-montserrat"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#B83A24]" />
                  <span>Filtros por Columna (Nombre, Cédula, GT...)</span>
                  {activeColFiltersCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[#B83A24] text-white text-[10px] flex items-center justify-center font-bold">
                      {activeColFiltersCount}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-[#64748B] transition-transform duration-200 ${
                    showColumnFilters ? 'rotate-180 text-[#B83A24]' : ''
                  }`}
                />
              </button>

              {showColumnFilters && (
                <div className="mt-2.5 space-y-2.5 p-3.5 bg-white rounded-2xl border border-[#EADDC7] shadow-2xs font-montserrat">
                  <div>
                    <label className="text-[10px] font-bold text-[#64748B] block mb-1">Nombre de la Persona</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={colFilterName}
                        onChange={(e) => setColFilterName(e.target.value)}
                        placeholder="Filtrar por nombre..."
                        className="w-full pl-7 pr-6 py-1.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                      />
                      <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2 top-2 pointer-events-none" />
                      {colFilterName && (
                        <button
                          onClick={() => setColFilterName('')}
                          className="absolute right-2 top-2 text-[#94A3B8] hover:text-[#B83A24]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#64748B] block mb-1">Cédula o Usuario (@)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={colFilterDoc}
                        onChange={(e) => setColFilterDoc(e.target.value)}
                        placeholder="Cédula o @usuario..."
                        className="w-full pl-7 pr-6 py-1.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                      />
                      <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2 top-2 pointer-events-none" />
                      {colFilterDoc && (
                        <button
                          onClick={() => setColFilterDoc('')}
                          className="absolute right-2 top-2 text-[#94A3B8] hover:text-[#B83A24]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#64748B] block mb-1">Tipo</label>
                      <select
                        value={colFilterType !== 'ALL' ? colFilterType : selectedTypeFilter}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setColFilterType(val);
                          setSelectedTypeFilter(val);
                          if (val !== 'GT') {
                            setColFilterGt('ALL');
                            setSelectedGtSubTeamFilter('ALL');
                          }
                        }}
                        className="w-full px-2 py-1.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] text-xs font-bold text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                      >
                        <option value="ALL">Todos los tipos</option>
                        <option value="GT">GT</option>
                        <option value="GAP">GAP</option>
                        <option value="MESA">MESA</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[#64748B] block mb-1">Sub-Equipo GT</label>
                      <select
                        value={colFilterGt !== 'ALL' ? colFilterGt : selectedGtSubTeamFilter}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setColFilterGt(val);
                          setSelectedGtSubTeamFilter(val);
                          if (val !== 'ALL') {
                            setColFilterType('GT');
                            setSelectedTypeFilter('GT');
                          }
                        }}
                        className="w-full px-2 py-1.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] text-xs font-bold text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                      >
                        <option value="ALL">Todos los GT</option>
                        {GT_SUBTEAMS.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#64748B] block mb-1">Contacto (Email / Teléfono)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={colFilterContact}
                        onChange={(e) => setColFilterContact(e.target.value)}
                        placeholder="Email o teléfono..."
                        className="w-full pl-7 pr-6 py-1.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                      />
                      <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2 top-2 pointer-events-none" />
                      {colFilterContact && (
                        <button
                          onClick={() => setColFilterContact('')}
                          className="absolute right-2 top-2 text-[#94A3B8] hover:text-[#B83A24]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {activeColFiltersCount > 0 && (
                    <button
                      onClick={handleResetAllFilters}
                      className="w-full py-2 rounded-xl bg-[#FDF2EE] text-[#B83A24] text-xs font-bold flex items-center justify-center gap-1.5 border border-[#F6C7BA] cursor-pointer"
                    >
                      <FilterX className="w-3.5 h-3.5" />
                      <span>Limpiar filtros de columna</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {filteredPeople.map((person) => (
              <div key={person.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(person.id)}
                      onChange={() => toggleSelect(person.id)}
                      className="w-4 h-4 rounded text-[#B83A24] border-[#CBD5E1] focus:ring-[#B83A24] cursor-pointer shrink-0"
                    />
                    <div className="w-10 h-10 rounded-xl bg-[#FAF6EC] border border-[#EADDC7] text-[#B83A24] font-bold font-dalek flex items-center justify-center shrink-0">
                      {person.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#182535]">{person.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs text-[#64748B]">{person.documentId}</span>
                        <span className="text-xs text-[#C87F17] font-mono">@{person.username || person.documentId}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      person.primaryType === 'GT'
                        ? 'bg-[#FDF2EE] text-[#B83A24]'
                        : person.primaryType === 'GAP'
                        ? 'bg-[#FEF8EC] text-[#C87F17]'
                        : 'bg-purple-50 text-purple-700'
                    }`}
                  >
                    {person.primaryType}
                  </span>
                </div>

                {/* Details */}
                <div className="text-xs text-[#64748B] space-y-2 bg-[#FAF6EC] p-3 rounded-2xl border border-[#EADDC7]/60">
                  {person.primaryType === 'GT' && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#182535]">Sub-Equipo:</span>
                      {person.gtTeams && person.gtTeams.length > 1 ? (
                        <span
                          className="px-2 py-0.5 rounded-md bg-[#FFF5F2] border border-[#FADCD5] text-[11px] font-bold text-[#B83A24]"
                          title={person.gtTeams.join(', ')}
                        >
                          {person.gtTeams.join(', ')}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-[#FFFDF8] border border-[#EADDC7] text-[11px] font-bold text-[#B83A24]">
                          {person.gtSubTeam || (person.gtTeams && person.gtTeams[0]) || 'Generales'}
                        </span>
                      )}
                    </div>
                  )}
                  {person.functions && person.functions.length > 0 && (
                    <div>
                      <span className="font-bold text-[#182535] block mb-1">Funciones:</span>
                      <div className="flex flex-wrap gap-1">
                        {person.functions.map((f, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-bold text-[#16A34A]"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="font-bold text-[#182535]">Correo: </span>
                    <span>{person.email}</span>
                  </div>
                </div>

                {/* Mobile Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleOpenEdit(person)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#334155] bg-[#FAF6EC] border border-[#EADDC7] flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(person.id, person.name)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#B83A24] bg-[#FDF2EE] border border-[#F6C7BA] flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Person Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl w-full max-w-xl p-6 sm:p-8 shadow-2xl relative my-6 text-[#182535] animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <span className="text-[10px] uppercase font-bold text-[#C87F17] font-montserrat tracking-wider">
                {editingPerson ? 'Editar Registro' : 'Nuevo Registro'}
              </span>
              <h2 className="text-xl font-extrabold text-[#182535] font-dalek tracking-wider">
                {editingPerson ? 'MODIFICAR PERSONA' : 'REGISTRAR NUEVA PERSONA'}
              </h2>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-[#FDF2EE] border border-[#F6C7BA] text-xs font-semibold text-[#B83A24] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSavePerson} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre */}
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej. Alejandra Pérez"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                  />
                </div>

                {/* Cédula */}
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                    Cédula / Documento *
                  </label>
                  <input
                    type="text"
                    required
                    value={formDoc}
                    onChange={(e) => setFormDoc(e.target.value)}
                    placeholder="Ej. 1234567890"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                  />
                  <span className="text-[10px] text-[#64748B] mt-0.5 block">
                    (Se utilizará como contraseña inicial de Staff)
                  </span>
                </div>

                {/* Usuario individual */}
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                    Usuario Staff (Login)
                  </label>
                  <input
                    type="text"
                    value={formUser}
                    onChange={(e) => setFormUser(e.target.value)}
                    placeholder="Ej. alejaperez"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                  />
                </div>

                {/* Tipo Principal */}
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                    Tipo Principal *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as PersonType)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                  >
                    <option value="GT">GT (Guías Técnicos)</option>
                    <option value="GAP">GAP (Guías de Apoyo y Protocolo)</option>
                    <option value="MESA">MESA (Comité Central)</option>
                  </select>
                </div>

                {/* Correo */}
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="ejemplo@eafit.edu.co"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                  />
                </div>

                {/* Celular */}
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                    Teléfono Celular
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="300 123 4567"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                  />
                </div>

                {/* Grupo / GT Sub-teams con selección múltiple */}
                {formType === 'GT' ? (
                  <div className="sm:col-span-2 p-3.5 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-bold text-[#182535] font-montserrat">
                          Sub-Equipos GT Asignados *
                        </label>
                        <span className="text-[11px] text-[#64748B]">
                          Seleccione uno o varios sub-equipos a los que pertenece esta persona
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = formGtSubTeams.length === GT_SUBTEAMS.length;
                          const newTeams = allSelected ? ['Logística'] : [...GT_SUBTEAMS];
                          setFormGtSubTeams(newTeams as GtSubTeam[]);
                          setFormGtSubTeam(newTeams[0] as GtSubTeam);
                        }}
                        className="text-[11px] font-bold text-[#B83A24] hover:underline cursor-pointer"
                      >
                        {formGtSubTeams.length === GT_SUBTEAMS.length
                          ? 'Solo Logística'
                          : 'Seleccionar todos (8)'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {GT_SUBTEAMS.map((sub) => {
                        const isSelected = formGtSubTeams.includes(sub);
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => {
                              let updated: GtSubTeam[];
                              if (isSelected) {
                                if (formGtSubTeams.length === 1) return; // Mínimo 1
                                updated = formGtSubTeams.filter((s) => s !== sub);
                              } else {
                                updated = [...formGtSubTeams, sub];
                              }
                              setFormGtSubTeams(updated);
                              setFormGtSubTeam(updated[0]);
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-montserrat flex items-center justify-between border transition-all text-left cursor-pointer ${
                              isSelected
                                ? 'bg-white border-[#B83A24] text-[#B83A24] font-bold shadow-2xs ring-1 ring-[#B83A24]/20'
                                : 'bg-[#FAF6EC]/70 border-[#D8C7A5] text-[#475569] hover:bg-white'
                            }`}
                          >
                            <span>{sub}</span>
                            <div
                              className={`w-4 h-4 rounded-md flex items-center justify-center border text-[10px] transition-colors ${
                                isSelected
                                  ? 'bg-[#B83A24] border-[#B83A24] text-white'
                                  : 'border-[#CBD5E1] bg-white text-transparent'
                              }`}
                            >
                              ✓
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-[#EADDC7]/70 flex items-center justify-between text-[11px] text-[#64748B]">
                      <span>
                        Grupos asignados:{' '}
                        <strong className="text-[#182535]">
                          {formGtSubTeams.length === GT_SUBTEAMS.length
                            ? 'Todos los 8 sub-equipos'
                            : formGtSubTeams.join(', ')}
                        </strong>
                      </span>
                      <span className="font-semibold text-[#B83A24]">
                        {formGtSubTeams.length} de {GT_SUBTEAMS.length} grupos
                      </span>
                    </div>

                    <div className="pt-3 mt-3 border-t border-[#EADDC7]/70 flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formAlsoActsAsGap}
                          onChange={(e) => setFormAlsoActsAsGap(e.target.checked)}
                          className="w-4 h-4 rounded text-[#B83A24] bg-white border-gray-300 focus:ring-[#B83A24]"
                        />
                        <span className="text-xs font-bold text-[#182535]">
                          Este GT también apoya como GAP en The Games/Carnival
                        </span>
                      </label>
                      {formAlsoActsAsGap && (
                        <input
                          type="text"
                          value={formGapRoleDesc}
                          onChange={(e) => setFormGapRoleDesc(e.target.value)}
                          placeholder="Especificar días o rol (Ej. Jueves y Viernes GAP Generales)"
                          className="w-full px-3 py-2 mt-1 rounded-xl bg-white border border-[#EADDC7] text-[11px] text-[#182535] focus:outline-none focus:border-[#B83A24]"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                      Rol / Cargo
                    </label>
                    <input
                      type="text"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      placeholder="Ej. Líder, Coordinador, Staff"
                      className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                    />
                  </div>
                )}
              </div>

              {/* Funciones Jerárquicas según Grupo */}
              <div className="p-4 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#182535] font-montserrat">
                    Funciones Asignadas a este Integrante (
                    {formType === 'GT'
                      ? formGtSubTeams.length === GT_SUBTEAMS.length
                        ? 'Todos los Sub-Equipos'
                        : formGtSubTeams.join(', ')
                      : formType}
                    )
                  </label>
                  <span className="text-[10px] text-[#64748B]">
                    Seleccione una o varias aptitudes
                  </span>
                </div>

                {/* Available functions in catalogue for this group */}
                {(() => {
                  const availableCatalogFns = getFilteredFunctions(
                    functions,
                    formType,
                    formType === 'GT' ? formGtSubTeams : undefined,
                    true
                  );

                  return (
                    <div className="space-y-2">
                      {availableCatalogFns.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {availableCatalogFns.map((fn) => {
                            const isSelected = formSelectedFunctions.includes(fn.name);
                            return (
                              <button
                                key={fn.id}
                                type="button"
                                onClick={() => toggleFunctionSelection(fn.name)}
                                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-[#182535] text-white border-[#182535] shadow-2xs'
                                    : 'bg-[#FFFDF8] text-[#475569] border-[#E2D6BC] hover:border-[#182535]'
                                }`}
                              >
                                {isSelected ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5 opacity-50" />
                                )}
                                <span>{fn.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#94A3B8]">
                          No hay funciones registradas en el catálogo para{' '}
                          {formType === 'GT' ? `GT → ${formGtSubTeam}` : formType}. Puede agregarlas en el módulo FUNCIONES o escribir una personalizada abajo.
                        </p>
                      )}

                      {/* Show active selections */}
                      {formSelectedFunctions.length > 0 && (
                        <div className="pt-2 border-t border-[#EADDC7]/60 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-[#64748B] font-bold">Seleccionadas:</span>
                          {formSelectedFunctions.map((fnName) => (
                            <span
                              key={fnName}
                              className="px-2 py-0.5 rounded-md bg-[#FDF2EE] border border-[#F6C7BA] text-[#B83A24] text-[11px] font-bold flex items-center gap-1"
                            >
                              <span>{fnName}</span>
                              <button
                                type="button"
                                onClick={() => toggleFunctionSelection(fnName)}
                                className="hover:text-red-700 ml-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Custom function quick add */}
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="text"
                          value={customFunctionInput}
                          onChange={(e) => setCustomFunctionInput(e.target.value)}
                          placeholder="Otra función específica..."
                          className="flex-1 px-3 py-1.5 rounded-lg bg-[#FFFDF8] border border-[#E2D6BC] text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24]"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomFunction();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomFunction}
                          className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#FAF6EC] hover:bg-[#F3EEDC] text-[#182535] border border-[#EADDC7] text-xs font-bold font-montserrat flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Añadir</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Talla y Dieta */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                    Talla Camiseta
                  </label>
                  <select
                    value={formShirt}
                    onChange={(e) => setFormShirt(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                  >
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="XXL">XXL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                    Restricción Alimentaria
                  </label>
                  <input
                    type="text"
                    value={formDiet}
                    onChange={(e) => setFormDiet(e.target.value)}
                    placeholder="Ej. Vegetariana, Celíaca"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold text-[#334155] mb-1 font-montserrat">
                  Observaciones
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Información relevante..."
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF6EC] border border-[#E5DAC0] text-xs text-[#182535] focus:outline-hidden focus:border-[#B83A24]"
                />
              </div>

              {/* Modal buttons */}
              <div className="pt-4 border-t border-[#EADDC7] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:bg-[#FAF6EC]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-2xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white font-bold text-xs font-dalek tracking-wider shadow-md transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'GUARDANDO...' : editingPerson ? 'ACTUALIZAR' : 'GUARDAR PERSONA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteModal && bulkDeleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] border-2 border-[#F6C7BA] rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl relative text-[#182535] animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => !isDeletingBulk && setBulkDeleteModal(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FDF2EE] border border-[#F6C7BA] flex items-center justify-center text-[#B83A24] shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#B83A24] font-montserrat tracking-wider">
                  Acción Definitiva
                </span>
                <h3 className="text-lg font-bold font-dalek text-[#182535]">
                  {bulkDeleteModal.mode === 'all'
                    ? '¿ELIMINAR A TODOS LOS INTEGRANTES?'
                    : bulkDeleteModal.mode === 'filtered'
                    ? `¿ELIMINAR ${bulkDeleteModal.count} INTEGRANTES FILTRADOS?`
                    : `¿ELIMINAR ${bulkDeleteModal.count} INTEGRANTES SELECCIONADOS?`}
                </h3>
              </div>
            </div>

            <div className="space-y-3 mb-6 text-xs text-[#64748B] font-montserrat">
              <p className="text-sm text-[#182535] font-semibold">
                {bulkDeleteModal.mode === 'all'
                  ? `Estás a punto de eliminar a la totalidad de los ${people.length} integrantes registrados en la base de datos.`
                  : bulkDeleteModal.mode === 'filtered'
                  ? `Se eliminarán las ${bulkDeleteModal.count} personas que coinciden con los filtros aplicados actualmente.`
                  : `Se eliminarán las ${bulkDeleteModal.count} personas seleccionadas con casillas de verificación.`}
              </p>

              <div className="p-3.5 rounded-2xl bg-[#FDF2EE] border border-[#F6C7BA] text-[#B83A24] text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Atención: Acción Irreversible</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#852717]">
                  Esta operación borrará los perfiles, así como todos sus turnos asignados y disponibilidades registradas en el evento.
                </p>
              </div>

              {/* Selector de modo si hay filtros aplicados o personas seleccionadas */}
              {hasActiveFilters && bulkDeleteModal.mode !== 'selected' && (
                <div className="pt-2">
                  <span className="block text-[11px] font-bold text-[#182535] mb-2">
                    Selecciona el alcance de la eliminación:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setBulkDeleteModal({
                          isOpen: true,
                          mode: 'filtered',
                          count: filteredPeople.length,
                          ids: filteredPeople.map((p) => p.id),
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        bulkDeleteModal.mode === 'filtered'
                          ? 'border-[#B83A24] bg-[#FDF2EE] text-[#B83A24] font-bold shadow-2xs'
                          : 'border-[#EADDC7] bg-white text-[#64748B] hover:bg-[#FAF6EC]'
                      }`}
                    >
                      <div className="text-xs font-bold">Solo Filtrados</div>
                      <div className="text-[10px] opacity-80">{filteredPeople.length} personas</div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setBulkDeleteModal({
                          isOpen: true,
                          mode: 'all',
                          count: people.length,
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        bulkDeleteModal.mode === 'all'
                          ? 'border-[#B83A24] bg-[#FDF2EE] text-[#B83A24] font-bold shadow-2xs'
                          : 'border-[#EADDC7] bg-white text-[#64748B] hover:bg-[#FAF6EC]'
                      }`}
                    >
                      <div className="text-xs font-bold">Todos en Base de Datos</div>
                      <div className="text-[10px] opacity-80">{people.length} personas</div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#EADDC7]">
              <button
                type="button"
                disabled={isDeletingBulk}
                onClick={() => setBulkDeleteModal(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#64748B] hover:bg-[#FAF6EC] cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingBulk}
                onClick={handleConfirmBulkDelete}
                className="px-5 py-2.5 rounded-xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50 font-montserrat"
              >
                {isDeletingBulk ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>
                      {bulkDeleteModal.mode === 'all'
                        ? `Sí, Eliminar a Todos (${people.length})`
                        : `Sí, Eliminar (${bulkDeleteModal.count})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        existingPeople={people}
        shifts={shifts}
      />
    </div>
  );
};
