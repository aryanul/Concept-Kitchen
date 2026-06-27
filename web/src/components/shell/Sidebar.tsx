import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home, Briefcase, Users, LogOut, Settings, Trash2 as Trash2Icon,
  ChevronDown, ChevronRight,
  Clock, CalendarDays, ClipboardCheck, Wallet, FileText, Banknote,
  TrendingUp, CalendarClock, Plane, Gift,
  Building2, LocateFixed, ClipboardList, Sparkles, BookOpen, Tag,
  Presentation as PresentationIcon, MapPin, Activity,
  type LucideIcon,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { BrandWordmark } from '../ui/BrandMark';
import { useAuth } from '../../stores/auth';

type Leaf  = { id: string; path: string; label: string; icon?: LucideIcon };
type Group = { id: string; label: string; icon: LucideIcon; defaultOpen?: boolean; children: Leaf[] };
type Item  = (Leaf & { icon: LucideIcon }) | Group;

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const NAV: Item[] = [
  { id: 'dashboard',    path: '/',             label: 'Dashboard',    icon: Home },
  { id: 'activity-log', path: '/activity-log', label: 'Activity Log', icon: Activity },
  {
    id: 'hiring', label: 'Hiring', icon: Briefcase, children: [
      { id: 'job-profile', path: '/job-profile', label: 'Job Profile' },
      { id: 'vacancy',     path: '/vacancy',     label: 'Vacancy & Job Listing' },
      { id: 'onboarding',  path: '/onboarding',  label: 'Induction & Onboarding' },
    ],
  },
  {
    id: 'employment', label: 'Employment', icon: Users, children: [
      { id: 'employees',     path: '/employees',     label: 'Employee Master',          icon: Users },
      { id: 'shifts',        path: '/shifts',        label: 'Duty Shifts & Rosters',    icon: Clock },
      { id: 'holidays',      path: '/holidays',      label: 'Holidays',                 icon: CalendarDays },
      { id: 'attendance',    path: '/attendance',    label: 'Attendance & Exceptions',  icon: ClipboardCheck },
      { id: 'salary-master', path: '/salary-master', label: 'Salary Struc. & Compo.',   icon: Wallet },
      { id: 'compensations', path: '/compensations', label: 'Compensation Master',      icon: Wallet },
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
  {
    id: 'settings', label: 'Settings', icon: Settings, children: [
      { id: 'masters-companies', path: '/masters/companies', label: 'Company Master', icon: Building2 },
      { id: 'masters-branches', path: '/masters/branches', label: 'Branch Master', icon: Building2 },
      { id: 'masters-locations', path: '/masters/locations', label: 'Location Master', icon: LocateFixed },
      { id: 'masters-ddd', path: '/masters/ddd', label: 'DDD Master', icon: ClipboardList },
      { id: 'masters-skills', path: '/masters/skills', label: 'Skill Master', icon: Sparkles },
      { id: 'masters-shifts', path: '/masters/shifts', label: 'Shift Master', icon: Clock },
      { id: 'masters-salary-grades', path: '/masters/salary-grades', label: 'Salary Grades', icon: Wallet },
      { id: 'masters-holidays', path: '/masters/holidays', label: 'Holiday Master', icon: CalendarDays },
      { id: 'masters-attendance-rules', path: '/masters/attendance-rules', label: 'Attendance Rules', icon: ClipboardCheck },
      { id: 'masters-training-modules', path: '/masters/training-modules', label: 'Training Modules', icon: BookOpen },
      { id: 'masters-induction-templates', path: '/masters/induction-templates', label: 'Induction Templates', icon: PresentationIcon },
      { id: 'masters-onboarding-templates', path: '/masters/onboarding-templates', label: 'Onboarding Templates', icon: MapPin },
      { id: 'masters-tags', path: '/masters/tags', label: 'Tag Master', icon: Tag },
      { id: 'masters-giveaways', path: '/masters/giveaways', label: 'Give Aways', icon: Gift },
    ],
  },
  { id: 'dev-wipe', path: '/dev/wipe',  label: 'DB Wipe (Dev)', icon: Trash2Icon },
];

const isGroup = (i: Item): i is Group => 'children' in i;

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const user = useAuth((s) => s.user);
  const location = useLocation();

  // Auto-expand the group that owns the current route; collapse the rest
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV.forEach((item) => {
      if (isGroup(item)) {
        init[item.id] = item.children.some(
          (c) => location.pathname === c.path || location.pathname.startsWith(c.path + '/')
        );
      }
    });
    return init;
  });

  const userName = user?.email ? humanize(user.email.split('@')[0]) : '';
  const role = user?.role ? humanizeRole(user.role) : '';

  return (
    <aside className={`ck-sidebar${isOpen ? ' is-open' : ''}`}>
      <div style={{ padding: '18px 18px 12px', flexShrink: 0 }}>
        <BrandWordmark markSize={36} />
      </div>

      <nav style={{ padding: '0 10px 16px', flex: 1, overflowY: 'auto' }}>
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
                  <div style={{ marginTop: 4, marginLeft: 10 }}>
                    {item.children.map((c) => (
                      <SubLink key={c.id} to={c.path} label={c.label} icon={c.icon} onNavigate={onClose} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <TopLink to={item.path} label={item.label} icon={item.icon} onNavigate={onClose} />
            )}
          </div>
        ))}
      </nav>

      <div style={{ padding: 12, borderTop: '1px solid var(--ck-line)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <Avatar name={userName || '?'} hue={340} size={36} />
        <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ck-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userName || '—'}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{role || '—'}</div>
        </div>
      </div>
    </aside>
  );
}

function TopLink({ to, label, icon: Cmp, onNavigate }: { to: string; label: string; icon: LucideIcon; onNavigate: () => void }) {
  return (
    <NavLink to={to} end={to === '/'} onClick={onNavigate}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 999,
        background: isActive ? '#6f6f6f' : 'transparent',
        color: isActive ? '#fff' : 'var(--ck-ink)',
        fontSize: 13, fontWeight: 600, transition: 'background 120ms',
      })}>
      <Cmp size={17} strokeWidth={1.7} />
      <span style={{ flex: 1 }}>{label}</span>
    </NavLink>
  );
}

function GroupHead({ icon: Cmp, label, expanded, onToggle }: { icon: LucideIcon; label: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '10px 14px', borderRadius: 999, border: 'none',
        background: expanded ? '#6f6f6f' : 'transparent',
        color: expanded ? '#fff' : 'var(--ck-ink)',
        fontSize: 13, fontWeight: 600, textAlign: 'left',
      }}>
      <Cmp size={17} strokeWidth={1.7} />
      <span style={{ flex: 1 }}>{label}</span>
      {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
    </button>
  );
}

function SubLink({ to, label, icon: Cmp, onNavigate }: { to: string; label: string; icon?: LucideIcon; onNavigate: () => void }) {
  return (
    <NavLink to={to} onClick={onNavigate}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 10,
        background: isActive ? '#e9e9e9' : 'transparent',
        color: isActive ? 'var(--ck-ink)' : 'var(--ck-ink-soft)',
        fontSize: 12.5, fontWeight: isActive ? 600 : 500, marginBottom: 4,
      })}>
      {Cmp && <Cmp size={15} strokeWidth={1.7} />}
      <span style={{ flex: 1 }}>{label}</span>
    </NavLink>
  );
}

function humanize(slug: string) {
  return slug.replace(/[._-]+/g, ' ').split(' ').filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join(' ');
}
function humanizeRole(role: string) {
  return role.toLowerCase().split('_').map((s) => s[0].toUpperCase() + s.slice(1)).join(' ');
}
