import { useEffect, type ReactNode } from 'react';

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="ghost" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function EventSelect({ events, value, onChange, all }: { events: { id: string; name: string }[]; value: string; onChange: (v: string) => void; all?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="種目">
      {all && <option value="">すべての種目</option>}
      {events.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
    </select>
  );
}

export function NumInput({ value, onChange, min = 0, max, style }: { value: number; onChange: (n: number) => void; min?: number; max?: number; style?: React.CSSProperties }) {
  return <input type="number" value={value} min={min} max={max} style={style} onChange={(e) => onChange(Number(e.target.value) || 0)} />;
}
