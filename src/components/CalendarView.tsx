import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardCheck,
  Edit3,
  List,
  MapPin,
  Rows3,
  Trash2,
  Users,
  XCircle,
  RotateCcw,
  LayoutGrid,
  Tags,
} from 'lucide-react';
import {
  CalendarEvent,
  LEAGUE_GTS,
  Person,
  BUILTIN_EVENT_TYPES,
  CustomEventType,
  ReminderOffset,
  REMINDER_OFFSETS,
  TrainingMode,
  REMINDER_OFFSET_LABELS,
} from '../types';
import {
  audienceLabel,
  calendarEvents,
  eventEnd,
  formatDateLong,
  formatTime12,
  isPersonInAudience,
  reminderId,
  reminderPreferences,
  customEventTypes,
  todayIso,
} from '../services/calendarService';
import { conectadosClosures } from '../services/leagueService';
import {
  enablePushNotifications,
  getPushPermission,
  isBackgroundPushConfigured,
  isPushSupported,
  PushPermission,
} from '../services/pushService';
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  EventTypeChip,
  eventTypeLabel,
  EVENT_TYPE_STYLES,
  inputCls,
  Modal,
  PageHeader,
  Segmented,
  useCollection,
} from './league/ui';
import { EventFormModal } from './EventFormModal';
import { EventTypesModal } from './EventTypesModal';
import { EventQrPanel } from './EventQrPanel';
import { api } from '../services/leagueApi';
import { attempt, useBusy } from './league/toast';
import {
  AdminBirthdayPushBanner,
  BirthdayDot,
  BirthdayImportModal,
  BirthdayListItem,
  BirthdayModal,
  BirthdayPill,
  UpcomingBirthdays,
  useBirthdaysByDate,
} from './BirthdayCalendar';
import { BirthdayOccurrence } from '../services/birthdayService';

