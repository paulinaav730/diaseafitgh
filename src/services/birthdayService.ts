import { Person } from '../types';
import { api } from './leagueApi';
import { getCurrentSession } from './session';
import { notificationsOn, registerServiceWorker } from './pushService';
import { BirthdayPerson, dueBirthdayReminders } from '../../supabase/functions/_shared/birthdays';

export * from '../../supabase/functions/_shared/birthdays';

/**
 * Cumpleaños para la administración. La fecha de nacimiento es privada: solo
 * se descarga con una sesión de administración (función segura del servidor).
 * No hay eventos guardados: el calendario calcula cada año a partir de la fecha.
 */
let cache: BirthdayPerson[] = [];
let lastPeople: Person[] = [];
const listeners = new Set<(list: BirthdayPerson[]) => void>();

function emit() {
  listeners.forEach((fn) => fn([...cache]));
}

export const birthdays = {
  subscribe(fn: (list: BirthdayPerson[]) => void) {
    listeners.add(fn);
    fn([...cache]);
    return () => {
      listeners.delete(fn);
    };
  },
  get: () => [...cache],
  /** Vuelve a cargar desde el servidor (o desde el modo local). Solo administración. */
  async refresh(people?: Person[]): Promise<void> {
    if (people) lastPeople = people;
    if (getCurrentSession()?.role !== 'admin') {
      cache = [];
      emit();
      return;
    }
    try {
      cache = await api.listBirthdays(lastPeople);
    } catch (err) {
      console.warn('No se pudieron cargar los cumpleaños:', err);
    }
    emit();
  },
  clear() {
    cache = [];
    emit();
  },
};

const SHOWN_KEY = 'dias_eafit_birthday_reminders_shown';

/**
 * Con la app ABIERTA: muestra los recordatorios de cumpleaños (7 días antes,
 * 1 día antes y el mismo día a las 12:00 p. m. de Bogotá). Con la app cerrada
 * los envía la función programada del servidor; ambos usan la misma etiqueta,
 * así que el navegador no repite el aviso.
 */
export function startBirthdayReminders(): () => void {
  const tick = async () => {
    if (!notificationsOn()) return;
    let shown: Record<string, number> = {};
    try {
      shown = JSON.parse(localStorage.getItem(SHOWN_KEY) || '{}');
    } catch {
      /* ignore */
    }
    const now = Date.now();
    // Ventana amplia: si la app se abre en la tarde, el aviso del mediodía aún aparece.
    for (const r of dueBirthdayReminders(cache, new Date(), 12 * 3600_000)) {
      if (shown[r.key]) continue;
      shown[r.key] = now;
      const reg = await registerServiceWorker();
      const options: NotificationOptions = { body: r.body, tag: r.key, icon: '/icon-192.png', data: { url: '/' } };
      if (reg) await reg.showNotification(r.title, options);
      else new Notification(r.title, options);
    }
    Object.keys(shown).forEach((k) => now - shown[k] > 10 * 86400_000 && delete shown[k]);
    try {
      localStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
    } catch {
      /* ignore */
    }
  };
  void tick();
  const id = window.setInterval(() => void tick(), 60_000);
  const unsub = birthdays.subscribe(() => void tick());
  return () => {
    window.clearInterval(id);
    unsub();
  };
}
