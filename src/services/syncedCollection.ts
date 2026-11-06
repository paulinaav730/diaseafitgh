import { getSupabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Colección reactiva para los módulos de Calendario, DÍAS League y Perfil DÍAS.
 *
 * Con Supabase configurado (producción):
 *  - La fuente de verdad es la base de datos. Nada se guarda en localStorage.
 *  - La colección solo LEE: tablas públicas con select, y privadas con una
 *    función de lectura (`loader`) que exige sesión.
 *  - Las escrituras NO van directo a las tablas: pasan por las funciones
 *    seguras de leagueApi.ts, que después actualizan la colección con la fila
 *    que confirmó el servidor (`applyFromServer`).
 *  - Los cambios de otros usuarios llegan por Realtime (tablas públicas).
 *
 * Sin Supabase (demo y desarrollo local): se guarda en localStorage.
 */
export interface SyncedCollection<T extends { id: string }> {
  subscribe(listener: (items: T[]) => void): () => void;
  getAll(): T[];
  get(id: string): T | undefined;
  /** Solo modo local: guarda y notifica. */
  upsert(item: T): void;
  upsertMany(items: T[]): void;
  remove(id: string): void;
  /** Reemplaza/agrega filas confirmadas por el servidor. */
  applyFromServer(items: T[]): void;
  /** Vuelve a leer desde Supabase. */
  pull(): Promise<void>;
  /** Borra el contenido en memoria (p. ej. al cerrar sesión, para datos privados). */
  clear(): void;
}

interface Options<T> {
  storageKey: string;
  table: string;
  fromRow: (row: any) => T;
  /** Lectura privada mediante RPC (si la tabla no es pública). Devuelve filas crudas. */
  loader?: () => Promise<any[] | null>;
}

const realtimeTables = new Map<string, () => void>();
let realtimeChannel: any = null;
let realtimeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRealtime() {
  if (realtimeChannel || realtimeTimer) return;
  // Se agrupan las tablas que se registran al arrancar en un solo canal
  realtimeTimer = setTimeout(() => {
    const client = getSupabase();
    realtimeTimer = null;
    if (!client || realtimeChannel || realtimeTables.size === 0) return;
    let channel = client.channel('public:calendar_league');
    realtimeTables.forEach((onChange, table) => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange());
    });
    realtimeChannel = channel.subscribe();
  }, 50);
}

export const isRemoteMode = () => isSupabaseConfigured();

export function createSyncedCollection<T extends { id: string }>(opts: Options<T>): SyncedCollection<T> {
  let cache: T[] = [];
  let loaded = false;
  const listeners = new Set<(items: T[]) => void>();
  const remote = isRemoteMode();

  const persist = () => {
    if (remote) return;
    try {
      localStorage.setItem(opts.storageKey, JSON.stringify(cache));
    } catch (err) {
      console.warn(`No se pudo guardar ${opts.storageKey}:`, err);
    }
  };
  const emit = () => listeners.forEach((fn) => fn([...cache]));

  const load = () => {
    if (loaded) return;
    loaded = true;
    if (remote) {
      try {
        // Limpieza: datos que versiones anteriores dejaron en el navegador
        localStorage.removeItem(opts.storageKey);
      } catch {
        /* ignore */
      }
      void collection.pull();
      if (!opts.loader) {
        realtimeTables.set(opts.table, () => void collection.pull());
        scheduleRealtime();
      }
      return;
    }
    try {
      const raw = localStorage.getItem(opts.storageKey);
      cache = raw ? JSON.parse(raw) : [];
    } catch {
      cache = [];
    }
  };

  if (typeof window !== 'undefined' && !remote) {
    // Sincronización entre pestañas del mismo navegador (modo local)
    window.addEventListener('storage', (e) => {
      if (e.key !== opts.storageKey || !e.newValue) return;
      try {
        cache = JSON.parse(e.newValue);
        emit();
      } catch {
        /* ignore */
      }
    });
  }

  const merge = (items: T[]) => {
    const byId = new Map(cache.map((x) => [x.id, x] as const));
    items.forEach((it) => byId.set(it.id, it));
    cache = [...byId.values()];
  };

  const collection: SyncedCollection<T> = {
    subscribe(listener) {
      load();
      listeners.add(listener);
      listener([...cache]);
      return () => listeners.delete(listener);
    },
    getAll() {
      load();
      return [...cache];
    },
    get(id) {
      load();
      return cache.find((x) => x.id === id);
    },
    upsert(item) {
      collection.upsertMany([item]);
    },
    upsertMany(items) {
      load();
      if (items.length === 0) return;
      merge(items);
      persist();
      emit();
    },
    remove(id) {
      load();
      cache = cache.filter((x) => x.id !== id);
      persist();
      emit();
    },
    applyFromServer(items) {
      if (items.length === 0) return;
      merge(items);
      emit();
    },
    clear() {
      cache = [];
      emit();
    },
    async pull() {
      if (!remote) return;
      const client = getSupabase();
      if (!client) return;
      try {
        let rows: any[] | null = [];
        if (opts.loader) {
          rows = await opts.loader();
          if (rows === null) return;
        } else {
          const pageSize = 1000;
          for (let from = 0; ; from += pageSize) {
            const { data, error } = await client.from(opts.table).select('*').range(from, from + pageSize - 1);
            if (error) {
              console.warn(`Supabase select ${opts.table}:`, error);
              return;
            }
            rows.push(...(data || []));
            if (!data || data.length < pageSize) break;
          }
        }
        cache = rows.map(opts.fromRow);
        emit();
      } catch (err) {
        console.warn(`Supabase pull ${opts.table}:`, err);
      }
    },
  };

  return collection;
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

/** Token aleatorio no predecible (192 bits) para QR en modo local. */
export function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
