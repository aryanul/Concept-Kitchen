// Shared UI primitives for CK Nest HRMS

const { useState, useEffect, useRef, useMemo } = React;

// ============= ICONS (inline SVGs) =============
const Icon = ({ name, size = 18, stroke = 1.6 }) => {
  const s = size, sw = stroke;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home': return <svg {...common}><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>;
    case 'users': return <svg {...common}><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c0-2 2-3.5 4-3.5s2 .5 2.5 1"/></svg>;
    case 'briefcase': return <svg {...common}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/><path d="M3 13h18"/></svg>;
    case 'logout': return <svg {...common}><path d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H10"/></svg>;
    case 'settings': return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>;
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>;
    case 'bell': return <svg {...common}><path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21h4"/></svg>;
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'cloud': return <svg {...common}><path d="M17 18a4 4 0 100-8 6 6 0 00-11 1 4 4 0 00-1 7"/></svg>;
    case 'calendar': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>;
    case 'chevron-down': return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevron-right': return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevron-left': return <svg {...common}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'filter': return <svg {...common}><path d="M3 5h18l-7 9v6l-4-2v-4z"/></svg>;
    case 'eye': return <svg {...common}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'pencil': return <svg {...common}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4z"/></svg>;
    case 'trash': return <svg {...common}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>;
    case 'check': return <svg {...common}><path d="M5 13l4 4L19 7"/></svg>;
    case 'x': return <svg {...common}><path d="M18 6L6 18M6 6l12 12"/></svg>;
    case 'upload': return <svg {...common}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>;
    case 'download': return <svg {...common}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>;
    case 'shift': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M3 12a9 9 0 0118 0"/></svg>;
    case 'attendance': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M9 14l2 2 4-4"/></svg>;
    case 'salary': return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3"/><path d="M7 9v.01M17 9v.01M7 16v.01M17 16v.01"/></svg>;
    case 'payroll': return <svg {...common}><path d="M4 4h12l4 4v12H4z"/><path d="M16 4v4h4"/><path d="M8 12h8M8 16h5"/></svg>;
    case 'loan': return <svg {...common}><path d="M3 12a9 9 0 1018 0 9 9 0 00-18 0z"/><path d="M14 9h-3a2 2 0 100 4h2a2 2 0 110 4H9"/><path d="M12 7v2M12 15v2"/></svg>;
    case 'increment': return <svg {...common}><path d="M3 17l6-6 4 4 8-8"/><path d="M21 14V7h-7"/></svg>;
    case 'leave': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M12 14l3 3"/></svg>;
    case 'plane': return <svg {...common}><path d="M2 14l20-7-7 20-3-9-9-3z"/></svg>;
    case 'gift': return <svg {...common}><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M3 12h18"/><path d="M12 8v13"/><path d="M12 8c-2-3-5-3-5-1s3 1 5 1zM12 8c2-3 5-3 5-1s-3 1-5 1z"/></svg>;
    case 'building': return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/></svg>;
    case 'sparkle': return <svg {...common}><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></svg>;
    case 'dot': return <svg {...common}><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>;
    case 'grid': return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case 'arrow-up-right': return <svg {...common}><path d="M7 17L17 7M9 7h8v8"/></svg>;
    case 'arrow-down-right': return <svg {...common}><path d="M7 7l10 10M9 17h8V9"/></svg>;
    case 'card': return <svg {...common}><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20"/></svg>;
    case 'flag': return <svg {...common}><path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/></svg>;
    case 'star': return <svg {...common}><path d="M12 3l2.5 6 6.5.5-5 4.5L17.5 21 12 17.5 6.5 21l1.5-7-5-4.5L9.5 9z"/></svg>;
    case 'menu': return <svg {...common}><path d="M3 6h18M3 12h18M3 18h18"/></svg>;
    case 'logo': return (
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ck-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E91E63"/>
            <stop offset="1" stopColor="#C2185B"/>
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#ck-g)"/>
        <path d="M32 14 L48 32 L32 50 L20 32 Z M32 14 L20 32 M32 50 L20 32" stroke="white" strokeWidth="3" fill="none"/>
        <path d="M32 14 L32 50" stroke="white" strokeWidth="3"/>
      </svg>
    );
    default: return null;
  }
};

window.Icon = Icon;

