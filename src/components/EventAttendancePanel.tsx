import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCheck, FileText, Lock, QrCode as QrIcon, RotateCcw, Search, UserX } from 'lucide-react';
import { AttendanceState, ATTENDANCE_STATE_LABELS, CalendarEvent, ConectadosGtResult, ConectadosScoring, EventAttendance, LEAGUE_GTS, Person } from '../types';
import { calendarEvents, formatClock, formatDateLong, formatTime12, isPersonInAudience, personPrimaryGt } from '../services/calendarService';
import { computeConectadosResults, conectadosClosures, conectadosGts, eventAttendances, getDefaultScoring } from '../services/leagueService';
import { api } from '../services/leagueApi';
import { btnDanger, btnPrimary, btnSecondary, Card, EmptyState, EventTypeChip, Field, formatPoints, inputCls, Modal, useCollection } from './league/ui';
import { attempt, notify, useBusy } from './league/toast';
import { EventQrPanel } from './EventQrPanel';

const STATES: AttendanceState[] = ['pendiente', 'llego', 'llego_tarde', 'excusa', 'no_asistio', 'no_aplica'];
export const STATE_STYLE: Record<AttendanceState, string> = {
  pendiente: 'bg-tinta-100 text-tinta-700 border-tinta-200',
  llego: 'bg-turquesa-600 text-white border-turquesa-600',
  llego_tarde: 'bg-mostaza-300 text-negro border-mostaza-300',
  excusa: 'bg-lila-300 text-negro border-lila-300',
  no_asistio: 'bg-coral-500 text-white border-coral-500',
  no_aplica: 'bg-tinta-600 text-white border-tinta-600',
};

interface Props {
  people: Person[];
  author: string;
  focusEventId?: string | null;
  onFocusHandled?: () => void;
}

