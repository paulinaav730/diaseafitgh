import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Cake, Download, IdCard, PartyPopper, Upload } from 'lucide-react';
import { api, errorMessage } from '../services/leagueApi';
import { BirthdayImportRow, downloadBirthdayTemplate, ImportRowStatus, readBirthdayFile } from '../services/birthdayImport';
import { Person } from '../types';
import {
  addDaysIso,
  BirthdayOccurrence,
  birthdays,
  birthdaysInRange,
  bogotaToday,
  formatBirthdayDate,
} from '../services/birthdayService';
import { enablePushNotifications, getPushPermission, isPushSupported, PushPermission } from '../services/pushService';
import { btnPrimary, btnSecondary, Modal, useCollection } from './league/ui';
import { PersonProfile } from './PersonProfile';

/**
 * Cumpleaños en el calendario de la administración.
 * No son eventos guardados: se calculan para el rango visible a partir de la
 * fecha de nacimiento (privada), así que se repiten cada año y la edad se
 * actualiza sola.
 */

/** Estilo propio, distinto al de reuniones y actividades. */
export const BIRTHDAY_STYLE = 'bg-coral-50 border border-dashed border-coral-300 text-coral-900 hover:bg-coral-100';

export const birthdayTitle = (o: Pick<BirthdayOccurrence, 'name'>) => `🎂 CUMPLEAÑOS — ${o.name}`;