// ============= AVATAR =============
const Avatar = ({ name, initials, size = 36, hue = 220 }) => {
  const ini = initials || (name ? name.split(' ').map(s => s[0]).slice(0, 2).join('') : '??');
  const bg = `oklch(0.92 0.04 ${hue})`;
  const fg = `oklch(0.42 0.08 ${hue})`;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, letterSpacing: '0.02em', flexShrink: 0,
      fontFamily: 'Inter, Roboto, sans-serif',
    }}>{ini}</div>
  );
};
window.Avatar = Avatar;

// ============= STATUS PILL =============
const StatusPill = ({ status, kind }) => {
  const styles = {
    'Active': { bg: 'oklch(0.95 0.05 145)', fg: 'oklch(0.42 0.12 145)', dot: 'oklch(0.55 0.16 145)' },
    'Present': { bg: 'oklch(0.95 0.05 145)', fg: 'oklch(0.42 0.12 145)', dot: 'oklch(0.55 0.16 145)' },
    'Approved': { bg: 'oklch(0.95 0.05 145)', fg: 'oklch(0.42 0.12 145)', dot: 'oklch(0.55 0.16 145)' },
    'Ok': { bg: 'oklch(0.95 0.05 145)', fg: 'oklch(0.42 0.12 145)', dot: 'oklch(0.55 0.16 145)' },
    'Settled': { bg: 'oklch(0.95 0.05 145)', fg: 'oklch(0.42 0.12 145)', dot: 'oklch(0.55 0.16 145)' },
    'Closed': { bg: 'oklch(0.94 0.005 250)', fg: 'oklch(0.45 0.01 250)', dot: 'oklch(0.6 0.01 250)' },
    'Late': { bg: 'oklch(0.96 0.06 70)', fg: 'oklch(0.5 0.13 60)', dot: 'oklch(0.62 0.16 60)' },
    'Pending': { bg: 'oklch(0.96 0.06 70)', fg: 'oklch(0.5 0.13 60)', dot: 'oklch(0.62 0.16 60)' },
    'Half-Day': { bg: 'oklch(0.96 0.06 70)', fg: 'oklch(0.5 0.13 60)', dot: 'oklch(0.62 0.16 60)' },
    'Hold': { bg: 'oklch(0.96 0.06 70)', fg: 'oklch(0.5 0.13 60)', dot: 'oklch(0.62 0.16 60)' },
    'In Review': { bg: 'oklch(0.95 0.05 250)', fg: 'oklch(0.45 0.13 250)', dot: 'oklch(0.6 0.16 250)' },
    'On Leave': { bg: 'oklch(0.95 0.05 250)', fg: 'oklch(0.45 0.13 250)', dot: 'oklch(0.6 0.16 250)' },
    'Submitted': { bg: 'oklch(0.95 0.05 250)', fg: 'oklch(0.45 0.13 250)', dot: 'oklch(0.6 0.16 250)' },
    'Pending Settlement': { bg: 'oklch(0.95 0.05 250)', fg: 'oklch(0.45 0.13 250)', dot: 'oklch(0.6 0.16 250)' },
    'Absent': { bg: 'oklch(0.95 0.05 25)', fg: 'oklch(0.45 0.15 25)', dot: 'oklch(0.6 0.18 25)' },
    'Rejected': { bg: 'oklch(0.95 0.05 25)', fg: 'oklch(0.45 0.15 25)', dot: 'oklch(0.6 0.18 25)' },
    'Exception': { bg: 'oklch(0.95 0.05 25)', fg: 'oklch(0.45 0.15 25)', dot: 'oklch(0.6 0.18 25)' },
    'Outstanding': { bg: 'oklch(0.95 0.06 340)', fg: 'oklch(0.45 0.16 340)', dot: 'oklch(0.6 0.2 340)' },
    'Exceeds': { bg: 'oklch(0.95 0.05 250)', fg: 'oklch(0.45 0.13 250)', dot: 'oklch(0.6 0.16 250)' },
    'Meets': { bg: 'oklch(0.94 0.005 250)', fg: 'oklch(0.4 0.01 250)', dot: 'oklch(0.6 0.01 250)' },
  };
  const s = styles[status] || styles['Closed'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
      borderRadius: 999, background: s.bg, color: s.fg,
      fontSize: 11.5, fontWeight: 600, letterSpacing: '0.01em',
      fontFamily: 'Inter, Roboto, sans-serif', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {status}
    </span>
  );
};
window.StatusPill = StatusPill;

