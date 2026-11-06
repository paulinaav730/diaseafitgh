import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Prefijos del contenido del QR: E = evento (asistencia), A = actividad (puntos), P = persona */
export type QrKind = 'E' | 'A' | 'P';

/**
 * Enlace que lleva el QR. Abre la app y, con la sesión iniciada, registra la
 * acción. El token es aleatorio: no contiene cédula ni datos personales.
 */
export function qrLink(kind: QrKind, token: string): string {
  const base = typeof window !== 'undefined' && /^https?:/.test(window.location.origin) ? window.location.origin : 'https://dias-eafit.app';
  return `${base}/?qr=${kind}.${encodeURIComponent(token)}`;
}

/** Extrae tipo y token de lo que leyó la cámara (enlace o texto). */
export function parseQrPayload(text: string): { kind: QrKind; token: string } | null {
  const raw = text.trim();
  let value = raw;
  try {
    const u = new URL(raw);
    value = u.searchParams.get('qr') || '';
  } catch {
    /* no es un enlace: puede ser el valor directo */
  }
  const m = /^([EAP])\.(.+)$/.exec(decodeURIComponent(value));
  return m ? { kind: m[1] as QrKind, token: m[2] } : null;
}

export const QrCode: React.FC<{ value: string; size?: number; className?: string; label?: string }> = ({
  value,
  size = 220,
  className = '',
  label = 'Código QR',
}) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#242424', light: '#FFFFFF' } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value, size]);
  return src ? (
    <img src={src} width={size} height={size} alt={label} className={`rounded-xl bg-white ${className}`} style={{ imageRendering: 'pixelated' }} />
  ) : (
    <div style={{ width: size, height: size }} className={`rounded-xl bg-tinta-100 animate-pulse ${className}`} aria-label="Generando QR" />
  );
};

// ---------------------------------------------------------------------------
// Al escanear dentro de la app (o abrir un enlace de QR) se avisa a App.tsx
// ---------------------------------------------------------------------------
const PENDING_KEY = 'dias_eafit_pending_qr';
const qrListeners = new Set<(p: { kind: QrKind; token: string }) => void>();

export function emitQr(text: string): boolean {
  const parsed = parseQrPayload(text);
  if (!parsed) return false;
  qrListeners.forEach((fn) => fn(parsed));
  return true;
}

export function onQr(fn: (p: { kind: QrKind; token: string }) => void): () => void {
  qrListeners.add(fn);
  return () => qrListeners.delete(fn);
}

/** Lee ?qr= de la URL al abrir la app, lo guarda hasta que haya sesión y limpia la URL. */
export function takeQrFromUrl(): { kind: QrKind; token: string } | null {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('qr');
    if (raw) {
      sessionStorage.setItem(PENDING_KEY, raw);
      url.searchParams.delete('qr');
      window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
    }
    const pending = sessionStorage.getItem(PENDING_KEY);
    return pending ? parseQrPayload(pending) : null;
  } catch {
    return null;
  }
}

export function clearPendingQr() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}
