import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  CalendarAudience,
  CalendarEvent,
  CalendarEventType,
  CALENDAR_EVENT_TYPES,
  CALENDAR_EVENT_TYPE_LABELS,
  ConectadosScoring,
  LEAGUE_GTS,
  Person,
  TrainingMode,
} from '../types';
import { EMPTY_AUDIENCE, isPersonInAudience, personGts, saveCalendarEvent, todayIso } from '../services/calendarService';
import { getClosure, getDefaultScoring } from '../services/leagueService';
import { btnPrimary, btnSecondary, CheckList, Field, inputCls, Modal } from './league/ui';

interface Props {
  initial?: CalendarEvent;
  defaultDate?: string;
  people: Person[];
  author: string;
  onClose: () => void;
  onSaved: (ev: CalendarEvent) => void;
}

export const EventFormModal: React.FC<Props> = ({ initial, defaultDate, people, author, onClose, onSaved }) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? todayIso());
  const [startTime, setStartTime] = useState(initial?.startTime ?? '18:00');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '19:30');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [type, setType] = useState<CalendarEventType>(initial?.type ?? 'conectados');
  const [trainingMode, setTrainingMode] = useState<TrainingMode>(initial?.trainingMode ?? 'invitacion');
  const [audience, setAudience] = useState<CalendarAudience>(initial?.audience ?? EMPTY_AUDIENCE);
  const [scoring, setScoring] = useState<ConectadosScoring>(initial?.scoring ?? getDefaultScoring());
  const [personQuery, setPersonQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isClosed = !!(initial && getClosure(initial.id));
  const isTraining = type === 'capacitacion';
  const byInvitation = isTraining && trainingMode === 'invitacion';
  const isOpenTraining = isTraining && trainingMode === 'abierta';
  /** Destinatarios efectivos según el tipo */
  const effectiveAudience: CalendarAudience = isOpenTraining
    ? { ...EMPTY_AUDIENCE, all: true }
    : byInvitation
    ? { ...EMPTY_AUDIENCE, all: false, personIds: audience.personIds }
    : audience.all
    ? { ...EMPTY_AUDIENCE, all: true }
    : audience;
  const invitedCount = useMemo(
    () => people.filter((p) => p.isActive !== false && isPersonInAudience(p, effectiveAudience)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, JSON.stringify(effectiveAudience)]
  );
  const activePeople = useMemo(() => people.filter((p) => p.isActive !== false), [people]);
  const addPeople = (ids: string[]) => setA({ personIds: [...new Set([...audience.personIds, ...ids])] });
  const personResults = useMemo(() => {
    const q = personQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return people
      .filter((p) => !audience.personIds.includes(p.id))
      .filter((p) => p.name.toLowerCase().includes(q) || p.documentId.includes(q) || (p.username || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [personQuery, people, audience.personIds]);

  const setA = (patch: Partial<CalendarAudience>) => setAudience((a) => ({ ...a, ...patch }));

  const submit = () => {
    if (!title.trim()) return setError('Escribe el nombre del evento.');
    if (!date) return setError('Elige la fecha.');
    if (!startTime || !endTime || endTime <= startTime) return setError('La hora de finalización debe ser posterior a la de inicio.');
    const a = effectiveAudience;
    if (byInvitation && a.personIds.length === 0) return setError('Agrega al menos una persona a la capacitación.');
    if (!a.all && !a.gtTeams.length && !a.includeGap && !a.includeMesa && !a.personIds.length) {
      return setError('Elige al menos un grupo destinatario.');
    }
    if (type === 'conectados' && !(scoring.maxGtPoints >= 0)) return setError('Los puntos máximos deben ser un número válido.');
    const ev = saveCalendarEvent(
      {
        id: initial?.id,
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        startTime,
        endTime,
        location: location.trim() || undefined,
        type,
        trainingMode: isTraining ? trainingMode : undefined,
        audience: a,
        status: initial?.status ?? 'activo',
        scoring: type === 'conectados' ? scoring : undefined,
      },
      author
    );
    onSaved(ev);
  };

  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <Modal
      title={initial ? 'Editar evento' : 'Nuevo evento'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {error && <span className="text-xs text-coral-700 self-center mr-auto">{error}</span>}
          <button className={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button className={btnPrimary} onClick={submit}>
            {initial ? 'Guardar cambios' : 'Crear evento'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre del evento" className="sm:col-span-2">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Conectados #3" autoFocus />
        </Field>
        <Field label="Tipo de actividad">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as CalendarEventType)}>
            {CALENDAR_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CALENDAR_EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lugar">
          <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ej: Auditorio Fundadores" />
        </Field>
        <Field label="Fecha">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio">
            <input type="time" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="Fin">
            <input type="time" className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Descripción" className="sm:col-span-2">
          <textarea className={`${inputCls} min-h-[72px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        {/* Clase de capacitación */}
        {isTraining && (
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Clase de capacitación">
            {(
              [
                { id: 'invitacion', title: 'Por invitación', text: 'Tú agregas a las personas que deben asistir.' },
                { id: 'abierta', title: 'Abierta a todos', text: 'Todos los integrantes la ven en su calendario.' },
              ] as { id: TrainingMode; title: string; text: string }[]
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={trainingMode === o.id}
                onClick={() => setTrainingMode(o.id)}
                className={`text-left rounded-2xl border-2 p-3 transition-colors ${
                  trainingMode === o.id ? 'border-turquesa-500 bg-turquesa-50' : 'border-tinta-200 hover:border-tinta-400'
                }`}
              >
                <span className="block text-sm font-semibold text-tinta-900">{o.title}</span>
                <span className="block text-[11px] text-tinta-600 mt-0.5">{o.text}</span>
              </button>
            ))}
          </div>
        )}

        {isOpenTraining && (
          <p className="sm:col-span-2 text-xs text-tinta-600 rounded-2xl bg-tinta-50 border border-tinta-200 px-4 py-3">
            Abierta a todos: la verán los {invitedCount} integrantes activos.
          </p>
        )}

        {byInvitation && (
          <div className="sm:col-span-2 rounded-2xl border border-tinta-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-tinta-700">Personas invitadas</p>
              <span className="text-[11px] text-tinta-500">{audience.personIds.length} agregadas</span>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-tinta-400 absolute left-3 top-2.5" />
              <input
                className={`${inputCls} pl-9`}
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                placeholder="Buscar por nombre, cédula o usuario"
              />
              {personResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-surface border border-tinta-200 rounded-xl shadow-lg overflow-hidden">
                  {personResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-tinta-50"
                      onClick={() => {
                        addPeople([p.id]);
                        setPersonQuery('');
                      }}
                    >
                      {p.name} <span className="text-tinta-500 text-xs">· {p.gtSubTeam || p.primaryType}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-[11px] text-tinta-500 mb-1.5">Agregar un grupo completo</p>
              <div className="flex flex-wrap gap-1.5">
                {LEAGUE_GTS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => addPeople(activePeople.filter((p) => personGts(p).includes(g)).map((p) => p.id))}
                    className="px-2.5 py-1 rounded-full border border-tinta-300 text-xs font-semibold text-tinta-700 hover:border-tinta-500"
                  >
                    + {g}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => addPeople(activePeople.filter((p) => p.primaryType === 'GAP' || p.alsoActsAsGap).map((p) => p.id))}
                  className="px-2.5 py-1 rounded-full border border-tinta-300 text-xs font-semibold text-tinta-700 hover:border-tinta-500"
                >
                  + GAP
                </button>
                <button
                  type="button"
                  onClick={() => addPeople(activePeople.filter((p) => p.primaryType === 'MESA').map((p) => p.id))}
                  className="px-2.5 py-1 rounded-full border border-tinta-300 text-xs font-semibold text-tinta-700 hover:border-tinta-500"
                >
                  + MESA
                </button>
              </div>
            </div>
            {audience.personIds.length > 0 && (
              <div className="rounded-xl border border-tinta-200 max-h-48 overflow-y-auto divide-y divide-tinta-100">
                {audience.personIds.map((id) => {
                  const p = people.find((x) => x.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                      <span className="truncate">
                        {p?.name || id} <span className="text-[11px] text-tinta-500">· {p?.gtSubTeam || p?.primaryType}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setA({ personIds: audience.personIds.filter((x) => x !== id) })}
                        className="p-1 rounded-full hover:bg-tinta-100 text-tinta-500"
                        aria-label={`Quitar a ${p?.name || id}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {audience.personIds.length > 0 && (
              <button type="button" className="text-[11px] font-semibold text-coral-700 hover:underline" onClick={() => setA({ personIds: [] })}>
                Quitar a todos
              </button>
            )}
          </div>
        )}

        {/* Destinatarios (otros tipos) */}
        {!isTraining && (
        <div className="sm:col-span-2 rounded-2xl border border-tinta-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-tinta-700">Destinatarios</p>
            <span className="text-[11px] text-tinta-500">{invitedCount} personas invitadas</span>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-lila-600" checked={audience.all} onChange={(e) => setA({ all: e.target.checked })} />
            Todos los integrantes
          </label>
          {!audience.all && (
            <>
              <div>
                <p className="text-[11px] text-tinta-500 mb-1.5">Grupos de Trabajo (puedes elegir varios)</p>
                <CheckList
                  options={LEAGUE_GTS.map((g) => ({ id: g as string, label: g }))}
                  selected={audience.gtTeams}
                  onChange={(gtTeams) => setA({ gtTeams })}
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="accent-lila-600" checked={audience.includeGap} onChange={(e) => setA({ includeGap: e.target.checked })} />
                  GAP
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="accent-lila-600" checked={audience.includeMesa} onChange={(e) => setA({ includeMesa: e.target.checked })} />
                  MESA
                </label>
              </div>
              <div>
                <p className="text-[11px] text-tinta-500 mb-1.5">Personas específicas</p>
                <div className="relative">
                  <Search className="w-4 h-4 text-tinta-400 absolute left-3 top-2.5" />
                  <input
                    className={`${inputCls} pl-9`}
                    value={personQuery}
                    onChange={(e) => setPersonQuery(e.target.value)}
                    placeholder="Buscar por nombre, cédula o usuario"
                  />
                  {personResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-surface border border-tinta-200 rounded-xl shadow-lg overflow-hidden">
                      {personResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-tinta-50"
                          onClick={() => {
                            setA({ personIds: [...audience.personIds, p.id] });
                            setPersonQuery('');
                          }}
                        >
                          {p.name} <span className="text-tinta-500 text-xs">· {p.gtSubTeam || p.primaryType}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {audience.personIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {audience.personIds.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-tinta-100 text-xs">
                        {people.find((p) => p.id === id)?.name || id}
                        <button
                          type="button"
                          onClick={() => setA({ personIds: audience.personIds.filter((x) => x !== id) })}
                          className="p-0.5 rounded-full hover:bg-tinta-200"
                          aria-label="Quitar"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        )}

        {/* Puntuación de CONECTADOS */}
        {type === 'conectados' && (
          <div className="sm:col-span-2 rounded-2xl border border-lila-200 bg-lila-50 p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-lila-800">DÍAS POINTS de este Conectados</p>
              <p className="text-[11px] text-tinta-600 mt-0.5">
                Puntos del GT = puntos máximos × % de asistencia del GT.
                {isClosed && ' La asistencia ya está cerrada: los cambios aquí no alteran los puntos ya registrados.'}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Puntos máx. por GT">
                <input type="number" min={0} className={inputCls} value={scoring.maxGtPoints} onChange={(e) => setScoring({ ...scoring, maxGtPoints: num(e.target.value) })} />
              </Field>
              <Field label="Individual: asistió">
                <input type="number" min={0} className={inputCls} value={scoring.individualPoints.asistio} onChange={(e) => setScoring({ ...scoring, individualPoints: { ...scoring.individualPoints, asistio: num(e.target.value) } })} />
              </Field>
              <Field label="Individual: tarde">
                <input type="number" min={0} className={inputCls} value={scoring.individualPoints.tarde} onChange={(e) => setScoring({ ...scoring, individualPoints: { ...scoring.individualPoints, tarde: num(e.target.value) } })} />
              </Field>
              <Field label="Individual: excusa">
                <input type="number" min={0} className={inputCls} value={scoring.individualPoints.excusa} onChange={(e) => setScoring({ ...scoring, individualPoints: { ...scoring.individualPoints, excusa: num(e.target.value) } })} />
              </Field>
              <Field label="Llegada tarde en el % del GT" className="col-span-2">
                <select className={inputCls} value={scoring.lateWeight} onChange={(e) => setScoring({ ...scoring, lateWeight: Number(e.target.value) })}>
                  <option value={1}>Cuenta como asistencia completa</option>
                  <option value={0.5}>Cuenta como media asistencia</option>
                  <option value={0}>No cuenta como asistencia</option>
                </select>
              </Field>
              <Field label="Excusas válidas en el % del GT" className="col-span-2">
                <select className={inputCls} value={scoring.excuseMode} onChange={(e) => setScoring({ ...scoring, excuseMode: e.target.value as ConectadosScoring['excuseMode'] })}>
                  <option value="excluir">No penaliza: se excluye del total</option>
                  <option value="asistencia">Cuenta como asistencia</option>
                  <option value="ausencia">Cuenta como inasistencia</option>
                </select>
              </Field>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
