import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, ClipboardCheck, CalendarClock, FileText, CalendarDays,
  Building2, Briefcase,
  Download, Plus, ArrowUpRight, Activity,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { useAuth, type AuthUser } from '../../stores/auth';

type MeResponse = { data: { user: AuthUser } };

type Summary = {
  totalEmployees: number;
  activeEmployees: number;
  onLeave: number;
  branches: number;
  departments: number;
  upcomingHolidays: number;
};

type SummaryResp = { data: Summary };

type ActivityEntry = {
  id: string;
  action: string;
  resource: string;
  resource_id: string;
  at: string;
  actor_name: string | null;
  actor_email: string | null;
};

type Stat = { label: string; value: string; delta: string; icon: LucideIcon; tint: number };

export function DashboardPage() {
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const navigate = useNavigate();
  const [meStatus, setMeStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityAge, setActivityAge] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActivity = useCallback(() => {
    api.get<{ data: ActivityEntry[] }>('/dashboard/activity')
      .then((r) => { setActivity(r.data.data ?? []); setActivityAge(0); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get<MeResponse>('/auth/me')
      .then(() => setMeStatus('ok'))
      .catch(() => setMeStatus('fail'));
    api
      .get<SummaryResp>('/dashboard/summary')
      .then((r) => setSummary(r.data.data))
      .catch(() => {});
    fetchActivity();
    timerRef.current = setInterval(fetchActivity, 30_000);
    const ageTimer = setInterval(() => setActivityAge((a) => a + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(ageTimer);
    };
  }, [fetchActivity]);

  const onLogout = () => {
    clear();
    navigate('/login', { replace: true });
  };

  const greeting = greetByHour();
  const slug = user?.email?.split('@')[0] ?? '';
  const firstName = slug.split('.')[0];
  const niceName = firstName ? firstName[0].toUpperCase() + firstName.slice(1) : '';

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const stats: Stat[] = summary
    ? [
        {
          label: 'Total Employees',
          value: String(summary.totalEmployees),
          delta: `${summary.activeEmployees} active`,
          icon: Users,
          tint: 250,
        },
        {
          label: 'On Leave',
          value: String(summary.onLeave),
          delta: 'Across all branches',
          icon: ClipboardCheck,
          tint: 60,
        },
        {
          label: 'Upcoming Holidays',
          value: String(summary.upcomingHolidays),
          delta: 'Calendar ahead',
          icon: CalendarClock,
          tint: 145,
        },
        {
          label: 'Branches',
          value: String(summary.branches),
          delta: `${summary.departments} departments`,
          icon: Building2,
          tint: 340,
        },
      ]
    : [
        { label: 'Total Employees',   value: '—', delta: 'Loading…', icon: Users,           tint: 250 },
        { label: 'On Leave',          value: '—', delta: 'Loading…', icon: ClipboardCheck,  tint: 60 },
        { label: 'Upcoming Holidays', value: '—', delta: 'Loading…', icon: CalendarClock,   tint: 145 },
        { label: 'Branches',          value: '—', delta: 'Loading…', icon: Building2,       tint: 340 },
      ];

  return (
    <div>
      <PageHeader
        title={niceName ? `${greeting}, ${niceName}` : greeting}
        subtitle={`Here's what's happening across Concept Kitchen — ${todayStr}.`}
        actions={
          <>
            <Button icon={Download}>Export Report</Button>
            <Button icon={Plus} variant="primary">Quick Action</Button>
          </>
        }
      />

      <div className="ck-stats-4">
        {stats.map((s) => (
          <Card key={s.label} padding={20}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `oklch(0.95 0.04 ${s.tint})`,
                  color: `oklch(0.45 0.13 ${s.tint})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <s.icon size={20} strokeWidth={1.8} />
              </div>
              <ArrowUpRight size={14} style={{ color: 'var(--ck-muted)' }} />
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--ck-faint)',
                fontWeight: 500,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: 'var(--ck-ink)',
                letterSpacing: '-0.02em',
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ck-muted)', marginTop: 4 }}>{s.delta}</div>
          </Card>
        ))}
      </div>

      <div className="ck-dash-split">
        <Card padding={0}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--ck-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={15} strokeWidth={1.8} style={{ color: 'var(--ck-accent)' }} />
                Activity Log
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginTop: 2 }}>
                All portal actions in the last 2 minutes
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>
                {activityAge < 5 ? 'Just refreshed' : `${activityAge}s ago`}
              </span>
              <button
                onClick={fetchActivity}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', color: 'var(--ck-ink-soft)', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Refresh
              </button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 380 }}>
            {activity.length === 0 ? (
              <div style={{ padding: '32px 22px', textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>
                No activity in the last 2 minutes.
              </div>
            ) : (
              activity.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))
            )}
          </div>
        </Card>

        <Card padding={0}>
          <div
            style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--ck-line)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-ink)' }}>You</div>
            <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginTop: 2 }}>
              Your session info.
            </div>
          </div>
          <div style={{ padding: 22 }}>
            <Row icon={Users}      label="Email" value={user?.email ?? '—'} mono />
            <Row icon={Briefcase}  label="Role"  value={user?.role ?? '—'} />
            <Row icon={CalendarDays} label="Today" value={todayStr} />
            <Row icon={FileText}   label="API health" value={meStatus === 'ok' ? 'OK' : meStatus === 'fail' ? 'Failed' : 'Checking…'} />
            <div style={{ marginTop: 16 }}>
              <Button onClick={onLogout}>Log out</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({
  icon: Cmp,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 0',
        borderBottom: '1px solid var(--ck-line-soft)',
      }}
    >
      <Cmp size={15} strokeWidth={1.8} style={{ color: 'var(--ck-muted)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--ck-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--ck-ink)',
            fontWeight: 500,
            fontFamily: mono ? 'var(--ck-font-mono)' : 'inherit',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

const RESOURCE_LABELS: Record<string, string> = {
  employee: 'Employee', leave: 'Leave', attendance: 'Attendance',
  holiday: 'Holiday', loan: 'Loan', increment: 'Increment',
  incentive: 'Incentive', payroll_period: 'Payroll', tour: 'Tour',
  compensation: 'Compensation',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'oklch(0.45 0.13 145)',
  update: 'oklch(0.45 0.13 250)',
  delete: 'oklch(0.45 0.13 20)',
  approve: 'oklch(0.45 0.13 145)',
  activate: 'oklch(0.45 0.13 145)',
  archive: 'oklch(0.45 0.13 60)',
  exit: 'oklch(0.45 0.13 20)',
  decide: 'oklch(0.45 0.13 250)',
  run: 'oklch(0.45 0.13 290)',
  disburse: 'oklch(0.45 0.13 145)',
  settle: 'oklch(0.45 0.13 145)',
};

const ACTION_BG: Record<string, string> = {
  create: 'oklch(0.96 0.04 145)',
  update: 'oklch(0.96 0.04 250)',
  delete: 'oklch(0.96 0.04 20)',
  approve: 'oklch(0.96 0.04 145)',
  activate: 'oklch(0.96 0.04 145)',
  archive: 'oklch(0.96 0.04 60)',
  exit: 'oklch(0.96 0.04 20)',
  decide: 'oklch(0.96 0.04 250)',
  run: 'oklch(0.96 0.04 290)',
  disburse: 'oklch(0.96 0.04 145)',
  settle: 'oklch(0.96 0.04 145)',
};

function formatRelativeTime(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 120) return '1m ago';
  return `${Math.floor(diff / 60)}m ago`;
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const actionColor = ACTION_COLORS[entry.action] ?? 'var(--ck-muted)';
  const actionBg    = ACTION_BG[entry.action]    ?? 'var(--ck-line-soft)';
  const resource    = RESOURCE_LABELS[entry.resource] ?? entry.resource;
  const actor       = entry.actor_name ?? entry.actor_email ?? 'System';

  return (
    <div style={{
      padding: '11px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: '1px solid var(--ck-line-soft)',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
        background: actionBg, color: actionColor,
        textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
      }}>
        {entry.action}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: 'var(--ck-ink)', fontWeight: 500 }}>{resource}</span>
        <span style={{ fontSize: 12, color: 'var(--ck-muted)', marginLeft: 6 }}>by {actor}</span>
      </div>
      <span style={{ fontSize: 11.5, color: 'var(--ck-faint)', flexShrink: 0 }}>
        {formatRelativeTime(entry.at)}
      </span>
    </div>
  );
}

function greetByHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
