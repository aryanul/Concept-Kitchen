import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconAction } from './IconAction';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({ open, onClose, title, subtitle, width = 520, children, footer }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) { document.addEventListener('keydown', h); document.body.style.overflow = 'hidden'; }
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;

  // Render via portal so the modal escapes any <label>/form ancestors that would
  // otherwise intercept clicks on form controls inside it.
  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: 16, animation: 'ck-fade-in 160ms ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: width, background: 'var(--ck-surface)',
          borderRadius: 14, boxShadow: 'var(--ck-shadow-lg)',
          display: 'flex', flexDirection: 'column', maxHeight: '90vh',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '20px 24px 16px', borderBottom: '1px solid var(--ck-line)', flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--ck-ink)' }}>{title}</h2>
            {subtitle && <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--ck-muted)' }}>{subtitle}</p>}
          </div>
          <IconAction icon={X} label="Close" iconOnly variant="plain" onClick={onClose} iconSize={18} tipPlacement="bottom" />
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--ck-line)', flexShrink: 0,
            display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
