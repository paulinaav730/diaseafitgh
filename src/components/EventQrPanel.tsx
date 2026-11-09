import React, { useEffect, useState } from 'react';
import { Maximize2, QrCode as QrIcon, RefreshCw, Lock, Unlock } from 'lucide-react';
import { CalendarEvent } from '../types';
import { api, QrInfo } from '../services/leagueApi';
import { formatTime12 } from '../services/calendarService';
import { QrCode, qrLink } from './league/QrCode';
import { btnSecondary, Modal } from './league/ui';
import { attempt, useBusy } from './league/toast';

/**
 * QR de asistencia de un evento (solo administradores): mostrar, cerrar,
 * habilitar o renovar. Renovar invalida el código anterior.
 */
export const EventQrPanel: React.FC<{ event: CalendarEvent; isClosed: boolean }> = ({ event: e, isClosed }) => {
  const [qr, setQr] = useState<QrInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [busy, run] = useBusy();

  useEffect(() => {
    api
      .eventQr(e.id, 'ver')
      .then(setQr)
      .catch((err) => setError(err.message));
  }, [e.id]);

  const act = (action: 'habilitar' | 'cerrar' | 'renovar', ok: string) =>
    run(() =>
      attempt(async () => {
        setQr(await api.eventQr(e.id, action));
      }, ok)
    );

  const status = isClosed
    ? 'Asistencia cerrada'
    : !qr?.enabled
    ? 'QR cerrado: nadie puede registrarse'
    : 'Abierto: los invitados pueden escanear hasta que lo cierres';

  return (
    <div className="rounded-2xl border border-lila-200 bg-lila-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <QrIcon className="w-4 h-4 text-lila-700" />
        <span className="text-sm font-semibold text-tinta-900">QR de asistencia</span>
      </div>
      {error && <p className="text-xs text-coral-700">{error}</p>}
      {qr && (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button onClick={() => setFullscreen(true)} className={`shrink-0 ${qr.enabled && !isClosed ? '' : 'opacity-40'}`} title="Ver en grande para proyectar">
            <QrCode value={qrLink('E', qr.token)} size={132} label={`QR de asistencia de ${e.title}`} />
          </button>
          <div className="space-y-2 text-center sm:text-left">
            <p className={`text-xs font-semibold ${qr.enabled && !isClosed ? 'text-turquesa-700' : 'text-tinta-600'}`}>{status}</p>
            <p className="text-[11px] text-tinta-600">
              Muéstralo al final del evento. Cada integrante lo escanea con la cámara de su celular y su sesión de DÍAS iniciada. No tiene límite de tiempo: sigue abierto hasta que toques <b>Cerrar QR</b>.
            </p>
            {!isClosed && (
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <button className={btnSecondary} onClick={() => setFullscreen(true)}>
                  <Maximize2 className="w-4 h-4" /> Proyectar
                </button>
                {qr.enabled ? (
                  <button className={btnSecondary} disabled={busy} onClick={() => act('cerrar', 'QR cerrado')}>
                    <Lock className="w-4 h-4" /> Cerrar QR
                  </button>
                ) : (
                  <button className={btnSecondary} disabled={busy} onClick={() => act('habilitar', 'QR habilitado')}>
                    <Unlock className="w-4 h-4" /> Habilitar
                  </button>
                )}
                <button className={btnSecondary} disabled={busy} onClick={() => act('renovar', 'QR renovado: el anterior ya no sirve')}>
                  <RefreshCw className="w-4 h-4" /> Renovar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {fullscreen && qr && (
        <Modal title={e.title} subtitle="Escanea con la cámara de tu celular para registrar tu asistencia" onClose={() => setFullscreen(false)} size="lg">
          <div className="flex flex-col items-center gap-3 py-2">
            <QrCode value={qrLink('E', qr.token)} size={360} className="max-w-full h-auto" label={`QR de asistencia de ${e.title}`} />
            <p className="text-sm text-tinta-700 text-center">Inicia sesión en DÍAS antes de escanear. Tu asistencia se registra una sola vez.</p>
          </div>
        </Modal>
      )}
    </div>
  );
};
