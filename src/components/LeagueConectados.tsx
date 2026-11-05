import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCheck, Lock, RotateCcw, Search, UserX } from 'lucide-react';
import { CalendarEvent, ConectadosStatus, CONECTADOS_STATUS_LABELS, Person } from '../types';
import { calendarEvents, formatDateLong, formatTime12 } from '../services/calendarService';
import {
  closeConectados,
  computeConectadosResults,
  conectadosClosures,
  conectadosGts,
  eventAttendances,
  getDefaultScoring,
  gtMembers,
  reopenConectados,
  setEventAttendance,
  setEventAttendanceBulk,
} from '../services/leagueService';
import { btnDanger, btnPrimary, btnSecondary, Card, EmptyState, Field, formatPoints, inputCls, Modal, useCollection } from './league/ui';

const STATUS_ORDER: ConectadosStatus[] = ['asistio', 'tarde', 'excusa', 'ausente', 'no_aplica'];
const STATUS_STYLE: Record<ConectadosStatus, string> = {
  asistio: 'bg-turquesa-600 text-white border-turquesa-600',
  tarde: 'bg-mostaza-300 text-negro border-mostaza-300',
  excusa: 'bg-lila-300 text-negro border-lila-300',
  ausente: 'bg-coral-500 text-white border-coral-500',
  no_aplica: 'bg-tinta-600 text-white border-tinta-600',
};
const SHORT: Record<ConectadosStatus, string> = {
  asistio: 'Asistió',
  tarde: 'Tarde',
  excusa: 'Excusa',
  ausente: 'No asistió',
  no_aplica: 'No habilitado',
};

interface Props {
  people: Person[];
  author: string;
  focusEventId?: string | null;
  onFocusHandled?: () => void;
}

