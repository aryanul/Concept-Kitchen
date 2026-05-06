import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, ClipboardCheck, CalendarClock, FileText, CalendarDays,
  Building2, Briefcase,
  Download, Plus, ArrowUpRight,
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

type Stat = { label: string; value: string; delta: string; icon: LucideIcon; tint: number };

export function DashboardPage() {
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const navigate = useNavigate();
  const [meStatus, setMeStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api
      .get<MeResponse>('/auth/me')
      .then(() => setMeStatus('ok'))
      .catch(() => setMeStatus('fail'));
    api
      .get<SummaryResp>('/dashboard/summary')
      .then((r) => setSummary(r.data.data))
      .catch(() => {});
  }, []);

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
          <div
            style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--ck-line)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-ink)' }}>
              Phase 1 — Module readiness
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginTop: 2 }}>
              Where each module currently sits in the build.
            </div>
          </div>
          <div style={{ padding: '8px 0' }}>
            {[
              { name: 'Employee Master',           status: 'live',     to: '/employees' },
              { name: 'Holidays',                  status: 'live',     to: '/holidays' },
              { name: 'Duty Shifts',               status: 'live',     to: '/shifts' },
              { name: 'Salary Master',             status: 'live',     to: '/salary-master' },
              { name: 'Attendance & Exceptions',   status: 'soon',     to: '/attendance' },
              { name: 'Payroll Runs',              status: 'soon',     to: '/payroll' },
              { name: 'Leaves & Approvals',        status: 'soon',     to: '/leaves' },
              { name: 'Loans, Increments, Tours',  status: 'soon',     to: '/loans' },
            ].map((m) => (
              <div
                key={m.name}
                onClick={() => navigate(m.to)}
                style={{
                  padding: '12px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background:
                        m.status === 'live' ? 'oklch(0.55 0.16 145)' : 'var(--ck-faint)',
                    }}
                  />
                  <span style={{ fontSize: 13.5, color: 'var(--ck-ink)', fontWeight: 500 }}>
                    {m.name}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: m.status === 'live' ? 'oklch(0.95 0.05 145)' : 'var(--ck-line-soft)',
                    color: m.status === 'live' ? 'oklch(0.42 0.12 145)' : 'var(--ck-muted)',
                  }}
                >
                  {m.status === 'live' ? 'Live' : 'Coming soon'}
                </span>
              </div>
            ))}
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

function greetByHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
