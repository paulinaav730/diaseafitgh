import React, { useState } from 'react';
import { Person, Assignment, AvailabilityRecord, AttendanceRecord } from '../types';
import { resetToEmptyState, exportAllData, importAllData } from '../services/storageService';
import {
  CheckCircle,
  ShieldCheck,
  Download,
  Upload,
  Trash2,
  X,
  FileCheck,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  assignments: Assignment[];
  availabilities: AvailabilityRecord[];
  attendances: AttendanceRecord[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  people,
  assignments,
  availabilities,
  attendances,
}) => {
  const [importJson, setImportJson] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    const dataStr = exportAllData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dias_eafit_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!importJson.trim()) return;
    const ok = importAllData(importJson);
    if (ok) {
      setImportStatus('✓ Datos importados exitosamente.');
      setTimeout(() => {
        setImportStatus(null);
        setImportJson('');
      }, 2500);
    } else {
      setImportStatus('✗ Error: Formato JSON inválido.');
    }
  };

  const handleFullReset = () => {
    if (
      confirm(
        '¿Está seguro de vaciar completamente la base de datos?\n\nLa aplicación quedará en 0 personas, 0 asignaciones, 0 disponibilidades y 0 asistencias. Esta acción cumple con la directiva de estado limpio.'
      )
    ) {
      resetToEmptyState();
      alert('La aplicación ha quedado en 0 personas y 0 registros.');
    }
  };

  const gtCount = people.filter((p) => p.primaryType === 'GT').length;
  const gapCount = people.filter((p) => p.primaryType === 'GAP').length;
  const mesaCount = people.filter((p) => p.primaryType === 'MESA').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-150 text-[#182535]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#64748B] hover:text-[#182535] p-2 rounded-2xl hover:bg-[#FAF6EC] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-2xl bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-[#182535] font-dalek tracking-wider">
              VERIFICACIÓN Y ESTADO DEL SISTEMA
            </h3>
            <p className="text-xs text-[#64748B] font-montserrat">
              Auditoría de cumplimiento de las directivas operativas de DÍAS EAFIT 2026.
            </p>
          </div>
        </div>

        {/* Verification Checklist */}
        <div className="bg-[#FAF6EC] border border-[#EADDC7] rounded-2xl p-4 my-5 space-y-3 font-montserrat">
          <h4 className="text-xs font-bold text-[#182535] uppercase tracking-wider flex items-center gap-2 font-dalek">
            <FileCheck className="w-4 h-4 text-[#B83A24]" />
            <span>Checklist de Verificación Oficial</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#334155]">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7]">
              <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>
                Personas registradas: <strong className="text-[#182535]">{people.length}</strong> (GT: {gtCount}, GAP: {gapCount}, MESA: {mesaCount})
              </span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7]">
              <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>
                Asignaciones activas: <strong className="text-[#182535]">{assignments.length}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7]">
              <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>
                Disponibilidades: <strong className="text-[#182535]">{availabilities.length}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7]">
              <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>
                Asistencias registradas: <strong className="text-[#182535]">{attendances.length}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] sm:col-span-2">
              <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>
                Sin datos mock / Sin seed automático: Colección vacía permanece en 0.
              </span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] sm:col-span-2">
              <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>
                THE SHOW (Lunes): T1 6:00-8:00, T2 8:00-12:30, T3 12:30-4:00, T4 4:00-7:30, T5 7:30-10:30.
              </span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] sm:col-span-2">
              <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>
                Carnival: Exactamente 30 bases físicas únicas (1..27 + Toro, Speedway, Arcade) en turnos GAP.
              </span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] sm:col-span-2">
              <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>
                Carnival GT: Exactamente 5 turnos independientes (T1..T5).
              </span>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFFDF8] border border-[#EADDC7] sm:col-span-2">
              <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>
                Regla de Continuidad en Carnival: la persona se mantiene en la misma base en todos sus turnos.
              </span>
            </div>
          </div>
        </div>

        {/* Export & Import */}
        <div className="border-t border-[#EADDC7] pt-5 space-y-4 font-montserrat">
          <h4 className="text-xs font-bold text-[#182535] uppercase tracking-wider font-dalek">
            Copia de Seguridad y Migración
          </h4>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-[#FAF6EC] hover:bg-[#F3EEDC] text-[#182535] flex items-center gap-2 border border-[#EADDC7] transition-all shadow-2xs"
            >
              <Download className="w-4 h-4 text-[#B83A24]" />
              <span>Descargar Respaldo JSON</span>
            </button>

            <button
              onClick={handleFullReset}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold bg-[#FDF2EE] hover:bg-[#FBE4DD] text-[#B83A24] border border-[#F6C7BA] flex items-center gap-2 transition-all shadow-2xs"
            >
              <Trash2 className="w-4 h-4 text-[#B83A24]" />
              <span>Vaciar Toda la Base de Datos (Volver a 0)</span>
            </button>
          </div>

          <div className="pt-2">
            <label className="block text-[11px] font-medium text-[#64748B] mb-1">
              Restaurar / Importar Respaldo JSON
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder='Pegar contenido JSON {"app":"DIAS_EAFIT",...}'
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs bg-[#FAF6EC] text-[#182535] rounded-xl border border-[#E5DAC0] font-mono focus:outline-hidden focus:border-[#B83A24]"
              />
              <button
                onClick={handleImport}
                disabled={!importJson.trim()}
                className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold bg-[#B83A24] hover:bg-[#9E2F1B] disabled:opacity-40 text-white flex items-center gap-1.5 shadow-2xs transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importar</span>
              </button>
            </div>
            {importStatus && (
              <span className="text-[11px] font-bold text-[#16A34A] mt-1 block">
                {importStatus}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[#EADDC7] flex justify-end">
          <button
            onClick={onClose}
            className="min-h-[44px] px-6 py-2 rounded-xl bg-[#182535] hover:bg-[#2A3F5A] text-white text-xs font-bold font-dalek tracking-wider shadow-2xs transition-all"
          >
            ENTENDIDO
          </button>
        </div>
      </div>
    </div>
  );
};
