import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Lock, Maximize2, Plus, QrCode as QrIcon, RefreshCw, ScanLine, Search, Unlock, UserPlus, Zap } from 'lucide-react';
import { CalendarAudience, LEAGUE_GTS, Person, PointActivity } from '../types';
import { activityClaims, challenges, pointActivities } from '../services/leagueService';
import { audienceLabel, EMPTY_AUDIENCE, personPrimaryGt, todayIso } from '../services/calendarService';
import { api, errorMessage, QrInfo } from '../services/leagueApi';
import { btnPrimary, btnSecondary, Card, CheckList, EmptyState, Field, formatPoints, inputCls, Modal, useCollection } from './league/ui';
import { attempt, notify, useBusy } from './league/toast';
import { QrCode, qrLink, parseQrPayload } from './league/QrCode';
import { QrScanner } from './league/QrScanner';

const MECHANISM_LABELS: Record<PointActivity['mechanism'], string> = {
  qr_actividad: 'Los integrantes escanean el QR de la actividad',
  qr_personal: 'La administración escanea el QR personal',
  ambos: 'Ambos mecanismos',
};

export const LeagueActivities: React.FC<{ people: Person[] }> = ({ people }) => {
  const list = useCollection(pointActivities.subscribe);
  const claims = useCollection(activityClaims.subscribe);
  const [editing, setEditing] = useState<PointActivity | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = useMemo(() => [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [list]);
  const open = sorted.find((a) => a.id === openId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-tinta-600 max-w-2xl">
          Entrega DÍAS POINTS por QR sin registrar a cada persona a mano. Cada integrante recibe los puntos una sola vez por actividad.
        </p>
        <button className={btnPrimary} onClick={() => setEditing('new')}>
          <Plus className="w-4 h-4" /> Nueva actividad
        </button>
      </div>
      {sorted.length === 0 ? (
        <Card>
          <EmptyState icon={Zap} title="Aún no hay actividades con puntos por QR" text="Crea una actividad, define los puntos y comparte su QR o escanea el QR personal de cada participante." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map((a) => {
            const n = claims.filter((c) => c.activityId === a.id).length;
            return (
              <Card key={a.id} className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-tinta-900">{a.name}</h3>
                    <p className="text-[11px] text-tinta-500 mt-0.5">
                      {a.date} · {audienceLabel(a.eligibility, people)}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${a.status === 'activa' ? 'bg-turquesa-100 text-turquesa-800' : 'bg-tinta-100 text-tinta-700'}`}>
                    {a.status === 'activa' ? 'Activa' : 'Cerrada'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {a.individualPoints !== 0 && <span className="px-2 py-1 rounded-lg bg-lila-50 text-lila-800 font-semibold">+{formatPoints(a.individualPoints)} por persona</span>}
                  {a.gtPoints !== 0 && <span className="px-2 py-1 rounded-lg bg-mostaza-50 text-mostaza-800 font-semibold">+{formatPoints(a.gtPoints)} al GT por participante</span>}
                  <span className="px-2 py-1 rounded-lg bg-tinta-100 text-tinta-700 font-semibold">{n} participante{n === 1 ? '' : 's'}</span>
                </div>
                <p className="text-[11px] text-tinta-500">{MECHANISM_LABELS[a.mechanism]}</p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  <button className={btnPrimary} onClick={() => setOpenId(a.id)}>
                    <QrIcon className="w-4 h-4" /> Registrar participación
                  </button>
                  <button className={btnSecondary} onClick={() => setEditing(a)}>
                    <Edit3 className="w-4 h-4" /> Editar
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <ActivityForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {open && <ActivityRegister activity={open} people={people} onClose={() => setOpenId(null)} />}
    </div>
  );
};

const ActivityForm: React.FC<{ initial?: PointActivity; onClose: () => void }> = ({ initial, onClose }) => {
  const retos = useCollection(challenges.subscribe);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [challengeId, setChallengeId] = useState(initial?.challengeId ?? '');
  const [individualPoints, setIndividualPoints] = useState(String(initial?.individualPoints ?? 5));
  const [gtPoints, setGtPoints] = useState(String(initial?.gtPoints ?? 0));
  const [eligibility, setEligibility] = useState<CalendarAudience>(initial?.eligibility ?? EMPTY_AUDIENCE);
  const [mechanism, setMechanism] = useState<PointActivity['mechanism']>(initial?.mechanism ?? 'ambos');
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [status, setStatus] = useState<PointActivity['status']>(initial?.status ?? 'activa');
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useBusy();
  const setE = (patch: Partial<CalendarAudience>) => setEligibility((e) => ({ ...e, ...patch }));

  const submit = () =>
    run(async () => {
      setError(null);
      try {
        await api.saveActivity({
          id: initial?.id,
          name: name.trim(),
          description: description.trim() || undefined,
          challengeId: challengeId || undefined,
          individualPoints: Number(individualPoints) || 0,
          gtPoints: Number(gtPoints) || 0,
          eligibility: eligibility.all ? { ...EMPTY_AUDIENCE, all: true } : eligibility,
          mechanism,
          date,
          status,
        });
        notify.ok('Actividad guardada');
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  return (
    <Modal
      title={initial ? 'Editar actividad' : 'Nueva actividad con DÍAS POINTS'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {error && <span className="text-xs text-coral-700 self-center mr-auto">{error}</span>}
          <button className={btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button className={btnPrimary} onClick={submit} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre" className="sm:col-span-2">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Rally fotográfico" autoFocus />
        </Field>
        <Field label="Descripción" className="sm:col-span-2">
          <textarea className={`${inputCls} min-h-[60px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Puntos individuales" hint="A cada participante">
          <input type="number" className={inputCls} value={individualPoints} onChange={(e) => setIndividualPoints(e.target.value)} />
        </Field>
        <Field label="Puntos para el GT" hint="Se suman al GT del participante, por cada uno">
          <input type="number" className={inputCls} value={gtPoints} onChange={(e) => setGtPoints(e.target.value)} />
        </Field>
        <Field label="Reto relacionado (opcional)">
          <select className={inputCls} value={challengeId} onChange={(e) => setChallengeId(e.target.value)}>
            <option value="">Ninguno</option>
            {retos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Mecanismo" className="sm:col-span-2">
          <select className={inputCls} value={mechanism} onChange={(e) => setMechanism(e.target.value as PointActivity['mechanism'])}>
            {(Object.keys(MECHANISM_LABELS) as PointActivity['mechanism'][]).map((m) => (
              <option key={m} value={m}>
                {MECHANISM_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2 rounded-2xl border border-tinta-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-tinta-700">¿Quién puede recibir los puntos?</p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="accent-lila-600" checked={eligibility.all} onChange={(e) => setE({ all: e.target.checked })} />
            Todos los integrantes que participen
          </label>
          {!eligibility.all && (
            <>
              <CheckList options={LEAGUE_GTS.map((g) => ({ id: g as string, label: g }))} selected={eligibility.gtTeams} onChange={(gtTeams) => setE({ gtTeams })} />
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="accent-lila-600" checked={eligibility.includeGap} onChange={(e) => setE({ includeGap: e.target.checked })} /> GAP
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="accent-lila-600" checked={eligibility.includeMesa} onChange={(e) => setE({ includeMesa: e.target.checked })} /> MESA
                </label>
              </div>
            </>
          )}
        </div>
        {initial && (
          <Field label="Estado">
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as PointActivity['status'])}>
              <option value="activa">Activa (entrega puntos)</option>
              <option value="cerrada">Cerrada</option>
            </select>
          </Field>
        )}
      </div>
    </Modal>
  );
};

/** Registrar participación: QR de la actividad, escaneo de QR personal o registro manual. */
const ActivityRegister: React.FC<{ activity: PointActivity; people: Person[]; onClose: () => void }> = ({ activity: a, people, onClose }) => {
  const claims = useCollection(activityClaims.subscribe);
  const mine = claims.filter((c) => c.activityId === a.id).sort((x, y) => y.claimedAt.localeCompare(x.claimedAt));
  const [qr, setQr] = useState<QrInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const [big, setBig] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, run] = useBusy();
  const showActivityQr = a.mechanism !== 'qr_personal';
  const allowPersonal = a.mechanism !== 'qr_actividad';

  useEffect(() => {
    if (showActivityQr) api.activityQr(a.id).then(setQr).catch((e) => notify.error(e));
  }, [a.id, showActivityQr]);

  const award = async (by: { personQr?: string; personId?: string }) => {
    try {
      const r = await api.awardActivity(a.id, by, people);
      if (r.result === 'ya_registrada') notify.ok(`${r.person} ya estaba registrado en esta actividad`);
      else notify.ok(`${r.person}: participación registrada`);
    } catch (e) {
      notify.error(e);
    }
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return people.filter((p) => p.name.toLowerCase().includes(q) || p.documentId.includes(q)).slice(0, 6);
  }, [query, people]);

  return (
    <Modal title={a.name} subtitle="Registrar participación" onClose={onClose} size="lg">
      <div className="space-y-5">
        {a.status !== 'activa' && <p className="text-sm text-coral-700 bg-coral-50 border border-coral-200 rounded-xl px-3 py-2">Esta actividad está cerrada: no entrega puntos.</p>}
        {showActivityQr && qr && (
          <div className="rounded-2xl border border-lila-200 bg-lila-50 p-4 flex flex-col sm:flex-row items-center gap-4">
            <button onClick={() => setBig(true)} className={qr.enabled ? '' : 'opacity-40'} title="Ver en grande">
              <QrCode value={qrLink('A', qr.token)} size={130} label={`QR de ${a.name}`} />
            </button>
            <div className="space-y-2 text-center sm:text-left">
              <p className="text-sm font-semibold text-tinta-900">QR de la actividad</p>
              <p className="text-[11px] text-tinta-600">Los participantes lo escanean con su sesión iniciada y reciben los puntos una sola vez.</p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <button className={btnSecondary} onClick={() => setBig(true)}>
                  <Maximize2 className="w-4 h-4" /> Proyectar
                </button>
                <button
                  className={btnSecondary}
                  disabled={busy}
                  onClick={() => run(() => attempt(async () => setQr(await api.activityQr(a.id, qr.enabled ? 'cerrar' : 'habilitar')), qr.enabled ? 'QR cerrado' : 'QR habilitado'))}
                >
                  {qr.enabled ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />} {qr.enabled ? 'Cerrar QR' : 'Habilitar'}
                </button>
                <button className={btnSecondary} disabled={busy} onClick={() => run(() => attempt(async () => setQr(await api.activityQr(a.id, 'renovar')), 'QR renovado'))}>
                  <RefreshCw className="w-4 h-4" /> Renovar
                </button>
              </div>
            </div>
          </div>
        )}

        {allowPersonal && (
          <div className="rounded-2xl border border-tinta-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-tinta-900">Escanear el QR personal de los participantes</p>
            <button className={btnPrimary} onClick={() => setScanning(true)} disabled={a.status !== 'activa'}>
              <ScanLine className="w-4 h-4" /> Abrir escáner
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-tinta-200 p-4 space-y-2">
          <p className="text-sm font-semibold text-tinta-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Registrar a mano
          </p>
          <div className="relative">
            <Search className="w-4 h-4 text-tinta-400 absolute left-3 top-2.5" />
            <input className={`${inputCls} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o cédula" />
            {matches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-surface border border-tinta-200 rounded-xl shadow-lg overflow-hidden">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-tinta-50"
                    onClick={() => {
                      setQuery('');
                      void run(() => award({ personId: p.id }));
                    }}
                  >
                    {p.name} <span className="text-xs text-tinta-500">· {personPrimaryGt(p) || p.primaryType}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-tinta-700 mb-2">Participantes ({mine.length})</p>
          {mine.length === 0 ? (
            <p className="text-sm text-tinta-500">Nadie se ha registrado todavía.</p>
          ) : (
            <ul className="divide-y divide-tinta-100 border border-tinta-200 rounded-2xl max-h-60 overflow-y-auto">
              {mine.map((c) => {
                const p = people.find((x) => x.id === c.personId);
                return (
                  <li key={c.id} className="px-3 py-2 flex justify-between text-sm">
                    <span>
                      {p?.name ?? c.personId} <span className="text-[11px] text-tinta-500">· {(p && personPrimaryGt(p)) || p?.primaryType}</span>
                    </span>
                    <span className="text-[11px] text-tinta-500">
                      {c.source === 'qr_actividad' ? 'QR de la actividad' : c.source === 'qr_personal' ? 'QR personal' : 'Manual'} ·{' '}
                      {new Date(c.claimedAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      {big && qr && (
        <Modal title={a.name} subtitle="Escanea con tu celular y tu sesión de DÍAS iniciada" onClose={() => setBig(false)} size="lg">
          <div className="flex justify-center py-2">
            <QrCode value={qrLink('A', qr.token)} size={360} className="max-w-full h-auto" />
          </div>
        </Modal>
      )}
      {scanning && (
        <QrScanner
          title={`Escanear participantes · ${a.name}`}
          subtitle="Escanea el QR personal de cada integrante. Puedes escanear varios seguidos."
          continuous
          onClose={() => setScanning(false)}
          onResult={async (text) => {
            const parsed = parseQrPayload(text);
            if (!parsed || parsed.kind !== 'P') {
              notify.error(new Error('Ese no es un QR personal de DÍAS.'));
              return;
            }
            await award({ personQr: parsed.token });
          }}
        />
      )}
    </Modal>
  );
};
