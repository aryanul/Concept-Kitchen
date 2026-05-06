import { useEffect, useState, type ReactNode } from 'react';
import { Search, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';
import { Modal } from '../../components/ui/Modal';

type Row = {
  id: string; date: string; in_at: string | null; out_at: string | null;
  total_min: number; ot_min: number; source: string; is_late: number; notes: string | null;
  employee_id: string; code: string; first_name: string; last_name: string; branch_name: string;
};
type Resp = { data: Row[]; meta: { total: number; page: number; pageSize: number } };

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtTime = (dt: string | null) => { if (!dt) return '—'; try { return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }); } catch { return '—'; } };
const fmtMins = (m: number) => m ? `${Math.floor(m / 60)}h ${m % 60}m` : '—';

const punchSchema = z.object({
  employeeId: z.string().min(1, 'Required'),
  date: z.string().min(1),
  inAt: z.string().optional(),
  outAt: z.string().optional(),
  notes: z.string().optional(),
});
type PunchForm = z.infer<typeof punchSchema>;

export function AttendancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [markOpen, setMarkOpen] = useState(false);
  const pageSize = 20;

  useEffect(() => { setPage(1); }, [date, search]);

  const fetchAttendance = () => {
    const ctrl = new AbortController();
    setLoading(true);
    const params: Record<string, unknown> = { date, page, pageSize };
    if (search) params.search = search;
    api.get<Resp>('/attendance', { params, signal: ctrl.signal })
      .then((r) => { setRows(r.data.data); setTotal(r.data.meta.total); })
      .catch(() => {}).finally(() => setLoading(false));
    return () => ctrl.abort();
  };

  useEffect(fetchAttendance, [date, search, page]);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PunchForm>({
    resolver: zodResolver(punchSchema),
    defaultValues: { date: todayStr() },
  });

  const onPunch = async (data: PunchForm) => {
    try {
      const payload = {
        employeeId: data.employeeId, date: data.date,
        inAt: data.inAt ? `${data.date}T${data.inAt}:00` : undefined,
        outAt: data.outAt ? `${data.date}T${data.outAt}:00` : undefined,
        notes: data.notes,
      };
      await api.post('/attendance/punch', payload);
      toast.success('Attendance marked');
      reset({ date: todayStr() }); setMarkOpen(false); fetchAttendance();
    } catch { toast.error('Failed to mark attendance'); }
  };

  const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader title="Attendance & Exceptions" subtitle="Daily punch-in/out records across all branches."
        actions={<Button icon={Plus} variant="primary" onClick={() => setMarkOpen(true)}>Mark Attendance</Button>} />

      <div className="ck-stats-4">
        {[{ label: 'Present', tint: 145 }, { label: 'Late', tint: 60 }, { label: 'On Leave', tint: 250 }, { label: 'Absent', tint: 25 }].map((s) => (
          <Card key={s.label} padding={20}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `oklch(0.95 0.04 ${s.tint})`, color: `oklch(0.45 0.13 ${s.tint})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{s.label[0]}</div>
            <div style={{ fontSize: 11, color: 'var(--ck-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ck-ink)' }}>{loading ? '—' : rows.filter((r) => s.label === 'Present' ? (!r.is_late && r.in_at) : s.label === 'Late' ? r.is_late : s.label === 'On Leave' ? !r.in_at && !r.is_late : !r.in_at).length}</div>
          </Card>
        ))}
      </div>

      <Card padding={0}>
        <div style={{ display: 'flex', gap: 12, padding: 16, borderBottom: '1px solid var(--ck-line)', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ height: 40, padding: '0 12px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }} />
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
                {['Employee','Branch','In Time','Out Time','Hours','OT','Status','Source'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>No attendance records for {date}.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--ck-line)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '12px 16px' }}>
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
                  <td style={{ padding: '12px 16px' }}><StatusPill status={r.is_late ? 'Late' : r.in_at ? 'Present' : 'Absent'} /></td>
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

      <Modal open={markOpen} onClose={() => { reset({ date: todayStr() }); setMarkOpen(false); }} title="Mark Attendance" subtitle="Manually record a punch-in or punch-out." width={440}
        footer={<>
          <Button onClick={() => { reset({ date: todayStr() }); setMarkOpen(false); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="punch-form" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</Button>
        </>}>
        <form id="punch-form" onSubmit={handleSubmit(onPunch)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <F2 label="Employee ID *" error={errors.employeeId?.message}><input {...register('employeeId')} placeholder="CK-EMP-001" style={inp} /></F2>
            <F2 label="Date *" error={errors.date?.message}><input type="date" {...register('date')} style={inp} /></F2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <F2 label="In time"><input type="time" {...register('inAt')} style={inp} /></F2>
              <F2 label="Out time"><input type="time" {...register('outAt')} style={inp} /></F2>
            </div>
            <F2 label="Notes"><input {...register('notes')} placeholder="Optional notes" style={inp} /></F2>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function F2({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11.5, color: 'var(--ck-danger-fg)' }}>{error}</span>}
    </label>
  );
}
