import React, { useEffect, useMemo, useState } from 'react';
import { Award, CalendarCheck, Image as ImageIcon, Maximize2, Plus, RefreshCw, ScrollText, Swords, User } from 'lucide-react';
import { ATTENDANCE_STATE_LABELS, Person, PersonProfileData, PointMovement } from '../types';
import { calendarEvents, formatClock, personGts, personPrimaryGt } from '../services/calendarService';
import { eventAttendances, pointMovements, round2 } from '../services/leagueService';
import { api } from '../services/leagueApi';
import { btnPrimary, btnSecondary, Card, EmptyState, Field, formatPoints, inputCls, Modal, useCollection } from './league/ui';
import { attempt, useBusy } from './league/toast';
import { QrCode, qrLink } from './league/QrCode';
import { AssignPointsModal, EditMovementModal, MovementRow } from './LeagueMovements';
import { STATE_STYLE } from './EventAttendancePanel';
import { PersonFoodSection } from './PersonFoodSection';

/** Carga el QR personal (el propio o, si es admin, el de cualquier integrante). */
export function useProfile(personId: string | undefined, asAdmin: boolean) {
  const [profile, setProfile] = useState<PersonProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!personId) return;
    setProfile(null);
    (asAdmin ? api.adminProfile(personId) : api.myProfile())
      .then(setProfile)
      .catch((e) => setError(e.message));
  }, [personId, asAdmin]);
  return { profile, setProfile, error };
}

export const Avatar: React.FC<{ name: string; photoUrl?: string; size?: string }> = ({ name, photoUrl, size = 'w-16 h-16 text-xl' }) => {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return photoUrl && !broken ? (
    <img src={photoUrl} alt={name} onError={() => setBroken(true)} className={`${size} rounded-2xl object-cover bg-tinta-100 shrink-0`} />
  ) : (
    <div className={`${size} rounded-2xl bg-lila-100 text-lila-800 font-bold flex items-center justify-center shrink-0`} aria-hidden>
      {initials || <User className="w-1/2 h-1/2" />}
    </div>
  );
};

/** QR personal grande, para mostrarlo a quien escanea. */
export const PersonalQrModal: React.FC<{ name: string; token: string; onClose: () => void }> = ({ name, token, onClose }) => (
  <Modal title="Mi QR DÍAS" subtitle="Muéstralo para registrar tu participación en retos y actividades." onClose={onClose}>
    <div className="flex flex-col items-center gap-3 py-2">
      <QrCode value={qrLink('P', token)} size={300} className="max-w-full h-auto" label={`QR personal de ${name}`} />
      <p className="text-sm font-semibold text-tinta-900">{name}</p>
      <p className="text-[11px] text-tinta-500 text-center max-w-xs">Este código te identifica en DÍAS. No contiene tu cédula ni datos personales.</p>
    </div>
  </Modal>
);

interface Props {
  person: Person;
  people: Person[];
  mode: 'admin' | 'staff';
}

