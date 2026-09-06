import React, { useState, useRef } from 'react';
import { Person, ConfigurableShift } from '../types';
import {
  parseExcelMaestroFile,
  downloadOfficialExcelMaestroTemplate,
  ExcelMaestroPreview,
  ExcelMaestroParsedRow,
  EVENT_DAY_COLUMNS,
} from '../services/excelService';
import {
  getShifts,
  importExcelMaestroBatch,
  ExcelMaestroImportResult,
  getPeople,
  getAssignments,
  getAvailabilities,
} from '../services/storageService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { syncAllToSupabase } from '../services/supabaseSync';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Download,
  Check,
  RefreshCw,
  Users,
  Calendar,
  Clock,
  ArrowRight,
  HelpCircle,
  ShieldCheck,
  Search,
  Cloud,
} from 'lucide-react';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPeople: Person[];
  shifts?: ConfigurableShift[];
  onImportComplete?: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  existingPeople,
  shifts: propShifts,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<ExcelMaestroPreview | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importResult, setImportResult] = useState<ExcelMaestroImportResult | null>(null);
  const [cloudSyncResult, setCloudSyncResult] = useState<{ synced: boolean; message: string } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'NEW' | 'EXISTING' | 'ERROR' | 'UNRECOGNIZED'>('ALL');
  const [tableSearch, setTableSearch] = useState('');
  const [showUnrecognizedDetails, setShowUnrecognizedDetails] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Active shifts: either from props or directly from storage service
  const configuredShifts = propShifts || getShifts();

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsLoading(true);
    setImportResult(null);
    setCloudSyncResult(null);

    try {
      const parsedPreview = await parseExcelMaestroFile(
        selectedFile,
        existingPeople,
        configuredShifts
      );
      setPreview(parsedPreview);
    } catch (err) {
      console.error('Error parsing excel file:', err);
      alert(
        'Error al procesar el archivo Excel. Asegúrate de que sea un archivo .xlsx, .xls o .csv válido.'
      );
      setFile(null);
      setPreview(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;

    setIsConfirming(true);
    try {
      const result = await importExcelMaestroBatch(preview.rows, { updateExisting });
      setImportResult(result);

      // Auto-synchronize to Supabase if configured
      if (isSupabaseConfigured()) {
        try {
          const syncRes = await syncAllToSupabase(getPeople(), getAssignments(), getAvailabilities());
          setCloudSyncResult({
            synced: syncRes.success,
            message: syncRes.message,
          });
        } catch (syncErr: any) {
          setCloudSyncResult({
            synced: false,
            message: syncErr?.message || 'Error al conectar con la base de datos de Supabase',
          });
        }
      }

      if (onImportComplete) onImportComplete();
    } catch (err) {
      console.error('Error importing excel maestro batch:', err);
      alert('Hubo un error al guardar las personas y disponibilidades.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setCloudSyncResult(null);
    setFilterTab('ALL');
    setTableSearch('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filter rows for preview table
  const filteredRows = (preview?.rows || []).filter((row) => {
    // Tab filter
    if (filterTab === 'NEW' && (!row.isValid || row.isExistingPerson)) return false;
    if (filterTab === 'EXISTING' && (!row.isValid || !row.isExistingPerson)) return false;
    if (filterTab === 'ERROR' && row.isValid) return false;
    if (filterTab === 'UNRECOGNIZED' && row.unrecognizedInRow.length === 0) return false;

    // Search filter
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      const matchName = row.name.toLowerCase().includes(q);
      const matchDoc = row.documentId.toLowerCase().includes(q);
      const matchEpik = row.epikId.toLowerCase().includes(q);
      const matchEmail = row.email.toLowerCase().includes(q);
      const matchGt = row.gt.toLowerCase().includes(q);
      return matchName || matchDoc || matchEpik || matchEmail || matchGt;
    }

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-[#FFFDF8] border-2 border-[#EADDC7] rounded-3xl shadow-2xl flex flex-col overflow-hidden font-montserrat">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-[#EADDC7] bg-[#FAF6EC] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#B83A24] text-white flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#182535] font-dalek tracking-wider">
                  IMPORTADOR EXCEL MAESTRO — DÍAS EAFIT 2026
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA] text-[10px] font-bold">
                  17 Columnas Oficiales
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Importa <b>Personas</b>, su <b>GT</b> y mapea automáticamente su{' '}
                <b>Disponibilidad</b> a los turnos oficiales de Supabase.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadOfficialExcelMaestroTemplate(configuredShifts)}
              className="px-3 py-1.5 rounded-xl border border-[#EADDC7] bg-white hover:bg-[#FAF6EC] text-[#182535] text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Descargar la plantilla oficial con las 17 columnas y turnos del sistema"
            >
              <Download className="w-3.5 h-3.5 text-[#B83A24]" />
              <span className="hidden sm:inline">Descargar Plantilla Oficial</span>
              <span className="sm:hidden">Plantilla</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#64748B] hover:text-[#182535] hover:bg-[#EADDC7]/40 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SUCCESS SCREEN */}
          {importResult ? (
            <div className="p-8 text-center space-y-6 max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto shadow-md animate-bounce">
                <Check className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <h4 className="text-2xl font-bold text-[#182535] font-dalek tracking-wider">
                  ¡IMPORTACIÓN COMPLETADA CON ÉXITO!
                </h4>
                <p className="text-xs text-[#64748B]">
                  Los datos del Excel Maestro han sido procesados y sincronizados con el almacén
                  oficial.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#EADDC7] text-center shadow-2xs">
                  <div className="text-2xl font-black text-emerald-600 font-mono">
                    {importResult.addedPeople}
                  </div>
                  <div className="text-[11px] font-bold text-[#64748B] uppercase mt-1">
                    Personas Nuevas
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#EADDC7] text-center shadow-2xs">
                  <div className="text-2xl font-black text-blue-600 font-mono">
                    {importResult.updatedPeople}
                  </div>
                  <div className="text-[11px] font-bold text-[#64748B] uppercase mt-1">
                    Actualizadas
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#EADDC7] text-center shadow-2xs">
                  <div className="text-2xl font-black text-[#B83A24] font-mono">
                    {importResult.totalAvailabilitiesAdded}
                  </div>
                  <div className="text-[11px] font-bold text-[#64748B] uppercase mt-1">
                    Disponibilidades
                  </div>
                </div>
              </div>

              {/* CLOUD SUPABASE STATUS INDICATOR */}
              {isSupabaseConfigured() ? (
                <div
                  className={`p-4 rounded-2xl text-xs space-y-1.5 border ${
                    cloudSyncResult?.synced
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      : cloudSyncResult && !cloudSyncResult.synced
                      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : 'bg-[#FAF6EC] border-[#EADDC7] text-[#182535]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    <Cloud className={`w-4 h-4 ${cloudSyncResult?.synced ? 'text-emerald-600' : 'text-[#C87F17]'}`} />
                    <span>Sincronización con Supabase (Nube PostgreSQL):</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {cloudSyncResult
                      ? cloudSyncResult.message
                      : 'Sincronizando automáticamente con la base de datos de Supabase en segundo plano...'}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <b>Nota:</b> Los datos se guardaron localmente en este navegador. Para compartirlos en tiempo real con los teléfonos del Staff mediante Supabase, configure las credenciales en el proyecto.
                  </span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] text-left text-xs text-[#64748B] space-y-2">
                <div className="flex items-center gap-2 text-[#182535] font-bold">
                  <ShieldCheck className="w-4 h-4 text-[#B83A24]" />
                  <span>Principio de Integridad Aplicado:</span>
                </div>
                <p>
                  • <b>El Excel NO creó asignaciones:</b> La disponibilidad horaria ya está
                  registrada para cada persona. Para asignarlos a bases y funciones específicas, usa
                  el <b>Módulo de Asignaciones</b>.
                </p>
                <p>
                  • <b>Datos Históricos Protegidos:</b> No se eliminaron asignaciones anteriores,
                  registros de asistencia ni alimentación de personas existentes.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl border border-[#EADDC7] bg-white hover:bg-[#FAF6EC] text-[#182535] text-xs font-bold"
                >
                  Importar otro archivo
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white text-xs font-bold font-dalek tracking-wider shadow-md"
                >
                  CERRAR Y CONTINUAR
                </button>
              </div>
            </div>
          ) : !preview ? (
            /* STEP 1: UPLOAD AREA */
            <div className="space-y-6">
              {/* Information Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#182535]">
                    <Clock className="w-4 h-4 text-[#B83A24]" />
                    <span>Normalización de Horarios</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    Reconoce formatos como <b>&quot;4pm - 7:30pm&quot;</b>, <b>&quot;8:50 AM - 12:10 PM&quot;</b> y
                    múltiples rangos por celda (separados por punto y coma), vinculándolos con su{' '}
                    <b>turn_id</b> oficial.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#182535]">
                    <ShieldCheck className="w-4 h-4 text-[#B83A24]" />
                    <span>Detección de Duplicados</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    Compara <b>Cédula</b>, <b>Correo institucional</b>, <b>EPIK ID</b> y Correo. Si
                    la persona ya existe, actualiza su información <b>sin eliminar</b> asignaciones ni
                    asistencias.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#182535]">
                    <Calendar className="w-4 h-4 text-[#B83A24]" />
                    <span>Excel = Personas + Disponibilidad</span>
                  </div>
                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    1 fila = 1 persona. El Excel <b>NO genera asignaciones de turno</b>; solamente
                    alimenta el catálogo de personal y sus franjas disponibles para asignación.
                  </p>
                </div>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#EADDC7] hover:border-[#B83A24] bg-[#FFFDF8] hover:bg-[#FAF6EC]/50 rounded-3xl p-10 text-center cursor-pointer transition-all space-y-4 group shadow-2xs"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-3xl bg-[#FAF6EC] group-hover:bg-[#FDF2EE] border border-[#EADDC7] group-hover:border-[#F6C7BA] text-[#B83A24] flex items-center justify-center mx-auto transition-all shadow-xs">
                  {isLoading ? (
                    <RefreshCw className="w-7 h-7 animate-spin" />
                  ) : (
                    <UploadCloud className="w-7 h-7" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold text-[#182535]">
                    {isLoading
                      ? 'Analizando columnas y disponibilidad horaria...'
                      : 'Haga clic o arrastre el archivo Excel Maestro aquí'}
                  </div>
                  <p className="text-xs text-[#64748B]">
                    Formatos soportados: <b>.XLSX, .XLS o .CSV</b> (Estructura oficial DÍAS EAFIT)
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-xl mx-auto pt-2">
                  {[
                    'ID',
                    'Hora inicio/fin',
                    'Nombre',
                    'Cédula',
                    'Correo institucional',
                    'ID EPIK',
                    'GT',
                    'Camiseta',
                    'THE SHOW',
                    'THE ZONE',
                    'CARNIVAL',
                    'THE CHALLENGE/GAMES',
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-[#FAF6EC] border border-[#EADDC7] text-[10px] font-bold text-[#64748B]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Template Download Prompt */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#FFFDF8] border border-[#EADDC7]">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-[#B83A24]" />
                  <div>
                    <div className="text-xs font-bold text-[#182535]">
                      ¿No tienes el formato oficial o deseas verificar los turnos configurados?
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      Descarga la plantilla oficial con las 17 columnas y la hoja anexa con los turnos
                      activos en el sistema.
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => downloadOfficialExcelMaestroTemplate(configuredShifts)}
                  className="px-4 py-2 rounded-xl bg-[#182535] hover:bg-[#2A3F55] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla</span>
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: PREVIEW SCREEN */
            <div className="space-y-6">
              {/* TOP METRICS CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Total Rows */}
                <div className="p-3.5 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] space-y-1">
                  <div className="text-[10px] font-bold uppercase text-[#64748B]">Total Filas</div>
                  <div className="text-xl font-black text-[#182535] font-mono">
                    {preview.totalRows}
                  </div>
                  <div className="text-[10px] text-[#64748B]">Registros leídos</div>
                </div>

                {/* 2. New Persons */}
                <div className="p-3.5 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] space-y-1">
                  <div className="text-[10px] font-bold uppercase text-[#16A34A]">Personas Nuevas</div>
                  <div className="text-xl font-black text-[#16A34A] font-mono">
                    {preview.newPersonsCount}
                  </div>
                  <div className="text-[10px] text-[#16A34A]">Se crearán en BD</div>
                </div>

                {/* 3. Existing Persons */}
                <div className="p-3.5 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] space-y-1">
                  <div className="text-[10px] font-bold uppercase text-[#2563EB]">Existentes</div>
                  <div className="text-xl font-black text-[#2563EB] font-mono">
                    {preview.existingPersonsCount}
                  </div>
                  <div className="text-[10px] text-[#2563EB]">Se actualizarán</div>
                </div>

                {/* 4. Duplicates / Matches */}
                <div className="p-3.5 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] space-y-1">
                  <div className="text-[10px] font-bold uppercase text-[#D97706]">Coincidencias</div>
                  <div className="text-xl font-black text-[#D97706] font-mono">
                    {preview.duplicateAlertsCount}
                  </div>
                  <div className="text-[10px] text-[#D97706]">Por Cédula / EPIK</div>
                </div>

                {/* 5. Recognized Schedules */}
                <div className="p-3.5 rounded-2xl bg-[#FDF2EE] border border-[#F6C7BA] space-y-1">
                  <div className="text-[10px] font-bold uppercase text-[#B83A24]">Horarios Válidos</div>
                  <div className="text-xl font-black text-[#B83A24] font-mono">
                    {preview.recognizedAvailabilitiesCount}
                  </div>
                  <div className="text-[10px] text-[#B83A24]">Mapeados a turn_id</div>
                </div>

                {/* 6. Unrecognized Schedules */}
                <div
                  className={`p-3.5 rounded-2xl border space-y-1 ${
                    preview.unrecognizedSchedulesCount > 0
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-[#FAF6EC] border-[#EADDC7]'
                  }`}
                >
                  <div
                    className={`text-[10px] font-bold uppercase ${
                      preview.unrecognizedSchedulesCount > 0 ? 'text-rose-600' : 'text-[#64748B]'
                    }`}
                  >
                    No Reconocidos
                  </div>
                  <div
                    className={`text-xl font-black font-mono ${
                      preview.unrecognizedSchedulesCount > 0 ? 'text-rose-600' : 'text-[#64748B]'
                    }`}
                  >
                    {preview.unrecognizedSchedulesCount}
                  </div>
                  <div
                    className={`text-[10px] ${
                      preview.unrecognizedSchedulesCount > 0 ? 'text-rose-600' : 'text-[#64748B]'
                    }`}
                  >
                    {preview.unrecognizedSchedulesCount > 0 ? 'Requiere revisión' : 'Sin alertas'}
                  </div>
                </div>
              </div>

              {/* UNRECOGNIZED SCHEDULES BANNER (RULE 28) */}
              {preview.unrecognizedSchedulesCount > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <span>
                        HORARIOS NO ENCONTRADOS ({preview.unrecognizedSchedulesCount}) — No
                        coinciden con la configuración de turnos
                      </span>
                    </div>

                    <button
                      onClick={() => setShowUnrecognizedDetails(!showUnrecognizedDetails)}
                      className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                    >
                      {showUnrecognizedDetails ? 'Ocultar detalles' : 'Ver horarios y personas'}
                    </button>
                  </div>

                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    El sistema <b>NO inventa turnos automáticamente</b>. Si una persona tiene un
                    horario que no existe en Supabase (ejemplo:{' '}
                    <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950">
                      &quot;4:30 PM - 7:00 PM&quot;
                    </code>
                    ), se reporta a continuación. Puedes crear previamente el turno en{' '}
                    <b>Configuración de Turnos</b> o corregir la celda en el Excel.
                  </p>

                  {showUnrecognizedDetails && (
                    <div className="mt-2 max-h-48 overflow-y-auto border border-amber-200 rounded-xl bg-white p-2 divide-y divide-amber-100">
                      {preview.unrecognizedDetails.map((item, idx) => (
                        <div
                          key={idx}
                          className="py-1.5 px-2 text-xs flex items-center justify-between gap-3"
                        >
                          <div>
                            <span className="font-bold text-[#182535]">{item.personName}</span>{' '}
                            <span className="text-[#64748B]">(Fila {item.rowNumber})</span>
                            <div className="text-[11px] text-amber-800">
                              <b>{item.eventName} ({item.dayName}):</b> Texto original:{' '}
                              <code className="bg-amber-50 px-1 rounded">&quot;{item.rawText}&quot;</code>
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-700 font-mono text-[10px] font-bold shrink-0">
                            {item.normalizedRange || 'Sin turno coincidente'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SUMMARY BY DAY */}
              <div className="p-4 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] space-y-3">
                <div className="text-xs font-bold text-[#182535] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#B83A24]" />
                  <span>Resumen de Disponibilidad Reconocida por Evento</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {EVENT_DAY_COLUMNS.map((def) => {
                    const stats = preview.summaryByDay[def.dayId] || {
                      recognizedCount: 0,
                      unrecognizedCount: 0,
                    };
                    return (
                      <div
                        key={def.dayId}
                        className="p-2.5 rounded-xl bg-white border border-[#EADDC7] text-center space-y-1"
                      >
                        <div className="text-[11px] font-bold text-[#182535] truncate">
                          {def.dayName}
                        </div>
                        <div className="text-[10px] text-[#64748B] truncate">{def.eventName}</div>
                        <div className="flex items-center justify-center gap-2 pt-1 font-mono text-xs">
                          <span
                            className="text-emerald-600 font-bold"
                            title="Turnos válidos mapeados"
                          >
                            ✓ {stats.recognizedCount}
                          </span>
                          {stats.unrecognizedCount > 0 && (
                            <span
                              className="text-rose-500 font-bold"
                              title="Horarios no reconocidos"
                            >
                              ⚠ {stats.unrecognizedCount}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* TABLE FILTER TABS & SEARCH */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-xl bg-[#FAF6EC] border border-[#EADDC7]">
                  {[
                    { id: 'ALL', label: `Todos (${preview.totalRows})` },
                    { id: 'NEW', label: `Nuevos (${preview.newPersonsCount})` },
                    { id: 'EXISTING', label: `Existentes (${preview.existingPersonsCount})` },
                    {
                      id: 'UNRECOGNIZED',
                      label: `Con Alertas (${preview.unrecognizedSchedulesCount})`,
                    },
                    { id: 'ERROR', label: `Errores (${preview.errorRows})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterTab(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        filterTab === tab.id
                          ? 'bg-[#B83A24] text-white shadow-2xs'
                          : 'text-[#64748B] hover:text-[#182535]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Filtrar por nombre, cédula, GT..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-[#EADDC7] text-xs text-[#182535] placeholder-[#94A3B8] focus:outline-hidden focus:border-[#B83A24]"
                  />
                  <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-3" />
                  {tableSearch && (
                    <button
                      onClick={() => setTableSearch('')}
                      className="absolute right-2.5 top-2.5 text-[#94A3B8] hover:text-[#182535]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* PREVIEW TABLE */}
              <div className="border border-[#EADDC7] rounded-2xl overflow-hidden bg-white shadow-2xs max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#FAF6EC] text-[#64748B] text-[10px] font-bold uppercase sticky top-0 border-b border-[#EADDC7] z-10">
                    <tr>
                      <th className="py-2.5 px-3">Fila</th>
                      <th className="py-2.5 px-3">Persona</th>
                      <th className="py-2.5 px-3">Documento / EPIK</th>
                      <th className="py-2.5 px-3">GT / Tipo</th>
                      <th className="py-2.5 px-3">Disponibilidad Reconocida</th>
                      <th className="py-2.5 px-3">Estado</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#EADDC7]/60">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-[#94A3B8]">
                          No se encontraron registros con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => {
                        return (
                          <tr
                            key={row.rowNumber}
                            className={`hover:bg-[#FAF6EC]/40 transition-colors ${
                              !row.isValid
                                ? 'bg-rose-50/50'
                                : row.isExistingPerson
                                ? 'bg-blue-50/20'
                                : ''
                            }`}
                          >
                            {/* Row Number */}
                            <td className="py-2.5 px-3 font-mono text-[11px] text-[#64748B]">
                              #{row.rowNumber}
                            </td>

                            {/* Person Info */}
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-[#182535]">{row.name}</div>
                              <div className="text-[10px] text-[#64748B] truncate max-w-[180px]">
                                {row.institutionalEmail || row.email}
                              </div>
                            </td>

                            {/* Document & Epik */}
                            <td className="py-2.5 px-3 font-mono">
                              <div className="font-bold text-[#182535]">{row.documentId}</div>
                              {row.epikId && (
                                <div className="text-[10px] text-[#64748B]">{row.epikId}</div>
                              )}
                            </td>

                            {/* GT / Primary Type */}
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  row.primaryType === 'GT'
                                    ? 'bg-[#FDF2EE] text-[#B83A24] border border-[#F6C7BA]'
                                    : row.primaryType === 'GAP'
                                    ? 'bg-[#FEF8EC] text-[#C87F17] border border-[#FDE68A]'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}
                              >
                                {row.primaryType === 'GT'
                                  ? `GT → ${row.gtTeams.join(', ') || 'Logística'}`
                                  : row.primaryType}
                              </span>
                            </td>

                            {/* Availability Badges */}
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap gap-1 max-w-sm">
                                {(
                                  Object.entries(row.recognizedShiftsByDay) as [
                                    string,
                                    Array<{ shiftId: string; shiftName: string; timeLabel: string }>
                                  ][]
                                ).map(([dayId, matches]) => {
                                  if (!matches || matches.length === 0) return null;
                                  const dayName =
                                    EVENT_DAY_COLUMNS.find((d) => d.dayId === dayId)?.dayName ||
                                    dayId;

                                  return matches.map((m) => (
                                    <span
                                      key={m.shiftId}
                                      className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold font-mono"
                                      title={`${dayName}: ${m.timeLabel}`}
                                    >
                                      {dayName.slice(0, 3)}: {m.shiftName}
                                    </span>
                                  ));
                                })}

                                {row.unrecognizedInRow.length > 0 && (
                                  <span
                                    className="px-1.5 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-700 text-[10px] font-bold"
                                    title={row.unrecognizedInRow.map((u) => u.reason).join(' | ')}
                                  >
                                    ⚠ {row.unrecognizedInRow.length} no reconocido(s)
                                  </span>
                                )}

                                {(Object.values(row.recognizedShiftsByDay) as any[]).every(
                                  (arr) => !arr || arr.length === 0
                                ) &&
                                  row.unrecognizedInRow.length === 0 && (
                                    <span className="text-[11px] text-[#94A3B8] italic">
                                      Sin turnos registrados
                                    </span>
                                  )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3">
                              {!row.isValid ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
                                  Error: {row.errors[0]}
                                </span>
                              ) : row.isExistingPerson ? (
                                <span
                                  className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px]"
                                  title={row.duplicateReasons.join(' • ')}
                                >
                                  Existente (Se actualiza)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                                  Nueva Persona
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* INTEGRITY SAFEGUARDS & OPTIONS */}
              <div className="p-4 rounded-2xl bg-[#FAF6EC] border border-[#EADDC7] space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#182535]">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="w-4 h-4 rounded text-[#B83A24] focus:ring-[#B83A24]"
                  />
                  <span>
                    Actualizar información de personas existentes que coincidan en el sistema
                  </span>
                </label>

                <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <b>Garantía de No Destrucción:</b> Esta importación jamás eliminará asignaciones
                    anteriores, registros de asistencia previa ni alimentación histórica.
                  </span>
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#EADDC7] bg-white hover:bg-[#FAF6EC] text-[#182535] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Cargar otro archivo</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold text-[#64748B] hover:bg-[#FAF6EC]"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isConfirming || preview.validRows === 0}
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-2xl bg-[#B83A24] hover:bg-[#9E2F1B] text-white font-bold text-xs font-dalek tracking-wider shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isConfirming ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>PROCESANDO...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>
                          CONFIRMAR IMPORTACIÓN ({preview.validRows} PERSONAS)
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
