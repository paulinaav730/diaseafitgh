import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { errorMessage } from '../../services/leagueApi';

type Toast = { id: number; kind: 'ok' | 'error'; text: string };
let seq = 0;
const listeners = new Set<(t: Toast) => void>();

export const notify = {
  ok(text: string) {
    const t = { id: ++seq, kind: 'ok' as const, text };
    listeners.forEach((fn) => fn(t));
  },
  error(e: unknown) {
    const t = { id: ++seq, kind: 'error' as const, text: errorMessage(e) };
    listeners.forEach((fn) => fn(t));
  },
};

/**
 * Ejecuta una acción del servidor mostrando el resultado.
 * Devuelve true solo si el servidor confirmó la operación.
 */
export async function attempt(fn: () => Promise<unknown>, okText?: string): Promise<boolean> {
  try {
    await fn();
    if (okText) notify.ok(okText);
    return true;
  } catch (e) {
    notify.error(e);
    return false;
  }
}

/** Hook para botones: estado "guardando" mientras se espera la confirmación. */
export function useBusy(): [boolean, <T>(fn: () => Promise<T>) => Promise<T | undefined>] {
  const [busy, setBusy] = useState(false);
  const run = async <T,>(fn: () => Promise<T>) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}

export const Toaster: React.FC = () => {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const fn = (t: Toast) => {
      setItems((x) => [...x.slice(-3), t]);
      setTimeout(() => setItems((x) => x.filter((y) => y.id !== t.id)), t.kind === 'error' ? 7000 : 3500);
    };
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return (
    <div
      className="fixed z-[70] left-1/2 -translate-x-1/2 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 flex flex-col gap-2 w-[min(92vw,28rem)]"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 shadow-xl text-sm ${
            t.kind === 'ok' ? 'bg-negro text-white' : 'bg-coral-600 text-white'
          }`}
        >
          {t.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-turquesa-300" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{t.text}</span>
          <button onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))} aria-label="Cerrar aviso" className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
