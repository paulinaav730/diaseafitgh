import React, { useMemo, useState } from 'react';
import { Ban, Link2, Plus, ScrollText, Search } from 'lucide-react';
import { LEAGUE_GTS, Person, PointCategory, PointMovement, POINT_CATEGORY_LABELS } from '../types';
import { addManualMovement, pointMovements, voidMovement } from '../services/leagueService';
import { todayIso } from '../services/calendarService';
import { btnDanger, btnPrimary, btnSecondary, Card, EmptyState, Field, formatPoints, inputCls, Modal, Segmented, useCollection } from './league/ui';

export const LeagueMovements: React.FC<{ people: Person[]; author: string }> = ({ people, author }) => {
  const movements = useCollection(pointMovements.subscribe);
  const [target, setTarget] = useState<'all' | 'gt' | 'person'>('all');
  const [gt, setGt] = useState('');
  const [category, setCategory] = useState<'' | PointCategory>('');
  const [showVoided, setShowVoided] = useState(true);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<PointMovement | null>(null);
  const [limit, setLimit] = useState(100);

  const nameOf = (id?: string) => (id ? people.find((p) => p.id === id)?.name ?? 'Persona eliminada' : '');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements
      .filter((m) => target === 'all' || m.target === target)
      .filter((m) => !gt || m.gt === gt)
      .filter((m) => !category || m.category === category)
      .filter((m) => showVoided || !m.voided)
      .filter(
        (m) =>
          !q ||
          m.activityName.toLowerCase().includes(q) ||
          (m.reason || '').toLowerCase().includes(q) ||
          nameOf(m.personId).toLowerCase().includes(q)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movements, target, gt, category, showVoided, query, people]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={target}
            onChange={setTarget}
            options={[
              { id: 'all', label: 'Todos' },
              { id: 'gt', label: 'GT' },
              { id: 'person', label: 'Personas' },
            ]}
          />
          <select className={`${inputCls} !w-auto !py-1.5 text-xs`} value={gt} onChange={(e) => setGt(e.target.value)} aria-label="GT">
            <option value="">Todos los GT</option>
            {LEAGUE_GTS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select className={`${inputCls} !w-auto !py-1.5 text-xs`} value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Tipo de puntuación">
            <option value="">Todos los tipos</option>
            {(Object.keys(POINT_CATEGORY_LABELS) as PointCategory[]).map((c) => (
              <option key={c} value={c}>
                {POINT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-4 h-4 text-tinta-400 absolute left-3 top-2" />
            <input className={`${inputCls} pl-9 !py-1.5 text-xs w-48`} placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-tinta-600 cursor-pointer">
            <input type="checkbox" className="accent-lila-600" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
            Ver anulados
          </label>
        </div>
        <button className={btnPrimary} onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4" /> Asignar puntos
        </button>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No hay movimientos con estos filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold text-tinta-500 uppercase tracking-wide border-b border-tinta-200">
                  <th className="text-left px-4 py-2.5">Fecha</th>
                  <th className="text-left px-2 py-2.5">Actividad</th>
                  <th className="text-left px-2 py-2.5">Recibe</th>
                  <th className="text-left px-2 py-2.5">Tipo</th>
                  <th className="text-right px-2 py-2.5">Puntos</th>
                  <th className="text-left px-2 py-2.5">Motivo</th>
                  <th className="text-left px-2 py-2.5">Registró</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-tinta-100">
                {rows.slice(0, limit).map((m) => (
                  <tr key={m.id} className={m.voided ? 'opacity-55' : ''}>
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-tinta-600">{m.date}</td>
                    <td className="px-2 py-2.5 font-semibold text-tinta-900">
                      {m.activityName}
                      {m.evidenceUrl && (
                        <a href={m.evidenceUrl} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex text-lila-700" title="Evidencia">
                          <Link2 className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-tinta-700">
                      {m.target === 'gt' ? (
                        <span>GT {m.gt}</span>
                      ) : (
                        <span>
                          {nameOf(m.personId)}
                          {m.gt && <span className="text-tinta-500"> · {m.gt}</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-tinta-600">{POINT_CATEGORY_LABELS[m.category]}</td>
                    <td className={`px-2 py-2.5 text-right tabular-nums font-bold ${m.voided ? 'line-through' : ''} ${m.points < 0 ? 'text-coral-700' : 'text-tinta-900'}`}>
                      {m.points > 0 ? '+' : ''}
                      {formatPoints(m.points)}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-tinta-600 max-w-[260px]">
                      {m.reason}
                      {m.voided && (
                        <span className="block text-coral-700 font-semibold">
                          Anulado por {m.voidedBy}: {m.voidReason}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-tinta-500 whitespace-nowrap">
                      {m.registeredBy}
                      <span className="block">{new Date(m.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!m.voided && (
                        <button onClick={() => setVoiding(m)} className="inline-flex items-center gap-1 text-xs font-semibold text-coral-700 hover:underline">
                          <Ban className="w-3.5 h-3.5" /> Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > limit && (
              <div className="p-3 text-center border-t border-tinta-200">
                <button className="text-xs font-semibold text-lila-700 hover:underline" onClick={() => setLimit(limit + 100)}>
                  Ver más ({rows.length - limit} restantes)
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      {adding && <ManualPointsForm people={people} author={author} onClose={() => setAdding(false)} />}
      {voiding && <VoidForm movement={voiding} author={author} label={voiding.target === 'gt' ? `GT ${voiding.gt}` : nameOf(voiding.personId)} onClose={() => setVoiding(null)} />}
    </div>
  );
};

const ManualPointsForm: React.FC<{ people: Person[]; author: string; onClose: () => void }> = ({ people, author, onClose }) => {
  const [target, setTarget] = useState<'gt' | 'person'>('gt');
  const [gt, setGt] = useState<string>(LEAGUE_GTS[0]);
  const [person, setPerson] = useState<Person | null>(null);
  const [query, setQuery] = useState('');
  const [points, setPoints] = useState('10');
  const [activityName, setActivityName] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(todayIso());
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [category, setCategory] = useState<'manual' | 'correccion'>('manual');
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return people.filter((p) => p.name.toLowerCase().includes(q) || p.documentId.includes(q)).slice(0, 6);
  }, [query, people]);

  const submit = () => {
    const n = Number(points);
    if (!Number.isFinite(n) || n === 0) return setError('Los puntos deben ser un número distinto de cero.');
    if (target === 'person' && !person) return setError('Elige la persona.');
    if (!activityName.trim()) return setError('Escribe la actividad.');
    if (!reason.trim()) return setError('El motivo es obligatorio.');
    addManualMovement({
      target,
      gt,
      person: person ?? undefined,
      points: n,
      activityName: activityName.trim(),
      reason: reason.trim(),
      date,
      evidenceUrl: evidenceUrl.trim(),
      category,
      author,
    });
    onClose();
  };

  return (
    <Modal
      title="Asignar DÍAS POINTS"
      subtitle="Usa puntos negativos para descontar. Queda registrado quién lo hizo y por qué."
      onClose={onClose}
      footer={
        <>
          {error && <span className="text-xs text-coral-700 self-center mr-auto">{error}</span>}
          <button className={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button className={btnPrimary} onClick={submit}>
            Registrar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={target}
          onChange={setTarget}
          options={[
            { id: 'gt', label: 'A un GT' },
            { id: 'person', label: 'A una persona' },
          ]}
        />
        {target === 'gt' ? (
          <Field label="GT">
            <select className={inputCls} value={gt} onChange={(e) => setGt(e.target.value)}>
              {LEAGUE_GTS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
        ) : person ? (
          <div className="flex items-center justify-between rounded-xl bg-tinta-50 border border-tinta-200 px-3 py-2">
            <span className="text-sm font-semibold">
              {person.name} <span className="text-tinta-500 font-normal">· {person.gtSubTeam || person.primaryType}</span>
            </span>
            <button className="text-xs font-semibold text-lila-700 hover:underline" onClick={() => setPerson(null)}>
              Cambiar
            </button>
          </div>
        ) : (
          <Field label="Persona">
            <div className="relative">
              <input className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o cédula" autoFocus />
              {matches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-surface border border-tinta-200 rounded-xl shadow-lg overflow-hidden">
                  {matches.map((p) => (
                    <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-tinta-50" onClick={() => setPerson(p)}>
                      {p.name} <span className="text-xs text-tinta-500">· {p.gtSubTeam || p.primaryType}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Puntos">
            <input type="number" className={inputCls} value={points} onChange={(e) => setPoints(e.target.value)} />
          </Field>
          <Field label="Tipo">
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              <option value="manual">Puntos manuales</option>
              <option value="correccion">Corrección</option>
            </select>
          </Field>
          <Field label="Actividad" className="col-span-2">
            <input className={inputCls} value={activityName} onChange={(e) => setActivityName(e.target.value)} placeholder="Ej: Mejor decoración de stand" />
          </Field>
          <Field label="Motivo" className="col-span-2">
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label="Fecha">
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Evidencia (enlace)">
            <input className={inputCls} value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://…" />
          </Field>
        </div>
      </div>
    </Modal>
  );
};

const VoidForm: React.FC<{ movement: PointMovement; author: string; label: string; onClose: () => void }> = ({
  movement: m,
  author,
  label,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  return (
    <Modal
      title="Anular movimiento"
      subtitle="El movimiento no se borra: queda en el historial marcado como anulado y deja de sumar."
      onClose={onClose}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>
            Volver
          </button>
          <button
            className={btnDanger}
            disabled={!reason.trim()}
            onClick={() => {
              voidMovement(m.id, author, reason.trim());
              onClose();
            }}
          >
            Anular
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-tinta-700">
          <b>{formatPoints(m.points)} pts</b> · {label} · {m.activityName} ({m.date})
        </p>
        <Field label="Motivo de la anulación (obligatorio)">
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
      </div>
    </Modal>
  );
};
