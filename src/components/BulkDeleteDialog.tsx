import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { btnDanger, btnSecondary, Field, inputCls, Modal } from './league/ui';

/**
 * Confirmación para borrados masivos: muestra el impacto y pide escribir
 * ELIMINAR para evitar borrar por accidente.
 */
export const BulkDeleteDialog: React.FC<{
  title: string;
  impact: React.ReactNode;
  onConfirm: () => Promise<string | void>;
  onClose: () => void;
}> = ({ title, impact, onConfirm, onClose }) => {
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const ready = word.trim().toUpperCase() === 'ELIMINAR';

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        result ? (
          <button className={btnSecondary} onClick={onClose}>
            Cerrar
          </button>
        ) : (
          <>
            <button className={btnSecondary} onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button
              className={btnDanger}
              disabled={!ready || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setResult((await onConfirm()) || 'Eliminación completada.');
                } catch (e) {
                  setResult(e instanceof Error ? e.message : 'No se pudo completar la eliminación.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 className="w-4 h-4" /> {busy ? 'Eliminando…' : 'Eliminar definitivamente'}
            </button>
          </>
        )
      }
    >
      {result ? (
        <p className="text-sm text-tinta-800">{result}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-2xl bg-coral-50 border border-coral-200 p-3 text-sm text-coral-900">
            <AlertTriangle className="w-5 h-5 shrink-0 text-coral-600" />
            <div className="space-y-1">{impact}</div>
          </div>
          <p className="text-xs text-tinta-600">Esta acción no se puede deshacer. Si quieres conservar una copia, descarga antes el respaldo JSON.</p>
          <Field label="Escribe ELIMINAR para confirmar">
            <input className={inputCls} value={word} onChange={(e) => setWord(e.target.value)} placeholder="ELIMINAR" autoFocus />
          </Field>
        </div>
      )}
    </Modal>
  );
};
