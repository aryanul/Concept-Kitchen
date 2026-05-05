import { useEffect, useState } from 'react';
import {
  Search, Bell, Clock, Cloud, Calendar, ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../stores/auth';

export function TopBar() {
  const user = useAuth((s) => s.user);
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const tStr = time.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const dStr = time.toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric',
  });

  const userSlug = user?.email ? user.email.split('@')[0] : '';
  const firstName = userSlug.split('.')[0];
  const niceFirst = firstName ? firstName[0].toUpperCase() + firstName.slice(1) : '—';
  const role = user?.role
    ? user.role.toLowerCase().split('_').map((s) => s[0].toUpperCase() + s.slice(1)).join(' ')
    : '—';
  const fullName = userSlug.replace(/\./g, ' ');

  return (
    <div
      style={{
        padding: '14px 32px',
        background: 'var(--ck-surface)',
        borderBottom: '1px solid var(--ck-line)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <div
        style={{
          flex: '1 1 0',
          maxWidth: 520,
          height: 42,
          padding: '0 16px',
          background: 'var(--ck-line-soft)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Search size={18} strokeWidth={2} style={{ color: 'var(--ck-ink-soft)' }} />
        <input
          placeholder="Search employees, payroll, leaves…"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 13.5,
            color: 'var(--ck-ink)',
          }}
        />
        <kbd
          style={{
            padding: '2px 8px',
            background: 'var(--ck-surface)',
            border: '1px solid var(--ck-line)',
            borderRadius: 5,
            fontSize: 11,
            color: 'var(--ck-muted)',
            fontFamily: 'var(--ck-font-mono)',
          }}
        >
          ⌘K
        </kbd>
      </div>
      <div style={{ flex: 1 }} />

      <Chip icon={Clock} label={tStr} />
      <Chip icon={Cloud} label="28°C" />
      <Chip icon={Calendar} label={dStr} />

      <button
        type="button"
        aria-label="Notifications"
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          border: '1px solid var(--ck-line)',
          background: 'var(--ck-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          color: 'var(--ck-ink-soft)',
        }}
      >
        <Bell size={18} strokeWidth={1.8} />
        <span
          style={{
            position: 'absolute',
            top: 9,
            right: 11,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--ck-accent)',
            border: '2px solid var(--ck-surface)',
          }}
        />
      </button>

      <div
        style={{
          height: 42,
          padding: '0 14px 0 6px',
          borderRadius: 10,
          border: '1px solid var(--ck-line)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
        }}
      >
        <Avatar name={fullName || niceFirst} hue={340} size={32} />
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)' }}>{niceFirst}</div>
          <div style={{ fontSize: 10.5, color: 'var(--ck-faint)' }}>{role}</div>
        </div>
        <ChevronDown size={14} />
      </div>
    </div>
  );
}

function Chip({ icon: Cmp, label }: { icon: LucideIcon; label: string }) {
  return (
    <div
      style={{
        height: 38,
        padding: '0 14px',
        borderRadius: 999,
        border: '1px solid var(--ck-line)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: 'var(--ck-ink-soft)',
        fontSize: 12.5,
        fontWeight: 500,
        background: 'var(--ck-surface)',
      }}
    >
      <Cmp size={14} strokeWidth={2} />
      <span>{label}</span>
    </div>
  );
}
