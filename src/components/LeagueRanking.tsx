import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, History, Info, Save, Scale, Trash2, Trophy, Users } from 'lucide-react';
import { BUILTIN_EVENT_TYPES, Person } from '../types';
import { api, errorMessage } from '../services/leagueApi';
import {
  activityClaims,
  conectadosClosures,
  leagueSettings,
  pointActivities,
  pointMovements,
  rankingHistory,
} from '../services/leagueService';
import { calendarEvents, customEventTypes, eventTypeName, todayIso } from '../services/calendarService';
import {
  DEFAULT_RANKING_CONFIG,
  GtRankingRow,
  LeagueRanking,
  normalizeRankingConfig,
  RankingConfig,
  RankingSnapshot,
} from '../services/leagueRanking';
import { btnPrimary, btnSecondary, Card, CheckList, EmptyState, Field, formatPoints, inputCls, Modal, useCollection } from './league/ui';
import { attempt, useBusy } from './league/toast';

// ----------------------------------------------------------------------------
// Datos: ranking en vivo (Supabase lo calcula con la información real)
// ----------------------------------------------------------------------------
export function useLeagueRanking(people: Person[]): { ranking: LeagueRanking | null; error: string | null } {
  const movements = useCollection(pointMovements.subscribe);
  const closures = useCollection(conectadosClosures.subscribe);
  const acts = useCollection(pointActivities.subscribe);
  const claims = useCollection(activityClaims.subscribe);
  const events = useCollection(calendarEvents.subscribe);
  const settings = useCollection(leagueSettings.subscribe);
  // Las personas cambian de referencia a menudo: basta con saber quién está en qué GT
  const peopleKey = useMemo(() => people.map((p) => `${p.id}:${p.primaryType}:${p.gtSubTeam ?? ''}:${p.gtTeams?.[0] ?? ''}`).join('|'), [people]);
  const [ranking, setRanking] = useState<LeagueRanking | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // Al registrarse puntos o participaciones llegan varios cambios seguidos: se recalcula una vez
    const t = window.setTimeout(async () => {
      try {
        const r = await api.ranking(people);
        if (!alive) return;
        setRanking(r);
        setError(null);
      } catch (e) {
        if (alive) setError(errorMessage(e));
      }
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movements, closures, acts, claims, events, settings, peopleKey]);

  return { ranking, error };
}

const POSITION_STYLES = ['bg-mostaza-300 text-negro', 'bg-tinta-300 text-negro', 'bg-coral-200 text-negro'];