/** Cumpleaños por fecha para un rango (solo administración). */
export function useBirthdaysByDate(enabled: boolean, people: Person[], from: string, to: string, gtFilter: string) {
  const list = useCollection(birthdays.subscribe);
  useEffect(() => {
    if (enabled) void birthdays.refresh(people);
    // La lista de personas cambia de referencia a menudo; basta con su tamaño.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, people.length]);
  return useMemo(() => {
    const m = new Map<string, BirthdayOccurrence[]>();
    if (!enabled) return m;
    const visible = gtFilter === 'all' ? list : list.filter((b) => b.gt === gtFilter);
    birthdaysInRange(visible, from, to).forEach((o) => m.set(o.date, [...(m.get(o.date) || []), o]));
    return m;
  }, [enabled, list, from, to, gtFilter]);
}

export const BirthdayPill: React.FC<{ o: BirthdayOccurrence; onOpen: (o: BirthdayOccurrence) => void; compact?: boolean }> = ({ o, onOpen, compact }) => (
  <button
    onClick={(ev) => {
      ev.stopPropagation();
      onOpen(o);
    }}
    className={`w-full text-left rounded-lg px-1.5 py-1 transition-colors ${BIRTHDAY_STYLE}`}
    title={`${birthdayTitle(o)} · cumple ${o.age} años`}
  >
    <span className="block text-[11px] font-semibold truncate">🎂 {o.name}</span>
    {!compact && <span className="block text-[10px] text-coral-700">Cumple {o.age} años{o.gt ? ` · GT ${o.gt}` : ''}</span>}
  </button>
);

export const BirthdayDot: React.FC<{ o: BirthdayOccurrence; onOpen: (o: BirthdayOccurrence) => void }> = ({ o, onOpen }) => (
  <button onClick={() => onOpen(o)} className="w-2 h-2 rounded-full bg-coral-500 ring-1 ring-coral-200" aria-label={birthdayTitle(o)} />
);

/** Tarjeta de la lista (vista "Lista"). */
export const BirthdayListItem: React.FC<{ o: BirthdayOccurrence; onOpen: (o: BirthdayOccurrence) => void }> = ({ o, onOpen }) => (
  <button onClick={() => onOpen(o)} className={`text-left rounded-2xl p-3 transition-colors ${BIRTHDAY_STYLE}`}>
    <p className="font-semibold">{birthdayTitle(o)}</p>
    <p className="text-xs text-coral-800 mt-1">
      🎉 ¡Cumple {o.age} años! · {formatBirthdayDate(o.date)}
      {o.gt ? ` · GT ${o.gt}` : ''}
    </p>
  </button>
);

/** Próximos cumpleaños (30 días) para la parte de arriba del calendario. */
export const UpcomingBirthdays: React.FC<{ onOpen: (o: BirthdayOccurrence) => void }> = ({ onOpen }) => {
  const list = useCollection(birthdays.subscribe);
  const today = bogotaToday();
  const upcoming = useMemo(() => birthdaysInRange(list, today, addDaysIso(today, 30)).slice(0, 6), [list, today]);
  if (upcoming.length === 0) return null;
  return (
    <div className="rounded-2xl border border-coral-200 bg-coral-50/60 p-3.5">
      <p className="text-xs font-semibold text-coral-900 flex items-center gap-1.5 mb-2">
        <Cake className="w-4 h-4" /> Próximos cumpleaños
      </p>
      <div className="flex flex-wrap gap-2">
        {upcoming.map((o) => {
          const days = Math.round((Date.parse(o.date) - Date.parse(today)) / 86400_000);
          return (
            <button
              key={o.personId + o.date}
              onClick={() => onOpen(o)}
              className="text-left rounded-xl bg-surface border border-coral-200 hover:border-coral-400 px-3 py-2 transition-colors"
            >
              <p className="text-sm font-semibold text-tinta-900">🎂 {o.name}</p>
              <p className="text-[11px] text-tinta-600">
                {days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`} · {formatBirthdayDate(o.date)} · cumple {o.age}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** Detalle del cumpleaños, con acceso al Perfil DÍAS de la persona. */
export const BirthdayModal: React.FC<{ o: BirthdayOccurrence; people: Person[]; onClose: () => void }> = ({ o, people, onClose }) => {
  const [showProfile, setShowProfile] = useState(false);
  const person = people.find((p) => p.id === o.personId);
  if (showProfile && person)
    return (
      <Modal title="Perfil DÍAS" onClose={onClose} size="xl">
        <PersonProfile person={person} people={people} mode="admin" />
      </Modal>
    );
  return (
    <Modal title="Cumpleaños" onClose={onClose}>
      <div className="flex flex-col items-center text-center gap-2 py-2">
        <div className="w-16 h-16 rounded-full bg-coral-50 border border-coral-200 flex items-center justify-center text-3xl">🎂</div>
        <p className="text-lg font-display text-tinta-900">Cumpleaños de {o.name}</p>
        <p className="text-base font-semibold text-coral-700 flex items-center gap-1.5">
          <PartyPopper className="w-4 h-4" /> ¡Cumple {o.age} años!
        </p>
        <p className="text-sm text-tinta-600">Fecha: {formatBirthdayDate(o.date)}</p>
        {o.gt && <p className="text-sm text-tinta-600">GT {o.gt}</p>}
        <div className="flex gap-2 mt-3">
          {person && (
            <button className={btnPrimary} onClick={() => setShowProfile(true)}>
              <IdCard className="w-4 h-4" /> Ver perfil DÍAS
            </button>
          )}
          <button className={btnSecondary} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
};

/**
 * Activar notificaciones de cumpleaños en este dispositivo (administración).
 * Si ya estaban permitidas, renueva en silencio la suscripción en el servidor
 * para que los avisos lleguen aunque la plataforma esté cerrada.
 */
export const AdminBirthdayPushBanner: React.FC = () => {
  const [perm, setPerm] = useState<PushPermission>(getPushPermission());
  useEffect(() => {
    if (perm === 'granted') void enablePushNotifications();
  }, [perm]);
  if (!isPushSupported() || perm === 'granted') return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-2xl border border-coral-200 bg-coral-50 p-4">
      <div className="flex items-start gap-3">
        <Bell className="w-5 h-5 text-coral-700 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-tinta-900">
            {perm === 'denied' ? 'Las notificaciones están bloqueadas' : 'Recibe los recordatorios de cumpleaños'}
          </p>
          <p className="text-xs text-tinta-600 mt-0.5">
            {perm === 'denied'
              ? 'No te llegarán los avisos de cumpleaños. Para activarlos, permite las notificaciones de este sitio en la configuración del navegador.'
              : 'Te avisamos 7 días antes, 1 día antes y el mismo día a las 12:00 p. m. (hora de Colombia), aunque no tengas la plataforma abierta.'}
          </p>
        </div>
      </div>
      {perm === 'default' && (
        <button className={btnPrimary} onClick={async () => setPerm(await enablePushNotifications())}>
          Activar notificaciones
        </button>
      )}
    </div>
  );
};

const STATUS_LABEL: Record<ImportRowStatus, { text: string; cls: string }> = {
  ok: { text: 'Se guarda', cls: 'bg-turquesa-50 text-turquesa-800 border-turquesa-200' },
  sin_cambio: { text: 'Ya estaba', cls: 'bg-tinta-50 text-tinta-600 border-tinta-200' },
  sin_persona: { text: 'No está registrado', cls: 'bg-coral-50 text-coral-800 border-coral-200' },
  fecha_invalida: { text: 'Fecha no válida', cls: 'bg-coral-50 text-coral-800 border-coral-200' },
  sin_fecha: { text: 'Sin fecha', cls: 'bg-tinta-50 text-tinta-500 border-tinta-200' },
  repetida: { text: 'Repetida', cls: 'bg-mostaza-50 text-mostaza-800 border-mostaza-200' },
};

// Primero lo que hay que revisar, luego lo que se guarda
const ORDER: ImportRowStatus[] = ['sin_persona', 'fecha_invalida', 'repetida', 'ok', 'sin_cambio', 'sin_fecha'];

/**
 * Cargar todos los cumpleaños de una vez desde Excel o CSV. Cada fila se une
 * al integrante que ya existe (por cédula o nombre). No crea personas.
 */
export const BirthdayImportModal: React.FC<{ people: Person[]; onClose: () => void }> = ({ people, onClose }) => {
  const current = useCollection(birthdays.subscribe);
  const [rows, setRows] = useState<BirthdayImportRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toSave = (rows || []).filter((r) => r.status === 'ok');
  const counts = (rows || []).reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
  const missing = people.filter((p) => !current.some((b) => b.personId === p.id) && !toSave.some((r) => r.person?.id === p.id)).length;

  const onFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    try {
      const r = await readBirthdayFile(file, people, current);
      if (r.error) {
        setError(r.error);
        setRows(null);
      } else setRows(r.rows);
    } catch {
      setError('No se pudo leer el archivo. Usa un Excel (.xlsx) o CSV.');
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.setBirthDates(toSave.map((x) => ({ personId: x.person!.id, birthDate: x.birthDate! })));
      await birthdays.refresh();
      setDone(`Listo: ${r.saved} cumpleaños guardados${r.skipped.length ? ` · ${r.skipped.length} no se pudieron guardar` : ''}. Ya aparecen en el calendario.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Cargar cumpleaños"
      onClose={onClose}
      size="lg"
      footer={
        done ? (
          <button className={btnPrimary} onClick={onClose}>
            Cerrar
          </button>
        ) : (
          <>
            <button className={btnSecondary} onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button className={btnPrimary} onClick={save} disabled={busy || toSave.length === 0}>
              <Cake className="w-4 h-4" /> {busy ? 'Guardando…' : `Guardar ${toSave.length} cumpleaños`}
            </button>
          </>
        )
      }
    >
      {done ? (
        <p className="text-sm text-tinta-800 py-2">{done}</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-coral-50 border border-coral-200 p-3 text-sm text-tinta-800 space-y-2">
            <p>
              <strong>1.</strong> Descarga la plantilla: trae a los {people.length} integrantes con su cédula. Llena la columna{' '}
              <strong>Fecha de nacimiento</strong> (día/mes/año, por ejemplo 06/11/2003).
            </p>
            <p>
              <strong>2.</strong> Súbela aquí. También sirve tu propio Excel si tiene una columna de cédula (o nombre) y una de fecha de nacimiento.
            </p>
            <button className={btnSecondary} onClick={() => downloadBirthdayTemplate(people, current)}>
              <Download className="w-4 h-4" /> Descargar plantilla
            </button>
          </div>

          <label className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-tinta-200 hover:border-lila-400 p-5 cursor-pointer text-center">
            <Upload className="w-6 h-6 text-tinta-500" />
            <span className="text-sm font-semibold text-tinta-900">{fileName || 'Elegir archivo (.xlsx o .csv)'}</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>

          {error && <p className="text-sm text-coral-700">{error}</p>}

          {rows && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                {(Object.keys(STATUS_LABEL) as ImportRowStatus[])
                  .filter((s) => counts[s])
                  .map((s) => (
                    <span key={s} className={`px-2 py-0.5 rounded-full border font-semibold ${STATUS_LABEL[s].cls}`}>
                      {STATUS_LABEL[s].text}: {counts[s]}
                    </span>
                  ))}
              </div>
              <div className="max-h-72 overflow-auto rounded-2xl border border-tinta-200">
                <table className="w-full text-sm">
                  <thead className="bg-tinta-50 text-[11px] text-tinta-500 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2">Fila</th>
                      <th className="text-left px-3 py-2">Integrante</th>
                      <th className="text-left px-3 py-2">Fecha</th>
                      <th className="text-left px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tinta-100">
                    {[...rows]
                      .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.row - b.row)
                      .map((r) => (
                        <tr key={r.row}>
                          <td className="px-3 py-1.5 text-tinta-500 tabular-nums">{r.row}</td>
                          <td className="px-3 py-1.5">{r.label}</td>
                          <td className="px-3 py-1.5 tabular-nums">{r.birthDate ? r.birthDate.split('-').reverse().join('/') : r.rawDate || '—'}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${STATUS_LABEL[r.status].cls}`}>
                              {STATUS_LABEL[r.status].text}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-tinta-500">
                Solo se guardan las filas "Se guarda". No se crean integrantes nuevos. Después de esta carga, quedarían {missing} integrante(s) sin fecha.
              </p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};
