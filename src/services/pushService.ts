import { CalendarEvent, EventReminderPreference, ReminderOffset } from '../types';
import { getSupabase } from './supabaseClient';
import { dueReminders, formatTime12 } from './calendarService';

/**
 * Notificaciones push del navegador para los recordatorios del calendario.
 *
 * - Con la app ABIERTA: un ciclo local revisa cada 30 s qué recordatorios
 *   vencen y los muestra con el service worker.
 * - Con la app CERRADA: la función programada de Supabase
 *   (supabase/functions/send-reminders) envía el push al navegador usando la
 *   suscripción guardada en la tabla push_subscriptions. Requiere configurar
 *   VITE_VAPID_PUBLIC_KEY (ver docs/CALENDARIO_Y_LEAGUE.md).
 *
 * Ambas vías usan la misma etiqueta (tag), así que el navegador no duplica
 * el aviso si llega por las dos.
 */

const VAPID_PUBLIC_KEY: string = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || '';
const SHOWN_KEY = 'dias_eafit_reminders_shown';

export type PushPermission = NotificationPermission | 'unsupported';

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function getPushPermission(): PushPermission {
  return isPushSupported() ? Notification.permission : 'unsupported';
}

// ----------------------------------------------------------------------------
// Activar / desactivar desde la app (campanita). El permiso del navegador no se
// puede quitar desde una página, así que "desactivar" guarda la preferencia en
// este dispositivo y cancela la suscripción push (el servidor deja de enviar).
// ----------------------------------------------------------------------------
const OFF_KEY = 'dias_eafit_notifications_off';
const PROMPTED_KEY = 'dias_eafit_notifications_prompted';
const changeListeners = new Set<() => void>();

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function writeFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Estado para la campanita: activas, apagadas por la persona, bloqueadas en el navegador o no compatibles. */
export type NotificationStatus = 'activas' | 'desactivadas' | 'sin_decidir' | 'bloqueadas' | 'no_compatible';

export function getNotificationStatus(): NotificationStatus {
  const perm = getPushPermission();
  if (perm === 'unsupported') return 'no_compatible';
  if (perm === 'denied') return 'bloqueadas';
  if (perm === 'default') return 'sin_decidir';
  return readFlag(OFF_KEY) ? 'desactivadas' : 'activas';
}

/** ¿Se deben mostrar avisos en este dispositivo? */
export function notificationsOn(): boolean {
  return getNotificationStatus() === 'activas';
}

export function onNotificationStatusChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => {
    changeListeners.delete(fn);
  };
}
const emitChange = () => changeListeners.forEach((fn) => fn());

/** Apaga las notificaciones en este dispositivo. */
export async function disablePushNotifications(): Promise<void> {
  writeFlag(OFF_KEY, true);
  try {
    const reg = isPushSupported() ? await navigator.serviceWorker.getRegistration() : undefined;
    const sub = await reg?.pushManager?.getSubscription();
    // Al cancelarla, el servidor recibe "ya no existe" en el próximo envío y la borra.
    await sub?.unsubscribe();
  } catch (err) {
    console.warn('No se pudo cancelar la suscripción push:', err);
  }
  emitChange();
}

/** ¿Hay que preguntarle a esta persona si quiere activar las notificaciones? (solo la primera vez) */
export function shouldPromptNotifications(userKey: string): boolean {
  if (getNotificationStatus() !== 'sin_decidir') return false;
  try {
    const seen: string[] = JSON.parse(localStorage.getItem(PROMPTED_KEY) || '[]');
    return !seen.includes(userKey);
  } catch {
    return true;
  }
}

export function markNotificationsPrompted(userKey: string) {
  try {
    const seen: string[] = JSON.parse(localStorage.getItem(PROMPTED_KEY) || '[]');
    if (!seen.includes(userKey)) localStorage.setItem(PROMPTED_KEY, JSON.stringify([...seen, userKey].slice(-50)));
  } catch {
    /* ignore */
  }
}

/** ¿Se pueden enviar push con la app cerrada? (requiere clave VAPID y Supabase) */
export function isBackgroundPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && getSupabase() && typeof window !== 'undefined' && 'PushManager' in window);
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return Promise.resolve(null);
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('No se pudo registrar el service worker:', err);
      return null;
    });
  }
  return registrationPromise;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function hashId(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

/**
 * Pide permiso de notificaciones y, si es posible, registra la suscripción
 * push en el servidor para recibir avisos con la app cerrada.
 */
export async function enablePushNotifications(_personId?: string): Promise<PushPermission> {
  if (!isPushSupported()) return 'unsupported';
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') {
    emitChange();
    return permission;
  }
  writeFlag(OFF_KEY, false);
  emitChange();
  const reg = await registerServiceWorker();
  if (reg && isBackgroundPushConfigured()) {
    try {
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        }));
      const json = sub.toJSON();
      // Se guarda con la sesión de quien la activa (función segura del servidor):
      // integrantes → recordatorios de sus eventos; administración → cumpleaños.
      const { api } = await import('./leagueApi');
      const { getCurrentSession } = await import('./session');
      const data = {
        id: await hashId(sub.endpoint),
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh || '',
        auth: json.keys?.auth || '',
        userAgent: navigator.userAgent.slice(0, 250),
      };
      if (getCurrentSession()?.role === 'admin') await api.saveAdminPushSubscription(data);
      else await api.savePushSubscription(data);
    } catch (err) {
      console.warn('No se pudo registrar la suscripción push:', err);
    }
  }
  return permission;
}

function readShown(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SHOWN_KEY) || '{}');
  } catch {
    return {};
  }
}

const WHEN: Record<number, string> = { 1440: 'Es mañana', 60: 'Empieza en 1 hora', 15: 'Empieza en 15 minutos' };

function reminderBody(ev: CalendarEvent, offset: number) {
  return `${WHEN[offset] ?? 'Empieza pronto'} · ${formatTime12(ev.startTime)}${ev.location ? ` · ${ev.location}` : ''}`;
}

export async function showReminderNotification(ev: CalendarEvent, offset: ReminderOffset) {
  const reg = await registerServiceWorker();
  const title = ev.title;
  const options: NotificationOptions = {
    body: reminderBody(ev, offset),
    tag: `${ev.id}__${offset}`,
    icon: '/icon-192.png',
    data: { url: '/' },
  };
  if (reg) await reg.showNotification(title, options);
  else new Notification(title, options);
}

/**
 * Revisa periódicamente los recordatorios vencidos mientras la app está abierta.
 * Devuelve una función para detener el ciclo.
 */
export function startForegroundReminders(
  personId: string,
  getData: () => { events: CalendarEvent[]; prefs: EventReminderPreference[] }
): () => void {
  const tick = () => {
    if (!notificationsOn()) return;
    const { events, prefs } = getData();
    const shown = readShown();
    const now = Date.now();
    dueReminders(events, prefs, personId).forEach(({ key, event, offset }) => {
      if (shown[key]) return;
      shown[key] = now;
      void showReminderNotification(event, offset);
    });
    // Limpieza: olvidar avisos de hace más de 3 días
    Object.keys(shown).forEach((k) => now - shown[k] > 3 * 86400_000 && delete shown[k]);
    localStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
  };
  tick();
  const id = window.setInterval(tick, 30_000);
  return () => window.clearInterval(id);
}