/** PERFIL DÍAS de un integrante. Vinculado a su registro de Personas (no se duplica). */
export const PersonProfile: React.FC<Props> = ({ person, people, mode }) => {
  const isAdmin = mode === 'admin';
  const { profile, setProfile, error } = useProfile(person.id, isAdmin);
  const movements = useCollection(pointMovements.subscribe);
  const attendances = useCollection(eventAttendances.subscribe);
  const events = useCollection(calendarEvents.subscribe);
  const [showQr, setShowQr] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [editPhoto, setEditPhoto] = useState(false);
  const [editing, setEditing] = useState<{ m: PointMovement; mode: 'corregir' | 'anular' } | null>(null);
  const [showVoided, setShowVoided] = useState(false);

  const mine = useMemo(
    () => movements.filter((m) => m.target === 'person' && m.personId === person.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [movements, person.id]
  );
  const active = mine.filter((m) => !m.voided);
  const total = round2(active.reduce((a, m) => a + m.points, 0));
  const myAttendance = useMemo(
    () =>
      attendances
        .filter((a) => a.personId === person.id)
        .map((a) => ({ a, ev: events.find((e) => e.id === a.eventId) }))
        .filter((x) => x.ev)
        .sort((x, y) => (y.ev!.date + y.ev!.startTime).localeCompare(x.ev!.date + x.ev!.startTime)),
    [attendances, events, person.id]
  );
  const challengesDone = useMemo(() => {
    const map = new Map<string, { name: string; date: string; points: number }>();
    active
      .filter((m) => m.category === 'reto' || m.category === 'actividad')
      .forEach((m) => {
        const k = m.sourceId || m.activityName;
        const prev = map.get(k);
        map.set(k, { name: m.activityName, date: m.date, points: round2((prev?.points ?? 0) + m.points) });
      });
    return [...map.values()];
  }, [active]);
  const recognitions = active.filter((m) => m.category === 'manual' || (m.category === 'reto' && !/^Puesto/.test(m.reason || '')));

  const gt = personPrimaryGt(person);
  const otherGts = personGts(person).filter((g) => g !== gt);
  const isActive = person.isActive !== false;

  return (
    <div className="space-y-4">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col md:flex-row gap-5 md:items-start">
          <div className="flex gap-4 flex-1 min-w-0">
            <Avatar name={person.name} photoUrl={profile?.photoUrl} size="w-20 h-20 text-2xl" />
            <div className="min-w-0 space-y-1.5">
              <p className="text-[10px] font-subtitle text-lila-700">Perfil DÍAS</p>
              <h2 className="text-xl sm:text-2xl font-display text-tinta-900 leading-tight">{person.fullName || person.name}</h2>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className={`px-2 py-0.5 rounded-full font-semibold ${isActive ? 'bg-turquesa-100 text-turquesa-800' : 'bg-tinta-200 text-tinta-700'}`}>
                  {isActive ? 'Activo' : 'Inactivo'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-tinta-100 text-tinta-700 font-semibold">{person.primaryType}</span>
                {person.roleTitle && <span className="px-2 py-0.5 rounded-full bg-tinta-100 text-tinta-700 font-semibold">{person.roleTitle}</span>}
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm mt-2">
                <div>
                  <dt className="text-[11px] text-tinta-500">Documento</dt>
                  <dd className="font-semibold tabular-nums">{person.documentId}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-tinta-500">GT principal</dt>
                  <dd className="font-semibold">{gt || '—'}</dd>
                </div>
                {otherGts.length > 0 && (
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] text-tinta-500">Otros GT</dt>
                    <dd className="font-semibold">{otherGts.join(', ')}</dd>
                  </div>
                )}
              </dl>
              {isAdmin && (
                <button className="text-xs font-semibold text-lila-700 hover:underline inline-flex items-center gap-1 mt-1" onClick={() => setEditPhoto(true)}>
                  <ImageIcon className="w-3.5 h-3.5" /> {profile?.photoUrl ? 'Cambiar foto' : 'Agregar foto'}
                </button>
              )}
            </div>
          </div>
          <div className="flex md:flex-col items-center gap-3 md:w-44 shrink-0">
            {profile ? (
              <button onClick={() => setShowQr(true)} title="Ver QR en grande" className="relative">
                <QrCode value={qrLink('P', profile.qrToken)} size={140} label={`QR personal de ${person.name}`} className="border border-tinta-200" />
                <Maximize2 className="absolute bottom-1.5 right-1.5 w-4 h-4 text-tinta-500 bg-white rounded" />
              </button>
            ) : (
              <div className="w-[140px] h-[140px] rounded-xl bg-tinta-100 animate-pulse flex items-center justify-center text-[11px] text-tinta-500 text-center p-2">
                {error || 'Cargando QR…'}
              </div>
            )}
            <div className="text-center">
              <p className="text-[11px] text-tinta-500">QR personal</p>
              {isAdmin && profile && <RenewQrButton personId={person.id} onDone={setProfile} />}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-negro text-white rounded-3xl p-4">
          <p className="text-[10px] font-subtitle text-lila-300">DÍAS POINTS</p>
          <p className="text-3xl font-display mt-1 tabular-nums">{formatPoints(total)}</p>
          <p className="text-[11px] text-white/60">individuales</p>
        </div>
        <Stat icon={CalendarCheck} label="Asistencias" value={myAttendance.filter((x) => x.a.status === 'llego' || x.a.status === 'llego_tarde').length} />
        <Stat icon={Swords} label="Retos y actividades" value={challengesDone.length} />
        <Stat icon={Award} label="Reconocimientos" value={recognitions.length} />
      </div>

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} onClick={() => setAssigning(true)}>
            <Plus className="w-4 h-4" /> ASIGNAR DÍAS POINTS
          </button>
        </div>
      )}

      <Section icon={ScrollText} title="Historial de puntos" actions={isAdmin && mine.some((m) => m.voided) ? (
        <label className="flex items-center gap-1.5 text-xs text-tinta-600 cursor-pointer">
          <input type="checkbox" className="accent-lila-600" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} /> Ver anulados
        </label>
      ) : undefined}>
        {(showVoided ? mine : active).length === 0 ? (
          <EmptyState icon={ScrollText} title="Aún no tiene DÍAS POINTS" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-semibold text-tinta-500 uppercase tracking-wide border-b border-tinta-200">
                  <th className="text-left px-4 py-2">Fecha</th>
                  <th className="text-left px-2 py-2">Actividad</th>
                  <th className="text-left px-2 py-2">Recibe</th>
                  <th className="text-left px-2 py-2">Tipo</th>
                  <th className="text-right px-2 py-2">Puntos</th>
                  <th className="text-left px-2 py-2">Motivo</th>
                  <th className="text-left px-2 py-2">Registró</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-tinta-100">
                {(showVoided ? mine : active).map((m) => (
                  <MovementRow key={m.id} m={m} recipient={person.name} onEdit={isAdmin ? (md) => setEditing({ m, mode: md }) : undefined} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <PersonFoodSection personId={person.id} />

      <Section icon={CalendarCheck} title="Historial de asistencia">
        {myAttendance.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Sin registros de asistencia" />
        ) : (
          <ul className="divide-y divide-tinta-100">
            {myAttendance.map(({ a, ev }) => (
              <li key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-tinta-900 truncate">{ev!.title}</p>
                  <p className="text-[11px] text-tinta-500">
                    {ev!.date}
                    {a.checkedInAt && ` · ${formatClock(a.checkedInAt)}`}
                    {a.source === 'qr' && ' · QR'}
                    {a.excuseReason && ` · Excusa: ${a.excuseReason}`}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold shrink-0 ${STATE_STYLE[a.status]}`}>{ATTENDANCE_STATE_LABELS[a.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section icon={Swords} title="Retos y actividades">
          {challengesDone.length === 0 ? (
            <EmptyState icon={Swords} title="Aún no ha participado en retos" />
          ) : (
            <ul className="divide-y divide-tinta-100">
              {challengesDone.map((c) => (
                <li key={c.name + c.date} className="px-4 py-2.5 flex justify-between gap-3">
                  <span className="text-sm">
                    <span className="font-semibold text-tinta-900">{c.name}</span>
                    <span className="block text-[11px] text-tinta-500">{c.date}</span>
                  </span>
                  <span className="font-bold tabular-nums">+{formatPoints(c.points)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section icon={Award} title="Reconocimientos">
          {recognitions.length === 0 ? (
            <EmptyState icon={Award} title="Sin reconocimientos todavía" />
          ) : (
            <ul className="divide-y divide-tinta-100">
              {recognitions.map((m) => (
                <li key={m.id} className="px-4 py-2.5 flex justify-between gap-3">
                  <span className="text-sm">
                    <span className="font-semibold text-tinta-900">{m.activityName}</span>
                    <span className="block text-[11px] text-tinta-500">
                      {m.date} · {m.reason}
                    </span>
                  </span>
                  <span className={`font-bold tabular-nums ${m.points < 0 ? 'text-coral-700' : ''}`}>
                    {m.points > 0 ? '+' : ''}
                    {formatPoints(m.points)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {showQr && profile && <PersonalQrModal name={person.name} token={profile.qrToken} onClose={() => setShowQr(false)} />}
      {assigning && <AssignPointsModal people={people} person={person} onClose={() => setAssigning(false)} />}
      {editing && <EditMovementModal movement={editing.m} mode={editing.mode} label={person.name} onClose={() => setEditing(null)} />}
      {editPhoto && <PhotoModal person={person} current={profile?.photoUrl} onSaved={setProfile} onClose={() => setEditPhoto(false)} />}
    </div>
  );
};

const Stat: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: number }> = ({ icon: Icon, label, value }) => (
  <div className="bg-surface border border-tinta-200 rounded-3xl p-4">
    <Icon className="w-4 h-4 text-tinta-500" />
    <p className="text-2xl font-bold tabular-nums text-tinta-900 mt-1">{value}</p>
    <p className="text-[11px] text-tinta-500">{label}</p>
  </div>
);

const Section: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; actions?: React.ReactNode; children: React.ReactNode }> = ({
  icon: Icon,
  title,
  actions,
  children,
}) => (
  <Card className="overflow-hidden">
    <div className="px-4 py-3 border-b border-tinta-200 flex items-center justify-between gap-2">
      <p className="text-sm font-semibold text-tinta-900 flex items-center gap-2">
        <Icon className="w-4 h-4 text-tinta-500" /> {title}
      </p>
      {actions}
    </div>
    {children}
  </Card>
);

const RenewQrButton: React.FC<{ personId: string; onDone: (p: PersonProfileData) => void }> = ({ personId, onDone }) => {
  const [confirm, setConfirm] = useState(false);
  const [busy, run] = useBusy();
  return confirm ? (
    <span className="flex flex-col items-center gap-1 mt-1">
      <span className="text-[10px] text-coral-700 text-center">El QR anterior dejará de funcionar.</span>
      <span className="flex gap-2">
        <button className="text-[11px] font-semibold text-tinta-600" onClick={() => setConfirm(false)}>
          No
        </button>
        <button
          className="text-[11px] font-semibold text-coral-700"
          disabled={busy}
          onClick={() =>
            run(() =>
              attempt(async () => {
                const pr = await api.adminProfile(personId);
                onDone(await api.updateProfile(personId, pr.photoUrl ?? '', true));
                setConfirm(false);
              }, 'QR personal renovado')
            )
          }
        >
          Sí, renovar
        </button>
      </span>
    </span>
  ) : (
    <button className="text-[11px] font-semibold text-lila-700 hover:underline inline-flex items-center gap-1" onClick={() => setConfirm(true)}>
      <RefreshCw className="w-3 h-3" /> Renovar QR
    </button>
  );
};

const PhotoModal: React.FC<{ person: Person; current?: string; onSaved: (p: PersonProfileData) => void; onClose: () => void }> = ({ person, current, onSaved, onClose }) => {
  const [url, setUrl] = useState(current ?? '');
  const [busy, run] = useBusy();
  return (
    <Modal
      title="Fotografía"
      subtitle={person.name}
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
                if (await attempt(async () => onSaved(await api.updateProfile(person.id, url)), 'Foto actualizada')) onClose();
              })
            }
          >
            Guardar
          </button>
        </>
      }
    >
      <div className="flex gap-4 items-center">
        <Avatar name={person.name} photoUrl={url || undefined} size="w-20 h-20 text-2xl" />
        <Field label="Enlace de la foto" hint="Pega el enlace público de la imagen (por ejemplo, de Drive o del sitio de EAFIT). Déjalo vacío para quitarla." className="flex-1">
          <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </Field>
      </div>
    </Modal>
  );
};
