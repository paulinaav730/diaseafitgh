import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Info, Plus, XCircle, Zap, CalendarCheck, IdCard } from 'lucide-react';
import { CurrentUser, Person } from '../types';
import { calendarEvents, checkinWindow, formatClock, personPrimaryGt, todayIso } from '../services/calendarService';
import { pointActivities } from '../services/leagueService';
import { api, errorMessage, PersonScan } from '../services/leagueApi';
import { btnPrimary, btnSecondary, Modal, useCollection } from './league/ui';
import { attempt, useBusy } from './league/toast';
import { QrKind } from './league/QrCode';
import { Avatar, PersonProfile } from './PersonProfile';
import { AssignPointsModal } from './LeagueMovements';

type Outcome = { ok: boolean; title: string; text?: string; tone?: 'ok' | 'info' | 'error' };

/**
 * Una misma lectura de QR se procesa UNA sola vez aunque la pantalla se monte
 * dos veces seguidas (modo desarrollo de React). Un nuevo escaneo, segundos
 * después, sí se envía al servidor y recibe "ya estaba registrada".
 */
const inflight = new Map<string, { at: number; promise: Promise<unknown> }>();
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = inflight.get(key);
  if (hit && Date.now() - hit.at < 2_000) return hit.promise as Promise<T>;
  const promise = fn();
  inflight.set(key, { at: Date.now(), promise });
  return promise;
}

/**
 * Lo que pasa al escanear un QR de DÍAS:
 *  - E (evento): el integrante registra SU asistencia. Un admin ve un aviso.
 *  - A (actividad): el integrante recibe los DÍAS POINTS (una vez).
 *  - P (persona): el admin ve el perfil y puede registrar participación o asignar puntos;
 *    otro integrante solo ve nombre y GT.
 * Todo se valida en el servidor con la sesión de quien escanea.
 */
export const QrActionModal: React.FC<{ kind: QrKind; token: string; user: CurrentUser; people: Person[]; onClose: () => void }> = ({
  kind,
  token,
  user,
  people,
  onClose,
}) => {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [scan, setScan] = useState<PersonScan | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (kind === 'E') {
          if (user.role !== 'staff') {
            if (alive) setOutcome({ ok: false, tone: 'info', title: 'QR de asistencia', text: 'Este código es para que los integrantes registren su asistencia con su propia sesión.' });
            return;
          }
          const r = await once(`E:${token}`, () => api.checkin(token));
          if (!alive) return;
          setOutcome(
            r.result === 'registrada'
              ? {
                  ok: true,
                  title: `¡Tu asistencia a ${r.eventTitle} quedó registrada!`,
                  text: `${r.status === 'llego_tarde' ? 'Llegada tarde' : 'Llegada a tiempo'} · ${formatClock(r.checkedInAt)}`,
                }
              : { ok: true, tone: 'info', title: 'Tu asistencia ya estaba registrada', text: `${r.eventTitle} · ${formatClock(r.checkedInAt)}` }
          );
        } else if (kind === 'A') {
          if (user.role !== 'staff') {
            if (alive) setOutcome({ ok: false, tone: 'info', title: 'QR de actividad', text: 'Los integrantes lo escanean con su sesión para recibir los DÍAS POINTS.' });
            return;
          }
          const r = await once(`A:${token}`, () => api.claimActivityQr(token));
          if (!alive) return;
          const pts = (r.points || []).map((p) => (p.target === 'person' ? `+${p.points} para ti` : `+${p.points} para ${p.gt}`)).join(' · ');
          setOutcome(
            r.result === 'registrada'
              ? { ok: true, title: `¡Participación en ${r.activity} registrada!`, text: pts ? `DÍAS POINTS: ${pts}` : undefined }
              : { ok: true, tone: 'info', title: 'Ya habías registrado esta actividad', text: 'Los puntos se entregan una sola vez por persona.' }
          );
        } else {
          const r = await once(`P:${token}`, () => api.resolvePersonQr(token, people));
          if (alive) setScan(r);
        }
      } catch (e) {
        if (alive) setOutcome({ ok: false, tone: 'error', title: 'No se pudo completar', text: errorMessage(e) });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, token]);

  if (kind === 'P' && scan) {
    if (scan.access === 'admin') return <AdminPersonScan person={scan.person as Person} people={people} onClose={onClose} />;
    const p = scan.person as { name: string; gt?: string };
    return (
      <Modal title="Integrante de DÍAS" onClose={onClose}>
        <div className="flex items-center gap-4 py-2">
          <Avatar name={p.name} photoUrl={scan.photoUrl} />
          <div>
            <p className="text-lg font-semibold text-tinta-900">{p.name}</p>
            <p className="text-sm text-tinta-600">{p.gt ? `GT ${p.gt}` : 'Integrante'}</p>
          </div>
        </div>
        <p className="text-[11px] text-tinta-500">Solo la administración puede registrar puntos o asistencia con este código.</p>
      </Modal>
    );
  }

  return (
    <Modal title={kind === 'E' ? 'Asistencia' : kind === 'A' ? 'DÍAS POINTS' : 'Perfil DÍAS'} onClose={onClose}>
      {!outcome ? (
        <p className="py-6 text-center text-sm text-tinta-600">Verificando el código…</p>
      ) : (
        <div className="flex flex-col items-center text-center gap-3 py-4">
          {outcome.tone === 'error' ? (
            <XCircle className="w-14 h-14 text-coral-600" />
          ) : outcome.tone === 'info' ? (
            <Info className="w-14 h-14 text-lila-600" />
          ) : (
            <CheckCircle2 className="w-14 h-14 text-turquesa-600" />
          )}
          <p className="text-xl font-display text-tinta-900 max-w-sm">{outcome.title}</p>
          {outcome.text && <p className="text-sm text-tinta-600">{outcome.text}</p>}
          <button className={btnPrimary} onClick={onClose}>
            Listo
          </button>
        </div>
      )}
    </Modal>
  );
};

