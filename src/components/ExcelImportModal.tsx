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
import { api } from '../services/leagueApi';
import { birthdays } from '../services/birthdayService';
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
  const [birthdayResult, setBirthdayResult] = useState<{ saved: number; error?: string } | null>(null);
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
    setBirthdayResult(null);

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

      // Fechas de nacimiento: se guardan aparte (privadas) DESPUÉS de subir a las
      // personas, porque el servidor solo las acepta para integrantes que ya existen.
      if (result.birthDates.length > 0) {
        try {
          const r = await api.setBirthDates(result.birthDates);
          setBirthdayResult({ saved: r.saved });
          void birthdays.refresh(getPeople());
        } catch (bErr: any) {
          setBirthdayResult({
            saved: 0,
            error: bErr?.message || 'No se pudieron guardar las fechas de nacimiento.',
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
    setBirthdayResult(null);
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
      const matchUser = row.username ? row.username.toLowerCase().includes(q) : false;
      const matchEpik = row.epikId.toLowerCase().includes(q);
      const matchEmail = row.email.toLowerCase().includes(q);
      const matchGt = row.gt.toLowerCase().includes(q);
      return matchName || matchDoc || matchUser || matchEpik || matchEmail || matchGt;
    }

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-surface border-2 border-tinta-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-tinta-200 bg-tinta-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-lila-600 text-white flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-tinta-900 font-display tracking-wider">
                  IMPORTADOR EXCEL MAESTRO — DÍAS EAFIT 2027
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-lila-50 text-lila-600 border border-lila-200 text-[10px] font-bold">
                  17 Columnas Oficiales
                </span>
              </div>
              <p className="text-xs text-tinta-500">
                Importa <b>Personas</b>, su <b>GT</b> y mapea automáticamente su{' '}
                <b>Disponibilidad</b> a los turnos oficiales de Supabase.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadOfficialExcelMaestroTemplate(configuredShifts)}
              className="px-3 py-1.5 rounded-xl border border-tinta-200 bg-white hover:bg-tinta-50 text-tinta-900 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Descargar la plantilla oficial con las 17 columnas y turnos del sistema"
            >
              <Download className="w-3.5 h-3.5 text-lila-600" />
              <span className="hidden sm:inline">Descargar Plantilla Oficial</span>
              <span className="sm:hidden">Plantilla</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-tinta-500 hover:text-tinta-900 hover:bg-tinta-200/40 transition-colors"
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
                <h4 className="text-2xl font-bold text-tinta-900 font-display tracking-wider">
                  ¡IMPORTACIÓN COMPLETADA CON ÉXITO!
                </h4>
                <p className="text-xs text-tinta-500">
                  Los datos del Excel Maestro han sido procesados y sincronizados con el almacén
                  oficial.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-surface border border-tinta-200 text-center shadow-2xs">
                  <div className="text-2xl font-black text-emerald-600 font-mono">
                    {importResult.addedPeople}
                  </div>
                  <div className="text-[11px] font-bold text-tinta-500 uppercase mt-1">
                    Personas Nuevas
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-surface border border-tinta-200 text-center shadow-2xs">
                  <div className="text-2xl font-black text-blue-600 font-mono">
                    {importResult.updatedPeople}
                  </div>
                  <div className="text-[11px] font-bold text-tinta-500 uppercase mt-1">
                    Actualizadas
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-surface border border-tinta-200 text-center shadow-2xs">
                  <div className="text-2xl font-black text-lila-600 font-mono">
                    {importResult.totalAvailabilitiesAdded}
                  </div>
                  <div className="text-[11px] font-bold text-tinta-500 uppercase mt-1">
                    Disponibilidades
                  </div>
                </div>
              </div>

              {birthdayResult && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs text-left flex items-start gap-2 ${
                    birthdayResult.error
                      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : 'bg-coral-50 border-coral-200 text-tinta-900'
                  }`}
                >
                  <span className="text-base leading-none">🎂</span>
                  <span>
                    {birthdayResult.error ? (
                      <>
                        <b>Las fechas de nacimiento no se guardaron:</b> {birthdayResult.error}
                      </>
                    ) : (
                      <>
                        <b>{birthdayResult.saved} fechas de nacimiento guardadas.</b> Los cumpleaños ya
                        aparecen en el calendario (solo los ve la administración).
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* CLOUD SUPABASE STATUS INDICATOR */}
              {isSupabaseConfigured() ? (
                <div
                  className={`p-4 rounded-2xl text-xs space-y-1.5 border ${
                    cloudSyncResult?.synced
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      : cloudSyncResult && !cloudSyncResult.synced
                      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : 'bg-tinta-50 border-tinta-200 text-tinta-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    <Cloud className={`w-4 h-4 ${cloudSyncResult?.synced ? 'text-emerald-600' : 'text-mostaza-600'}`} />
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

              <div className="p-4 rounded-2xl bg-tinta-50 border border-tinta-200 text-left text-xs text-tinta-500 space-y-2">
                <div className="flex items-center gap-2 text-tinta-900 font-bold">
                  <ShieldCheck className="w-4 h-4 text-lila-600" />
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
                  className="px-4 py-2.5 rounded-xl border border-tinta-200 bg-white hover:bg-tinta-50 text-tinta-900 text-xs font-bold"
                >
                  Importar otro archivo
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-lila-600 hover:bg-lila-700 text-white text-xs font-bold font-display tracking-wider shadow-md"
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
                <div className="p-4 rounded-2xl bg-tinta-50 border border-tinta-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-tinta-900">
                    <Clock className="w-4 h-4 text-lila-600" />
                    <span>Normalización de Horarios</span>
                  </div>
                  <p className="text-[11px] text-tinta-500 leading-relaxed">
                    Reconoce formatos como <b>&quot;4pm - 7:30pm&quot;</b>, <b>&quot;8:50 AM - 12:10 PM&quot;</b> y
                    múltiples rangos por celda (separados por punto y coma), vinculándolos con su{' '}
                    <b>turn_id</b> oficial.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-tinta-50 border border-tinta-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-tinta-900">
                    <ShieldCheck className="w-4 h-4 text-lila-600" />
                    <span>Detección de Duplicados</span>
                  </div>
                  <p className="text-[11px] text-tinta-500 leading-relaxed">
                    Compara <b>Cédula</b>, <b>Usuario</b>, <b>Correo institucional</b>, <b>EPIK ID</b> y Correo. Si
                    la persona ya existe, actualiza su información <b>sin eliminar</b> asignaciones ni
                    asistencias.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-tinta-50 border border-tinta-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-tinta-900">
                    <Calendar className="w-4 h-4 text-lila-600" />
                    <span>Excel = Personas + Disponibilidad</span>
                  </div>
                  <p className="text-[11px] text-tinta-500 leading-relaxed">
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
                className="border-2 border-dashed border-tinta-200 hover:border-lila-600 bg-surface hover:bg-tinta-50/50 rounded-3xl p-10 text-center cursor-pointer transition-all space-y-4 group shadow-2xs"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-3xl bg-tinta-50 group-hover:bg-lila-50 border border-tinta-200 group-hover:border-lila-200 text-lila-600 flex items-center justify-center mx-auto transition-all shadow-xs">
                  {isLoading ? (
                    <RefreshCw className="w-7 h-7 animate-spin" />
                  ) : (
                    <UploadCloud className="w-7 h-7" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-bold text-tinta-900">
                    {isLoading
                      ? 'Analizando columnas y disponibilidad horaria...'
                      : 'Haga clic o arrastre el archivo Excel Maestro aquí'}
                  </div>
                  <p className="text-xs text-tinta-500">
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
                      className="px-2 py-0.5 rounded-md bg-tinta-50 border border-tinta-200 text-[10px] font-bold text-tinta-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Template Download Prompt */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-surface border border-tinta-200">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-lila-600" />
                  <div>
                    <div className="text-xs font-bold text-tinta-900">
                      ¿No tienes el formato oficial o deseas verificar los turnos configurados?
                    </div>
                    <div className="text-[11px] text-tinta-500">
                      Descarga la plantilla oficial con las 17 columnas y la hoja anexa con los turnos
                      activos en el sistema.
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => downloadOfficialExcelMaestroTemplate(configuredShifts)}
                  className="px-4 py-2 rounded-xl bg-tinta-900 hover:bg-tinta-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Plantilla</span>
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: PREVIEW SCREEN */
            <div className="space-y-6">
              {(() => {
                const withDate = preview.rows.filter((r) => r.isValid && r.birthDate).length;
                const badRows = preview.rows.filter((r) => r.warnings.some((w) => w.startsWith('Fecha de nacimiento')));
                if (withDate === 0 && badRows.length === 0) return null;
                return (
                  <div className="p-3.5 rounded-2xl bg-coral-50 border border-coral-200 text-xs text-tinta-900 flex items-start gap-2">
                    <span className="text-base leading-none">🎂</span>
                    <span>
                      <b>{withDate} fechas de nacimiento</b> se guardarán con las personas y sus cumpleaños
                      saldrán solos en el calendario.
                      {badRows.length > 0 && (
                        <>
                          {' '}
                          No se entendió la fecha de {badRows.length}:{' '}
                          {badRows.map((r) => `${r.name || 'Fila ' + r.rowNumber} (fila ${r.rowNumber})`).join(', ')}.
                          Esas se omiten; usa día/mes/año, por ejemplo 06/11/2003.
                        </>
                      )}
                    </span>
                  </div>
                );
              })()}

              {/* TOP METRICS CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Total Rows */}
                <div className="p-3.5 rounded-2xl bg-tinta-50 border border-tinta-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-tinta-500">Total Filas</div>
                  <div className="text-xl font-black text-tinta-900 font-mono">
                    {preview.totalRows}
                  </div>
                  <div className="text-[10px] text-tinta-500">Registros leídos</div>
                </div>

                {/* 2. New Persons */}
                <div className="p-3.5 rounded-2xl bg-turquesa-50 border border-turquesa-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-turquesa-600">Personas Nuevas</div>
                  <div className="text-xl font-black text-turquesa-600 font-mono">
                    {preview.newPersonsCount}
                  </div>
                  <div className="text-[10px] text-turquesa-600">Se crearán en BD</div>
                </div>

                {/* 3. Existing Persons */}
                <div className="p-3.5 rounded-2xl bg-turquesa-50 border border-turquesa-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-turquesa-700">Existentes</div>
                  <div className="text-xl font-black text-turquesa-700 font-mono">
                    {preview.existingPersonsCount}
                  </div>
                  <div className="text-[10px] text-turquesa-700">Se actualizarán</div>
                </div>

                {/* 4. Duplicates / Matches */}
                <div className="p-3.5 rounded-2xl bg-mostaza-50 border border-mostaza-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-mostaza-500">Coincidencias</div>
                  <div className="text-xl font-black text-mostaza-500 font-mono">
                    {preview.duplicateAlertsCount}
                  </div>
                  <div className="text-[10px] text-mostaza-500">Por Cédula / EPIK</div>
                </div>

                {/* 5. Recognized Schedules */}
                <div className="p-3.5 rounded-2xl bg-lila-50 border border-lila-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-lila-600">Horarios Válidos</div>
                  <div className="text-xl font-black text-lila-600 font-mono">
                    {preview.recognizedAvailabilitiesCount}
                  </div>
                  <div className="text-[10px] text-lila-600">Mapeados a turn_id</div>
                </div>

                {/* 6. Unrecognized Schedules */}
                <div
                  className={`p-3.5 rounded-2xl border space-y-1 ${
                    preview.unrecognizedSchedulesCount > 0
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-tinta-50 border-tinta-200'
                  }`}
                >
                  <div
                    className={`text-[10px] font-bold uppercase ${
                      preview.unrecognizedSchedulesCount > 0 ? 'text-rose-600' : 'text-tinta-500'
                    }`}
                  >
                    No Reconocidos
                  </div>
                  <div
                    className={`text-xl font-black font-mono ${
                      preview.unrecognizedSchedulesCount > 0 ? 'text-rose-600' : 'text-tinta-500'
                    }`}
                  >
                    {preview.unrecognizedSchedulesCount}
                  </div>
                  <div
                    className={`text-[10px] ${
                      preview.unrecognizedSchedulesCount > 0 ? 'text-rose-600' : 'text-tinta-500'
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
                            <span className="font-bold text-tinta-900">{item.personName}</span>{' '}
                            <span className="text-tinta-500">(Fila {item.rowNumber})</span>
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
              <div className="p-4 rounded-2xl bg-tinta-50 border border-tinta-200 space-y-3">
                <div className="text-xs font-bold text-tinta-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-lila-600" />
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
                        className="p-2.5 rounded-xl bg-white border border-tinta-200 text-center space-y-1"
                      >
                        <div className="text-[11px] font-bold text-tinta-900 truncate">
                          {def.dayName}
                        </div>
                        <div className="text-[10px] text-tinta-500 truncate">{def.eventName}</div>
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
                <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-xl bg-tinta-50 border border-tinta-200">
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
                          ? 'bg-lila-600 text-white shadow-2xs'
                          : 'text-tinta-500 hover:text-tinta-900'
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
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-tinta-200 text-xs text-tinta-900 placeholder-tinta-400 focus:outline-hidden focus:border-lila-600"
                  />
                  <Search className="w-3.5 h-3.5 text-tinta-400 absolute left-2.5 top-3" />
                  {tableSearch && (
                    <button
                      onClick={() => setTableSearch('')}
                      className="absolute right-2.5 top-2.5 text-tinta-400 hover:text-tinta-900"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* PREVIEW TABLE */}
              <div className="border border-tinta-200 rounded-2xl overflow-hidden bg-white shadow-2xs max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-tinta-50 text-tinta-500 text-[10px] font-bold uppercase sticky top-0 border-b border-tinta-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Fila</th>
                      <th className="py-2.5 px-3">Persona</th>
                      <th className="py-2.5 px-3">Documento / Usuario</th>
                      <th className="py-2.5 px-3">TIPO</th>
<th className="py-2.5 px-3">GT</th>
                      <th className="py-2.5 px-3">Disponibilidad Reconocida</th>
                      <th className="py-2.5 px-3">Estado</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-tinta-200/60">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-xs text-tinta-400">
                          No se encontraron registros con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => {
                        return (
                          <tr
                            key={row.rowNumber}
                            className={`hover:bg-tinta-50/40 transition-colors ${
                              !row.isValid
                                ? 'bg-rose-50/50'
                                : row.isExistingPerson
                                ? 'bg-blue-50/20'
                                : ''
                            }`}
                          >
                            {/* Row Number */}
                            <td className="py-2.5 px-3 font-mono text-[11px] text-tinta-500">
                              #{row.rowNumber}
                            </td>

                            {/* Person Info */}
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-tinta-900">{row.name}</div>
                              <div className="text-[10px] text-tinta-500 truncate max-w-[180px]">
                                {row.institutionalEmail || row.email}
                              </div>
                              {((row.foodAllergies &&
                                !['ninguna', 'no', 'ninguno', 'n/a', ''].includes(
                                  row.foodAllergies.trim().toLowerCase()
                                )) ||
                                (row.dietaryRestrictions &&
                                  !['ninguna', 'no', 'ninguno', 'n/a', ''].includes(
                                    row.dietaryRestrictions.trim().toLowerCase()
                                  )) ||
                                (row.medicalConditions &&
                                  !['ninguna', 'no', 'ninguno', 'n/a', ''].includes(
                                    row.medicalConditions.trim().toLowerCase()
                                  ))) && (
                                <div className="flex items-center gap-1 flex-wrap mt-1">
                                  {row.foodAllergies &&
                                    !['ninguna', 'no', 'ninguno', 'n/a', ''].includes(
                                      row.foodAllergies.trim().toLowerCase()
                                    ) && (
                                      <span className="text-[9px] px-1 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-semibold">
                                        Alergia: {row.foodAllergies}
                                      </span>
                                    )}
                                  {row.dietaryRestrictions &&
                                    !['ninguna', 'no', 'ninguno', 'n/a', ''].includes(
                                      row.dietaryRestrictions.trim().toLowerCase()
                                    ) && (
                                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-semibold">
                                        Dieta: {row.dietaryRestrictions}
                                      </span>
                                    )}
                                  {row.medicalConditions &&
                                    !['ninguna', 'no', 'ninguno', 'n/a', ''].includes(
                                      row.medicalConditions.trim().toLowerCase()
                                    ) && (
                                      <span className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-semibold">
                                        Condición: {row.medicalConditions}
                                      </span>
                                    )}
                                </div>
                              )}
                            </td>

                            {/* Document & Username */}
                            <td className="py-2.5 px-3 font-mono">
                              <div className="font-bold text-tinta-900">{row.documentId}</div>
                              <div className="text-[10px] text-lila-600 font-semibold flex items-center gap-1">
                                <span>@{row.username}</span>
                              </div>
                              {row.epikId && row.epikId.toLowerCase() !== row.username.toLowerCase() && (
                                <div className="text-[9px] text-tinta-500">EPIK: {row.epikId}</div>
                              )}
                            </td>

                            {/* GT / Primary Type */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    row.primaryType === 'GT'
                                      ? 'bg-lila-50 text-lila-600 border border-lila-200'
                                      : row.primaryType === 'GAP'
                                      ? 'bg-mostaza-50 text-mostaza-600 border border-mostaza-200'
                                      : 'bg-purple-50 text-purple-700 border border-purple-200'
                                  }`}
                                >
                                  {row.primaryType === 'GT'
                                    ? `GT → ${row.gtTeams.join(', ') || 'Logística'}`
                                    : row.primaryType}
                                </span>
                                {row.primaryType === 'GT' && row.alsoActsAsGap && (
                                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-mostaza-50 text-mostaza-600 border border-mostaza-200">
                                    + GAP Generales
                                  </span>
                                )}
                              </div>
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
                                    <span className="text-[11px] text-tinta-400 italic">
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
              <div className="p-4 rounded-2xl bg-tinta-50 border border-tinta-200 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-tinta-900">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="w-4 h-4 rounded text-lila-600 focus:ring-lila-600"
                  />
                  <span>
                    Actualizar información de personas existentes que coincidan en el sistema
                  </span>
                </label>

                <div className="flex items-center gap-2 text-[11px] text-tinta-500">
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
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-tinta-200 bg-white hover:bg-tinta-50 text-tinta-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Cargar otro archivo</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold text-tinta-500 hover:bg-tinta-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isConfirming || preview.validRows === 0}
                    className="flex-1 sm:flex-initial px-6 py-2.5 rounded-2xl bg-lila-600 hover:bg-lila-700 text-white font-bold text-xs font-display tracking-wider shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