// ============= BUTTON =============
const Button = ({ variant = 'secondary', size = 'md', icon, children, onClick, disabled, style = {} }) => {
  const sizes = {
    sm: { p: '6px 12px', fs: 12.5, h: 32 },
    md: { p: '9px 16px', fs: 13, h: 38 },
    lg: { p: '11px 20px', fs: 14, h: 44 },
  };
  const sz = sizes[size];
  const variants = {
    primary: { bg: '#272727', fg: '#fff', border: '#272727', hover: '#000' },
    accent: { bg: '#E91E63', fg: '#fff', border: '#E91E63', hover: '#C2185B' },
    secondary: { bg: '#fff', fg: '#272727', border: '#E5E7EB', hover: '#F9FAFB' },
    ghost: { bg: 'transparent', fg: '#4D4D4D', border: 'transparent', hover: '#F3F4F6' },
  };
  const v = variants[variant];
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: sz.h, padding: sz.p, fontSize: sz.fs, fontWeight: 600,
        background: hover && !disabled ? v.hover : v.bg, color: v.fg,
        border: `1px solid ${v.border}`, borderRadius: 10,
        display: 'inline-flex', alignItems: 'center', gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        fontFamily: 'Inter, Roboto, sans-serif',
        transition: 'background 120ms', whiteSpace: 'nowrap', ...style,
      }}
    >
      {icon && <Icon name={icon} size={sz.fs + 2} stroke={2} />}
      {children}
    </button>
  );
};
window.Button = Button;

// ============= CARD =============
const Card = ({ children, padding = 24, style = {} }) => (
  <div style={{
    background: '#fff', border: '1px solid #ECECEC', borderRadius: 14,
    padding, ...style,
  }}>{children}</div>
);
window.Card = Card;

// ============= SELECT =============
const Select = ({ value, onChange, options, placeholder = 'Select…', size = 'md' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const h = size === 'sm' ? 34 : 40;
  const current = options.find(o => (typeof o === 'string' ? o : o.value) === value);
  const label = current ? (typeof current === 'string' ? current : current.label) : placeholder;
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 140 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', height: h, padding: '0 12px', background: '#fff',
          border: '1px solid #E5E7EB', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13, color: current ? '#272727' : '#9CA3AF', cursor: 'pointer',
          fontFamily: 'Inter, Roboto, sans-serif', textAlign: 'left',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: h + 4, left: 0, right: 0, background: '#fff',
          border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          zIndex: 50, maxHeight: 280, overflowY: 'auto', padding: 4,
        }}>
          {options.map((o, i) => {
            const v = typeof o === 'string' ? o : o.value;
            const l = typeof o === 'string' ? o : o.label;
            return (
              <div key={i} onClick={() => { onChange(v); setOpen(false); }}
                style={{
                  padding: '8px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 13,
                  background: v === value ? '#F3F4F6' : 'transparent',
                  color: '#272727', fontFamily: 'Inter, Roboto, sans-serif',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                onMouseLeave={e => e.currentTarget.style.background = v === value ? '#F3F4F6' : 'transparent'}
              >{l}</div>
            );
          })}
        </div>
      )}
    </div>
  );
};
window.Select = Select;

// ============= TEXT INPUT =============
const TextInput = ({ value, onChange, placeholder, icon, size = 'md', style = {} }) => {
  const h = size === 'sm' ? 34 : 40;
  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center', height: h,
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
      padding: '0 12px', ...style,
    }}>
      {icon && <Icon name={icon} size={16} stroke={2} />}
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          padding: icon ? '0 0 0 10px' : 0, fontSize: 13, color: '#272727',
          fontFamily: 'Inter, Roboto, sans-serif',
        }}
      />
    </div>
  );
};
window.TextInput = TextInput;

