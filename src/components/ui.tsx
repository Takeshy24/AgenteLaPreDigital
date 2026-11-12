import { Bot, Eye, Hand, X } from 'lucide-react';
import { useSurfaceLight } from '../shared/useSurfaceLight';
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return <button {...props} className={`button ${variant} ${className}`} />;
}
// Quién actúa sobre cada bloque del expediente: el agente lo hace solo, solo el operador, o es
// información de lectura. Se muestra con color y texto para no depender únicamente del color.
export type Mode = 'agent' | 'manual' | 'info';
const MODES: Record<Mode, { chip: string; hint: string; Icon: typeof Bot }> = {
  agent: {
    chip: 'Automático',
    hint: 'Lo registra el agente por sí solo. Los controles de este bloque sirven para corregir o completar.',
    Icon: Bot,
  },
  manual: {
    chip: 'Solo manual',
    hint: 'El agente no interviene: lo registra el operador.',
    Icon: Hand,
  },
  info: {
    chip: 'Solo lectura',
    hint: 'Información del lead; se actualiza sola.',
    Icon: Eye,
  },
};
export function ModeChip({ mode }: { mode: Mode }) {
  const { chip, hint, Icon } = MODES[mode];
  return (
    <span className={`mode-chip ${mode}`} title={hint}>
      <Icon size={13} aria-hidden="true" />
      {chip}
    </span>
  );
}
export function ModeLegend() {
  return (
    <ul className="mode-legend" aria-label="Quién actúa en cada bloque">
      {(Object.keys(MODES) as Mode[]).map((mode) => (
        <li key={mode}>
          <ModeChip mode={mode} />
          <span>{MODES[mode].hint}</span>
        </li>
      ))}
    </ul>
  );
}
export function Card({
  title,
  label,
  mode,
  className = '',
  children,
}: {
  title: string;
  label?: string;
  mode?: Mode;
  className?: string;
  children: ReactNode;
}) {
  const light = useSurfaceLight();
  return (
    <section {...light} className={`panel live-section${mode ? ` mode-${mode}` : ''} ${className}`}>
      {(label || mode) && (
        <div className="section-head">
          {label && <span className="eyebrow">{label}</span>}
          {mode && <ModeChip mode={mode} />}
        </div>
      )}
      <h3>{title}</h3>
      {children}
    </section>
  );
}
export function Badge({ value }: { value: string }) {
  const tone: Record<string, string> = {
    Alta: 'red',
    Media: 'blue',
    Baja: 'amber',
    Nula: 'gray',
    Pendiente: 'slate',
    Activa: 'green',
    Suspendida: 'amber',
    Finalizada: 'gray',
    Convertida: 'green',
  };
  return <span className={`pill ${tone[value] || 'slate'}`}>{value}</span>;
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty" role="status">
      {children}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  className = '',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,button,select,textarea')?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) || [],
      ).filter((element) => element.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={ref}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
