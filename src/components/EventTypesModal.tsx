import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { BUILTIN_EVENT_TYPES, BUILTIN_EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, EventTypeColor } from '../types';
import { customEventTypes } from '../services/calendarService';
import { api } from '../services/leagueApi';
import { btnPrimary, btnSecondary, COLOR_STYLES, EventTypeChip, Field, inputCls, Modal, useCollection } from './league/ui';
import { attempt, useBusy } from './league/toast';

const COLOR_NAMES: Record<EventTypeColor, string> = {
  lila: 'Lila',
  turquesa: 'Turquesa',
  coral: 'Coral',
  mostaza: 'Mostaza',
  lima: 'Lima',
  tinta: 'Gris',
};

/** Tipos de evento: los predefinidos de DÍAS y los que crea el administrador. */
export const EventTypesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const custom = useCollection(customEventTypes.subscribe);
  const [name, setName] = useState('');
  const [color, setColor] = useState<EventTypeColor>('turquesa');
  const [busy, run] = useBusy();

  return (
    <Modal title="Tipos de evento" subtitle="Los tipos predefinidos de DÍAS y los que crees tú." onClose={onClose} size="lg">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-tinta-700 mb-2">Predefinidos</p>
          <div className="flex flex-wrap gap-1.5">
            {BUILTIN_EVENT_TYPES.map((t) => (
              <EventTypeChip key={t} type={t} />
            ))}
          </div>
          <p className="text-[11px] text-tinta-500 mt-2">
            {BUILTIN_EVENT_TYPE_LABELS.capacitacion} se divide en “por invitación” y “abierta” al crear el evento.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-tinta-700 mb-2">Creados por la administración</p>
          {custom.length === 0 ? (
            <p className="text-sm text-tinta-500">Todavía no hay tipos creados.</p>
          ) : (
            <ul className="divide-y divide-tinta-100 border border-tinta-200 rounded-2xl">
              {custom.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-3 py-2">
                  <EventTypeChip type={t.id} />
                  <button
                    className="p-1.5 rounded-lg hover:bg-coral-50 text-coral-700"
                    disabled={busy}
                    onClick={() => run(() => attempt(() => api.deleteEventType(t.id), 'Tipo eliminado'))}
                    aria-label={`Eliminar ${t.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-tinta-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-tinta-700">Nuevo tipo</p>
          <Field label="Nombre">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Integración de GT" />
          </Field>
          <div>
            <p className="text-xs font-semibold text-tinta-700 mb-1.5">Color</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
              {EVENT_TYPE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  onClick={() => setColor(c)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${
                    color === c ? 'border-tinta-900' : 'border-tinta-200'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${COLOR_STYLES[c].swatch}`} />
                  {COLOR_NAMES[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={onClose}>
              Cerrar
            </button>
            <button
              className={btnPrimary}
              disabled={busy || !name.trim()}
              onClick={() =>
                run(async () => {
                  if (await attempt(() => api.saveEventType(undefined, name, color), 'Tipo creado')) setName('');
                })
              }
            >
              Crear tipo
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
