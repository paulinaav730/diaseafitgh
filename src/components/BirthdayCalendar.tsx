import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Cake, IdCard, PartyPopper } from 'lucide-react';
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