/** El admin escaneó el QR personal: identificación + acciones permitidas. */
const AdminPersonScan: React.FC<{ person: Person; people: Person[]; onClose: () => void }> = ({ person, people, onClose }) => {
  const events = useCollection(calendarEvents.subscribe);
  const acts = useCollection(pointActivities.subscribe);
  const [assigning, setAssigning] = useState(false);
  const [fullProfile, setFullProfile] = useState(false);
  const [busy, run] = useBusy();
  const openEvents = useMemo(
    () => events.filter((e) => e.status === 'activo' && (e.attendanceEnabled || e.type === 'conectados') && (e.date === todayIso() || checkinWindow(e) === 'abierta') && !api.isClosed(e.id)),
    [events]
  );
  const activeActs = acts.filter((a) => a.status === 'activa' && a.mechanism !== 'qr_actividad');

  if (fullProfile)
    return (
      <Modal title="Perfil DÍAS" onClose={onClose} size="xl">
        <PersonProfile person={person} people={people} mode="admin" />
      </Modal>
    );

  return (
    <Modal title="Integrante identificado" onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar name={person.name} />
          <div className="min-w-0">
            <p className="text-lg font-semibold text-tinta-900">{person.name}</p>
            <p className="text-sm text-tinta-600">
              {personPrimaryGt(person) ? `GT ${personPrimaryGt(person)}` : person.primaryType} · CC {person.documentId}
            </p>
          </div>
        </div>
        {openEvents.length > 0 && (
          <div className="rounded-2xl border border-tinta-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-tinta-700 flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4" /> Registrar llegada a un evento de hoy
            </p>
            {openEvents.map((e) => (
              <button
                key={e.id}
                className={`${btnSecondary} w-full justify-between`}
                disabled={busy}
                onClick={() => run(() => attempt(() => api.setAttendance(e.id, [person.id], 'llego'), `${person.name}: LLEGÓ a ${e.title}`))}
              >
                {e.title} <span className="text-[11px] text-tinta-500">Marcar LLEGÓ</span>
              </button>
            ))}
          </div>
        )}
        {activeActs.length > 0 && (
          <div className="rounded-2xl border border-tinta-200 p-3 space-y-2">
            <p className="text-xs font-semibold text-tinta-700 flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> Registrar participación en una actividad
            </p>
            {activeActs.map((a) => (
              <button
                key={a.id}
                className={`${btnSecondary} w-full justify-between`}
                disabled={busy}
                onClick={() =>
                  run(() =>
                    attempt(async () => {
                      const r = await api.awardActivity(a.id, { personId: person.id }, people);
                      if (r.result === 'ya_registrada') throw new Error(`${person.name} ya estaba registrado en ${a.name}.`);
                    }, `${person.name}: participación en ${a.name} registrada`)
                  )
                }
              >
                {a.name} <span className="text-[11px] text-tinta-500">+{a.individualPoints || a.gtPoints} pts</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} onClick={() => setAssigning(true)}>
            <Plus className="w-4 h-4" /> ASIGNAR DÍAS POINTS
          </button>
          <button className={btnSecondary} onClick={() => setFullProfile(true)}>
            <IdCard className="w-4 h-4" /> Ver perfil completo
          </button>
        </div>
      </div>
      {assigning && <AssignPointsModal people={people} person={person} onClose={() => setAssigning(false)} />}
    </Modal>
  );
};
