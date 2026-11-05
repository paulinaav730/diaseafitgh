import React, { useMemo, useState } from 'react';
import { Link2, Plus, Search, Swords, Trash2, Trophy, Edit3, X } from 'lucide-react';
import {
  Challenge,
  ChallengeEvidence,
  ChallengeResult,
  ChallengeStatus,
  IndividualAward,
  LEAGUE_GTS,
  Person,
} from '../types';
import { challenges as challengesCol, registerChallengeResults, saveChallenge } from '../services/leagueService';
import { todayIso } from '../services/calendarService';
import { btnPrimary, btnSecondary, Card, CheckList, EmptyState, Field, formatPoints, inputCls, Modal, useCollection } from './league/ui';

const STATUS_LABELS: Record<ChallengeStatus, string> = {
  pendiente: 'Pendiente',
  activo: 'Activo',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};
const STATUS_STYLES: Record<ChallengeStatus, string> = {
  pendiente: 'bg-tinta-100 text-tinta-700',
  activo: 'bg-turquesa-100 text-turquesa-800',
  finalizado: 'bg-lila-100 text-lila-800',
  cancelado: 'bg-coral-100 text-coral-800',
};

export const LeagueChallenges: React.FC<{ people: Person[]; author: string }> = ({ people, author }) => {
  const list = useCollection(challengesCol.subscribe);
  const [editing, setEditing] = useState<Challenge | 'new' | null>(null);
  const [resultsFor, setResultsFor] = useState<Challenge | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ChallengeStatus>('all');

  const sorted = useMemo(
    () =>
      list
        .filter((c) => statusFilter === 'all' || c.status === statusFilter)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [list, statusFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select className={`${inputCls} !w-auto !py-1.5 text-xs`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filtrar por estado">
          <option value="all">Todos los estados</option>
          {(Object.keys(STATUS_LABELS) as ChallengeStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button className={btnPrimary} onClick={() => setEditing('new')}>
          <Plus className="w-4 h-4" /> Nuevo reto
        </button>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <EmptyState icon={Swords} title="Aún no hay retos" text="Crea un reto, define los GT participantes y los puntos por puesto." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map((c) => (
            <Card key={c.id} className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-tinta-900">{c.name}</h3>
                  <p className="text-[11px] text-tinta-500 mt-0.5">
                    {c.startDate} → {c.endDate} · {c.gtTeams.length === LEAGUE_GTS.length ? 'Todos los GT' : c.gtTeams.join(', ')}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${STATUS_STYLES[c.status]}`}>
                  {STATUS_LABELS[c.status]}
                </span>
              </div>
              {c.description && <p className="text-sm text-tinta-600 line-clamp-2">{c.description}</p>}
              {c.placements.length > 0 && (
                <p className="text-xs text-tinta-600">
                  {c.placements
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((p) => `${p.position}.º ${formatPoints(p.points)}`)
                    .join(' · ')}{' '}
                  pts
                </p>
              )}
              {c.resultsRegisteredAt && (
                <div className="rounded-2xl bg-tinta-50 border border-tinta-200 p-3">
                  <p className="text-[11px] font-semibold text-tinta-500 uppercase tracking-wide mb-1.5">Resultados</p>
                  <ul className="text-sm space-y-0.5">
                    {[...c.results]
                      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99) || b.points - a.points)
                      .map((r) => (
                        <li key={r.gt} className="flex justify-between">
                          <span>
                            {r.position ? `${r.position}.º ` : ''}
                            {r.gt}
                          </span>
                          <span className="tabular-nums font-semibold">{formatPoints(r.points)}</span>
                        </li>
                      ))}
                  </ul>
                  {c.individualAwards.length > 0 && (
                    <p className="text-[11px] text-tinta-500 mt-1.5">
                      + {c.individualAwards.length} reconocimiento{c.individualAwards.length === 1 ? '' : 's'} individual
                      {c.individualAwards.length === 1 ? '' : 'es'}
                    </p>
                  )}
                </div>
              )}
              {c.evidences.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {c.evidences.map((ev, i) => (
                    <a key={i} href={ev.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-lila-700 hover:underline">
                      <Link2 className="w-3.5 h-3.5" /> {ev.name || 'Evidencia'}
                    </a>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-auto pt-1">
                <button className={btnSecondary} onClick={() => setEditing(c)}>
                  <Edit3 className="w-4 h-4" /> Editar
                </button>
                {c.status !== 'cancelado' && (
                  <button className={btnPrimary} onClick={() => setResultsFor(c)}>
                    <Trophy className="w-4 h-4" /> {c.resultsRegisteredAt ? 'Corregir resultados' : 'Registrar resultados'}
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <ChallengeForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {resultsFor && <ResultsForm challenge={resultsFor} people={people} author={author} onClose={() => setResultsFor(null)} />}
    </div>
  );
};

// ----------------------------------------------------------------------------

const ChallengeForm: React.FC<{ initial?: Challenge; onClose: () => void }> = ({ initial, onClose }) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [rules, setRules] = useState(initial?.rules ?? '');
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayIso());
  const [endDate, setEndDate] = useState(initial?.endDate ?? todayIso());
  const [gtTeams, setGtTeams] = useState<string[]>(initial?.gtTeams ?? [...LEAGUE_GTS]);
  const [placements, setPlacements] = useState(
    initial?.placements ?? [
      { position: 1, points: 100 },
      { position: 2, points: 70 },
      { position: 3, points: 50 },
    ]
  );
  const [status, setStatus] = useState<ChallengeStatus>(initial?.status ?? 'pendiente');
  const [evidences, setEvidences] = useState<ChallengeEvidence[]>(initial?.evidences ?? []);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) return setError('Escribe el nombre del reto.');
    if (endDate < startDate) return setError('La fecha de finalización no puede ser anterior al inicio.');
    if (gtTeams.length === 0) return setError('Elige al menos un GT participante.');
    saveChallenge({
      id: initial?.id,
      name: name.trim(),
      description: description.trim() || undefined,
      rules: rules.trim() || undefined,
      startDate,
      endDate,
      gtTeams,
      placements: placements.filter((p) => p.position > 0).map((p, i) => ({ position: i + 1, points: p.points })),
      status,
      evidences: evidences.filter((e) => e.url.trim()),
    });
    onClose();
  };

  return (
    <Modal
      title={initial ? 'Editar reto' : 'Nuevo reto'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {error && <span className="text-xs text-coral-700 self-center mr-auto">{error}</span>}
          <button className={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button className={btnPrimary} onClick={submit}>
            Guardar reto
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre" className="sm:col-span-2">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Competencia de integración" autoFocus />
        </Field>
        <Field label="Descripción" className="sm:col-span-2">
          <textarea className={`${inputCls} min-h-[60px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Reglas" className="sm:col-span-2">
          <textarea className={`${inputCls} min-h-[60px]`} value={rules} onChange={(e) => setRules(e.target.value)} />
        </Field>
        <Field label="Inicio">
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Finalización">
          <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Field label="Estado">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ChallengeStatus)}>
            {(Object.keys(STATUS_LABELS) as ChallengeStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-tinta-700">GT participantes</span>
            <button
              type="button"
              className="text-[11px] font-semibold text-lila-700 hover:underline"
              onClick={() => setGtTeams(gtTeams.length === LEAGUE_GTS.length ? [] : [...LEAGUE_GTS])}
            >
              {gtTeams.length === LEAGUE_GTS.length ? 'Quitar todos' : 'Todos'}
            </button>
          </div>
          <CheckList options={LEAGUE_GTS.map((g) => ({ id: g as string, label: g }))} selected={gtTeams} onChange={setGtTeams} />
        </div>

        <div className="sm:col-span-2 rounded-2xl border border-tinta-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-tinta-700">Puntos por puesto (opcional)</p>
          <p className="text-[11px] text-tinta-500">
            Al registrar resultados se sugieren estos puntos según el puesto; siempre puedes ajustarlos o entregar puntos sin puestos.
          </p>
          {placements.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-12 text-sm font-semibold text-tinta-700">{i + 1}.º</span>
              <input
                type="number"
                className={`${inputCls} !w-32`}
                value={p.points}
                onChange={(e) => setPlacements(placements.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x)))}
                aria-label={`Puntos puesto ${i + 1}`}
              />
              <span className="text-xs text-tinta-500">pts</span>
              <button type="button" onClick={() => setPlacements(placements.filter((_, j) => j !== i))} className="p-1.5 rounded-lg hover:bg-tinta-100 text-tinta-500" aria-label="Quitar puesto">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" className="text-xs font-semibold text-lila-700 hover:underline" onClick={() => setPlacements([...placements, { position: placements.length + 1, points: 0 }])}>
            + Agregar puesto
          </button>
        </div>

        <div className="sm:col-span-2 rounded-2xl border border-tinta-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-tinta-700">Evidencias o archivos</p>
          <p className="text-[11px] text-tinta-500">Pega el enlace (Drive, fotos, formulario…).</p>
          {evidences.map((ev, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${inputCls} !w-40`} placeholder="Nombre" value={ev.name} onChange={(e) => setEvidences(evidences.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className={inputCls} placeholder="https://…" value={ev.url} onChange={(e) => setEvidences(evidences.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <button type="button" onClick={() => setEvidences(evidences.filter((_, j) => j !== i))} className="p-1.5 rounded-lg hover:bg-tinta-100 text-tinta-500" aria-label="Quitar evidencia">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" className="text-xs font-semibold text-lila-700 hover:underline" onClick={() => setEvidences([...evidences, { name: '', url: '' }])}>
            + Agregar evidencia
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ----------------------------------------------------------------------------

const ResultsForm: React.FC<{ challenge: Challenge; people: Person[]; author: string; onClose: () => void }> = ({
  challenge: c,
  people,
  author,
  onClose,
}) => {
  const pointsFor = (pos?: number) => c.placements.find((p) => p.position === pos)?.points ?? 0;
  const [rows, setRows] = useState<ChallengeResult[]>(() =>
    c.gtTeams.map((gt) => c.results.find((r) => r.gt === gt) ?? { gt, points: 0 })
  );
  const [awards, setAwards] = useState<IndividualAward[]>(c.individualAwards);
  const [date, setDate] = useState(c.endDate <= todayIso() ? c.endDate : todayIso());
  const [query, setQuery] = useState('');
  const maxPos = Math.max(c.placements.length, 3);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return people
      .filter((p) => !awards.some((a) => a.personId === p.id))
      .filter((p) => p.name.toLowerCase().includes(q) || p.documentId.includes(q))
      .slice(0, 6);
  }, [query, people, awards]);

  const total = rows.reduce((a, r) => a + (r.points || 0), 0);

  return (
    <Modal
      title={`Resultados: ${c.name}`}
      subtitle={c.resultsRegisteredAt ? 'Ya tenía resultados: los puntos anteriores se anularán (quedan en el historial) y se registrarán estos.' : undefined}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <span className="text-xs text-tinta-500 self-center mr-auto">
            {formatPoints(total)} pts a GT · {awards.length} individuales
          </span>
          <button className={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button
            className={btnPrimary}
            onClick={() => {
              registerChallengeResults(
                c.id,
                rows.map((r) => ({ ...r, points: Number(r.points) || 0 })),
                awards.filter((a) => a.points),
                people,
                author,
                date
              );
              onClose();
            }}
          >
            Registrar puntos
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Fecha de la actividad" className="max-w-xs">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div>
          <p className="text-xs font-semibold text-tinta-700 mb-2">Puntos por GT</p>
          <div className="divide-y divide-tinta-100 border border-tinta-200 rounded-2xl">
            {rows.map((r, i) => (
              <div key={r.gt} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 text-sm font-semibold text-tinta-900">{r.gt}</span>
                <select
                  className={`${inputCls} !w-28 !py-1.5 text-xs`}
                  value={r.position ?? ''}
                  onChange={(e) => {
                    const pos = e.target.value ? Number(e.target.value) : undefined;
                    setRows(rows.map((x, j) => (j === i ? { ...x, position: pos, points: pos ? pointsFor(pos) : x.points } : x)));
                  }}
                  aria-label={`Puesto de ${r.gt}`}
                >
                  <option value="">Sin puesto</option>
                  {Array.from({ length: maxPos }, (_, k) => k + 1).map((p) => (
                    <option key={p} value={p}>
                      {p}.º puesto
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className={`${inputCls} !w-24 !py-1.5 text-right`}
                  value={r.points}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x)))}
                  aria-label={`Puntos de ${r.gt}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-tinta-700 mb-2">Puntos individuales (opcional)</p>
          <div className="relative">
            <Search className="w-4 h-4 text-tinta-400 absolute left-3 top-2.5" />
            <input className={`${inputCls} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar persona para reconocer" />
            {matches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-surface border border-tinta-200 rounded-xl shadow-lg overflow-hidden">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-tinta-50"
                    onClick={() => {
                      setAwards([...awards, { personId: p.id, points: 10 }]);
                      setQuery('');
                    }}
                  >
                    {p.name} <span className="text-xs text-tinta-500">· {p.gtSubTeam || p.primaryType}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {awards.length > 0 && (
            <div className="mt-2 divide-y divide-tinta-100 border border-tinta-200 rounded-2xl">
              {awards.map((a, i) => (
                <div key={a.personId} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="flex-1 min-w-[140px] text-sm font-semibold">{people.find((p) => p.id === a.personId)?.name ?? a.personId}</span>
                  <input
                    className={`${inputCls} !w-48 !py-1.5 text-xs`}
                    placeholder="Motivo"
                    value={a.reason ?? ''}
                    onChange={(e) => setAwards(awards.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))}
                  />
                  <input
                    type="number"
                    className={`${inputCls} !w-20 !py-1.5 text-right`}
                    value={a.points}
                    onChange={(e) => setAwards(awards.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x)))}
                    aria-label="Puntos"
                  />
                  <button onClick={() => setAwards(awards.filter((_, j) => j !== i))} className="p-1.5 rounded-lg hover:bg-tinta-100 text-tinta-500" aria-label="Quitar">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