export const EventAttendancePanel: React.FC<Props> = ({ people, focusEventId, onFocusHandled }) => {
  const events = useCollection(calendarEvents.subscribe);
  const closures = useCollection(conectadosClosures.subscribe);
  const list = useMemo(
    () =>
      events
        .filter((e) => e.type === 'conectados' || e.attendanceEnabled)
        .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)),
    [events]
  );
  const [selectedId, setSelectedId] = useState<string | null>(focusEventId ?? null);

  useEffect(() => {
    if (focusEventId) {
      setSelectedId(focusEventId);
      onFocusHandled?.();
    }
  }, [focusEventId, onFocusHandled]);

  const selected = list.find((e) => e.id === selectedId);

  if (list.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CalendarDays}
          title="No hay eventos con control de asistencia"
          text="Crea un Conectados o activa el QR de asistencia en un evento del Calendario."
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
      <Card className="overflow-hidden">
        <p className="px-4 py-3 text-[11px] font-semibold text-tinta-500 uppercase tracking-wide border-b border-tinta-200">Eventos con asistencia</p>
        <ul className="divide-y divide-tinta-100 max-h-[60vh] overflow-y-auto">
          {list.map((e) => {
            const closed = closures.some((c) => c.eventId === e.id && c.status === 'cerrado');
            return (
              <li key={e.id}>
                <button onClick={() => setSelectedId(e.id)} className={`w-full text-left px-4 py-3 hover:bg-tinta-50 ${selectedId === e.id ? 'bg-lila-50' : ''}`}>
                  <p className={`text-sm font-semibold text-tinta-900 ${e.status === 'cancelado' ? 'line-through opacity-60' : ''}`}>{e.title}</p>
                  <p className="text-[11px] text-tinta-500 mt-0.5 flex flex-wrap items-center gap-2">
                    {e.date}
                    {e.attendanceEnabled && <QrIcon className="w-3 h-3" aria-label="Con QR" />}
                    {closed ? (
                      <span className="inline-flex items-center gap-1 text-turquesa-700 font-semibold">
                        <Lock className="w-3 h-3" /> Cerrada
                      </span>
                    ) : (
                      <span className="text-mostaza-700 font-semibold">Abierta</span>
                    )}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      {selected ? (
        <AttendanceDetail key={selected.id} event={selected} people={people} />
      ) : (
        <Card>
          <EmptyState icon={CheckCheck} title="Elige un evento" text="Selecciona un evento de la lista para ver y gestionar su asistencia." />
        </Card>
      )}
    </div>
  );
};

const AttendanceDetail: React.FC<{ event: CalendarEvent; people: Person[] }> = ({ event, people }) => {
  const attendances = useCollection(eventAttendances.subscribe);
  const closures = useCollection(conectadosClosures.subscribe);
  const closure = closures.find((c) => c.eventId === event.id && c.status === 'cerrado');
  const lastReopen = closures.find((c) => c.eventId === event.id && c.status === 'reabierto');
  const isClosed = !!closure;
  const isConectados = event.type === 'conectados';
  const scoring: ConectadosScoring = closure?.scoring ?? event.scoring ?? getDefaultScoring();

  // Con Supabase, los escaneos de QR llegan al servidor: se refresca la lista mientras está abierta
  useEffect(() => {
    void api.refreshAttendance();
    if (!api.isRemote() || isClosed) return;
    const id = window.setInterval(() => void api.refreshAttendance(), 5000);
    return () => window.clearInterval(id);
  }, [event.id, isClosed]);

  const records = useMemo(() => {
    const m = new Map<string, EventAttendance>();
    attendances.filter((a) => a.eventId === event.id).forEach((a) => m.set(a.personId, a));
    return m;
  }, [attendances, event.id]);

  const invited = useMemo(
    () =>
      people
        .filter((p) => p.isActive !== false && (isPersonInAudience(p, event.audience) || records.has(p.id)))
        .sort((a, b) => (personPrimaryGt(a) || 'zz').localeCompare(personPrimaryGt(b) || 'zz') || a.name.localeCompare(b.name)),
    [people, event.audience, records]
  );
  const statusOf = (id: string): AttendanceState => records.get(id)?.status ?? 'pendiente';

  const live: ConectadosGtResult[] = useMemo(
    () => (isConectados ? computeConectadosResults(scoring, conectadosGts(event), people, (id) => records.get(id)?.status) : []),
    [isConectados, scoring, event, people, records]
  );
  const results = closure?.results?.length ? closure.results : live;

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATES.map((s) => [s, 0])) as Record<AttendanceState, number>;
    invited.forEach((p) => c[statusOf(p.id)]++);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invited, records]);

  const [gt, setGt] = useState('');
  const [stateFilter, setStateFilter] = useState<'' | AttendanceState>('');
  const [query, setQuery] = useState('');
  const [excuseFor, setExcuseFor] = useState<Person | null>(null);
  const [noteFor, setNoteFor] = useState<Person | null>(null);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [busy, run] = useBusy();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invited
      .filter((p) => !gt || personPrimaryGt(p) === gt || (gt === 'otros' && !personPrimaryGt(p)))
      .filter((p) => !stateFilter || statusOf(p.id) === stateFilter)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.documentId.includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invited, gt, stateFilter, query, records]);

  const setStatus = (p: Person, st: AttendanceState) => {
    if (st === 'excusa') return setExcuseFor(p);
    return run(() => attempt(() => api.setAttendance(event.id, [p.id], st)));
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-display text-tinta-900">{event.title}</h2>
              <EventTypeChip type={event.type} trainingMode={event.trainingMode} />
            </div>
            <p className="text-sm text-tinta-600 capitalize mt-1">
              {formatDateLong(event.date)} · {formatTime12(event.startTime)} – {formatTime12(event.endTime)}
              {event.location && ` · ${event.location}`}
            </p>
            {isConectados && (
              <p className="text-xs text-tinta-500 mt-2">
                Vale hasta <b className="text-tinta-900">{formatPoints(scoring.maxGtPoints)}</b> pts por GT · individual: {formatPoints(scoring.individualPoints.asistio)} llegó /{' '}
                {formatPoints(scoring.individualPoints.tarde)} tarde / {formatPoints(scoring.individualPoints.excusa)} excusa · excusas{' '}
                {scoring.excuseMode === 'excluir' ? 'no penalizan' : scoring.excuseMode === 'asistencia' ? 'cuentan como asistencia' : 'cuentan como ausencia'}
              </p>
            )}
          </div>
          {isClosed ? (
            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-turquesa-100 text-turquesa-800 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" /> Cerrada por {closure.closedBy}
              </span>
              <button className={btnSecondary} onClick={() => setReopening(true)}>
                <RotateCcw className="w-4 h-4" /> Reabrir
              </button>
            </div>
          ) : (
            <button className={`${btnPrimary} shrink-0`} onClick={() => setClosing(true)} disabled={event.status === 'cancelado'}>
              <Lock className="w-4 h-4" /> Cerrar asistencia
            </button>
          )}
        </div>
        {!isClosed && lastReopen?.reopenReason && (
          <p className="text-xs text-mostaza-800 bg-mostaza-50 border border-mostaza-200 rounded-xl px-3 py-2">
            Reabierta por {lastReopen.reopenedBy}: {lastReopen.reopenReason}. Los puntos anteriores quedaron anulados en el historial.
          </p>
        )}
        {event.attendanceEnabled && !isClosed && event.status === 'activo' && <EventQrPanel event={event} isClosed={isClosed} />}
        {/* Conteo por estado */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {STATES.map((s) => (
            <button
              key={s}
              onClick={() => setStateFilter(stateFilter === s ? '' : s)}
              className={`rounded-xl border px-2 py-2 text-left ${stateFilter === s ? 'border-tinta-900' : 'border-tinta-200'} hover:border-tinta-400`}
            >
              <span className="block text-lg font-bold tabular-nums text-tinta-900">{counts[s]}</span>
              <span className="block text-[10px] font-semibold text-tinta-600">{ATTENDANCE_STATE_LABELS[s]}</span>
            </button>
          ))}
        </div>
        {!isClosed && counts.pendiente > 0 && (
          <p className="text-[11px] text-tinta-600">
            Quien no ha escaneado sigue <b>PENDIENTE</b>. Solo al cerrar la asistencia pasa a NO ASISTIÓ.
          </p>
        )}
      </Card>

      {isConectados && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-tinta-200">
            <p className="text-sm font-semibold text-tinta-900">{isClosed ? 'Resultado registrado (DÍAS League)' : 'Cálculo en vivo (aún sin registrar)'}</p>
          </div>
          <ResultsTable results={results} showPending={!isClosed} onPick={setGt} selectedGt={gt} />
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-tinta-200 flex flex-col md:flex-row md:items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-2">
            <select className={`${inputCls} !w-auto !py-1.5 text-xs`} value={gt} onChange={(e) => setGt(e.target.value)} aria-label="Filtrar por GT">
              <option value="">Todos los GT</option>
              {LEAGUE_GTS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              <option value="otros">GAP / MESA</option>
            </select>
            <select className={`${inputCls} !w-auto !py-1.5 text-xs`} value={stateFilter} onChange={(e) => setStateFilter(e.target.value as typeof stateFilter)} aria-label="Filtrar por estado">
              <option value="">Todos los estados</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {ATTENDANCE_STATE_LABELS[s]}
                </option>
              ))}
            </select>
            {!isClosed && gt && gt !== 'otros' && (
              <button
                className="text-xs font-semibold text-turquesa-700 hover:underline px-1"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    attempt(
                      () => api.setAttendance(event.id, rows.filter((p) => statusOf(p.id) === 'pendiente').map((p) => p.id), 'llego'),
                      'Pendientes marcados como LLEGÓ'
                    )
                  )
                }
              >
                Pendientes de {gt} → LLEGÓ
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-tinta-400 absolute left-3 top-2.5" />
            <input className={`${inputCls} pl-9 !py-1.5 md:w-56`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar integrante" />
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={UserX} title="Nadie coincide con los filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold text-tinta-500 uppercase tracking-wide border-b border-tinta-200">
                  <th className="text-left px-4 py-2.5">Integrante</th>
                  <th className="text-left px-2 py-2.5">GT</th>
                  <th className="text-left px-2 py-2.5">Estado de asistencia</th>
                  <th className="text-left px-2 py-2.5">Hora de registro</th>
                  <th className="text-left px-2 py-2.5">Observación</th>
                  {!isClosed && <th className="text-right px-4 py-2.5">Cambiar estado</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-tinta-100">
                {rows.map((p) => {
                  const rec = records.get(p.id);
                  const st = statusOf(p.id);
                  return (
                    <tr key={p.id} className="align-top">
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-tinta-900">{p.name}</span>
                        <span className="block text-[11px] text-tinta-500">CC {p.documentId}</span>
                      </td>
                      <td className="px-2 py-2.5 text-tinta-700">{personPrimaryGt(p) || p.primaryType}</td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-lg border text-[11px] font-bold ${STATE_STYLE[st]}`}>{ATTENDANCE_STATE_LABELS[st]}</span>
                        {rec?.source === 'qr' && <span className="ml-1.5 text-[10px] font-semibold text-lila-700">QR</span>}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums text-tinta-700 whitespace-nowrap">{formatClock(rec?.checkedInAt)}</td>
                      <td className="px-2 py-2.5 text-xs text-tinta-600 max-w-[260px]">
                        {st === 'excusa' && rec?.excuseReason && <span className="block">Excusa: {rec.excuseReason}</span>}
                        {rec?.observation || (st === 'excusa' ? '' : '—')}
                        {st === 'excusa' && rec?.excuseApprovedBy && (
                          <span className="block text-[10px] text-tinta-500">
                            Aprobada por {rec.excuseApprovedBy}
                            {rec.excuseApprovedAt && ` · ${new Date(rec.excuseApprovedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' })}`}
                          </span>
                        )}
                        {rec?.excuseEvidenceUrl && (
                          <a href={rec.excuseEvidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-lila-700 hover:underline">
                            <FileText className="w-3 h-3" /> Evidencia
                          </a>
                        )}
                        {!isClosed && (
                          <button className="block text-[11px] font-semibold text-lila-700 hover:underline mt-0.5" onClick={() => setNoteFor(p)}>
                            {rec?.observation ? 'Editar observación' : 'Agregar observación'}
                          </button>
                        )}
                      </td>
                      {!isClosed && (
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap justify-end gap-1" role="radiogroup" aria-label={`Asistencia de ${p.name}`}>
                            {STATES.map((s) => (
                              <button
                                key={s}
                                role="radio"
                                aria-checked={st === s}
                                disabled={busy}
                                onClick={() => setStatus(p, s)}
                                className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
                                  st === s ? STATE_STYLE[s] : 'bg-surface border-tinta-200 text-tinta-600 hover:border-tinta-400'
                                }`}
                              >
                                {ATTENDANCE_STATE_LABELS[s]}
                              </button>
                            ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {excuseFor && <ExcuseModal event={event} person={excuseFor} current={records.get(excuseFor.id)} onClose={() => setExcuseFor(null)} />}
      {noteFor && <NoteModal event={event} person={noteFor} current={records.get(noteFor.id)} status={statusOf(noteFor.id)} onClose={() => setNoteFor(null)} />}
      {closing && <CloseModal event={event} people={people} pending={counts.pendiente} onClose={() => setClosing(false)} />}
      {reopening && <ReopenModal event={event} onClose={() => setReopening(false)} />}
    </div>
  );
};

const ResultsTable: React.FC<{ results: ConectadosGtResult[]; showPending: boolean; onPick?: (gt: string) => void; selectedGt?: string }> = ({
  results,
  showPending,
  onPick,
  selectedGt,
}) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[11px] font-semibold text-tinta-500 uppercase tracking-wide border-b border-tinta-200">
          <th className="text-left px-4 py-2">GT</th>
          <th className="text-right px-2 py-2" title="Integrantes activos y habilitados">Habilitados</th>
          <th className="text-right px-2 py-2">Llegó</th>
          <th className="text-right px-2 py-2">Tarde</th>
          <th className="text-right px-2 py-2">Excusa</th>
          {showPending && <th className="text-right px-2 py-2">Pendiente</th>}
          <th className="text-right px-2 py-2">No asistió</th>
          <th className="text-right px-2 py-2" title="Denominador usado en el cálculo">Base</th>
          <th className="text-right px-2 py-2">% Asist.</th>
          <th className="text-right px-4 py-2">DÍAS POINTS</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-tinta-100">
        {[...results]
          .sort((a, b) => b.points - a.points || a.gt.localeCompare(b.gt))
          .map((r) => (
            <tr key={r.gt} onClick={() => onPick?.(r.gt)} className={`${onPick ? 'cursor-pointer hover:bg-tinta-50' : ''} ${selectedGt === r.gt ? 'bg-lila-50' : ''}`}>
              <td className="px-4 py-2 font-semibold text-tinta-900">{r.gt}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.enabled}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.attended}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.late}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.excused}</td>
              {showPending && <td className="px-2 py-2 text-right tabular-nums text-tinta-500">{r.pending ?? 0}</td>}
              <td className="px-2 py-2 text-right tabular-nums">{showPending ? r.absent - (r.pending ?? 0) : r.absent}</td>
              <td className="px-2 py-2 text-right tabular-nums text-tinta-500">{r.denominator}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatPoints(r.percentage)}%</td>
              <td className="px-4 py-2 text-right tabular-nums font-bold text-tinta-900">{formatPoints(r.points)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  </div>
);

const ExcuseModal: React.FC<{ event: CalendarEvent; person: Person; current?: EventAttendance; onClose: () => void }> = ({ event, person, current, onClose }) => {
  const [reason, setReason] = useState(current?.excuseReason ?? '');
  const [observation, setObservation] = useState(current?.observation ?? '');
  const [evidence, setEvidence] = useState(current?.excuseEvidenceUrl ?? '');
  const [busy, run] = useBusy();
  return (
    <Modal
      title="Aprobar excusa válida"
      subtitle={`${person.name} · ${event.title}`}
      onClose={onClose}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button
            className={btnPrimary}
            disabled={busy || !reason.trim()}
            onClick={() =>
              run(async () => {
                if (
                  await attempt(
                    () => api.setAttendance(event.id, [person.id], 'excusa', { excuseReason: reason.trim(), observation: observation.trim(), evidenceUrl: evidence.trim() }),
                    'Excusa aprobada'
                  )
                )
                  onClose();
              })
            }
          >
            Aprobar excusa
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Motivo de la excusa (obligatorio)">
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: Parcial de Cálculo" autoFocus />
        </Field>
        <Field label="Observación">
          <input className={inputCls} value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Ej: Excusa aprobada" />
        </Field>
        <Field label="Documento o evidencia (enlace)" hint="Drive, foto o PDF de soporte">
          <input className={inputCls} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="https://…" />
        </Field>
        <p className="text-[11px] text-tinta-500">Quedan registrados quién la aprobó y la fecha. La excusa no penaliza según la configuración del evento.</p>
      </div>
    </Modal>
  );
};

const NoteModal: React.FC<{ event: CalendarEvent; person: Person; current?: EventAttendance; status: AttendanceState; onClose: () => void }> = ({
  event,
  person,
  current,
  status,
  onClose,
}) => {
  const [note, setNote] = useState(current?.observation ?? '');
  const [busy, run] = useBusy();
  return (
    <Modal
      title="Observación"
      subtitle={`${person.name} · ${event.title}`}
      onClose={onClose}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button
            className={btnPrimary}
            disabled={busy}
            onClick={() =>
              run(async () => {
                if (
                  await attempt(
                    () =>
                      api.setAttendance(event.id, [person.id], status, {
                        observation: note.trim(),
                        excuseReason: current?.excuseReason,
                        evidenceUrl: current?.excuseEvidenceUrl,
                      }),
                    'Observación guardada'
                  )
                )
                  onClose();
              })
            }
          >
            Guardar
          </button>
        </>
      }
    >
      <Field label="Observación">
        <textarea className={`${inputCls} min-h-[80px]`} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
};

const CloseModal: React.FC<{ event: CalendarEvent; people: Person[]; pending: number; onClose: () => void }> = ({ event, people, pending, onClose }) => {
  const [preview, setPreview] = useState<{ scoring: ConectadosScoring; results: ConectadosGtResult[] } | null>(null);
  const [busy, run] = useBusy();
  useEffect(() => {
    api
      .previewAttendance(event, people)
      .then(setPreview)
      .catch((e) => notify.error(e));
  }, [event, people]);
  const total = preview?.results.reduce((a, r) => a + r.points, 0) ?? 0;
  return (
    <Modal
      title="Cerrar asistencia"
      subtitle="Revisa el cálculo antes de confirmar. Solo al cerrar se consolidan los resultados."
      onClose={onClose}
      size="xl"
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>
            Volver
          </button>
          <button
            className={btnPrimary}
            disabled={busy || !preview}
            onClick={() =>
              run(async () => {
                if (await attempt(() => api.closeAttendance(event, people), event.type === 'conectados' ? 'Asistencia cerrada: DÍAS POINTS entregados' : 'Asistencia cerrada')) onClose();
              })
            }
          >
            {busy ? 'Cerrando…' : 'Confirmar y cerrar'}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-tinta-700">
        {pending > 0 && (
          <p className="rounded-xl bg-mostaza-50 border border-mostaza-200 px-3 py-2 text-mostaza-900">
            Hay <b>{pending}</b> integrante{pending === 1 ? '' : 's'} PENDIENTE{pending === 1 ? '' : 'S'}: al cerrar quedarán como <b>NO ASISTIÓ</b>. Si alguno tiene excusa, apruébala antes.
          </p>
        )}
        {event.type === 'conectados' ? (
          preview ? (
            <>
              <p>
                Se entregarán <b>{formatPoints(total)}</b> DÍAS POINTS a los GT y los puntos individuales de cada asistente. Los totales de integrantes quedan congelados aunque
                después cambien los GT.
              </p>
              <div className="border border-tinta-200 rounded-2xl overflow-hidden">
                <ResultsTable results={preview.results} showPending />
              </div>
            </>
          ) : (
            <p>Calculando…</p>
          )
        ) : (
          <p>Este evento no entrega DÍAS POINTS: al cerrar se guarda la asistencia definitiva.</p>
        )}
      </div>
    </Modal>
  );
};

const ReopenModal: React.FC<{ event: CalendarEvent; onClose: () => void }> = ({ event, onClose }) => {
  const [reason, setReason] = useState('');
  const [busy, run] = useBusy();
  return (
    <Modal
      title="Reabrir asistencia"
      subtitle="Los puntos ya registrados se anularán (quedan en el historial) y podrás corregir y volver a cerrar."
      onClose={onClose}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>
            Volver
          </button>
          <button
            className={btnDanger}
            disabled={busy || !reason.trim()}
            onClick={() =>
              run(async () => {
                if (await attempt(() => api.reopenAttendance(event.id, reason.trim()), 'Asistencia reabierta')) onClose();
              })
            }
          >
            Reabrir
          </button>
        </>
      }
    >
      <Field label="Motivo (obligatorio)">
        <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: se registró mal la asistencia de Finanzas" autoFocus />
      </Field>
    </Modal>
  );
};
