import { useEffect, useState } from 'react';
import { Plus, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';
import { inrPaiseToRupeesShort, formatDate } from '../../lib/format';

type Tour = {
  id: string; code: string; from_city: string; to_city: string; from_date: string; to_date: string;
  advance: number|string; expense: number|string; status: string;
  employee_id: string; emp_code: string; first_name: string; last_name: string; designation: string;
};
type Resp = { data: Tour[] };
const STATUS_LABELS: Record<string,string> = { requested: 'Requested', approved: 'Approved', in_progress: 'In Progress', settled: 'Settled', rejected: 'Rejected' };

export function ToursPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Resp>('/tours').then((r) => setTours(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Tour & Travel" subtitle="Employee travel requests, advances and expense settlements."
        actions={<Button icon={Plus} variant="primary">New Tour Request</Button>} />
      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {['Tour ID', 'Employee', 'Route', 'Dates', 'Advance', 'Expense', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && tours.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>No tour requests yet.</td></tr>
              )}
              {tours.map((t, i) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--ck-line)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--ck-font-mono)', fontSize: 12, color: 'var(--ck-muted)' }}>{t.code}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={`${t.first_name} ${t.last_name}`} hue={(i * 47) % 360} size={34} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{t.first_name} {t.last_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{t.designation}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                      {t.from_city} <ArrowRight size={14} style={{ color: 'var(--ck-muted)' }} /> {t.to_city}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--ck-ink-soft)' }}>{formatDate(t.from_date)} – {formatDate(t.to_date)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{inrPaiseToRupeesShort(t.advance)}</td>
                  <td style={{ padding: '12px 16px', color: Number(t.expense) ? 'var(--ck-ink)' : 'var(--ck-faint)' }}>
                    {Number(t.expense) ? inrPaiseToRupeesShort(t.expense) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}><StatusPill status={STATUS_LABELS[t.status] ?? t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
