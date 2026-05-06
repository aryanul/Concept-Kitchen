import { useEffect, useState } from 'react';
import { Play, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusPill } from '../../components/ui/StatusPill';
import { inrPaiseToRupeesShort } from '../../lib/format';
import { Modal } from '../../components/ui/Modal';

type Period = {
  id: string; month: number; year: number; status: string;
  employee_count: number | string; total_gross: number | string; total_net: number | string;
  run_at: string | null;
};
type Resp = { data: Period[] };

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_LABELS: Record<string, string> = { DRAFT: 'Draft', APPROVED: 'Approved', DISBURSED: 'Disbursed' };

const runSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
});
type RunForm = z.infer<typeof runSchema>;

export function PayrollPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [runOpen, setRunOpen] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchPeriods = () => {
    api.get<Resp>('/payroll/periods')
      .then((r) => setPeriods(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchPeriods, []);

  const latest = periods[0];

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RunForm>({
    resolver: zodResolver(runSchema),
    defaultValues: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
  });

  const onRun = async (data: RunForm) => {
    try {
      await api.post('/payroll/periods', data);
      toast.success('Payroll run started');
      reset(data); setRunOpen(false); fetchPeriods();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to run payroll';
      toast.error(msg);
    }
  };

  const approve = async (id: string) => {
    setActionId(id);
    try { await api.post(`/payroll/periods/${id}/approve`); toast.success('Payroll approved'); fetchPeriods(); }
    catch { toast.error('Failed to approve'); }
    finally { setActionId(null); }
  };

  const disburse = async (id: string) => {
    setActionId(id);
    try { await api.post(`/payroll/periods/${id}/disburse`); toast.success('Payroll disbursed'); fetchPeriods(); }
    catch { toast.error('Failed to disburse'); }
    finally { setActionId(null); }
  };

  const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

  return (
    <div>
      <PageHeader
        title="Payroll Runs & Pay-slips"
        subtitle="Manage monthly payroll cycles, approve and disburse salaries."
        actions={<Button icon={Play} variant="primary" onClick={() => setRunOpen(true)}>Run Payroll</Button>}
      />

      <Card padding={0} style={{ marginBottom: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
          {[
            { label: 'Current Period',  value: latest ? `${MONTHS[latest.month - 1]} ${latest.year}` : '—', sub: 'Active period' },
            { label: 'Employees',       value: latest ? String(latest.employee_count) : '—',                sub: 'In this run' },
            { label: 'Gross Payable',   value: latest ? inrPaiseToRupeesShort(latest.total_gross) : '—',    sub: 'Before deductions' },
            { label: 'Net Payable',     value: latest ? inrPaiseToRupeesShort(latest.total_net)   : '—',    sub: 'After deductions' },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: 24, borderLeft: i > 0 ? '1px solid var(--ck-line)' : 'none' }}>
              <div style={{ fontSize: 11.5, color: 'var(--ck-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ck-ink)', letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--ck-muted)', marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--ck-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-ink)' }}>Payroll history</div>
            <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginTop: 2 }}>All processed payroll periods.</div>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>{loading ? 'Loading…' : `${periods.length} periods`}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {['Period', 'Employees', 'Gross', 'Net Payable', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && periods.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                  No payroll periods yet. Run the first payroll to get started.
                </td></tr>
              )}
              {periods.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--ck-line)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '14px 16px', fontWeight: 600 }}>{MONTHS[p.month - 1]} {p.year}</td>
                  <td style={{ padding: '14px 16px' }}>{Number(p.employee_count)}</td>
                  <td style={{ padding: '14px 16px' }}>{inrPaiseToRupeesShort(p.total_gross)}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--ck-ink)' }}>{inrPaiseToRupeesShort(p.total_net)}</td>
                  <td style={{ padding: '14px 16px' }}><StatusPill status={STATUS_LABELS[p.status] ?? p.status} /></td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {p.status === 'DRAFT' && (
                        <Button size="sm" variant="accent" disabled={actionId === p.id} onClick={() => approve(p.id)}>
                          {actionId === p.id ? 'Approving…' : 'Approve'}
                        </Button>
                      )}
                      {p.status === 'APPROVED' && (
                        <Button size="sm" variant="accent" disabled={actionId === p.id} onClick={() => disburse(p.id)}>
                          {actionId === p.id ? 'Disbursing…' : 'Disburse'}
                        </Button>
                      )}
                      <Button size="sm" icon={FileText} variant="ghost">View</Button>
                      <Button size="sm" icon={Download} variant="ghost">Download</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={runOpen} onClose={() => { reset(); setRunOpen(false); }} title="Run Payroll" width={420}
        footer={<>
          <Button onClick={() => { reset(); setRunOpen(false); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="run-payroll-form" disabled={isSubmitting}>{isSubmitting ? 'Starting…' : 'Run'}</Button>
        </>}
      >
        <form id="run-payroll-form" onSubmit={handleSubmit(onRun)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>Month *</span>
              <input type="number" min={1} max={12} {...register('month')} style={inp} />
              {errors.month && <span style={{ fontSize: 11.5, color: 'var(--ck-danger-fg)' }}>{errors.month.message}</span>}
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>Year *</span>
              <input type="number" {...register('year')} style={inp} />
              {errors.year && <span style={{ fontSize: 11.5, color: 'var(--ck-danger-fg)' }}>{errors.year.message}</span>}
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
