import { CurrentUser } from '../types';

/**
 * Sesión actual para las acciones protegidas (Calendario, DÍAS League, Perfil DÍAS).
 * El token lo emite el servidor (login_admin / login_staff) y cada función de la
 * base de datos lo verifica: sin un token válido no se puede modificar nada.
 */
let current: CurrentUser | null = null;
const listeners = new Set<(u: CurrentUser | null) => void>();

export function setCurrentSession(user: CurrentUser | null) {
  const changed = current?.sessionToken !== user?.sessionToken || current?.role !== user?.role;
  current = user;
  if (changed) listeners.forEach((fn) => fn(user));
}

export function getCurrentSession(): CurrentUser | null {
  return current;
}

export function getSessionToken(): string | undefined {
  return current?.sessionToken;
}

export function onSessionChange(fn: (u: CurrentUser | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Nombre de quien realiza la acción (para trazabilidad) */
export function actorName(): string {
  if (!current) return 'Sistema';
  return current.role === 'admin' ? current.adminData?.name || 'Administrador' : current.staffData?.name || 'Integrante';
}
