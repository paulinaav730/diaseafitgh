import React, { useMemo, useState } from 'react';
import { Ban, Link2, Pencil, Plus, ScrollText, Search } from 'lucide-react';
import { LEAGUE_GTS, Person, PointCategory, PointMovement, POINT_CATEGORY_LABELS } from '../types';
import { challenges, pointActivities, pointMovements } from '../services/leagueService';
import { calendarEvents, todayIso } from '../services/calendarService';
import { api, errorMessage } from '../services/leagueApi';
import { btnDanger, btnPrimary, btnSecondary, Card, EmptyState, Field, formatPoints, inputCls, Modal, Segmented, useCollection } from './league/ui';
import { notify, useBusy } from './league/toast';

export const LeagueMovements: React.FC<{ people: Person[]; author: string }> = ({ people }) => {
  const movements = useCollection(pointMovements.subscribe);
  const [target, setTarget] = useState<'all' | 'gt' | 'person'>('all');
  const [gt, setGt] = useState('');
  const [category, setCategory] = useState<'' | PointCategory>('');
  const [showVoided, setShowVoided] = useState(true);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ m: PointMovement; mode: 'corregir' | 'anular' } | null>(null);
  const [limit, setLimit] = useState(100);

  const nameOf = (id?: string) => (id ? people.find((p) => p.id === id)?.name ?? 'Persona eliminada' : '');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements
      .filter((m) => target === 'all' || m.target === target)
      .filter((m) => !gt || m.gt === gt)
      .filter((m) => !category || m.category === category)
      .filter((m) => showVoided || !m.voided)
      .filter((m) => !q || m.activityName.toLowerCase().includes(q) || (m.reason || '').toLowerCase().includes(q) || nameOf(m.personId).toLowerCase().includes(q))
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
          <Plus className="w-4 h-4" /> Asignar DÍAS POINTS
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
                  <MovementRow key={m.id} m={m} recipient={m.target === 'gt' ? `GT ${m.gt}` : nameOf(m.personId)} onEdit={(mode) => setEditing({ m, mode })} />
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

      {adding && <AssignPointsModal people={people} onClose={() => setAdding(false)} />}
      {editing && (
        <EditMovementModal
          movement={editing.m}
          mode={editing.mode}
          label={editing.m.target === 'gt' ? `GT ${editing.m.gt}` : nameOf(editing.m.personId)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export const MovementRow: React.FC<{ m: PointMovement; recipient: string; onEdit?: (mode: 'corregir' | 'anular') => void }> = ({ m, recipient, onEdit }) => (
  <tr className={m.voided ? 'opacity-55' : ''}>
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
      {recipient}
      {m.target === 'person' && m.gt && <span className="text-tinta-500"> · {m.gt}</span>}
    </td>
    <td className="px-2 py-2.5 text-tinta-600">{POINT_CATEGORY_LABELS[m.category] ?? m.category}</td>
    <td className={`px-2 py-2.5 text-right tabular-nums font-bold ${m.voided ? 'line-through' : ''} ${m.points < 0 ? 'text-coral-700' : 'text-tinta-900'}`}>
      {m.points > 0 ? '+' : ''}
      {formatPoints(m.points)}
      {m.previousPoints !== undefined && (
        <span className="block text-[10px] font-semibold text-mostaza-700 no-underline">antes {formatPoints(m.previousPoints)}</span>
      )}
    </td>
    <td className="px-2 py-2.5 text-xs text-tinta-600 max-w-[260px]">
      {m.reason}
      {m.observation && <span className="block text-tinta-500">Obs.: {m.observation}</span>}
      {m.voided && (
        <span className="block text-coral-700 font-semibold">
          Anulado por {m.voidedBy}: {m.voidReason}
        </span>
      )}
    </td>
    <td className="px-2 py-2.5 text-xs text-tinta-500 whitespace-nowrap">
      {m.registeredBy}
      <span className="block">{new Date(m.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' })}</span>
    </td>
    <td className="px-4 py-2.5 text-right whitespace-nowrap">
      {!m.voided && onEdit && (
        <span className="inline-flex gap-3">
          <button onClick={() => onEdit('corregir')} className="inline-flex items-center gap-1 text-xs font-semibold text-lila-700 hover:underline">
            <Pencil className="w-3.5 h-3.5" /> Corregir
          </button>
          <button onClick={() => onEdit('anular')} className="inline-flex items-center gap-1 text-xs font-semibold text-coral-700 hover:underline">
            <Ban className="w-3.5 h-3.5" /> Anular
          </button>
        </span>
      )}
    </td>
  </tr>
);

/**
 * ASIGNAR DÍAS POINTS: a un GT o a una persona (opcionalmente ya elegida, desde su perfil).
 * Negativo para restar. Queda quién, cuándo, la actividad, el motivo y la observación.
 */
export const AssignPointsModal: React.FC<{ people: Person[]; person?: Person; onClose: () => void }> = ({ people, person: fixedPerson, onClose }) => {
  const [target, setTarget] = useState<'gt' | 'person'>(fixedPerson ? 'person' : 'gt');
  const [gt, setGt] = useState<string>(LEAGUE_GTS[0]);
  const [person, setPerson] = useState<Person | null>(fixedPerson ?? null);
  const [query, setQuery] = useState('');
  const [points, setPoints] = useState('10');
  const [activity, setActivity] = useState('');
  const [activityName, setActivityName] = useState('');
  const [reason, setReason] = useState('');
  const [observation, setObservation] = useState('');
  const [date, setDate] = useState(todayIso());
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [category, setCategory] = useState<'manual' | 'correccion'>('manual');
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();
  const retos = useCollection(challenges.subscribe);
  const acts = useCollection(pointActivities.subscribe);
  const events = useCollection(calendarEvents.subscribe);

  const activityOptions = useMemo(
    () => [
      ...retos.map((r) => ({ id: `reto:${r.id}`, label: `Reto · ${r.name}`, name: r.name })),
      ...acts.map((a) => ({ id: `act:${a.id}`, label: `Actividad · ${a.name}`, name: a.name })),
      ...events
        .filter((e) => e.status === 'activo')
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30)
        .map((e) => ({ id: `evt:${e.id}`, label: `Evento · ${e.title} (${e.date})`, name: e.title })),
    ],
    [retos, acts, events]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return people.filter((p) => p.name.toLowerCase().includes(q) || p.documentId.includes(q)).slice(0, 6);
  }, [query, people]);

  const submit = () => {
    const n = Number(points);
    if (!Number.isFinite(n) || n === 0) return setError('Los puntos deben ser un número distinto de cero.');
    if (target === 'person' && !person) return setError('Elige la persona.');
    const name = activity === 'otra' || !activity ? activityName.trim() : activityOptions.find((o) => o.id === activity)?.name ?? '';
    if (!name) return setError('Elige o escribe la actividad que genera los puntos.');
    if (!reason.trim()) return setError('El motivo es obligatorio.');
    setError(null);
    return run(async () => {
      try {
        await api.addPoints({
          target,
          gt,
          person: person ?? undefined,
          points: n,
          activityName: name,
          reason: reason.trim(),
          observation: observation.trim() || undefined,
          date,
          evidenceUrl: evidenceUrl.trim() || undefined,
          category,
        });
        notify.ok(`${n > 0 ? '+' : ''}${formatPoints(n)} DÍAS POINTS registrados`);
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });
  };

  return (
    <Modal
      title="Asignar DÍAS POINTS"
      subtitle={fixedPerson ? `${fixedPerson.name}. Usa puntos negativos para restar.` : 'Usa puntos negativos para restar. Queda registrado quién lo hizo y por qué.'}
      onClose={onClose}
      footer={
        <>
          {error && <span className="text-xs text-coral-700 self-center mr-auto">{error}</span>}
          <button className={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button className={btnPrimary} onClick={submit} disabled={busy}>
            {busy ? 'Registrando…' : 'Registrar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {!fixedPerson && (
          <Segmented
            value={target}
            onChange={setTarget}
            options={[
              { id: 'gt', label: 'A un GT' },
              { id: 'person', label: 'A una persona' },
            ]}
          />
        )}
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
            {!fixedPerson && (
              <button className="text-xs font-semibold text-lila-700 hover:underline" onClick={() => setPerson(null)}>
                Cambiar
              </button>
            )}
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
          <Field label="Actividad que genera los puntos" className="col-span-2">
            <select className={inputCls} value={activity} onChange={(e) => setActivity(e.target.value)}>
              <option value="">Elige una actividad…</option>
              {activityOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
              <option value="otra">Otra (escribir)</option>
            </select>
          </Field>
          {(activity === 'otra' || activity === '') && (
            <Field label="Nombre de la actividad" className="col-span-2">
              <input className={inputCls} value={activityName} onChange={(e) => setActivityName(e.target.value)} placeholder="Ej: Mejor decoración de stand" />
            </Field>
          )}
          <Field label="Motivo" className="col-span-2">
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label="Observación (opcional)" className="col-span-2">
            <input className={inputCls} value={observation} onChange={(e) => setObservation(e.target.value)} />
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

/** Corregir (nuevo valor) o anular un movimiento. Siempre con motivo; nada se borra. */
export const EditMovementModal: React.FC<{ movement: PointMovement; mode: 'corregir' | 'anular'; label: string; onClose: () => void }> = ({
  movement: m,
  mode,
  label,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const [value, setValue] = useState(String(m.points));
  const [busy, run] = useBusy();
  const correcting = mode === 'corregir';
  const save = () =>
    run(async () => {
      try {
        if (correcting) {
          await api.correctPoints(m.id, Number(value), reason.trim());
          notify.ok(`Corregido de ${formatPoints(m.points)} a ${formatPoints(Number(value))}`);
        } else {
          await api.voidPoints(m.id, reason.trim());
          notify.ok('Movimiento anulado');
        }
        onClose();
      } catch (e) {
        notify.error(e);
      }
    });
  return (
    <Modal
      title={correcting ? 'Corregir puntos' : 'Anular movimiento'}
      subtitle={
        correcting
          ? 'El movimiento original queda anulado y se crea uno nuevo con el valor anterior y el nuevo.'
          : 'El movimiento no se borra: queda en el historial marcado como anulado y deja de sumar.'
      }
      onClose={onClose}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose}>
            Volver
          </button>
          <button
            className={correcting ? btnPrimary : btnDanger}
            disabled={busy || !reason.trim() || (correcting && (!Number.isFinite(Number(value)) || Number(value) === m.points))}
            onClick={save}
          >
            {correcting ? 'Guardar corrección' : 'Anular'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-tinta-700">
          <b>{formatPoints(m.points)} pts</b> · {label} · {m.activityName} ({m.date})
        </p>
        {correcting && (
          <Field label="Valor nuevo" hint={`Valor anterior: ${formatPoints(m.points)}. Pon 0 para dejarlo sin puntos.`}>
            <input type="number" className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </Field>
        )}
        <Field label="Motivo (obligatorio)">
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus={!correcting} />
        </Field>
      </div>
    </Modal>
  );
};
