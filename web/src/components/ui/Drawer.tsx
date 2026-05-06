import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
  children: ReactNode;
};

export function Drawer({ open, onClose, width = 720, children }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) { document.addEventListener('keydown', h); document.body.style.overflow = 'hidden'; }
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
          zIndex: 39, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 220ms',
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, height: '100vh', width,
          background: 'var(--ck-surface)',
          boxShadow: '-8px 0 32px rgba(15,23,42,0.12)',
          zIndex: 40, display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 360ms cubic-bezier(0.2,0.8,0.2,1)',
          overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close drawer"
          style={{
            position: 'absolute', top: 16, right: 20, width: 36, height: 36,
            border: '1px solid var(--ck-line)', borderRadius: 10, background: 'var(--ck-surface)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ck-muted)', zIndex: 1,
          }}
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </>
  );
}