export const LeagueConectados: React.FC<Props> = ({ people, author, focusEventId, onFocusHandled }) => {
  const events = useCollection(calendarEvents.subscribe);
  const closures = useCollection(conectadosClosures.subscribe);
  const conectados = useMemo(
    () => events.filter((e) => e.type === 'conectados').sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime)),
    [events]
  );
  const [selectedId, setSelectedId] = useState<string | null>(focusEventId ?? null);

  useEffect(() => {
    if (focusEventId) {
      setSelectedId(focusEventId);
      onFocusHandled?.();
    }
  }, [focusEventId, onFocusHandled]);

  const selected = conectados.find((e) => e.id === selectedId);

  if (conectados.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CalendarDays}
          title="No hay Conectados en el calendario"
          text="Crea un evento de tipo Conectados en el Calendario para tomar asistencia y calcular los DÍAS POINTS."
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
      <Card className="overflow-hidden">
        <p className="px-4 py-3 text-[11px] font-semibold text-tinta-500 uppercase tracking-wide border-b border-tinta-200">
          Conectados
        </p>
        <ul className="divide-y divide-tinta-100 max-h-[60vh] overflow-y-auto">
          {conectados.map((e) => {
            const closed = closures.some((c) => c.eventId === e.id && c.status === 'cerrado');
            return (
              <li key={e.id}>
                <button
                  onClick={() => setSelectedId(e.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-tinta-50 ${selectedId === e.id ? 'bg-lila-50' : ''}`}
                >
                  <p className={`text-sm font-semibold text-tinta-900 ${e.status === 'cancelado' ? 'line-through opacity-60' : ''}`}>
                    {e.title}
                  </p>
                  <p className="text-[11px] text-tinta-500 mt-0.5 flex items-center gap-2">
                    {e.date}
                    {closed ? (
                      <span className="inline-flex items-center gap-1 text-turquesa-700 font-semibold">
                        <Lock className="w-3 h-3" /> Cerrado
                      </span>
                    ) : (
                      <span className="text-mostaza-700 font-semibold">Abierto</span>
                    )}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {selected ? (
        <ConectadosAttendance key={selected.id} event={selected} people={people} author={author} />
      ) : (
        <Card>
          <EmptyState icon={CheckCheck} title="Elige un Conectados" text="Selecciona un Conectados de la lista para registrar la asistencia." />
        </Card>
      )}
    </div>
  );
};

const ConectadosAttendance: React.FC<{ event: CalendarEvent; people: Person[]; author: string }> = ({ event, people, author }) => {
  const attendances = useCollection(eventAttendances.subscribe);
  const closures = useCollection(conectadosClosures.subscribe);
  const closure = closures.find((c) => c.eventId === event.id && c.status === 'cerrado');
  const lastReopen = closures.find((c) => c.eventId === event.id && c.status === 'reabierto');
  const isClosed = !!closure;
  const scoring = closure?.scoring ?? event.scoring ?? getDefaultScoring();
  const gts = conectadosGts(event);

  const records = useMemo(() => {
    const m = new Map<string, { status: ConectadosStatus; excuseReason?: string }>();
    attendances.filter((a) => a.eventId === event.id).forEach((a) => m.set(a.personId, a));
    return m;
  }, [attendances, event.id]);

  const liveResults = useMemo(
    () => computeConectadosResults(scoring, gts, people, (id) => records.get(id)?.status),
    [scoring, gts, people, records]
  );
  const results = closure?.results ?? liveResults;

  const [gt, setGt] = useState(gts[0]);
  const [query, setQuery] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const members = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gtMembers(people, gt)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.documentId.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [people, gt, query]);

  const unmarked = useMemo(
    () => gts.reduce((acc, g) => acc + gtMembers(people, g).filter((p) => !records.has(p.id)).length, 0),
    [gts, people, records]
  );
  const gtUnmarked = gtMembers(people, gt).filter((p) => !records.has(p.id));

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-display text-tinta-900">{event.title}</h2>
            <p className="text-sm text-tinta-600 capitalize mt-1">
              {formatDateLong(event.date)} · {formatTime12(event.startTime)}
              {event.location && ` · ${event.location}`}
            </p>
            <p className="text-xs text-tinta-500 mt-2">
              Vale hasta <b className="text-tinta-900">{formatPoints(scoring.maxGtPoints)}</b> pts por GT · individual:{' '}
              {formatPoints(scoring.individualPoints.asistio)} asistió / {formatPoints(scoring.individualPoints.tarde)} tarde /{' '}
              {formatPoints(scoring.individualPoints.excusa)} excusa · tarde cuenta{' '}
              {scoring.lateWeight === 1 ? 'completa' : scoring.lateWeight === 0 ? 'como ausencia' : 'como media'} · excusas{' '}
              {scoring.excuseMode === 'excluir' ? 'no penalizan' : scoring.excuseMode === 'asistencia' ? 'cuentan como asistencia' : 'cuentan como ausencia'}
            </p>
          </div>
          {isClosed ? (
            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-turquesa-100 text-turquesa-800 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" /> Cerrado por {closure.closedBy}
              </span>
              <button className={btnSecondary} onClick={() => setReopening(true)}>
                <RotateCcw className="w-4 h-4" /> Reabrir
              </button>
            </div>
          ) : (
            <button className={`${btnPrimary} shrink-0`} onClick={() => setConfirmClose(true)} disabled={event.status === 'cancelado'}>
              <Lock className="w-4 h-4" /> Cerrar y calcular puntos
            </button>
          )}
        </div>
        {!isClosed && lastReopen?.reopenReason && (
          <p className="mt-3 text-xs text-mostaza-800 bg-mostaza-50 border border-mostaza-200 rounded-xl px-3 py-2">
            Reabierto por {lastReopen.reopenedBy}: {lastReopen.reopenReason}. Los puntos anteriores quedaron anulados en el historial.
          </p>
        )}
      </Card>

      {/* Resumen por GT */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-tinta-200 flex items-center justify-between">
          <p className="text-sm font-semibold text-tinta-900">{isClosed ? 'Resultado registrado' : 'Resultado en vivo (aún sin registrar)'}</p>
          {!isClosed && unmarked > 0 && <p className="text-[11px] text-mostaza-800">{unmarked} sin marcar contarán como “No asistió”</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold text-tinta-500 uppercase tracking-wide border-b border-tinta-200">
                <th className="text-left px-4 py-2">GT</th>
                <th className="text-right px-2 py-2" title="Integrantes activos y habilitados">Habilitados</th>
                <th className="text-right px-2 py-2">Asistió</th>
                <th className="text-right px-2 py-2">Tarde</th>
                <th className="text-right px-2 py-2">Excusa</th>
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
                  <tr key={r.gt} onClick={() => setGt(r.gt)} className={`cursor-pointer hover:bg-tinta-50 ${gt === r.gt ? 'bg-lila-50' : ''}`}>
                    <td className="px-4 py-2 font-semibold text-tinta-900">{r.gt}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.enabled}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.attended}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.late}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.excused}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.absent}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-tinta-500">{r.denominator}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatPoints(r.percentage)}%</td>
                    <td className="px-4 py-2 text-right tabular-nums font-bold text-tinta-900">{formatPoints(r.points)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Registro por GT */}
      <Card className="overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-tinta-200 flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-1.5">
            {gts.map((g) => (
              <button
                key={g}
                onClick={() => setGt(g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                  gt === g ? 'bg-tinta-900 text-white border-tinta-900' : 'bg-surface border-tinta-200 text-tinta-700 hover:border-tinta-400'
                }`}
              >
                {g} <span className="opacity-60 tabular-nums">{gtMembers(people, g).length}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-tinta-400 absolute left-3 top-2.5" />
            <input className={`${inputCls} pl-9 !py-1.5 md:w-56`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar integrante" />
          </div>
        </div>
        {!isClosed && members.length > 0 && (
          <div className="px-4 py-2.5 bg-tinta-50 border-b border-tinta-200 flex flex-wrap gap-2 text-xs">
            <button
              className="font-semibold text-turquesa-700 hover:underline"
              onClick={() => setEventAttendanceBulk(event.id, gtMembers(people, gt).map((p) => p.id), 'asistio', author)}
            >
              Marcar todos “Asistió”
            </button>
            {gtUnmarked.length > 0 && (
              <button
                className="font-semibold text-coral-700 hover:underline"
                onClick={() => setEventAttendanceBulk(event.id, gtUnmarked.map((p) => p.id), 'ausente', author)}
              >
                Sin marcar → “No asistió” ({gtUnmarked.length})
              </button>
            )}
          </div>
        )}
        {members.length === 0 ? (
          <EmptyState icon={UserX} title={`${gt} no tiene integrantes activos`} text="Revisa en Personas que tengan este GT como principal." />
        ) : (
          <ul className="divide-y divide-tinta-100">
            {members.map((p) => {
              const rec = records.get(p.id);
              return (
                <li key={p.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-tinta-900">{p.name}</p>
                    <p className="text-[11px] text-tinta-500">
                      {p.roleTitle || 'Staff'} · CC {p.documentId}
                      {!rec && !isClosed && <span className="text-mostaza-700 font-semibold"> · sin marcar</span>}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 md:items-end">
                    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`Asistencia de ${p.name}`}>
                      {STATUS_ORDER.map((st) => {
                        const on = rec?.status === st;
                        return (
                          <button
                            key={st}
                            role="radio"
                            aria-checked={on}
                            disabled={isClosed}
                            title={CONECTADOS_STATUS_LABELS[st]}
                            onClick={() => setEventAttendance(event.id, p.id, st, author, rec?.excuseReason)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${
                              on ? STATUS_STYLE[st] : 'bg-surface border-tinta-200 text-tinta-600 hover:border-tinta-400 disabled:opacity-40'
                            }`}
                          >
                            {SHORT[st]}
                          </button>
                        );
                      })}
                    </div>
                    {rec?.status === 'excusa' && (
                      <input
                        className={`${inputCls} !py-1 text-xs md:w-72`}
                        placeholder="Motivo de la excusa"
                        defaultValue={rec.excuseReason}
                        disabled={isClosed}
                        onBlur={(e) => setEventAttendance(event.id, p.id, 'excusa', author, e.target.value.trim())}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {confirmClose && (
        <Modal
          title="Cerrar asistencia y registrar puntos"
          onClose={() => setConfirmClose(false)}
          footer={
            <>
              <button className={btnSecondary} onClick={() => setConfirmClose(false)}>
                Volver
              </button>
              <button
                className={btnPrimary}
                onClick={() => {
                  closeConectados(event, people, author);
                  setConfirmClose(false);
                }}
              >
                Cerrar y registrar
              </button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-tinta-700">
            <p>
              Se registrarán <b>{formatPoints(liveResults.reduce((a, r) => a + r.points, 0))}</b> DÍAS POINTS para los GT y los puntos
              individuales de cada asistente. Los totales de integrantes quedan congelados aunque después cambien los GT.
            </p>
            {unmarked > 0 && (
              <p className="rounded-xl bg-mostaza-50 border border-mostaza-200 px-3 py-2 text-mostaza-900">
                Hay <b>{unmarked}</b> integrante{unmarked === 1 ? '' : 's'} sin marcar: contarán como “No asistió”.
              </p>
            )}
          </div>
        </Modal>
      )}

      {reopening && (
        <Modal
          title="Reabrir asistencia"
          subtitle="Los puntos ya registrados se anularán (quedan en el historial) y podrás corregir y volver a cerrar."
          onClose={() => setReopening(false)}
          footer={
            <>
              <button className={btnSecondary} onClick={() => setReopening(false)}>
                Volver
              </button>
              <button
                className={btnDanger}
                disabled={!reopenReason.trim()}
                onClick={() => {
                  reopenConectados(event.id, author, reopenReason.trim());
                  setReopening(false);
                  setReopenReason('');
                }}
              >
                Reabrir
              </button>
            </>
          }
        >
          <Field label="Motivo (obligatorio)">
            <input className={inputCls} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Ej: se registró mal la asistencia de Finanzas" autoFocus />
          </Field>
        </Modal>
      )}
    </div>
  );
};
