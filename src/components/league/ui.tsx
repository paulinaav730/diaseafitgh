import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { CalendarEventType, CALENDAR_EVENT_TYPE_LABELS } from '../../types';

/** Colores por tipo de evento (paleta de marca). El texto siempre acompaña al color. */
export const EVENT_TYPE_STYLES: Record<CalendarEventType, { chip: string; dot: string; bar: string }> = {
  conectados: { chip: 'bg-lila-100 text-lila-800 border-lila-200', dot: 'bg-lila-500', bar: 'border-l-lila-500' },
  reunion_gt: { chip: 'bg-turquesa-100 text-turquesa-800 border-turquesa-200', dot: 'bg-turquesa-500', bar: 'border-l-turquesa-500' },
  reunion_general: { chip: 'bg-mostaza-100 text-mostaza-800 border-mostaza-200', dot: 'bg-mostaza-400', bar: 'border-l-mostaza-400' },
  reto: { chip: 'bg-coral-100 text-coral-800 border-coral-200', dot: 'bg-coral-400', bar: 'border-l-coral-400' },
  capacitacion: { chip: 'bg-lima-100 text-lima-800 border-lima-200', dot: 'bg-lima-500', bar: 'border-l-lima-500' },
  institucional: { chip: 'bg-tinta-200 text-tinta-800 border-tinta-300', dot: 'bg-tinta-700', bar: 'border-l-tinta-700' },
  otro: { chip: 'bg-tinta-100 text-tinta-700 border-tinta-200', dot: 'bg-tinta-400', bar: 'border-l-tinta-400' },
};

export const EventTypeChip: React.FC<{ type: CalendarEventType; className?: string }> = ({ type, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${EVENT_TYPE_STYLES[type].chip} ${className}`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${EVENT_TYPE_STYLES[type].dot}`} />
    {CALENDAR_EVENT_TYPE_LABELS[type]}
  </span>
);

export const formatPoints = (n: number) =>
  n.toLocaleString('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 1 });

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ title, subtitle, onClose, children, footer, size = 'md' }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const width = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`bg-surface border border-tinta-200 rounded-t-3xl sm:rounded-3xl ${width} w-full max-h-[92vh] flex flex-col shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3 border-b border-tinta-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-tinta-900 font-display leading-tight">{title}</h3>
            {subtitle && <p className="text-xs text-tinta-500 mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-xl text-tinta-500 hover:text-tinta-900 hover:bg-tinta-100"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 sm:px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 sm:px-6 py-3 border-t border-tinta-100 flex flex-wrap justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
};

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({
  label,
  hint,
  children,
  className = '',
}) => (
  <label className={`block ${className}`}>
    <span className="block text-xs font-semibold text-tinta-700 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-tinta-500 mt-1">{hint}</span>}
  </label>
);

export const inputCls =
  'w-full px-3 py-2 rounded-xl bg-tinta-50 border border-tinta-300 text-sm text-tinta-900 placeholder-tinta-400 focus:outline-hidden focus:border-lila-500 focus:bg-surface';

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-lila-600 hover:bg-lila-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed';
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-surface border border-tinta-300 hover:bg-tinta-50 text-tinta-800 text-sm font-semibold disabled:opacity-40';
export const btnDanger =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-coral-50 border border-coral-200 hover:bg-coral-100 text-coral-700 text-sm font-semibold';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-surface border border-tinta-200 rounded-3xl ${className}`}>{children}</div>
);

export const PageHeader: React.FC<{ kicker: string; title: string; description?: string; actions?: React.ReactNode }> = ({
  kicker,
  title,
  description,
  actions,
}) => (
  <Card className="p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div className="min-w-0">
      <p className="text-[10px] text-lila-700 font-subtitle">{kicker}</p>
      <h1 className="text-2xl sm:text-3xl font-display text-tinta-900 mt-1">{title}</h1>
      {description && <p className="text-sm text-tinta-600 mt-1.5 max-w-2xl">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
  </Card>
);

/** Selector segmentado (pestañas internas). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: { id: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex flex-wrap gap-1 p-1 bg-tinta-100 rounded-2xl ${className}`} role="tablist">
      {options.map((o) => {
        const Icon = o.icon;
        const active = value === o.id;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              active ? 'bg-surface text-tinta-900 shadow-xs' : 'text-tinta-600 hover:text-tinta-900'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Lista de opciones con casillas (para GT, destinatarios, etc.). */
export function CheckList<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: { id: T; label: string }[];
  selected: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            type="button"
            key={o.id}
            onClick={() => onChange(on ? selected.filter((x) => x !== o.id) : [...selected, o.id])}
            aria-pressed={on}
            className={`px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${
              on ? 'bg-tinta-900 border-tinta-900 text-white' : 'bg-surface border-tinta-300 text-tinta-700 hover:border-tinta-500'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const EmptyState: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; text?: string }> = ({
  icon: Icon,
  title,
  text,
}) => (
  <div className="text-center py-10 px-4">
    <div className="w-12 h-12 mx-auto rounded-2xl bg-tinta-100 text-tinta-500 flex items-center justify-center">
      <Icon className="w-6 h-6" />
    </div>
    <p className="mt-3 text-sm font-semibold text-tinta-800">{title}</p>
    {text && <p className="mt-1 text-xs text-tinta-500 max-w-sm mx-auto">{text}</p>}
  </div>
);

/** Hook: suscribe un componente a una colección sincronizada. */
export function useCollection<T>(subscribe: (fn: (items: T[]) => void) => () => void): T[] {
  const [items, setItems] = React.useState<T[]>([]);
  useEffect(() => subscribe(setItems), [subscribe]);
  return items;
}
