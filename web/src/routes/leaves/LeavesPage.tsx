import { useEffect, useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';

type Leave = {
  id: string; type: string; from_date: string; to_date: string; days: number;
  reason: string; status: string; created_at: string;
  employee_id: string; code: string; first_name: string; last_name: string; designation: string;
};
type Resp = { data: Leave[]; meta: { total: number } };

const LEAVE_TYPES = ['EL', 'CL', 'SL', 'LWP', 'TOUR', 'COMP_OFF'];
const TABS = ['All', 'Pending', 'Approved', 'Rejected'];
const STATUS_MAP: Record<string, string | undefined> = { All: undefined, Pending: 'PENDING', Approved: 'APPROVED', Rejected: 'REJECTED' };
const STATUS_LABELS: Record<string, string> = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };

const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return s; } };

export function LeavesPage() {
  const [tab, setTab] = useState('All');
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const params: Record<string, string> = {};
    const s = STATUS_MAP[tab];
    if (s) params.status = s;
    api.get<Resp>('/leaves', { params, signal: ctrl.signal })
      .then((r) => { setLeaves(r.data.data); setTotal(r.data.meta.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [tab]);

  return (
    <div>
      <PageHeader
        title="Leaves & Approvals"
        subtitle="Apply, track and approve employee leave requests."
        actions={<Button icon={Plus} variant="primary">Apply Leave</Button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 22 }}>
        {LEAVE_TYPES.map((t, i) => (
          <Card key={t} padding={16}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `oklch(0.95 0.04 ${[250,145,60,25,340,200][i]})`, color: `oklch(0.45 0.13 ${[250,145,60,25,340,200][i]})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarClock size={14} strokeWidth={2} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ck-ink)', fontFamily: 'var(--ck-font-mono)' }}>{t}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ck-ink)' }}>—</div>
            <div style={{ fontSize: 11, color: 'var(--ck-muted)', marginTop: 2 }}>days balance</div>
          </Card>
        ))}
      </div>

      <Card padding={0}>
        <div style={{ display: 'flex', gap: 4, padding: '14px 16px', borderBottom: '1px solid var(--ck-line)', alignItems: 'center' }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: tab === t ? 'var(--ck-ink)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--ck-muted)' }}>
              {t}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>{loading ? 'Loading…' : `${total} requests`}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {['Employee', 'Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && leaves.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                  No leave requests yet. They will appear here once employees apply.
                </td></tr>
              )}
              {leaves.map((l, i) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--ck-line)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={`${l.first_name} ${l.last_name}`} hue={(i * 53) % 360} size={34} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{l.first_name} {l.last_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{l.designation}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: 'var(--ck-line-soft)', color: 'var(--ck-ink)', fontFamily: 'var(--ck-font-mono)' }}>{l.type}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--ck-ink-soft)' }}>{fmtDate(l.from_date)}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--ck-ink-soft)' }}>{fmtDate(l.to_date)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{l.days}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--ck-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason}</td>
                  <td style={{ padding: '12px 16px' }}><StatusPill status={STATUS_LABELS[l.status] ?? l.status} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    {l.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button size="sm" variant="accent">Approve</Button>
                        <Button size="sm" variant="ghost">Reject</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
