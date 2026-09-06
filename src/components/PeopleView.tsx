import React, { useState } from 'react';
import { Person, PersonType, GroupFunction, GtSubTeam, ConfigurableShift, AvailabilityRecord } from '../types';
import { addPerson, updatePerson, deletePerson } from '../services/storageService';
import { exportPeopleToOfficialExcel, downloadOfficialExcelMaestroTemplate } from '../services/excelService';
import { ExcelImportModal } from './ExcelImportModal';
import { GT_SUBTEAMS, getFilteredFunctions } from '../data/functionsCatalog';
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
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<PersonType | 'ALL'>('ALL');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

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
    }
  };

  // Filtered people
  const filteredPeople = people.filter((p) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(query) ||
      p.documentId.toLowerCase().includes(query) ||
      (p.username && p.username.toLowerCase().includes(query)) ||
      p.email.toLowerCase().includes(query);

    const matchesType = selectedTypeFilter === 'ALL' || p.primaryType === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  const gtCount = people.filter((p) => p.primaryType === 'GT').length;
  const gapCount = people.filter((p) => p.primaryType === 'GAP').length;
  const mesaCount = people.filter((p) => p.primaryType === 'MESA').length;

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

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar por nombre, cédula, usuario o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#FFFDF8] border border-[#EADDC7] text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24] shadow-2xs font-montserrat"
          />
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3.5" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-3.5 text-[#94A3B8] hover:text-[#182535]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#FFFDF8] border border-[#EADDC7] p-1.5 rounded-2xl shadow-2xs overflow-x-auto">
          {[
            { id: 'ALL', label: `Todos (${people.length})` },
            { id: 'GT', label: `GT (${gtCount})` },
            { id: 'GAP', label: `GAP (${gapCount})` },
            { id: 'MESA', label: `MESA (${mesaCount})` },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setSelectedTypeFilter(btn.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-montserrat whitespace-nowrap transition-all ${
                selectedTypeFilter === btn.id
                  ? 'bg-[#B83A24] text-white shadow-2xs'
                  : 'text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC]'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
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
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF6EC] text-[#64748B] font-bold border-b border-[#EADDC7]">
                <tr>
                  <th className="p-4">Persona</th>
                  <th className="p-4">Cédula & Usuario</th>
                  <th className="p-4">Tipo Principal</th>
                  <th className="p-4">GT / Funciones</th>
                  <th className="p-4">Contacto</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EADDC7]/60">
                {filteredPeople.map((person) => (
                  <tr key={person.id} className="hover:bg-[#FAF6EC]/60 transition-colors">
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
            {filteredPeople.map((person) => (
              <div key={person.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
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
