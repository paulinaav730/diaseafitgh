import React, { useMemo, useState } from 'react';
import {
  Trophy,
  Users,
  ClipboardCheck,
  Swords,
  ScrollText,
  Settings2,
  Download,
  Medal,
  User,
  ChevronRight,
  Zap,
  IdCard,
  Search,
  ScanLine,
} from 'lucide-react';
import { ConectadosScoring, LEAGUE_GTS, Person, PointMovement, POINT_CATEGORY_LABELS } from '../types';
import {
  computeGtStandings,
  computePersonStandings,
  exportLeagueReport,
  getDefaultScoring,
  leagueSettings,
  pointMovements,
  GtStanding,
  PersonStanding,
} from '../services/leagueService';
import { calendarEvents, personPrimaryGt } from '../services/calendarService';
import {
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  Field,
  formatPoints,
  inputCls,
  Modal,
  PageHeader,
  Segmented,
  useCollection,
} from './league/ui';
import { EventAttendancePanel } from './EventAttendancePanel';
import { LeagueActivities } from './LeagueActivities';
import { PersonProfile } from './PersonProfile';
import { api } from '../services/leagueApi';
import { attempt, notify, useBusy } from './league/toast';
import { QrScanner } from './league/QrScanner';
import { emitQr } from './league/QrCode';
import { LeagueChallenges } from './LeagueChallenges';
import { LeagueMovements } from './LeagueMovements';

type LeagueTab = 'ranking' | 'individual' | 'conectados' | 'retos' | 'actividades' | 'perfiles' | 'movimientos' | 'config';

interface LeagueViewProps {
  mode: 'admin' | 'staff';
  people: Person[];
  person?: Person;
  author: string;
  /** Abre directamente la asistencia de este CONECTADOS */
  focusConectadosId?: string | null;
  onFocusHandled?: () => void;
}

