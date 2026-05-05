import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, Briefcase, Users, LogOut, Settings,
  ChevronDown, ChevronRight,
  Clock, CalendarDays, ClipboardCheck, Wallet, FileText, Banknote,
  TrendingUp, CalendarClock, Plane, Gift,
  type LucideIcon,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { BrandWordmark } from '../ui/BrandMark';
import { useAuth } from '../../stores/auth';

type Leaf  = { id: string; path: string; label: string; icon?: LucideIcon };
type Group = { id: string; label: string; icon: LucideIcon; defaultOpen?: boolean; children: Leaf[] };
type Item  = (Leaf & { icon: LucideIcon }) | Group;

const NAV: Item[] = [
  { id: 'dashboard', path: '/', label: 'Dashboard', icon: Home },
  {
    id: 'hiring', label: 'Hiring', icon: Briefcase, children: [
      { id: 'job-profile', path: '/job-profile', label: 'Job Profile' },
      { id: 'vacancy',     path: '/vacancy',     label: 'Vacancies' },
      { id: 'onboarding',  path: '/onboarding',  label: 'Onboarding' },
    ],
  },
  {
    id: 'employment', label: 'Employment', icon: Users, defaultOpen: true, children: [
      { id: 'employees',     path: '/employees',     label: 'Employee Master',          icon: Users },
      { id: 'shifts',        path: '/shifts',        label: 'Duty Shifts & Rosters',    icon: Clock },
      { id: 'holidays',      path: '/holidays',      label: 'Holidays',                 icon: CalendarDays },
      { id: 'attendance',    path: '/attendance',    label: 'Attendance & Exceptions',  icon: ClipboardCheck },
      { id: 'salary-master', path: '/salary-master', label: 'Salary Struc. & Compo.',   icon: Wallet },
      { id: 'payroll',       path: '/payroll',       label: 'Payroll Runs & Pay-slips', icon: FileText },
      { id: 'loans',         path: '/loans',         label: 'Advances & Loans',         icon: Banknote },
      { id: 'increments',    path: '/increments',    label: 'Increments & Appraisals',  icon: TrendingUp },
      { id: 'leaves',        path: '/leaves',        label: 'Leaves & Approvals',       icon: CalendarClock },
      { id: 'tours',         path: '/tours',         label: 'Tour & Travel',            icon: Plane },
      { id: 'incentives',    path: '/incentives',    label: 'Incentives & Perks',       icon: Gift },
    ],
  },
  {
    id: 'relieving', label: 'Relieving', icon: LogOut, children: [
      { id: 'exit-clearance', path: '/exit-clearance', label: 'Exit Clearance' },
      { id: 'fnf',            path: '/fnf',            label: 'Full & Final' },
    ],
  },
  { id: 'settings', path: '/settings', label: 'Settings', icon: Settings },
];

const isGroup = (i: Item): i is Group => 'children' in i;

export function Sidebar() {
  const user = useAuth((s) => s.user);
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV.forEach((i) => { if (isGroup(i)) init[i.id] = !!i.defaultOpen; });
    return init;
  });

  const userName = user?.email ? humanize(user.email.split('@')[0]) : '';
  const role = user?.role ? humanizeRole(user.role) : '';

  return (
    <aside
      style={{
        width: 'var(--ck-sidebar-w)',
        flexShrink: 0,
        background: 'var(--ck-surface)',
        borderRight: '1px solid var(--ck-line)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <div style={{ padding: '22px 22px 16px' }}>
        <BrandWordmark markSize={36} />
      </div>

      <nav style={{ padding: '0 12px 16px', flex: 1, overflowY: 'auto' }}>
        {NAV.map((item) => (
          <div key={item.id} style={{ marginBottom: 2 }}>
            {isGroup(item) ? (
              <>
                <GroupHead
                  icon={item.icon}
                  label={item.label}
                  expanded={!!open[item.id]}
                  onToggle={() => setOpen((o) => ({ ...o, [item.id]: !o[item.id] }))}
                />
                {open[item.id] && (
                  <div
                    style={{
                      marginTop: 2,
                      marginLeft: 14,
                      paddingLeft: 8,
                      borderLeft: '1px solid var(--ck-line)',
                    }}
                  >
                    {item.children.map((c) => (
                      <SubLink key={c.id} to={c.path} label={c.label} icon={c.icon} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <TopLink to={item.path} label={item.label} icon={item.icon} />
            )}
          </div>
        ))}
      </nav>

      <div
        style={{
          padding: 12,
          borderTop: '1px solid var(--ck-line)',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <Avatar name={userName || '?'} hue={340} size={36} />
        <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ck-ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {userName || '—'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{role || '—'}</div>
        </div>
      </div>
    </aside>
  );
}

function TopLink({ to, label, icon: Cmp }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 14px',
        borderRadius: 10,
        background: isActive ? 'var(--ck-ink)' : 'transparent',
        color: isActive ? '#fff' : 'var(--ck-ink)',
        fontSize: 13.5,
        fontWeight: 500,
        transition: 'background 120ms',
      })}
    >
      <Cmp size={18} strokeWidth={1.7} />
      <span style={{ flex: 1 }}>{label}</span>
    </NavLink>
  );
}

function GroupHead({
  icon: Cmp, label, expanded, onToggle,
}: { icon: LucideIcon; label: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '11px 14px',
        borderRadius: 10,
        border: 'none',
        background: expanded ? 'var(--ck-line-soft)' : 'transparent',
        color: 'var(--ck-ink)',
        fontSize: 13.5,
        fontWeight: 500,
        textAlign: 'left',
      }}
    >
      <Cmp size={18} strokeWidth={1.7} />
      <span style={{ flex: 1 }}>{label}</span>
      {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
    </button>
  );
}

function SubLink({ to, label, icon: Cmp }: { to: string; label: string; icon?: LucideIcon }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 8,
        background: isActive ? 'var(--ck-line-soft)' : 'transparent',
        color: isActive ? 'var(--ck-ink)' : 'var(--ck-ink-soft)',
        fontSize: 12.5,
        fontWeight: isActive ? 600 : 500,
        marginBottom: 1,
      })}
    >
      {Cmp && <Cmp size={15} strokeWidth={1.7} />}
      <span style={{ flex: 1 }}>{label}</span>
    </NavLink>
  );
}

function humanize(slug: string) {
  return slug
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(' ');
}

function humanizeRole(role: string) {
  return role
    .toLowerCase()
    .split('_')
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(' ');
}
