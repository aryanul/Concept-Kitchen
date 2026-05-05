import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, ClipboardCheck, CalendarClock, FileText,
  Download, Plus, ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { useAuth, type AuthUser } from '../../stores/auth';

type MeResponse = { data: { user: AuthUser } };

type Stat = { label: string; value: string; delta: string; icon: LucideIcon; tint: number };

const STATS: Stat[] = [
  { label: 'Total Employees',     value: '264',      delta: '+12 this month',     icon: Users,          tint: 250 },
  { label: 'Present Today',       value: '241',      delta: '91% attendance',     icon: ClipboardCheck, tint: 145 },
  { label: 'Pending Approvals',   value: '18',       delta: '7 leave · 11 incr.', icon: CalendarClock,  tint: 60 },
  { label: 'Payroll This Month',  value: '₹1.25 Cr', delta: 'Run on 31 May',      icon: FileText,       tint: 340 },
];

export function DashboardPage() {
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const navigate = useNavigate();
  const [meStatus, setMeStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    api
      .get<MeResponse>('/auth/me')
      .then(() => setMeStatus('ok'))
      .catch(() => setMeStatus('fail'));
  }, []);

  const onLogout = () => {
    clear();
    navigate('/login', { replace: true });
  };

  const greeting = greetByHour();
  const slug = user?.email?.split('@')[0] ?? '';
  const firstName = slug.split('.')[0];
  const niceName = firstName ? firstName[0].toUpperCase() + firstName.slice(1) : '';

  return (
    <div>
      <PageHeader
        title={niceName ? `${greeting}, ${niceName}` : greeting}
        subtitle="Here's what's happening across Concept Kitchen today."
        actions={
          <>
            <Button icon={Download}>Export Report</Button>
            <Button icon={Plus} variant="primary">Quick Action</Button>
          </>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 22,
        }}
      >
        {STATS.map((s) => (
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

      <Card padding={24}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-ink)', marginBottom: 8 }}>
          Welcome back
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ck-muted)', marginBottom: 12 }}>
          You're signed in as <strong style={{ color: 'var(--ck-ink)' }}>{user?.email}</strong>{' '}
          ({user?.role}).
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ck-faint)', marginBottom: 20 }}>
          /auth/me check: <strong style={{ color: 'var(--ck-ink-soft)' }}>{meStatus}</strong>
        </div>
        <Button onClick={onLogout}>Log out</Button>
        <div
          style={{
            marginTop: 24,
            padding: '12px 14px',
            background: 'var(--ck-line-soft)',
            borderRadius: 10,
            fontSize: 12.5,
            color: 'var(--ck-muted)',
          }}
        >
          The stat tiles above use placeholder numbers. Real attendance, payroll and approval
          aggregates wire up after the employees + transactional data are seeded.
        </div>
      </Card>
    </div>
  );
}

function greetByHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