// ============= TOAST SYSTEM =============
const ToastContext = React.createContext(null);
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const push = (msg, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 10000,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {toasts.map(t => {
          const colors = {
            success: { bg: '#272727', fg: '#fff', accent: 'oklch(0.65 0.18 145)' },
            info: { bg: '#272727', fg: '#fff', accent: 'oklch(0.7 0.15 250)' },
            error: { bg: '#272727', fg: '#fff', accent: 'oklch(0.65 0.2 25)' },
          };
          const c = colors[t.kind];
          return (
            <div key={t.id} style={{
              background: c.bg, color: c.fg, padding: '12px 18px', borderRadius: 12,
              fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
              fontFamily: 'Inter, Roboto, sans-serif',
              borderLeft: `3px solid ${c.accent}`, minWidth: 240,
              animation: 'toastIn 200ms ease-out',
            }}>{t.msg}</div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
window.ToastProvider = ToastProvider;
window.useToast = () => React.useContext(ToastContext);

// ============= MODAL =============
const Modal = ({ open, onClose, title, children, width = 560, footer }) => {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9000, padding: 20, animation: 'fadeIn 160ms',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width, maxWidth: '100%',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        animation: 'modalIn 200ms cubic-bezier(.2,.9,.3,1.2)',
      }}>
        {title && (
          <div style={{
            padding: '20px 24px', borderBottom: '1px solid #ECECEC',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#272727', fontFamily: 'Inter, Roboto, sans-serif' }}>{title}</div>
            <button onClick={onClose} style={{
              border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280',
              padding: 4, display: 'flex', borderRadius: 6,
            }}><Icon name="x" size={20}/></button>
          </div>
        )}
        <div style={{ overflow: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid #ECECEC',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}>{footer}</div>
        )}
      </div>
    </div>
  );
};
window.Modal = Modal;

// ============= TABLE =============
const Table = ({ columns, rows, onRowClick }) => {
  return (
    <div style={{ width: '100%', overflow: 'auto' }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        fontFamily: 'Inter, Roboto, sans-serif',
      }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{
                textAlign: c.align || 'left', padding: '14px 16px',
                fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.06em',
                textTransform: 'uppercase', borderBottom: '1px solid #ECECEC',
                whiteSpace: 'nowrap', width: c.width,
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}
              onClick={() => onRowClick && onRowClick(r)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {columns.map((c, ci) => (
                <td key={ci} style={{
                  textAlign: c.align || 'left', padding: '14px 16px',
                  fontSize: 13, color: '#272727', borderBottom: '1px solid #F4F4F5',
                  verticalAlign: 'middle',
                }}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
window.Table = Table;

// ============= PAGE HEADER =============
const PageHeader = ({ title, subtitle, actions }) => (
  <div style={{
    padding: '22px 32px', background: '#F4F4F5',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: 12, marginBottom: 22,
  }}>
    <div>
      <div style={{ fontSize: 22, fontWeight: 600, color: '#272727', letterSpacing: '-0.01em', fontFamily: 'Inter, Roboto, sans-serif' }}>{title}</div>
      <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4, fontFamily: 'Inter, Roboto, sans-serif' }}>{subtitle}</div>
    </div>
    <div style={{ display: 'flex', gap: 10 }}>{actions}</div>
  </div>
);
window.PageHeader = PageHeader;

// ============= SECTION HEADER =============
const SectionHeader = ({ title, right }) => (
  <div style={{
    padding: '14px 18px', background: '#F9FAFB', borderRadius: '10px 10px 0 0',
    border: '1px solid #ECECEC', borderBottom: 'none',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }}>
    <div style={{ fontSize: 14, fontWeight: 600, color: '#272727', fontFamily: 'Inter, Roboto, sans-serif' }}>{title}</div>
    {right}
  </div>
);
window.SectionHeader = SectionHeader;

// ============= GLOBAL STYLES =============
const GlobalStyles = () => (
  <style>{`
    @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes modalIn { from { opacity: 0; transform: translateY(8px) scale(.98) } to { opacity: 1; transform: none } }
    @keyframes toastIn { from { opacity: 0; transform: translateX(20px) } to { opacity: 1; transform: none } }
    @keyframes slideIn { from { opacity: 0; transform: translateX(-8px) } to { opacity: 1; transform: none } }
    *::-webkit-scrollbar { width: 10px; height: 10px }
    *::-webkit-scrollbar-track { background: transparent }
    *::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 6px; border: 2px solid #fff }
    *::-webkit-scrollbar-thumb:hover { background: #D1D5DB }
  `}</style>
);
window.GlobalStyles = GlobalStyles;
