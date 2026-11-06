import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, Keyboard } from 'lucide-react';
import { btnSecondary, inputCls, Modal } from './ui';

/**
 * Lector de QR con la cámara del dispositivo (funciona en Android y iPhone).
 * Si no hay cámara o el permiso se niega, permite pegar el enlace del QR.
 * `continuous`: sigue leyendo (para registrar varias personas seguidas).
 */
export const QrScanner: React.FC<{
  title: string;
  subtitle?: string;
  onResult: (text: string) => void | Promise<void>;
  onClose: () => void;
  continuous?: boolean;
  footer?: React.ReactNode;
}> = ({ title, subtitle, onResult, onClose, continuous = false, footer }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const busyRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !busyRef.current) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
          const now = Date.now();
          // Evita leer el mismo código varias veces seguidas
          if (code?.data && !(code.data === lastRef.current.text && now - lastRef.current.at < 3000)) {
            lastRef.current = { text: code.data, at: now };
            busyRef.current = true;
            if ('vibrate' in navigator) navigator.vibrate?.(60);
            try {
              await onResult(code.data);
            } finally {
              busyRef.current = false;
            }
            if (!continuous) return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('sin cámara');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        raf = requestAnimationFrame(tick);
      } catch {
        setError('No se pudo usar la cámara. Permite el acceso a la cámara o pega el enlace del QR.');
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} footer={footer}>
      <div className="space-y-3">
        {!error ? (
          <div className="relative rounded-2xl overflow-hidden bg-negro aspect-square max-h-[60vh] mx-auto">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-[18%] border-2 border-white/80 rounded-2xl pointer-events-none" />
            <span className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/80 flex items-center justify-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> Apunta al código QR
            </span>
          </div>
        ) : (
          <p className="text-sm text-coral-700 bg-coral-50 border border-coral-200 rounded-xl px-3 py-2">{error}</p>
        )}
        <canvas ref={canvasRef} className="hidden" />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) void onResult(manual.trim());
            setManual('');
          }}
        >
          <div className="relative flex-1">
            <Keyboard className="w-4 h-4 text-tinta-400 absolute left-3 top-2.5" />
            <input className={`${inputCls} pl-9`} value={manual} onChange={(e) => setManual(e.target.value)} placeholder="O pega el enlace del QR" />
          </div>
          <button type="submit" className={btnSecondary} disabled={!manual.trim()}>
            Usar
          </button>
        </form>
      </div>
    </Modal>
  );
};
