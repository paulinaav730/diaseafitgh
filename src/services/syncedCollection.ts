import { getSupabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Colección local-first con sincronización opcional a Supabase.
 *
 * Sigue el mismo patrón del resto de la app (storageService):
 *  - Caché en memoria + localStorage para funcionar sin conexión.
 *  - Si Supabase está configurado: cada cambio se sube (upsert) y al iniciar
 *    se descarga la tabla completa; los cambios remotos llegan por Realtime.
 *  - Suscriptores reactivos para que React se actualice.
 */
export interface SyncedCollection<T extends { id: string }> {
  subscribe(listener: (items: T[]) => void): () => void;
  getAll(): T[];
  get(id: string): T | undefined;
  upsert(item: T): void;
  upsertMany(items: T[]): void;
  remove(id: string): void;
  /** Vuelve a descargar desde Supabase (si está configurado). */
  pull(): Promise<void>;
}

interface Options<T> {
  storageKey: string;
  table: string;
  toRow: (item: T) => Record<string, unknown>;
  fromRow: (row: any) => T;
}

const realtimeTables = new Map<string, () => void>();
let realtimeChannel: any = null;

function ensureRealtime() {
  const client = getSupabase();
  if (!client || realtimeChannel || realtimeTables.size === 0) return;
  let channel = client.channel('public:calendar_league');
  realtimeTables.forEach((onChange, table) => {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange());
  });
  realtimeChannel = channel.subscribe();
}

export function createSyncedCollection<T extends { id: string }>(opts: Options<T>): SyncedCollection<T> {
  let cache: T[] = [];
  let loaded = false;
  const listeners = new Set<(items: T[]) => void>();

  const persist = () => {
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
    try {
      const raw = localStorage.getItem(opts.storageKey);
      cache = raw ? JSON.parse(raw) : [];
    } catch {
      cache = [];
    }
    if (isSupabaseConfigured()) {
      void collection.pull();
      realtimeTables.set(opts.table, () => void collection.pull());
      ensureRealtime();
    }
  };

  const push = (items: T[]) => {
    const client = getSupabase();
    if (!client || items.length === 0) return;
    client
      .from(opts.table)
      .upsert(items.map(opts.toRow), { onConflict: 'id' })
      .then(({ error }: { error: unknown }) => {
        if (error) console.warn(`Supabase upsert ${opts.table}:`, error);
      });
  };

  // Sincronización entre pestañas del mismo navegador
  if (typeof window !== 'undefined') {
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
      const byId = new Map(cache.map((x) => [x.id, x] as const));
      items.forEach((it) => byId.set(it.id, it));
      cache = [...byId.values()];
      persist();
      emit();
      push(items);
    },
    remove(id) {
      load();
      cache = cache.filter((x) => x.id !== id);
      persist();
      emit();
      const client = getSupabase();
      if (client) {
        client
          .from(opts.table)
          .delete()
          .eq('id', id)
          .then(({ error }: { error: unknown }) => {
            if (error) console.warn(`Supabase delete ${opts.table}:`, error);
          });
      }
    },
    async pull() {
      const client = getSupabase();
      if (!client) return;
      try {
        const rows: any[] = [];
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
        cache = rows.map(opts.fromRow);
        persist();
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
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
