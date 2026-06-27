import { useEffect, useRef, useState } from 'react';
import {
  Search, Bell, Clock, Cloud, Calendar, ChevronDown, LogOut, User, Menu,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { useAuth } from '../../stores/auth';
import { api } from '../../lib/api';

type TopBarProps = { onMenuClick: () => void };

export function TopBar({ onMenuClick }: TopBarProps) {
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const navigate = useNavigate();
  const [time, setTime] = useState(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const tStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dStr = time.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

  const userSlug = user?.email ? user.email.split('@')[0] : '';
  const firstName = userSlug.split('.')[0];
  const niceFirst = firstName ? firstName[0].toUpperCase() + firstName.slice(1) : '—';
  const role = user?.role
    ? user.role.toLowerCase().split('_').map((s) => s[0].toUpperCase() + s.slice(1)).join(' ')
    : '—';
  const fullName = userSlug.replace(/\./g, ' ');

  const handleLogout = () => {
    setMenuOpen(false);
    api.post('/auth/logout').catch(() => {}); // fire-and-forget: logs the event server-side
    clear();
    navigate('/login', { replace: true });
  };

  return (
    <div
      style={{
        padding: '10px 24px',
        background: 'var(--ck-surface)',
        borderBottom: '1px solid var(--ck-line)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Hamburger — visible on mobile only via CSS */}
      <Tooltip label="Open menu" placement="bottom">
        <button
          type="button"
          aria-label="Open menu"
          onClick={onMenuClick}
          className="ck-hamburger"
          style={{
            width: 36, height: 36, borderRadius: 10, border: '1px solid var(--ck-line)',
            background: 'var(--ck-surface)', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ck-ink)', cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Menu size={18} />
        </button>
      </Tooltip>

      <div
        className="ck-topbar-search-max"
        style={{
          flex: '1 1 0',
          maxWidth: 360,
          height: 36,
          padding: '0 12px',
          background: 'var(--ck-surface)',
          border: '1px solid var(--ck-line)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Search size={16} strokeWidth={2} style={{ color: 'var(--ck-muted)' }} />
        <input
          placeholder="Search"
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent', fontSize: 13.5, color: 'var(--ck-ink)',
          }}
        />
      </div>
      <div className="ck-topbar-spacer" />

      <div className="ck-topbar-chips">
        <Chip icon={Clock} label={tStr} />
        <Chip icon={Cloud} label="28°C" />
        <Chip icon={Calendar} label={dStr} />
      </div>

      <Tooltip label="Notifications" placement="bottom">
        <button
          type="button"
          aria-label="Notifications"
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: '1px solid var(--ck-line)', background: 'var(--ck-line-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', color: 'var(--ck-ink-soft)', cursor: 'pointer',
          }}
        >
          <Bell size={16} strokeWidth={1.8} />
          <span style={{
            position: 'absolute', top: 7, right: 9,
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--ck-accent)', border: '2px solid var(--ck-surface)',
          }} />
        </button>
      </Tooltip>

      {/* User chip + dropdown */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <div
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            height: 36, padding: '0 12px 0 6px', borderRadius: 10,
            border: `1px solid ${menuOpen ? 'var(--ck-accent)' : 'var(--ck-line)'}`,
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            background: 'var(--ck-line-soft)',
          }}
        >
          <Avatar name={fullName || niceFirst} hue={340} size={32} />
          <div className="ck-user-text">
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)' }}>{niceFirst}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ck-faint)' }}>{role}</div>
          </div>
          <Tooltip label="Account menu" placement="bottom">
            <ChevronDown
              size={14}
              className="ck-user-chevron"
              style={{
                color: 'var(--ck-muted)',
                transition: 'transform 160ms',
                transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </Tooltip>
        </div>

        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 220,
              background: 'var(--ck-surface)',
              border: '1px solid var(--ck-line)',
              borderRadius: 12,
              boxShadow: 'var(--ck-shadow-md)',
              zIndex: 50,
              overflow: 'hidden',
            }}
          >
            {/* Profile block */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ck-line)' }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ck-ink)', marginBottom: 2 }}>
                {fullName || niceFirst}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ck-muted)', wordBreak: 'break-all' }}>
                {user?.email}
              </div>
              <div style={{
                marginTop: 8, display: 'inline-block',
                padding: '2px 10px', borderRadius: 999,
                background: 'var(--ck-line-soft)',
                fontSize: 11, fontWeight: 600, color: 'var(--ck-ink-soft)',
              }}>
                {role}
              </div>
            </div>

            {/* Menu items */}
            <div style={{ padding: '6px 0' }}>
              <MenuItem icon={User} label="My Profile" onClick={() => setMenuOpen(false)} />
            </div>

            <div style={{ borderTop: '1px solid var(--ck-line)', padding: '6px 0' }}>
              <MenuItem
                icon={LogOut}
                label="Log out"
                onClick={handleLogout}
                danger
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  icon: Cmp, label, onClick, danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 16px',
        border: 'none',
        background: hover ? (danger ? 'var(--ck-danger-bg)' : 'var(--ck-line-soft)') : 'transparent',
        color: danger ? 'var(--ck-danger-fg)' : 'var(--ck-ink)',
        fontSize: 13.5,
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <Cmp size={15} strokeWidth={1.8} />
      {label}
    </button>
  );
}

function Chip({ icon: Cmp, label }: { icon: LucideIcon; label: string }) {
  return (
    <div style={{
      height: 32, padding: '0 12px', borderRadius: 999,
      border: '1px solid var(--ck-line)',
      display: 'flex', alignItems: 'center', gap: 8,
      color: 'var(--ck-ink-soft)', fontSize: 12, fontWeight: 500,
      background: 'var(--ck-line-soft)',
    }}>
      <Cmp size={13} strokeWidth={2} />
      <span>{label}</span>
    </div>
  );
}