// ----------------------------------------------------------------------------
// Utilidades de fecha (todo en cadenas YYYY-MM-DD para evitar líos de zona horaria)
// ----------------------------------------------------------------------------
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => toIso(new Date(toDate(iso).getTime() + n * 86400_000));
const weekStart = (iso: string) => addDays(iso, -((toDate(iso).getUTCDay() + 6) % 7)); // lunes
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const addMonths = (iso: string, n: number) => {
  const d = toDate(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toIso(d);
};
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const monthLabel = (iso: string) =>
  toDate(iso).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDay = (iso: string) =>
  toDate(iso).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

type CalView = 'mes' | 'semana' | 'lista';

/** Tipos para filtrar y leyenda: la capacitación se separa en abierta y por invitación. */
type LegendItem = { type: string; trainingMode?: TrainingMode };
function buildLegend(custom: CustomEventType[]): LegendItem[] {
  return [
    ...BUILTIN_EVENT_TYPES.flatMap((t): LegendItem[] =>
      t === 'capacitacion'
        ? [
            { type: t, trainingMode: 'invitacion' },
            { type: t, trainingMode: 'abierta' },
          ]
        : [{ type: t }]
    ),
    ...custom.map((c) => ({ type: c.id })),
  ];
}
const typeFilterKey = (e: Pick<CalendarEvent, 'type' | 'trainingMode'>) =>
  e.type === 'capacitacion' ? `capacitacion:${e.trainingMode ?? 'invitacion'}` : e.type;

interface CalendarViewProps {
  mode: 'admin' | 'staff';
  people: Person[];
  /** Persona que consulta (modo staff) */
  person?: Person;
  author: string;
  onOpenConectados?: (eventId: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ mode, people, person, author, onOpenConectados }) => {
  const isAdmin = mode === 'admin';
  const customTypes = useCollection(customEventTypes.subscribe);
  const legend = useMemo(() => buildLegend(customTypes), [customTypes]);
  const typeFilters = useMemo(
    () => [{ id: 'all', label: 'Todos los tipos' }, ...legend.map((l) => ({ id: typeFilterKey(l), label: eventTypeLabel(l.type, l.trainingMode) }))],
    [legend]
  );
  const [managingTypes, setManagingTypes] = useState(false);
  const allEvents = useCollection(calendarEvents.subscribe);
  const prefs = useCollection(reminderPreferences.subscribe);
  const closures = useCollection(conectadosClosures.subscribe);

  const [view, setView] = useState<CalView>(() => {
    try {
      return (localStorage.getItem('dias_eafit_calendar_view') as CalView) || 'mes';
    } catch {
      return 'mes';
    }
  });
  const [cursor, setCursor] = useState(todayIso());
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [showCancelled, setShowCancelled] = useState(true);
  const [listFrom, setListFrom] = useState(todayIso());
  const [listTo, setListTo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBirthday, setSelectedBirthday] = useState<BirthdayOccurrence | null>(null);
  const [importingBirthdays, setImportingBirthdays] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null);
  const [newDate, setNewDate] = useState<string | undefined>();

  useEffect(() => {
    try {
      localStorage.setItem('dias_eafit_calendar_view', view);
    } catch {
      /* ignore */
    }
  }, [view]);

  // Eventos visibles para quien consulta + filtros
  const events = useMemo(() => {
    return allEvents
      .filter((e) => isAdmin || (person && isPersonInAudience(person, e.audience)))
      .filter((e) => typeFilter === 'all' || typeFilterKey(e) === typeFilter || e.type === typeFilter)
      .filter(() => typeFilter !== 'cumpleanos')
      .filter((e) => showCancelled || e.status === 'activo')
      .filter((e) => {
        if (groupFilter === 'all') return true;
        const a = e.audience;
        if (a.all) return true;
        if (groupFilter === 'GAP') return a.includeGap;
        if (groupFilter === 'MESA') return a.includeMesa;
        if (groupFilter === 'PERSONAS') return a.personIds.length > 0;
        return a.gtTeams.includes(groupFilter);
      })
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  }, [allEvents, isAdmin, person, typeFilter, groupFilter, showCancelled]);

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    events.forEach((e) => m.set(e.date, [...(m.get(e.date) || []), e]));
    return m;
  }, [events]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return events.filter((e) => e.status === 'activo' && eventEnd(e).getTime() >= now).slice(0, 4);
  }, [events]);

  // Cumpleaños (solo administración): se calculan para el rango visible
  const showBirthdays = isAdmin && (typeFilter === 'all' || typeFilter === 'cumpleanos');
  const bdayFrom = view === 'lista' ? listFrom || todayIso() : view === 'mes' ? weekStart(monthStart(cursor)) : weekStart(cursor);
  const bdayTo = view === 'lista' ? listTo || addDays(bdayFrom, 365) : addDays(bdayFrom, view === 'mes' ? 41 : 6);
  const bdayGt = ['all', 'GAP', 'MESA', 'PERSONAS'].includes(groupFilter) ? (groupFilter === 'all' ? 'all' : '__ninguno__') : groupFilter;
  const birthdaysByDate = useBirthdaysByDate(showBirthdays, people, bdayFrom, bdayTo, bdayGt);

  const selected = selectedId ? allEvents.find((e) => e.id === selectedId) : undefined;
  const today = todayIso();

  const goPrev = () => setCursor(view === 'mes' ? addMonths(cursor, -1) : addDays(cursor, -7));
  const goNext = () => setCursor(view === 'mes' ? addMonths(cursor, 1) : addDays(cursor, 7));

  const EventPill: React.FC<{ e: CalendarEvent; compact?: boolean }> = ({ e, compact }) => (
    <button
      onClick={() => setSelectedId(e.id)}
      className={`w-full text-left rounded-lg border-l-[3px] ${EVENT_TYPE_STYLES[e.type].bar} bg-tinta-50 hover:bg-tinta-100 px-1.5 py-1 transition-colors ${
        e.status === 'cancelado' ? 'opacity-50 line-through' : ''
      }`}
      title={`${e.title} · ${formatTime12(e.startTime)}`}
    >
      <span className="block text-[11px] font-semibold text-tinta-900 truncate">{e.title}</span>
      {!compact && <span className="block text-[10px] text-tinta-500">{formatTime12(e.startTime)}</span>}
    </button>
  );

  // ---------------------------- Vistas ----------------------------
  const renderMonth = () => {
    const start = weekStart(monthStart(cursor));
    const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    const month = cursor.slice(0, 7);
    return (
      <div>
        <div className="grid grid-cols-7 border-b border-tinta-200">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-tinta-500 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const list = byDate.get(d) || [];
            const bdays = birthdaysByDate.get(d) || [];
            const inMonth = d.slice(0, 7) === month;
            return (
              <div
                key={d}
                className={`min-h-[78px] sm:min-h-[104px] border-b border-r border-tinta-100 p-1 sm:p-1.5 ${
                  inMonth ? '' : 'bg-tinta-50/60'
                } ${isAdmin ? 'cursor-pointer' : ''}`}
                onDoubleClick={() => {
                  if (!isAdmin) return;
                  setNewDate(d);
                  setEditing('new');
                }}
              >
                <div className="flex justify-end">
                  <span
                    className={`text-[11px] w-6 h-6 flex items-center justify-center rounded-full tabular-nums ${
                      d === today ? 'bg-tinta-900 text-white font-bold' : inMonth ? 'text-tinta-700' : 'text-tinta-400'
                    }`}
                  >
                    {parseInt(d.slice(8), 10)}
                  </span>
                </div>
                {/* En móvil: puntos; en escritorio: títulos */}
                <div className="sm:hidden flex flex-wrap gap-1 mt-1 justify-center">
                  {bdays.map((o) => (
                    <BirthdayDot key={'b' + o.personId} o={o} onOpen={setSelectedBirthday} />
                  ))}
                  {list.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      className={`w-2 h-2 rounded-full ${EVENT_TYPE_STYLES[e.type].dot}`}
                      aria-label={e.title}
                    />
                  ))}
                </div>
                <div className="hidden sm:flex flex-col gap-1 mt-0.5">
                  {bdays.slice(0, 2).map((o) => (
                    <BirthdayPill key={'b' + o.personId} o={o} onOpen={setSelectedBirthday} compact />
                  ))}
                  {bdays.length > 2 && (
                    <span className="text-[10px] font-semibold text-coral-700 px-1">+{bdays.length - 2} cumpleaños</span>
                  )}
                  {list.slice(0, 3).map((e) => (
                    <EventPill key={e.id} e={e} compact />
                  ))}
                  {list.length > 3 && (
                    <button
                      onClick={() => {
                        setCursor(d);
                        setView('semana');
                      }}
                      className="text-[10px] font-semibold text-tinta-500 hover:text-tinta-900 text-left px-1"
                    >
                      +{list.length - 3} más
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeek = () => {
    const start = weekStart(cursor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return (
      <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-tinta-100">
        {days.map((d) => {
          const list = byDate.get(d) || [];
          const bdays = birthdaysByDate.get(d) || [];
          return (
            <div key={d} className="p-2 md:min-h-[320px]">
              <p
                className={`text-xs font-semibold mb-2 capitalize ${d === today ? 'text-lila-700' : 'text-tinta-600'}`}
              >
                {shortDay(d)}
                {d === today && ' · hoy'}
              </p>
              <div className="flex flex-col gap-1.5">
                {list.length === 0 && bdays.length === 0 && <p className="text-[11px] text-tinta-400 md:hidden">Sin eventos</p>}
                {bdays.map((o) => (
                  <BirthdayPill key={'b' + o.personId} o={o} onOpen={setSelectedBirthday} />
                ))}
                {list.map((e) => (
                  <EventPill key={e.id} e={e} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderList = () => {
    const list = events.filter((e) => (!listFrom || e.date >= listFrom) && (!listTo || e.date <= listTo));
    if (list.length === 0 && birthdaysByDate.size === 0) {
      return <EmptyState icon={CalendarDays} title="No hay eventos en este rango" text="Ajusta las fechas o los filtros." />;
    }
    const groups = new Map<string, CalendarEvent[]>();
    list.forEach((e) => groups.set(e.date, [...(groups.get(e.date) || []), e]));
    birthdaysByDate.forEach((_, d) => !groups.has(d) && groups.set(d, []));
    return (
      <div className="divide-y divide-tinta-100">
        {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, evs]) => (
          <div key={d} className="p-4 sm:px-6 flex flex-col sm:flex-row gap-2 sm:gap-6">
            <p className="text-xs font-semibold text-tinta-600 capitalize sm:w-44 shrink-0">{formatDateLong(d)}</p>
            <div className="flex-1 flex flex-col gap-2">
              {(birthdaysByDate.get(d) || []).map((o) => (
                <BirthdayListItem key={'b' + o.personId} o={o} onOpen={setSelectedBirthday} />
              ))}
              {evs.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`text-left rounded-2xl border border-tinta-200 hover:border-tinta-400 border-l-4 ${EVENT_TYPE_STYLES[e.type].bar} p-3 transition-colors ${
                    e.status === 'cancelado' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-semibold text-tinta-900 ${e.status === 'cancelado' ? 'line-through' : ''}`}>
                      {e.title}
                    </span>
                    <EventTypeChip type={e.type} trainingMode={e.trainingMode} />
                    {e.status === 'cancelado' && (
                      <span className="text-[11px] font-semibold text-coral-700">Cancelado</span>
                    )}
                  </div>
                  <p className="text-xs text-tinta-600 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {formatTime12(e.startTime)} – {formatTime12(e.endTime)}
                    </span>
                    {e.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {e.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {audienceLabel(e.audience, people)}
                    </span>
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const periodLabel =
    view === 'mes'
      ? monthLabel(cursor)
      : `${shortDay(weekStart(cursor))} – ${shortDay(addDays(weekStart(cursor), 6))}`;

  return (
    <div className="space-y-5">
      <PageHeader
        kicker={isAdmin ? 'Administración' : 'Mi DÍAS'}
        title="Calendario"
        description={
          isAdmin
            ? 'Conectados, capacitaciones, retos y la Semana de DÍAS en un solo lugar.'
            : 'Los eventos a los que estás invitado. Activa recordatorios para no perderte ninguno.'
        }
        actions={
          isAdmin && (
            <>
              <button className={btnSecondary} onClick={() => setImportingBirthdays(true)}>
                🎂 Cargar cumpleaños
              </button>
              <button className={btnSecondary} onClick={() => setManagingTypes(true)}>
                <Tags className="w-4 h-4" /> Tipos de evento
              </button>
              <button
                className={btnPrimary}
                onClick={() => {
                  setNewDate(undefined);
                  setEditing('new');
                }}
              >
                <CalendarPlus className="w-4 h-4" /> Nuevo evento
              </button>
            </>
          )
        }
      />

      {!isAdmin && person && <PushBanner personId={person.id} />}
      {isAdmin && <AdminBirthdayPushBanner />}
      {isAdmin && <UpcomingBirthdays onOpen={setSelectedBirthday} />}

      {/* Próximos eventos */}
      {upcoming.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {upcoming.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedId(e.id)}
              className={`text-left bg-surface border border-tinta-200 border-l-4 ${EVENT_TYPE_STYLES[e.type].bar} rounded-2xl p-3.5 hover:border-tinta-400 transition-colors`}
            >
              <p className="text-[11px] font-semibold text-tinta-500 capitalize">
                {e.date === today ? 'Hoy' : shortDay(e.date)} · {formatTime12(e.startTime)}
              </p>
              <p className="font-semibold text-tinta-900 mt-0.5 leading-snug line-clamp-2">{e.title}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <EventTypeChip type={e.type} trainingMode={e.trainingMode} />
                {!isAdmin && person && prefs.find((p) => p.id === reminderId(e.id, person.id))?.enabled && (
                  <Bell className="w-3.5 h-3.5 text-lila-600" aria-label="Recordatorio activo" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        {/* Barra de herramientas */}
        <div className="p-3 sm:p-4 border-b border-tinta-200 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Segmented<CalView>
              value={view}
              onChange={setView}
              options={[
                { id: 'mes', label: 'Mes', icon: LayoutGrid },
                { id: 'semana', label: 'Semana', icon: Rows3 },
                { id: 'lista', label: 'Lista', icon: List },
              ]}
            />
            {view !== 'lista' && (
              <div className="flex items-center gap-1">
                <button onClick={goPrev} className="p-2 rounded-xl hover:bg-tinta-100" aria-label="Anterior">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCursor(todayIso())}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-tinta-100"
                >
                  Hoy
                </button>
                <button onClick={goNext} className="p-2 rounded-xl hover:bg-tinta-100" aria-label="Siguiente">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="ml-1 text-sm font-semibold text-tinta-900 capitalize">{periodLabel}</span>
              </div>
            )}
            {view === 'lista' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-tinta-500">Desde</span>
                <input type="date" value={listFrom} onChange={(e) => setListFrom(e.target.value)} className={`${inputCls} !py-1.5 !w-auto`} />
                <span className="text-tinta-500">hasta</span>
                <input type="date" value={listTo} onChange={(e) => setListTo(e.target.value)} className={`${inputCls} !py-1.5 !w-auto`} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`${inputCls} !py-1.5 !w-auto text-xs`}
              aria-label="Filtrar por tipo"
            >
              <option value="all">Todos los tipos</option>
              {typeFilters.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
              {isAdmin && <option value="cumpleanos">🎂 Cumpleaños</option>}
            </select>
            {isAdmin && (
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className={`${inputCls} !py-1.5 !w-auto text-xs`}
                aria-label="Filtrar por grupo destinatario"
              >
                <option value="all">Todos los grupos</option>
                {LEAGUE_GTS.map((g) => (
                  <option key={g} value={g}>
                    GT {g}
                  </option>
                ))}
                <option value="GAP">GAP</option>
                <option value="MESA">MESA</option>
                <option value="PERSONAS">Personas específicas</option>
              </select>
            )}
            <label className="flex items-center gap-1.5 text-xs text-tinta-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => setShowCancelled(e.target.checked)}
                className="accent-lila-600"
              />
              Ver cancelados
            </label>
          </div>
        </div>

        {view === 'mes' && renderMonth()}
        {view === 'semana' && renderWeek()}
        {view === 'lista' && renderList()}

        {/* Leyenda */}
        <div className="px-4 py-3 border-t border-tinta-200 flex flex-wrap gap-2">
          {legend.map((l) => (
            <EventTypeChip key={l.type + (l.trainingMode || '')} type={l.type} trainingMode={l.trainingMode} />
          ))}
          {isAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-coral-300 bg-coral-50 px-2 py-0.5 text-[11px] font-semibold text-coral-800">
              🎂 Cumpleaños
            </span>
          )}
          {isAdmin && view === 'mes' && (
            <span className="text-[11px] text-tinta-500 ml-auto self-center">Doble clic en un día para crear un evento</span>
          )}
        </div>
      </Card>

      {selected && (
        <EventDetailModal
          event={selected}
          people={people}
          isAdmin={isAdmin}
          person={person}
          isClosed={closures.some((c) => c.eventId === selected.id && c.status === 'cerrado')}
          onClose={() => setSelectedId(null)}
          onEdit={() => {
            setEditing(selected);
            setSelectedId(null);
          }}
          onOpenConectados={
            onOpenConectados
              ? () => {
                  setSelectedId(null);
                  onOpenConectados(selected.id);
                }
              : undefined
          }
        />
      )}

      {importingBirthdays && <BirthdayImportModal people={people} onClose={() => setImportingBirthdays(false)} />}
      {selectedBirthday && <BirthdayModal o={selectedBirthday} people={people} onClose={() => setSelectedBirthday(null)} />}

      {managingTypes && <EventTypesModal onClose={() => setManagingTypes(false)} />}

      {editing && (
        <EventFormModal
          initial={editing === 'new' ? undefined : editing}
          defaultDate={newDate}
          people={people}
          author={author}
          onClose={() => setEditing(null)}
          onSaved={(ev) => {
            setEditing(null);
            setCursor(ev.date);
          }}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Aviso para activar notificaciones en el dispositivo
// ----------------------------------------------------------------------------
const PushBanner: React.FC<{ personId: string }> = ({ personId }) => {
  const [perm, setPerm] = useState<PushPermission>(getPushPermission());
  if (!isPushSupported() || perm === 'granted') return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-2xl border border-lila-200 bg-lila-50 p-4">
      <div className="flex items-start gap-3">
        <Bell className="w-5 h-5 text-lila-700 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-tinta-900">
            {perm === 'denied' ? 'Las notificaciones están bloqueadas' : 'Recibe recordatorios en este dispositivo'}
          </p>
          <p className="text-xs text-tinta-600 mt-0.5">
            {perm === 'denied'
              ? 'Puedes ver los eventos aquí, pero no te llegarán avisos. Para activarlos, permite las notificaciones de este sitio en la configuración del navegador.'
              : 'Activa las notificaciones para que te avisemos antes de los eventos en los que actives recordatorio.'}
          </p>
        </div>
      </div>
      {perm === 'default' && (
        <button className={btnPrimary} onClick={async () => setPerm(await enablePushNotifications(personId))}>
          Activar notificaciones
        </button>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Detalle del evento
// ----------------------------------------------------------------------------
const EventDetailModal: React.FC<{
  event: CalendarEvent;
  people: Person[];
  isAdmin: boolean;
  person?: Person;
  isClosed: boolean;
  onClose: () => void;
  onEdit: () => void;
  onOpenConectados?: () => void;
}> = ({ event: e, people, isAdmin, person, isClosed, onClose, onEdit, onOpenConectados }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, run] = useBusy();
  const invited = useMemo(() => people.filter((p) => p.isActive !== false && isPersonInAudience(p, e.audience)).length, [people, e.audience]);

  return (
    <Modal
      title={e.title}
      onClose={onClose}
      footer={
        isAdmin ? (
          <>
            {confirmDelete ? (
              <>
                <span className="text-xs text-coral-700 self-center mr-auto">
                  {isClosed ? 'Este Conectados tiene puntos registrados: reábrelo antes de eliminarlo.' : '¿Eliminar definitivamente?'}
                </span>
                <button className={btnSecondary} onClick={() => setConfirmDelete(false)}>
                  No
                </button>
                {!isClosed && (
                  <button
                    className={btnDanger}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        if (await attempt(() => api.deleteEvent(e.id), 'Evento eliminado')) onClose();
                      })
                    }
                  >
                    Sí, eliminar
                  </button>
                )}
              </>
            ) : (
              <>
                <button className={`${btnDanger} mr-auto`} onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
                <button
                  className={btnSecondary}
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      attempt(
                        () => api.setEventStatus(e, e.status === 'activo' ? 'cancelado' : 'activo'),
                        e.status === 'activo' ? 'Evento cancelado' : 'Evento reactivado'
                      )
                    )
                  }
                >
                  {e.status === 'activo' ? (
                    <>
                      <XCircle className="w-4 h-4" /> Cancelar evento
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" /> Reactivar
                    </>
                  )}
                </button>
                <button className={btnPrimary} onClick={onEdit}>
                  <Edit3 className="w-4 h-4" /> Editar
                </button>
              </>
            )}
          </>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <EventTypeChip type={e.type} trainingMode={e.trainingMode} />
          {e.status === 'cancelado' && (
            <span className="px-2 py-0.5 rounded-full bg-coral-100 text-coral-800 text-[11px] font-semibold">Cancelado</span>
          )}
          {isClosed && (
            <span className="px-2 py-0.5 rounded-full bg-turquesa-100 text-turquesa-800 text-[11px] font-semibold">
              Asistencia cerrada
            </span>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-2.5 text-sm">
          <div className="flex gap-2.5">
            <CalendarDays className="w-4 h-4 text-tinta-500 mt-0.5 shrink-0" />
            <dd className="capitalize">{formatDateLong(e.date)}</dd>
          </div>
          <div className="flex gap-2.5">
            <Clock className="w-4 h-4 text-tinta-500 mt-0.5 shrink-0" />
            <dd>
              {formatTime12(e.startTime)} – {formatTime12(e.endTime)}
            </dd>
          </div>
          {e.location && (
            <div className="flex gap-2.5">
              <MapPin className="w-4 h-4 text-tinta-500 mt-0.5 shrink-0" />
              <dd>{e.location}</dd>
            </div>
          )}
          <div className="flex gap-2.5">
            <Users className="w-4 h-4 text-tinta-500 mt-0.5 shrink-0" />
            <dd>
              {audienceLabel(e.audience, people)}
              {isAdmin && <span className="text-tinta-500"> · {invited} invitados</span>}
            </dd>
          </div>
        </dl>
        {e.description && <p className="text-sm text-tinta-700 whitespace-pre-line">{e.description}</p>}

        {isAdmin && e.audience.personIds.length > 0 && (
          <details className="rounded-2xl border border-tinta-200 px-4 py-2.5">
            <summary className="text-xs font-semibold text-tinta-700 cursor-pointer">
              Ver personas invitadas ({e.audience.personIds.length})
            </summary>
            <ul className="mt-2 max-h-48 overflow-y-auto text-sm divide-y divide-tinta-100">
              {e.audience.personIds.map((id) => {
                const p = people.find((x) => x.id === id);
                return (
                  <li key={id} className="py-1.5 flex justify-between gap-2">
                    <span>{p?.name || 'Persona eliminada'}</span>
                    <span className="text-[11px] text-tinta-500">{p?.gtSubTeam || p?.primaryType}</span>
                  </li>
                );
              })}
            </ul>
          </details>
        )}

        {isAdmin && e.attendanceEnabled && e.status === 'activo' && <EventQrPanel event={e} isClosed={isClosed} />}

        {isAdmin && (e.type === 'conectados' || e.attendanceEnabled) && onOpenConectados && (
          <button className={`${btnSecondary} w-full`} onClick={onOpenConectados}>
            <ClipboardCheck className="w-4 h-4" /> {isClosed ? 'Ver asistencia y puntos' : 'Panel de asistencia'}
          </button>
        )}

        {!isAdmin && person && e.status === 'activo' && <ReminderEditor eventId={e.id} personId={person.id} />}
      </div>
    </Modal>
  );
};

const ReminderEditor: React.FC<{ eventId: string; personId: string }> = ({ eventId, personId }) => {
  const prefs = useCollection(reminderPreferences.subscribe);
  const pref = prefs.find((p) => p.id === reminderId(eventId, personId));
  const enabled = pref?.enabled ?? false;
  const offsets = pref?.offsets ?? [];
  const [perm, setPerm] = useState<PushPermission>(getPushPermission());

  const update = async (nextEnabled: boolean, nextOffsets: ReminderOffset[], fromSwitch = false) => {
    let en = nextEnabled;
    let offs = nextOffsets;
    if (en && offs.length === 0) {
      // Al encender sin anticipación elegida: 1 hora antes. Al desmarcar la última: se apaga.
      if (fromSwitch) offs = [60];
      else en = false;
    }
    if (!(await attempt(() => api.saveReminder(eventId, en, offs)))) return;
    if (en && perm === 'default') setPerm(await enablePushNotifications(personId));
  };

  return (
    <div className="rounded-2xl border border-tinta-200 bg-tinta-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {enabled ? <Bell className="w-4 h-4 text-lila-700" /> : <BellOff className="w-4 h-4 text-tinta-500" />}
          <span className="text-sm font-semibold text-tinta-900">Recordatorio</span>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => update(!enabled, offsets, true)}
          className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-lila-600' : 'bg-tinta-300'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-5' : ''
            }`}
          />
          <span className="sr-only">Activar recordatorio</span>
        </button>
      </div>
      {enabled && (
        <div className="flex flex-wrap gap-2">
          {REMINDER_OFFSETS.map((o) => {
            const on = offsets.includes(o);
            return (
              <label
                key={o}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                  on ? 'bg-surface border-lila-400 text-lila-800' : 'bg-surface border-tinta-200 text-tinta-600'
                }`}
              >
                <input
                  type="checkbox"
                  className="accent-lila-600"
                  checked={on}
                  onChange={() => update(true, on ? offsets.filter((x) => x !== o) : [...offsets, o])}
                />
                {REMINDER_OFFSET_LABELS[o]}
              </label>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-tinta-500">
        {!enabled
          ? 'No recibirás avisos de este evento.'
          : perm === 'granted'
          ? isBackgroundPushConfigured()
            ? 'Te avisaremos en este dispositivo, aunque la app esté cerrada.'
            : 'Te avisaremos en este dispositivo mientras tengas DÍAS abierto.'
          : perm === 'denied'
          ? 'Tu preferencia quedó guardada, pero el navegador bloquea las notificaciones de este sitio.'
          : perm === 'unsupported'
          ? 'Tu preferencia quedó guardada, pero este navegador no admite notificaciones.'
          : 'Permite las notificaciones cuando el navegador lo pida para recibir el aviso.'}
      </p>
    </div>
  );
};
