import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, BellRing, X } from 'lucide-react';
import { CurrentUser } from '../types';
import {
  disablePushNotifications,
  enablePushNotifications,
  getNotificationStatus,
  markNotificationsPrompted,
  NotificationStatus,
  onNotificationStatusChange,
  shouldPromptNotifications,
} from '../services/pushService';

/** Estado de las notificaciones de este dispositivo, actualizado al instante. */
function useNotificationStatus(): NotificationStatus {
  const [status, setStatus] = useState<NotificationStatus>(getNotificationStatus());
  useEffect(() => {
    const refresh = () => setStatus(getNotificationStatus());
    const off = onNotificationStatusChange(refresh);
    // Si la persona cambia el permiso en el navegador y vuelve a la app
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      off();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return status;
}

const whatYouGet = (isAdmin: boolean) =>
  isAdmin
    ? 'Recordatorios de los cumpleaños del equipo (7 días antes, 1 día antes y el mismo día a las 12:00 p. m.) y de los eventos del calendario.'
    : 'Recordatorios de los eventos del calendario en los que actives un recordatorio, aunque no tengas la app abierta.';

const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

const StatusText: React.FC<{ status: NotificationStatus }> = ({ status }) => {
  const map: Record<NotificationStatus, { title: string; body: string; cls: string }> = {
    activas: {
      title: 'Notificaciones activadas',
      body: 'Te llegarán los avisos en este dispositivo.',
      cls: 'text-turquesa-700',
    },
    desactivadas: {
      title: 'Notificaciones desactivadas',
      body: 'No te llegará ningún aviso en este dispositivo hasta que las vuelvas a activar.',
      cls: 'text-tinta-700',
    },
    sin_decidir: {
      title: 'Notificaciones apagadas',
      body: 'Actívalas para recibir los avisos en este dispositivo.',
      cls: 'text-tinta-700',
    },
    bloqueadas: {
      title: 'Bloqueadas en el navegador',
      body: 'Este navegador tiene bloqueadas las notificaciones de DÍAS. Para activarlas, toca el candado junto a la dirección de la página → Notificaciones → Permitir, y vuelve a la app.',
      cls: 'text-coral-700',
    },
    no_compatible: {
      title: 'Este navegador no permite notificaciones',
      body: isIos()
        ? 'En iPhone, primero agrega DÍAS a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí.'
        : 'Prueba desde Chrome, Edge, Firefox o Safari actualizados.',
      cls: 'text-tinta-700',
    },
  };
  const m = map[status];
  return (
    <div>
      <p className={`text-sm font-semibold ${m.cls}`}>{m.title}</p>
      <p className="text-xs text-tinta-600 mt-1 leading-relaxed">{m.body}</p>
    </div>
  );
};

/** Campanita del encabezado: abre un panel para activar o desactivar las notificaciones. */
export const NotificationBell: React.FC<{ currentUser: CurrentUser | null }> = ({ currentUser }) => {
  const status = useNotificationStatus();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const on = status === 'activas';
  const canToggle = status === 'activas' || status === 'desactivadas' || status === 'sin_decidir';
  const Icon = on ? Bell : BellOff;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={on ? 'Notificaciones activadas' : 'Notificaciones desactivadas'}
        aria-label="Notificaciones"
        aria-expanded={open}
        className="relative p-2 rounded-xl bg-white/8 hover:bg-white/15 text-white/70 hover:text-white transition-colors"
      >
        <Icon className="w-4 h-4" />
        {!on && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-coral-300 rounded-full ring-2 ring-tinta-900" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="fixed left-3 right-3 top-[4.5rem] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 z-50 rounded-2xl bg-surface border border-tinta-200 shadow-2xl p-4 text-left space-y-3 text-tinta-900"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-tinta-500">Notificaciones</p>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-tinta-500 hover:bg-tinta-100" aria-label="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${on ? 'bg-turquesa-50 text-turquesa-700' : 'bg-tinta-100 text-tinta-500'}`}>
              <Icon className="w-4 h-4" />
            </div>
            <StatusText status={status} />
          </div>

          {canToggle && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-tinta-200 bg-tinta-50 px-3 py-2.5">
              <span className="text-sm font-semibold">{on ? 'Activadas' : 'Desactivadas'}</span>
              <button
                role="switch"
                aria-checked={on}
                disabled={busy}
                onClick={() => run(() => (on ? disablePushNotifications() : enablePushNotifications(currentUser?.staffData?.id)))}
                className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-lila-600' : 'bg-tinta-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          )}

          {currentUser && <p className="text-[11px] text-tinta-500 leading-relaxed">{whatYouGet(isAdmin)}</p>}
        </div>
      )}
    </div>
  );
};

/**
 * La primera vez que una persona entra en este dispositivo, le preguntamos si
 * quiere activar las notificaciones. Solo una vez por persona y dispositivo.
 */
export const NotificationPrompt: React.FC<{ currentUser: CurrentUser | null }> = ({ currentUser }) => {
  const key = currentUser
    ? currentUser.role === 'admin'
      ? `admin:${currentUser.adminData?.username ?? 'admin'}`
      : `staff:${currentUser.staffData?.id ?? ''}`
    : '';
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setShow(Boolean(key) && shouldPromptNotifications(key));
  }, [key]);

  if (!show || !currentUser) return null;
  const firstName = (currentUser.staffData?.name || currentUser.adminData?.name || '').split(' ')[0];
  const done = () => {
    markNotificationsPrompted(key);
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Activar notificaciones">
      <div className="bg-surface rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-tinta-200 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-lila-50 border border-lila-200 flex items-center justify-center">
          <BellRing className="w-7 h-7 text-lila-600" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-display text-tinta-900">{firstName ? `${firstName}, ¿activamos las notificaciones?` : '¿Activamos las notificaciones?'}</p>
          <p className="text-sm text-tinta-600 leading-relaxed">{whatYouGet(currentUser.role === 'admin')}</p>
          <p className="text-xs text-tinta-500">Puedes cambiarlo cuando quieras con la campanita de arriba.</p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await enablePushNotifications(currentUser.staffData?.id);
              } finally {
                setBusy(false);
                done();
              }
            }}
            className="w-full px-4 py-3 rounded-2xl bg-lila-600 hover:bg-lila-800 text-white font-bold text-sm transition-colors disabled:opacity-60"
          >
            Activar notificaciones
          </button>
          <button onClick={done} className="w-full px-4 py-2.5 rounded-2xl text-tinta-600 hover:bg-tinta-100 font-semibold text-sm transition-colors">
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
};
