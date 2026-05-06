import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';

type Row = {
  id: string; date: string; in_at: string | null; out_at: string | null;
  total_min: number; ot_min: number; source: string; is_late: number; notes: string | null;
  employee_id: string; code: string; first_name: string; last_name: string; branch_name: string;
};

type Resp = { data: Row[]; meta: { total: number; page: number; pageSize: number } };

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtTime = (dt: string | null) => {
  if (!dt) return '—';
  try { return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }); } catch { return '—'; }
};
const fmtMins = (m: number) => {
  if (!m) return '—';
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

export function AttendancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => { setPage(1); }, [date, search]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const params: Record<string, unknown> = { date, page, pageSize };
    if (search) params.search = search;
    api.get<Resp>('/attendance', { params, signal: ctrl.signal })
      .then((r) => { setRows(r.data.data); setTotal(r.data.meta.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [date, search, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader
        title="Attendance & Exceptions"
        subtitle="Daily punch-in/out records across all branches."
        actions={<Button variant="primary">Mark Attendance</Button>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Present',  tint: 145 },
          { label: 'Late',     tint: 60 },
          { label: 'On Leave', tint: 250 },
          { label: 'Absent',   tint: 25 },
        ].map((s) => (
          <Card key={s.label} padding={20}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `oklch(0.95 0.04 ${s.tint})`, color: `oklch(0.45 0.13 ${s.tint})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>
                {s.label[0]}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ck-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ck-ink)' }}>—</div>
            <div style={{ fontSize: 11.5, color: 'var(--ck-muted)', marginTop: 2 }}>No data for {date}</div>
          </Card>
        ))}
      </div>

      <Card padding={0}>
        <div style={{ display: 'flex', gap: 12, padding: 16, borderBottom: '1px solid var(--ck-line)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={{ height: 40, padding: '0 12px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }} />
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ck-muted)', pointerEvents: 'none' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee…"
              style={{ width: '100%', height: 40, padding: '0 12px 0 36px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }} />
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>{loading ? 'Loading…' : `${total} records`}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {['Employee', 'Branch', 'In Time', 'Out Time', 'Hours', 'OT', 'Status', 'Source'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                  No attendance records for this date. Records appear once employees punch in.
                </td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--ck-line)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={`${r.first_name} ${r.last_name}`} hue={(i * 47) % 360} size={34} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{r.first_name} {r.last_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{r.code}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{r.branch_name}</td>
                  <td style={{ padding: '12px 16px', color: r.is_late ? 'oklch(0.5 0.18 25)' : 'inherit' }}>{fmtTime(r.in_at)}</td>
                  <td style={{ padding: '12px 16px' }}>{fmtTime(r.out_at)}</td>
                  <td style={{ padding: '12px 16px' }}>{fmtMins(r.total_min)}</td>
                  <td style={{ padding: '12px 16px' }}>{fmtMins(r.ot_min)}</td>
                  <td style={{ padding: '12px 16px' }}><StatusPill status={r.is_late ? 'Late' : 'Present'} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ck-muted)' }}>{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--ck-line)', fontSize: 12.5 }}>
          <div style={{ color: 'var(--ck-muted)' }}>Page {page} of {totalPages}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <Button size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