const Bar: React.FC<{ value: number; className: string }> = ({ value, className }) => (
  <span className="block h-2 rounded-full bg-tinta-100 overflow-hidden">
    <span className={`block h-full rounded-full ${className}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </span>
);

// ----------------------------------------------------------------------------
// Tabla del ranking
// ----------------------------------------------------------------------------
export const GtRankingBoard: React.FC<{ ranking: LeagueRanking | null; error: string | null; highlightGt?: string }> = ({
  ranking,
  error,
  highlightGt,
}) => {
  const [detail, setDetail] = useState<GtRankingRow | null>(null);
  const rows = ranking?.rows ?? [];
  const started = rows.some((r) => r.score > 0);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-lila-200 bg-lila-50 p-4 text-sm text-tinta-800 flex gap-3">
        <Scale className="w-5 h-5 text-lila-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-tinta-900">Puntaje sobre 100, igual de justo para GT grandes y pequeños</p>
          <p className="text-xs text-tinta-700 leading-relaxed">
            <b>50 %</b> promedio de DÍAS POINTS por integrante (puntos del GT ÷ todos sus integrantes, también los que tienen 0) +{' '}
            <b>50 %</b> participación (el % de sus integrantes que participó en cada actividad, en promedio). En cada parte, el mejor GT
            vale 100 y los demás se comparan con él. Gana el GT con mejor promedio y más participación, no el que tiene más gente.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        {error && <div className="px-5 py-3 bg-coral-50 border-b border-coral-200 text-xs text-coral-800">No se pudo cargar el ranking: {error}</div>}
        {!ranking && !error && <div className="px-5 py-8 text-center text-sm text-tinta-500">Calculando el ranking…</div>}
        {ranking && !started && (
          <div className="px-5 py-3 bg-tinta-50 border-b border-tinta-200 text-xs text-tinta-600">
            Aún no hay DÍAS POINTS ni participaciones registradas. El ranking se actualiza solo al registrar puntos, cerrar una asistencia o
            terminar una actividad.
          </div>
        )}
        {ranking && (
          <>
            <div className="hidden md:grid grid-cols-[56px_1.2fr_1.6fr_1.2fr_1.2fr_24px] gap-4 px-5 py-2.5 text-[11px] font-semibold text-tinta-500 uppercase tracking-wide border-b border-tinta-200">
              <span>Puesto</span>
              <span>GT</span>
              <span>Puntaje final</span>
              <span>Promedio por integrante</span>
              <span>Participación</span>
              <span />
            </div>
            <ol className="divide-y divide-tinta-100">
              {rows.map((r) => (
                <li key={r.gt}>
                  <button
                    onClick={() => setDetail(r)}
                    className={`w-full text-left grid grid-cols-[44px_1fr_auto] md:grid-cols-[56px_1.2fr_1.6fr_1.2fr_1.2fr_24px] gap-x-3 md:gap-4 gap-y-2 items-center px-4 md:px-5 py-3 hover:bg-tinta-50 transition-colors ${
                      highlightGt === r.gt ? 'bg-lila-50' : ''
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold tabular-nums text-sm ${
                        (r.score > 0 && POSITION_STYLES[r.position - 1]) || 'bg-tinta-100 text-tinta-700'
                      }`}
                    >
                      {r.position}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-tinta-900 truncate">
                        {r.gt}
                        {highlightGt === r.gt && <span className="ml-2 text-[11px] font-semibold text-lila-700">Tu GT</span>}
                      </span>
                      <span className="block text-[11px] text-tinta-500">
                        {r.members} integrante{r.members === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="md:hidden text-right">
                      <span className="block text-lg font-bold tabular-nums text-tinta-900">{formatPoints(r.score)}</span>
                      <span className="block text-[10px] text-tinta-500">de 100</span>
                    </span>
                    {/* Celular: las dos dimensiones debajo */}
                    <span className="md:hidden col-span-3 grid grid-cols-2 gap-3 text-[11px] text-tinta-600">
                      <span>
                        Promedio <b className="text-tinta-900 tabular-nums">{formatPoints(r.avgPoints)}</b> pts · {formatPoints(r.pointsScore)}/100
                        <Bar value={r.pointsScore} className="bg-turquesa-400 mt-1" />
                      </span>
                      <span>
                        Participación <b className="text-tinta-900 tabular-nums">{formatPoints(r.participation)}%</b> · {formatPoints(r.participationScore)}/100
                        <Bar value={r.participationScore} className="bg-coral-300 mt-1" />
                      </span>
                    </span>
                    <span className="hidden md:flex items-center gap-3">
                      <span className="flex-1">
                        <Bar value={r.score} className="bg-lila-400" />
                      </span>
                      <span className="w-12 text-right font-bold tabular-nums text-tinta-900">{formatPoints(r.score)}</span>
                    </span>
                    <span className="hidden md:block text-sm">
                      <span className="flex items-baseline justify-between gap-2">
                        <b className="tabular-nums text-tinta-900">{formatPoints(r.avgPoints)} pts</b>
                        <span className="text-[11px] text-tinta-500 tabular-nums">{formatPoints(r.pointsScore)}/100</span>
                      </span>
                      <Bar value={r.pointsScore} className="bg-turquesa-400 mt-1" />
                    </span>
                    <span className="hidden md:block text-sm">
                      <span className="flex items-baseline justify-between gap-2">
                        <b className="tabular-nums text-tinta-900">{formatPoints(r.participation)}%</b>
                        <span className="text-[11px] text-tinta-500 tabular-nums">{formatPoints(r.participationScore)}/100</span>
                      </span>
                      <Bar value={r.participationScore} className="bg-coral-300 mt-1" />
                    </span>
                    <ChevronRight className="hidden md:block w-4 h-4 text-tinta-400" />
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </Card>
      {detail && ranking && <GtRankingDetail row={detail} ranking={ranking} onClose={() => setDetail(null)} />}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Detalle de un GT: de dónde sale cada número
// ----------------------------------------------------------------------------
const GtRankingDetail: React.FC<{ row: GtRankingRow; ranking: LeagueRanking; onClose: () => void }> = ({ row, ranking, onClose }) => {
  const bestAvg = [...ranking.rows].sort((a, b) => b.avgPoints - a.avgPoints)[0];
  const bestPart = [...ranking.rows].sort((a, b) => b.participation - a.participation)[0];
  const mine = ranking.activities
    .map((a) => ({ a, x: a.byGt.find((g) => g.gt === row.gt) }))
    .filter((v): v is { a: (typeof ranking.activities)[number]; x: NonNullable<(typeof v)['x']> } => !!v.x);
  return (
    <Modal title={`${row.gt} · puesto ${row.position}`} subtitle={`${formatPoints(row.score)} de 100 puntos`} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-turquesa-200 bg-turquesa-50/60 p-4 space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-turquesa-800">1 · Promedio de DÍAS POINTS (50 %)</p>
            <p className="text-sm text-tinta-800">
              {formatPoints(row.totalPoints)} pts ÷ {row.members} integrante{row.members === 1 ? '' : 's'} ={' '}
              <b className="text-tinta-900">{formatPoints(row.avgPoints)} pts por integrante</b>
            </p>
            <p className="text-sm text-tinta-800">
              En la escala: <b className="text-tinta-900">{formatPoints(row.pointsScore)} de 100</b>
            </p>
            {bestAvg && bestAvg.avgPoints > 0 && (
              <p className="text-[11px] text-tinta-600">
                100 = el mejor promedio: {bestAvg.gt} con {formatPoints(bestAvg.avgPoints)} pts.
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-coral-200 bg-coral-50/60 p-4 space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-coral-800">2 · Participación (50 %)</p>
            <p className="text-sm text-tinta-800">
              Promedio de {row.activitiesCounted} actividad{row.activitiesCounted === 1 ? '' : 'es'} ={' '}
              <b className="text-tinta-900">{formatPoints(row.participation)}%</b>
            </p>
            <p className="text-sm text-tinta-800">
              En la escala: <b className="text-tinta-900">{formatPoints(row.participationScore)} de 100</b>
            </p>
            {bestPart && bestPart.participation > 0 && (
              <p className="text-[11px] text-tinta-600">
                100 = la mejor participación: {bestPart.gt} con {formatPoints(bestPart.participation)}%.
              </p>
            )}
          </div>
        </div>
        <p className="text-sm text-tinta-700 rounded-2xl bg-tinta-50 border border-tinta-200 px-4 py-3">
          Puntaje final = 50 % × {formatPoints(row.pointsScore)} + 50 % × {formatPoints(row.participationScore)} ={' '}
          <b className="text-tinta-900">{formatPoints(row.score)} de 100</b>
        </p>

        <div>
          <p className="text-sm font-semibold text-tinta-900 mb-2">Participación en cada actividad</p>
          {mine.length === 0 ? (
            <p className="text-xs text-tinta-500">Todavía no hay actividades terminadas que cuenten para este GT.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-tinta-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-semibold text-tinta-500 uppercase tracking-wide border-b border-tinta-200">
                    <th className="text-left px-3 py-2">Actividad</th>
                    <th className="text-left px-2 py-2">Fecha</th>
                    <th className="text-right px-2 py-2" title="Participaron ÷ habilitados">Participaron</th>
                    <th className="text-right px-3 py-2">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tinta-100">
                  {mine.map(({ a, x }) => (
                    <tr key={a.id}>
                      <td className="px-3 py-2">
                        <span className="font-medium text-tinta-900">{a.name}</span>
                        <span className="block text-[11px] text-tinta-500">{a.kind === 'actividad_qr' ? 'Actividad con QR' : eventTypeName(a.type)}</span>
                      </td>
                      <td className="px-2 py-2 text-tinta-600 whitespace-nowrap">{a.date}</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatPoints(x.participated)} / {x.eligible}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatPoints(x.rate)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

// ----------------------------------------------------------------------------
// Historial
// ----------------------------------------------------------------------------
const snapshotTitle = (s: RankingSnapshot) => (s.kind === 'corte' ? s.label || 'Corte' : `Día ${s.date}`);

export const RankingHistoryPanel: React.FC<{ isAdmin: boolean; currentRows: GtRankingRow[] }> = ({ isAdmin, currentRows }) => {
  const snaps = useCollection(rankingHistory.subscribe);
  const sorted = useMemo(
    () => [...snaps].sort((a, b) => b.date.localeCompare(a.date) || (a.kind === b.kind ? b.updatedAt.localeCompare(a.updatedAt) : a.kind === 'corte' ? -1 : 1)),
    [snaps]
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [busy, run] = useBusy();
  const open = sorted.find((s) => s.id === openId);

  return (
    <Card className="p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-tinta-900 flex items-center gap-2">
            <History className="w-4 h-4 text-lila-600" /> Historial del ranking
          </p>
          <p className="text-xs text-tinta-500 mt-0.5">Se guarda solo cada día que el ranking cambia. La administración también puede guardar cortes con nombre.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <input className={`${inputCls} sm:w-56`} placeholder="Nombre del corte (ej. Cierre semestre 1)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <button
              className={btnSecondary}
              disabled={busy || !label.trim()}
              onClick={() => run(async () => (await attempt(() => api.saveRankingCut(label.trim(), currentRows), 'Corte guardado')) && setLabel(''))}
            >
              <Save className="w-4 h-4" /> Guardar corte
            </button>
          </div>
        )}
      </div>
      {sorted.length === 0 ? (
        <EmptyState icon={History} title="Aún no hay historial" text="Aparece el primer día en que se registren DÍAS POINTS o participaciones." />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {sorted.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setOpenId(s.id)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                  s.kind === 'corte' ? 'bg-mostaza-50 border-mostaza-300 text-tinta-900 hover:border-mostaza-500' : 'bg-surface border-tinta-200 text-tinta-700 hover:border-tinta-400'
                }`}
              >
                {s.kind === 'corte' ? `★ ${snapshotTitle(s)} · ${s.date}` : snapshotTitle(s)} · 1.º {s.rows[0]?.gt ?? '—'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <Modal
          title={snapshotTitle(open)}
          subtitle={open.kind === 'corte' ? `Guardado el ${open.date}${open.createdBy ? ` por ${open.createdBy}` : ''}` : 'Ranking al final de ese día'}
          onClose={() => setOpenId(null)}
          size="lg"
          footer={
            isAdmin && open.kind === 'corte' ? (
              <button
                className={btnSecondary}
                disabled={busy}
                onClick={() => run(async () => (await attempt(() => api.deleteRankingCut(open.id), 'Corte borrado')) && setOpenId(null))}
              >
                <Trash2 className="w-4 h-4" /> Borrar este corte
              </button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold text-tinta-500 uppercase tracking-wide border-b border-tinta-200">
                  <th className="text-left px-2 py-2">Puesto</th>
                  <th className="text-left px-2 py-2">GT</th>
                  <th className="text-right px-2 py-2">Puntaje</th>
                  <th className="text-right px-2 py-2">Promedio</th>
                  <th className="text-right px-2 py-2">Participación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tinta-100">
                {open.rows.map((r) => (
                  <tr key={r.gt}>
                    <td className="px-2 py-2 tabular-nums font-semibold">{r.position}</td>
                    <td className="px-2 py-2 font-medium text-tinta-900">{r.gt}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-bold">{formatPoints(r.score)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatPoints(r.avgPoints)} pts</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatPoints(r.participation)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </Card>
  );
};

// ----------------------------------------------------------------------------
// Configuración (administración): qué cuenta para el ranking
// ----------------------------------------------------------------------------
const NOT_LEAGUE_DAYS = new Set(['the_show', 'the_zone', 'carnival', 'the_challenge_games', 'the_games']);

export const RankingConfigPanel: React.FC = () => {
  const settings = useCollection(leagueSettings.subscribe);
  const custom = useCollection(customEventTypes.subscribe);
  const events = useCollection(calendarEvents.subscribe);
  const closures = useCollection(conectadosClosures.subscribe);
  const acts = useCollection(pointActivities.subscribe);
  const saved = normalizeRankingConfig(settings.find((s) => s.id === 'default')?.rankingConfig);
  const [cfg, setCfg] = useState<RankingConfig>(saved);
  const [dirty, setDirty] = useState(false);
  const [busy, run] = useBusy();
  useEffect(() => {
    if (!dirty) setCfg(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(saved)]);
  const set = (patch: Partial<RankingConfig>) => {
    setDirty(true);
    setCfg((c) => ({ ...c, ...patch }));
  };

  const typeOptions = [
    ...BUILTIN_EVENT_TYPES.map((t) => ({ id: t as string, label: eventTypeName(t) + (NOT_LEAGUE_DAYS.has(t) ? ' (día del evento)' : '') })),
    ...custom.map((t) => ({ id: t.id, label: t.name })),
  ];

  // Lo que hoy cuenta (o contaría), para poder excluir algo puntual
  const today = todayIso();
  const closedIds = new Set(closures.filter((c) => c.status === 'cerrado').map((c) => c.eventId));
  const candidates = [
    ...events
      .filter((e) => closedIds.has(e.id) && e.status === 'activo' && cfg.countedTypes.includes(e.type))
      .map((e) => ({ id: e.id, name: e.title, date: e.date, kind: eventTypeName(e.type) })),
    ...(cfg.includeQrActivities
      ? acts.filter((a) => a.status === 'cerrada' || a.date < today).map((a) => ({ id: a.id, name: a.name, date: a.date, kind: 'Actividad con QR' }))
      : []),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card className="p-5 sm:p-6 space-y-5 max-w-3xl">
      <div>
        <h2 className="text-lg font-display text-tinta-900 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-lila-600" /> Qué cuenta para el ranking
        </h2>
        <p className="text-sm text-tinta-600 mt-1">
          La participación se mide en los eventos con la asistencia cerrada de los tipos que marques aquí y, si lo activas, en las actividades
          de DÍAS POINTS por QR ya terminadas. Los cambios recalculan el ranking al instante.
        </p>
      </div>
      <Field label="Tipos de evento que cuentan para la participación">
        <CheckList options={typeOptions} selected={cfg.countedTypes} onChange={(v) => set({ countedTypes: v })} />
      </Field>
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" className="accent-lila-600 w-5 h-5 mt-0.5" checked={cfg.includeQrActivities} onChange={(e) => set({ includeQrActivities: e.target.checked })} />
        <span>
          <span className="block text-sm font-semibold text-tinta-900">Contar las actividades de DÍAS POINTS por QR</span>
          <span className="block text-xs text-tinta-600">Participó quien escaneó (o a quien le escanearon su QR personal). Cuentan cuando se cierran o pasa su fecha.</span>
        </span>
      </label>
      <Field label="Puntos que entran al promedio por integrante">
        <div className="grid sm:grid-cols-2 gap-2">
          {(
            [
              ['todos', 'Todos los DÍAS POINTS', 'Los de cada integrante + los entregados al GT completo (retos, Conectados).'],
              ['individuales', 'Solo los individuales', 'Solo los puntos que recibió cada integrante.'],
            ] as const
          ).map(([id, title, text]) => (
            <label
              key={id}
              className={`rounded-2xl border p-3 cursor-pointer transition-colors ${cfg.pointsBase === id ? 'border-lila-400 bg-lila-50' : 'border-tinta-200 hover:border-tinta-400'}`}
            >
              <input type="radio" name="pointsBase" className="sr-only" checked={cfg.pointsBase === id} onChange={() => set({ pointsBase: id })} />
              <span className="block text-sm font-semibold text-tinta-900">{title}</span>
              <span className="block text-xs text-tinta-600 mt-0.5">{text}</span>
            </label>
          ))}
        </div>
      </Field>
      {candidates.length > 0 && (
        <Field label="Actividades que cuentan" hint="Desmarca una para sacarla del ranking sin cambiar su tipo">
          <ul className="max-h-64 overflow-y-auto rounded-2xl border border-tinta-200 divide-y divide-tinta-100">
            {candidates.map((c) => {
              const on = !cfg.excludedIds.includes(c.id);
              return (
                <li key={c.id}>
                  <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-tinta-50">
                    <input
                      type="checkbox"
                      className="accent-lila-600 w-4 h-4"
                      checked={on}
                      onChange={() => set({ excludedIds: on ? [...cfg.excludedIds, c.id] : cfg.excludedIds.filter((x) => x !== c.id) })}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-tinta-900 truncate">{c.name}</span>
                      <span className="block text-[11px] text-tinta-500">
                        {c.kind} · {c.date}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Field>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={btnPrimary}
          disabled={busy || !dirty}
          onClick={() => run(async () => (await attempt(() => api.saveRankingConfig(cfg), 'Configuración del ranking guardada')) && setDirty(false))}
        >
          Guardar
        </button>
        <button className={btnSecondary} disabled={busy} onClick={() => set({ ...DEFAULT_RANKING_CONFIG })}>
          Volver a lo recomendado
        </button>
        {dirty && <span className="text-xs text-tinta-500 flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Cambios sin guardar</span>}
      </div>
    </Card>
  );
};

export const MyGtRankCard: React.FC<{ gt?: string; ranking: LeagueRanking | null }> = ({ gt, ranking }) => {
  const row = ranking?.rows.find((r) => r.gt === gt);
  return (
    <div className="bg-surface border border-tinta-200 rounded-3xl p-5">
      <p className="text-[10px] font-subtitle text-tinta-600">Mi GT</p>
      {!gt ? (
        <p className="text-sm text-tinta-600 mt-2">No perteneces a un GT de la liga.</p>
      ) : !row ? (
        <p className="text-sm text-tinta-600 mt-2">{gt}</p>
      ) : (
        <>
          <p className="text-2xl font-display text-tinta-900 mt-2">{gt}</p>
          <p className="text-sm text-tinta-600 mt-1">
            Puesto <b className="text-tinta-900">{row.position}</b> de {ranking!.rows.length} ·{' '}
            <b className="text-tinta-900 tabular-nums">{formatPoints(row.score)}</b> de 100
          </p>
          <p className="text-[11px] text-tinta-500 mt-1 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {formatPoints(row.avgPoints)} pts por integrante · {formatPoints(row.participation)}% de participación
          </p>
        </>
      )}
    </div>
  );
};
