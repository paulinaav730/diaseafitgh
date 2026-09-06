import React, { useState } from 'react';
import { GroupFunction, GtSubTeam, PersonType, Person, Assignment } from '../types';
import { GT_SUBTEAMS, getFilteredFunctions } from '../data/functionsCatalog';
import {
  addGroupFunction,
  updateGroupFunction,
  toggleGroupFunctionActive,
  deleteGroupFunction,
  checkFunctionUsage,
  restoreDefaultFunctions,
} from '../services/storageService';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Shield,
  Layers,
  Users,
  Grid,
  Sparkles,
} from 'lucide-react';

interface FunctionsViewProps {
  functions: GroupFunction[];
  people: Person[];
  assignments: Assignment[];
}

export const FunctionsView: React.FC<FunctionsViewProps> = ({
  functions,
}) => {
  const [activeCategory, setActiveCategory] = useState<PersonType>('GT');
  const [activeGtSubTeam, setActiveGtSubTeam] = useState<GtSubTeam>('Logística');

  // New function form state
  const [newFunctionName, setNewFunctionName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit modal state
  const [editingFn, setEditingFn] = useState<GroupFunction | null>(null);
  const [editName, setEditName] = useState('');

  // Delete warning modal state
  const [deleteWarning, setDeleteWarning] = useState<{
    fn: GroupFunction;
    peopleCount: number;
    assignmentsCount: number;
    peopleNames: string[];
  } | null>(null);

  // Filter functions strictly by current active category and sub-team
  const currentGroupFunctions = getFilteredFunctions(
    functions,
    activeCategory,
    activeCategory === 'GT' ? activeGtSubTeam : undefined,
    false // show both active and inactive
  );

  const handleCreateFunction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFunctionName.trim()) return;

    setIsSubmitting(true);
    try {
      await addGroupFunction({
        name: newFunctionName.trim(),
        category: activeCategory,
        gtSubTeam: activeCategory === 'GT' ? activeGtSubTeam : undefined,
        isActive: true,
      });

      setNewFunctionName('');
      setSuccessMessage(`Función "${newFunctionName.trim()}" creada con éxito.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al crear la función.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (fn: GroupFunction) => {
    setEditingFn(fn);
    setEditName(fn.name);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFn || !editName.trim()) return;

    try {
      await updateGroupFunction(editingFn.id, {
        name: editName.trim(),
      });
      setEditingFn(null);
      setSuccessMessage('Función actualizada correctamente.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al actualizar la función.');
    }
  };

  const handleToggleActive = async (fn: GroupFunction) => {
    try {
      await toggleGroupFunctionActive(fn.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteClick = (fn: GroupFunction) => {
    const usage = checkFunctionUsage(fn.name, fn.category, fn.gtSubTeam);
    if (usage.peopleCount > 0 || usage.assignmentsCount > 0) {
      // Must NOT delete silently: show explicit warning
      setDeleteWarning({
        fn,
        peopleCount: usage.peopleCount,
        assignmentsCount: usage.assignmentsCount,
        peopleNames: usage.peopleNames,
      });
    } else {
      if (confirm(`¿Eliminar la función "${fn.name}"?`)) {
        deleteGroupFunction(fn.id, true);
      }
    }
  };

  const handleConfirmForcedDelete = async () => {
    if (!deleteWarning) return;
    await deleteGroupFunction(deleteWarning.fn.id, true);
    setDeleteWarning(null);
    setSuccessMessage(`Función eliminada.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRestoreDefaults = async () => {
    if (
      confirm(
        '¿Desea restaurar el catálogo predeterminado de funciones oficiales para GT, GAP y MESA?'
      )
    ) {
      await restoreDefaultFunctions();
      setSuccessMessage('Catálogo de funciones restaurado.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6 text-[#182535]">
      {/* Header Banner */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 sm:p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA] font-dalek">
              MÓDULO OFICIAL
            </span>
            <span className="text-xs text-[#C87F17] font-bold font-montserrat">
              Jerarquía Independiente
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#182535] mt-1 tracking-wide font-dalek">
            GESTIÓN DE FUNCIONES
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5 font-montserrat max-w-2xl">
            Las funciones <strong>NO son globales</strong>. Pertenecen exclusivamente a su GT específico (Logística, RRPP, GH, Mercadeo, etc.), a GAP o a MESA, y nunca se mezclan.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleRestoreDefaults}
            className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[#FAF6EC] hover:bg-[#F3EEDC] text-[#64748B] hover:text-[#182535] border border-[#EADDC7] transition-all flex items-center gap-1.5 font-montserrat"
            title="Restaurar catálogo inicial oficial"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar Catálogo</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Group Tabs (GT / GAP / MESA) */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EADDC7]">
          <div>
            <h3 className="text-sm font-bold text-[#182535] font-montserrat">
              Seleccionar Grupo Principal
            </h3>
            <p className="text-[11px] text-[#64748B]">
              Organización estricta por tipo de integrante
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[#FAF6EC] p-1.5 rounded-2xl border border-[#EADDC7]">
            <button
              onClick={() => setActiveCategory('GT')}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeCategory === 'GT'
                  ? 'bg-[#182535] text-white shadow-xs font-montserrat'
                  : 'text-[#64748B] hover:text-[#182535] font-montserrat'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>GT (Grupos de Trabajo)</span>
            </button>

            <button
              onClick={() => setActiveCategory('GAP')}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeCategory === 'GAP'
                  ? 'bg-[#B83A24] text-white shadow-xs font-montserrat'
                  : 'text-[#64748B] hover:text-[#182535] font-montserrat'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>GAP</span>
            </button>

            <button
              onClick={() => setActiveCategory('MESA')}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeCategory === 'MESA'
                  ? 'bg-[#C87F17] text-white shadow-xs font-montserrat'
                  : 'text-[#64748B] hover:text-[#182535] font-montserrat'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>MESA</span>
            </button>
          </div>
        </div>

        {/* If GT is selected: Sub-team horizontal selector */}
        {activeCategory === 'GT' && (
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider font-dalek">
              Sub-Equipos GT Oficiales:
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {GT_SUBTEAMS.map((subTeam) => {
                const isSelected = activeGtSubTeam === subTeam;
                const count = functions.filter(
                  (f) => f.category === 'GT' && f.gtSubTeam === subTeam
                ).length;

                return (
                  <button
                    key={subTeam}
                    onClick={() => setActiveGtSubTeam(subTeam)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-[#B83A24] text-white border-[#B83A24] shadow-xs font-montserrat'
                        : 'bg-[#FAF6EC] text-[#64748B] border-[#EADDC7] hover:text-[#182535] hover:bg-[#F3EEDC] font-montserrat'
                    }`}
                  >
                    <span>{subTeam}</span>
                    <span
                      className={`text-[10px] px-2 py-0.2 rounded-md font-mono ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-[#EAE0CA] text-[#475569]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Function Creation & List Section */}
      <div className="bg-[#FFFDF8] border border-[#EADDC7] rounded-3xl p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EADDC7]">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#B83A24]" />
              <h3 className="text-base sm:text-lg font-bold text-[#182535] font-dalek tracking-wide">
                {activeCategory === 'GT'
                  ? `FUNCIONES DE GT → ${activeGtSubTeam.toUpperCase()}`
                  : activeCategory === 'GAP'
                  ? 'FUNCIONES PROPIAS DE GAP'
                  : 'FUNCIONES PROPIAS DE MESA'}
              </h3>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5 font-montserrat">
              {activeCategory === 'GT'
                ? `Pertenecen EXCLUSIVAMENTE a ${activeGtSubTeam}. No aparecerán en otros GT, GAP ni Mesa.`
                : activeCategory === 'GAP'
                ? 'Pertenecen EXCLUSIVAMENTE a GAP. No aparecerán en GT ni Mesa.'
                : 'Pertenecen EXCLUSIVAMENTE a Mesa. No aparecerán en GT ni GAP.'}
            </p>
          </div>

          <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#FAF6EC] border border-[#EADDC7] text-[#182535] font-bold self-start sm:self-auto">
            {currentGroupFunctions.length} función(es) registrada(s)
          </span>
        </div>

        {/* Quick Create Form */}
        <form
          onSubmit={handleCreateFunction}
          className="p-4 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] flex flex-col sm:flex-row items-center gap-3"
        >
          <div className="flex-1 w-full relative">
            <input
              type="text"
              placeholder={`Nueva función para ${
                activeCategory === 'GT' ? activeGtSubTeam : activeCategory
              } (ej. ${
                activeGtSubTeam === 'Logística'
                  ? 'Montaje, Apoyo logístico, Desmontaje'
                  : 'Coordinación, Control, Apoyo'
              })`}
              value={newFunctionName}
              onChange={(e) => setNewFunctionName(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl bg-[#FFFDF8] border border-[#E2D6BC] text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24] font-montserrat font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !newFunctionName.trim()}
            className="min-h-[42px] w-full sm:w-auto px-5 py-2 rounded-xl bg-[#B83A24] hover:bg-[#9E2F1B] disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 font-dalek tracking-wider shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>AGREGAR FUNCIÓN</span>
          </button>
        </form>

        {/* Functions Grid */}
        {currentGroupFunctions.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#64748B]">
            <Tag className="w-8 h-8 text-[#C87F17] mx-auto mb-2 opacity-70" />
            <p className="font-semibold text-[#182535] text-sm">
              No hay funciones creadas para{' '}
              {activeCategory === 'GT' ? `${activeCategory} → ${activeGtSubTeam}` : activeCategory}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Ingrese un nombre en el campo superior para crear la primera función.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {currentGroupFunctions.map((fn) => {
              const usage = checkFunctionUsage(fn.name, fn.category, fn.gtSubTeam);

              return (
                <div
                  key={fn.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    fn.isActive
                      ? 'bg-[#FFFDF8] border-[#EADDC7] hover:border-[#B83A24] shadow-2xs'
                      : 'bg-[#F9F6EE] border-[#E5DAC0] opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#B83A24]" />
                        <h4 className="font-bold text-[#182535] text-sm font-montserrat">
                          {fn.name}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(fn)}
                        title={fn.isActive ? 'Desactivar función' : 'Activar función'}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold transition-colors ${
                          fn.isActive
                            ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
                            : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                        }`}
                      >
                        {fn.isActive ? 'Activa' : 'Inactiva'}
                      </button>
                    </div>

                    <div className="text-[11px] text-[#64748B] font-mono mt-1 space-y-0.5">
                      <div>
                        Pertenece a:{' '}
                        <strong className="text-[#182535]">
                          {fn.category}
                          {fn.gtSubTeam ? ` → ${fn.gtSubTeam}` : ''}
                        </strong>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#94A3B8] pt-1">
                        <span>{usage.peopleCount} persona(s)</span>
                        <span>•</span>
                        <span>{usage.assignmentsCount} turno(s)</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-4 pt-3 border-t border-[#EADDC7]/70 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEdit(fn)}
                      title="Editar nombre"
                      className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC] border border-transparent hover:border-[#EADDC7] transition-all flex items-center justify-center text-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteClick(fn)}
                      title="Eliminar función"
                      className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-[#64748B] hover:text-[#B83A24] hover:bg-[#FDF2EE] border border-transparent hover:border-[#F6C7BA] transition-all flex items-center justify-center text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingFn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-[#182535] mb-1 font-dalek tracking-wide">
              EDITAR FUNCIÓN
            </h3>
            <p className="text-xs text-[#64748B] mb-4 font-montserrat">
              {editingFn.category} {editingFn.gtSubTeam ? `→ ${editingFn.gtSubTeam}` : ''}
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-montserrat">
              <div>
                <label className="block text-[#334155] font-semibold mb-1">
                  Nombre de la Función *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF6EC] text-[#182535] rounded-xl border border-[#E5DAC0] focus:outline-hidden focus:border-[#B83A24] text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#EADDC7]">
                <button
                  type="button"
                  onClick={() => setEditingFn(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC] text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white font-bold text-xs shadow-md transition-all font-dalek tracking-wider"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Warning Modal (Mandatory Anti-Silent Deletion) */}
      {deleteWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] border-2 border-[#B83A24] rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FDF2EE] border border-[#F6C7BA] text-[#B83A24] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-[#182535] font-dalek tracking-wide">
                ADVERTENCIA: FUNCIÓN EN USO
              </h3>
              <p className="text-xs text-[#64748B] mt-1 font-montserrat">
                La función <strong>&quot;{deleteWarning.fn.name}&quot;</strong> no puede eliminarse silenciosamente porque actualmente está vinculada:
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FEF8EC] border border-[#E5A12E]/40 text-xs font-montserrat space-y-2">
              <div className="flex justify-between font-bold text-[#182535]">
                <span>Personas que tienen esta función:</span>
                <span className="font-mono text-[#B83A24]">{deleteWarning.peopleCount}</span>
              </div>
              <div className="flex justify-between font-bold text-[#182535]">
                <span>Turnos asignados con esta función:</span>
                <span className="font-mono text-[#B83A24]">{deleteWarning.assignmentsCount}</span>
              </div>
              {deleteWarning.peopleNames.length > 0 && (
                <div className="text-[11px] text-[#64748B] pt-1 border-t border-[#E5A12E]/30">
                  Integrantes: {deleteWarning.peopleNames.slice(0, 5).join(', ')}
                  {deleteWarning.peopleNames.length > 5 && ' ...'}
                </div>
              )}
            </div>

            <p className="text-[11px] text-[#94A3B8] text-center font-montserrat">
              Si confirma la eliminación forzada, la función será removida del catálogo y de las asignaciones correspondientes.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteWarning(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#FAF6EC] text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmForcedDelete}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white font-bold text-xs shadow-md transition-all font-dalek tracking-wider"
              >
                Confirmar Eliminación Forzada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