export const LeagueView: React.FC<LeagueViewProps> = ({ mode, people, person, author, focusConectadosId, onFocusHandled }) => {
  const isAdmin = mode === 'admin';
  const movements = useCollection(pointMovements.subscribe);
  const events = useCollection(calendarEvents.subscribe);
  const [tab, setTab] = useState<LeagueTab>(focusConectadosId ? 'conectados' : 'ranking');

  React.useEffect(() => {
    if (focusConectadosId) setTab('conectados');
  }, [focusConectadosId]);

  const standings = useMemo(() => computeGtStandings(movements), [movements]);
  const [scanning, setScanning] = useState(false);

  const tabs: { id: LeagueTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'ranking', label: 'Ranking GT', icon: Trophy },
    { id: 'individual', label: isAdmin ? 'Ranking individual' : 'Individual', icon: Users },
    ...(isAdmin
      ? ([
          { id: 'conectados', label: 'Asistencia', icon: ClipboardCheck },
          { id: 'retos', label: 'Retos', icon: Swords },
          { id: 'actividades', label: 'Puntos por QR', icon: Zap },
          { id: 'perfiles', label: 'Perfiles DÍAS', icon: IdCard },
          { id: 'movimientos', label: 'Historial y puntos', icon: ScrollText },
          { id: 'config', label: 'Configuración', icon: Settings2 },
        ] as const)
      : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="DÍAS POINTS"
        title="DÍAS League"
        description="La competencia entre los nueve Grupos de Trabajo: retos, Conectados y reconocimientos individuales durante todo el año."
        actions={
          isAdmin && (
            <>
              <button className={btnSecondary} onClick={() => setScanning(true)}>
                <ScanLine className="w-4 h-4" /> Escanear QR
              </button>
              <button className={btnSecondary} onClick={() => exportLeagueReport(people, events)}>
                <Download className="w-4 h-4" /> Exportar reporte
              </button>
            </>
          )
        }
      />

      {!isAdmin && person && <MyPointsCard person={person} movements={movements} standings={standings} />}

      <div className="overflow-x-auto -mx-1 px-1">
        <Segmented value={tab} onChange={setTab} options={tabs} />
      </div>

      {tab === 'ranking' && <GtRanking standings={standings} movements={movements} highlightGt={person ? personPrimaryGt(person) : undefined} />}
      {tab === 'individual' && <PersonRanking movements={movements} people={people} highlightId={person?.id} isAdmin={isAdmin} />}
      {isAdmin && tab === 'conectados' && (
        <EventAttendancePanel people={people} author={author} focusEventId={focusConectadosId} onFocusHandled={onFocusHandled} />
      )}
      {isAdmin && tab === 'actividades' && <LeagueActivities people={people} />}
      {isAdmin && tab === 'perfiles' && <ProfilesBrowser people={people} />}
      {isAdmin && tab === 'retos' && <LeagueChallenges people={people} author={author} />}
      {isAdmin && tab === 'movimientos' && <LeagueMovements people={people} author={author} />}
      {isAdmin && tab === 'config' && <LeagueSettingsPanel />}
      {scanning && (
        <QrScanner
          title="Escanear QR personal"
          subtitle="Identifica al integrante para registrar su participación o asignarle DÍAS POINTS."
          onClose={() => setScanning(false)}
          onResult={(text) => {
            if (emitQr(text)) setScanning(false);
            else notify.error(new Error('Ese código no es un QR de DÍAS.'));
          }}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Ranking de GT
// ----------------------------------------------------------------------------

const Sparkline: React.FC<{ data: { date: string; total: number }[]; label: string }> = ({ data, label }) => {
  if (data.length < 2) return <span className="text-[11px] text-tinta-400">—</span>;
  const w = 96;
  const h = 28;
  const values = data.map((d) => d.total);
  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const x = (i: number) => (i / (data.length - 1)) * (w - 4) + 2;
  const y = (v: number) => h - 3 - ((v - min) / (max - min)) * (h - 6);
  const pts = data.map((d, i) => `${x(i)},${y(d.total)}`).join(' ');
  const last = data[data.length - 1];
  return (
    <svg width={w} height={h} role="img" aria-label={`Evolución de ${label}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="text-tinta-800" />
      {data.map((d, i) => (
        <circle key={d.date} cx={x(i)} cy={y(d.total)} r={6} fill="transparent">
          <title>{`${d.date}: ${formatPoints(d.total)} pts`}</title>
        </circle>
      ))}
      <circle cx={x(data.length - 1)} cy={y(last.total)} r={3} className="fill-lila-600" />
    </svg>
  );
};

const POSITION_STYLES = ['bg-mostaza-300 text-negro', 'bg-tinta-300 text-negro', 'bg-coral-200 text-negro'];

const GtRanking: React.FC<{ standings: GtStanding[]; movements: PointMovement[]; highlightGt?: string }> = ({
  standings,
  movements,
  highlightGt,
}) => {
  const [detailGt, setDetailGt] = useState<string | null>(null);
  const leader = Math.max(...standings.map((s) => s.total), 1);
  const hasPoints = standings.some((s) => s.total !== 0);

  return (
    <Card className="overflow-hidden">
      {!hasPoints && (
        <div className="px-5 py-3 bg-tinta-50 border-b border-tinta-200 text-xs text-tinta-600">
          Aún no hay DÍAS POINTS registrados. El ranking se actualiza solo al cerrar un Conectados, registrar un reto o asignar puntos.
        </div>
      )}
      <div className="hidden md:grid grid-cols-[56px_1.4fr_2fr_repeat(3,90px)_110px_24px] gap-3 px-5 py-2.5 text-[11px] font-semibold text-tinta-500 uppercase tracking-wide border-b border-tinta-200">
        <span>Puesto</span>
        <span>GT</span>
        <span>Total</span>
        <span className="text-right">Retos</span>
        <span className="text-right">Conectados</span>
        <span className="text-right">Otros</span>
        <span>Evolución</span>
        <span />
      </div>
      <ol className="divide-y divide-tinta-100">
        {standings.map((s) => (
          <li key={s.gt}>
            <button
              onClick={() => setDetailGt(s.gt)}
              className={`w-full text-left grid grid-cols-[44px_1fr_auto] md:grid-cols-[56px_1.4fr_2fr_repeat(3,90px)_110px_24px] gap-3 items-center px-4 md:px-5 py-3 hover:bg-tinta-50 transition-colors ${
                highlightGt === s.gt ? 'bg-lila-50' : ''
              }`}
            >
              <span
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold tabular-nums text-sm ${
                  (s.total > 0 && POSITION_STYLES[s.position - 1]) || 'bg-tinta-100 text-tinta-700'
                }`}
              >
                {s.position}
              </span>
              <span className="font-semibold text-tinta-900 truncate">
                {s.gt}
                {highlightGt === s.gt && <span className="ml-2 text-[11px] font-semibold text-lila-700">Tu GT</span>}
                <span className="md:hidden block text-[11px] font-normal text-tinta-500">
                  Retos {formatPoints(s.retos)} · Conectados {formatPoints(s.conectados)} · Otros {formatPoints(s.otros)}
                </span>
              </span>
              <span className="md:hidden font-bold tabular-nums text-tinta-900">{formatPoints(s.total)}</span>
              <span className="hidden md:flex items-center gap-3">
                <span className="flex-1 h-2.5 rounded-full bg-tinta-100 overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-lila-400"
                    style={{ width: `${Math.max(0, (s.total / leader) * 100)}%` }}
                  />
                </span>
                <span className="w-14 text-right font-bold tabular-nums text-tinta-900">{formatPoints(s.total)}</span>
              </span>
              <span className="hidden md:block text-right tabular-nums text-sm text-tinta-700">{formatPoints(s.retos)}</span>
              <span className="hidden md:block text-right tabular-nums text-sm text-tinta-700">{formatPoints(s.conectados)}</span>
              <span className="hidden md:block text-right tabular-nums text-sm text-tinta-700">{formatPoints(s.otros)}</span>
              <span className="hidden md:block">
                <Sparkline data={s.evolution} label={s.gt} />
              </span>
              <ChevronRight className="hidden md:block w-4 h-4 text-tinta-400" />
            </button>
          </li>
        ))}
      </ol>
      {detailGt && (
        <Modal title={`Puntos de ${detailGt}`} onClose={() => setDetailGt(null)} size="lg">
          <MovementList movements={movements.filter((m) => !m.voided && m.target === 'gt' && m.gt === detailGt)} />
        </Modal>
      )}
    </Card>
  );
};

export const MovementList: React.FC<{ movements: PointMovement[]; people?: Person[] }> = ({ movements, people }) => {
  const sorted = [...movements].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  if (sorted.length === 0) return <EmptyState icon={ScrollText} title="Sin movimientos todavía" />;
  return (
    <ul className="divide-y divide-tinta-100">
      {sorted.map((m) => (
        <li key={m.id} className="py-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-tinta-900">{m.activityName}</p>
            <p className="text-[11px] text-tinta-500">
              {m.date} · {POINT_CATEGORY_LABELS[m.category]}
              {people && m.personId && ` · ${people.find((p) => p.id === m.personId)?.name ?? ''}`}
              {m.reason && ` · ${m.reason}`}
            </p>
          </div>
          <span className={`tabular-nums font-bold shrink-0 ${m.points < 0 ? 'text-coral-700' : 'text-tinta-900'}`}>
            {m.points > 0 ? '+' : ''}
            {formatPoints(m.points)}
          </span>
        </li>
      ))}
    </ul>
  );
};

// ----------------------------------------------------------------------------
// Ranking individual
// ----------------------------------------------------------------------------

const PersonRanking: React.FC<{ movements: PointMovement[]; people: Person[]; highlightId?: string; isAdmin?: boolean }> = ({
  movements,
  people,
  highlightId,
  isAdmin,
}) => {
  const [gt, setGt] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [detail, setDetail] = useState<PersonStanding | null>(null);
  const rows = useMemo(() => computePersonStandings(movements, people, { gt: gt || undefined, from, to }), [movements, people, gt, from, to]);

  return (
    <Card className="overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-tinta-200 flex flex-wrap items-center gap-2">
        <select className={`${inputCls} !w-auto !py-1.5 text-xs`} value={gt} onChange={(e) => setGt(e.target.value)} aria-label="Filtrar por GT">
          <option value="">Todos los GT</option>
          {LEAGUE_GTS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <span className="text-xs text-tinta-500 ml-1">Periodo</span>
        <input type="date" className={`${inputCls} !w-auto !py-1.5 text-xs`} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" />
        <span className="text-xs text-tinta-500">a</span>
        <input type="date" className={`${inputCls} !w-auto !py-1.5 text-xs`} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" />
        {(gt || from || to) && (
          <button
            className="text-xs font-semibold text-lila-700 hover:underline ml-1"
            onClick={() => {
              setGt('');
              setFrom('');
              setTo('');
            }}
          >
            Limpiar
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Medal} title="Nadie tiene puntos individuales en este filtro" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold text-tinta-500 uppercase tracking-wide border-b border-tinta-200">
                <th className="text-left px-4 py-2.5 w-14">Puesto</th>
                <th className="text-left px-2 py-2.5">Nombre</th>
                <th className="text-left px-2 py-2.5">GT</th>
                <th className="text-right px-2 py-2.5">Retos completados</th>
                <th className="text-right px-2 py-2.5">Asistencias</th>
                <th className="text-right px-4 py-2.5">DÍAS POINTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tinta-100">
              {rows.map((r) => (
                <tr
                  key={r.personId}
                  onClick={() => setDetail(r)}
                  className={`cursor-pointer hover:bg-tinta-50 ${r.personId === highlightId ? 'bg-lila-50' : ''}`}
                >
                  <td className="px-4 py-2.5 tabular-nums font-bold text-tinta-700">{r.position}</td>
                  <td className="px-2 py-2.5 font-semibold text-tinta-900">
                    {r.name}
                    {r.personId === highlightId && <span className="ml-2 text-[11px] font-semibold text-lila-700">Tú</span>}
                  </td>
                  <td className="px-2 py-2.5 text-tinta-600">{r.gt || '—'}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-tinta-600">{r.challengesCompleted}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-tinta-600">{r.attendances}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-tinta-900">{formatPoints(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && isAdmin && people.find((p) => p.id === detail.personId) ? (
        <Modal title="Perfil DÍAS" onClose={() => setDetail(null)} size="xl">
          <PersonProfile person={people.find((p) => p.id === detail.personId)!} people={people} mode="admin" />
        </Modal>
      ) : (
        detail && (
          <Modal title={detail.name} subtitle={`${detail.gt || 'Sin GT'} · ${formatPoints(detail.total)} DÍAS POINTS`} onClose={() => setDetail(null)} size="lg">
            <MovementList movements={detail.movements} />
          </Modal>
        )
      )}
    </Card>
  );
};

// ----------------------------------------------------------------------------
// Tarjeta del integrante (modo staff)
// ----------------------------------------------------------------------------

const MyPointsCard: React.FC<{ person: Person; movements: PointMovement[]; standings: GtStanding[] }> = ({
  person,
  movements,
  standings,
}) => {
  const mine = movements.filter((m) => !m.voided && m.target === 'person' && m.personId === person.id);
  const total = mine.reduce((a, m) => a + m.points, 0);
  const gt = personPrimaryGt(person);
  const gtStanding = standings.find((s) => s.gt === gt);
  const [open, setOpen] = useState(false);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button onClick={() => setOpen(true)} className="text-left bg-negro text-white rounded-3xl p-5 hover:bg-tinta-800 transition-colors">
        <p className="text-[10px] font-subtitle text-lila-300">Mis DÍAS POINTS</p>
        <p className="text-4xl font-display mt-2 tabular-nums">{formatPoints(total)}</p>
        <p className="text-xs text-white/60 mt-1 flex items-center gap-1">
          <User className="w-3.5 h-3.5" /> {mine.length} movimiento{mine.length === 1 ? '' : 's'} · ver historial
        </p>
      </button>
      <div className="bg-surface border border-tinta-200 rounded-3xl p-5">
        <p className="text-[10px] font-subtitle text-tinta-600">Mi GT</p>
        {gtStanding ? (
          <>
            <p className="text-2xl font-display text-tinta-900 mt-2">{gt}</p>
            <p className="text-sm text-tinta-600 mt-1">
              Puesto <b className="text-tinta-900">{gtStanding.position}</b> de {standings.length} ·{' '}
              <b className="text-tinta-900 tabular-nums">{formatPoints(gtStanding.total)}</b> pts
            </p>
          </>
        ) : (
          <p className="text-sm text-tinta-600 mt-2">No perteneces a un GT de la liga.</p>
        )}
      </div>
      {open && (
        <Modal title="Mi historial de DÍAS POINTS" onClose={() => setOpen(false)} size="lg">
          <MovementList movements={mine} />
        </Modal>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Configuración por defecto
// ----------------------------------------------------------------------------

const LeagueSettingsPanel: React.FC = () => {
  useCollection(leagueSettings.subscribe);
  const [s, setS] = useState<ConectadosScoring>(getDefaultScoring());
  const [saved, setSaved] = useState(false);
  const [busy, run] = useBusy();
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const set = (patch: Partial<ConectadosScoring>) => {
    setSaved(false);
    setS({ ...s, ...patch });
  };
  return (
    <Card className="p-5 sm:p-6 space-y-5 max-w-3xl">
      <div>
        <h2 className="text-lg font-display text-tinta-900">Valores por defecto de los Conectados</h2>
        <p className="text-sm text-tinta-600 mt-1">
          Se usan al crear un Conectados nuevo. Cada Conectados puede ajustarlos al editarlo, y al cerrar la asistencia
          quedan congelados para que el histórico no cambie.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Field label="Puntos máx. por GT" hint="Lo que gana un GT con 100% de asistencia">
          <input type="number" min={0} className={inputCls} value={s.maxGtPoints} onChange={(e) => set({ maxGtPoints: num(e.target.value) })} />
        </Field>
        <Field label="Individual: asistió">
          <input type="number" min={0} className={inputCls} value={s.individualPoints.asistio} onChange={(e) => set({ individualPoints: { ...s.individualPoints, asistio: num(e.target.value) } })} />
        </Field>
        <Field label="Individual: tarde">
          <input type="number" min={0} className={inputCls} value={s.individualPoints.tarde} onChange={(e) => set({ individualPoints: { ...s.individualPoints, tarde: num(e.target.value) } })} />
        </Field>
        <Field label="Individual: excusa">
          <input type="number" min={0} className={inputCls} value={s.individualPoints.excusa} onChange={(e) => set({ individualPoints: { ...s.individualPoints, excusa: num(e.target.value) } })} />
        </Field>
        <Field label="Llegada tarde en el % del GT" className="col-span-2">
          <select className={inputCls} value={s.lateWeight} onChange={(e) => set({ lateWeight: Number(e.target.value) })}>
            <option value={1}>Cuenta como asistencia completa</option>
            <option value={0.5}>Cuenta como media asistencia</option>
            <option value={0}>No cuenta como asistencia</option>
          </select>
        </Field>
        <Field label="Excusas válidas en el % del GT" className="col-span-2">
          <select className={inputCls} value={s.excuseMode} onChange={(e) => set({ excuseMode: e.target.value as ConectadosScoring['excuseMode'] })}>
            <option value="excluir">No penaliza: se excluye del total</option>
            <option value="asistencia">Cuenta como asistencia</option>
            <option value="ausencia">Cuenta como inasistencia</option>
          </select>
        </Field>
      </div>
      <div className="rounded-2xl bg-tinta-50 border border-tinta-200 p-4 text-xs text-tinta-700 space-y-1">
        <p className="font-semibold text-tinta-900">Cómo se calcula</p>
        <p>% de asistencia del GT = (asistentes ÷ integrantes habilitados) × 100</p>
        <p>DÍAS POINTS del GT = puntos máximos × % de asistencia ÷ 100</p>
        <p>
          Ejemplo con {formatPoints(s.maxGtPoints)} pts máx.: un GT con 80% gana {formatPoints((s.maxGtPoints * 80) / 100)} pts;
          uno con 100% gana {formatPoints(s.maxGtPoints)}.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          className={btnPrimary}
          disabled={busy}
          onClick={() =>
            run(async () => {
              if (await attempt(() => api.saveDefaultScoring(s), 'Configuración guardada')) setSaved(true);
            })
          }
        >
          {busy ? 'Guardando…' : 'Guardar configuración'}
        </button>
        {saved && <span className="text-xs font-semibold text-turquesa-700">Guardado</span>}
      </div>
    </Card>
  );
};

// ----------------------------------------------------------------------------
// Perfiles DÍAS (administración): buscar a cualquier integrante
// ----------------------------------------------------------------------------
const ProfilesBrowser: React.FC<{ people: Person[] }> = ({ people }) => {
  const [query, setQuery] = useState('');
  const [gt, setGt] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => !gt || personPrimaryGt(p) === gt)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.documentId.includes(q) || (p.username || '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 200);
  }, [people, query, gt]);
  const open = people.find((p) => p.id === openId);
  return (
    <Card className="overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-tinta-200 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-tinta-400 absolute left-3 top-2.5" />
          <input className={`${inputCls} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, cédula o usuario" />
        </div>
        <select className={`${inputCls} !w-auto text-xs`} value={gt} onChange={(e) => setGt(e.target.value)} aria-label="GT">
          <option value="">Todos los GT</option>
          {LEAGUE_GTS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={User} title="No hay integrantes con ese filtro" />
      ) : (
        <ul className="divide-y divide-tinta-100 max-h-[65vh] overflow-y-auto">
          {rows.map((p) => (
            <li key={p.id}>
              <button onClick={() => setOpenId(p.id)} className="w-full text-left px-4 py-2.5 hover:bg-tinta-50 flex items-center justify-between gap-3">
                <span>
                  <span className="text-sm font-semibold text-tinta-900">{p.name}</span>
                  <span className="block text-[11px] text-tinta-500">
                    {personPrimaryGt(p) || p.primaryType} · CC {p.documentId}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-tinta-400" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <Modal title="Perfil DÍAS" onClose={() => setOpenId(null)} size="xl">
          <PersonProfile person={open} people={people} mode="admin" />
        </Modal>
      )}
    </Card>
  );
};
