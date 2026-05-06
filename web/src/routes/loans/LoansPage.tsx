import { useEffect, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
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
import { inrPaiseToRupeesShort } from '../../lib/format';

type Loan = {
  id: string; kind: string; principal: number|string; outstanding: number|string;
  emi: number|string; tenure_months: number; remaining: number; status: string; purpose: string|null;
  employee_id: string; code: string; first_name: string; last_name: string; designation: string;
};
type Stats = { total_principal: number|string; total_outstanding: number|string; active: number|string };
type Resp = { data: Loan[]; meta: { total: number }; stats: Stats };
const STATUS_LABELS: Record<string,string> = { ACTIVE: 'Active', CLOSED: 'Closed', DEFAULTED: 'Defaulted' };

const schema = z.object({
  employeeId: z.string().min(1, 'Required'),
  kind: z.enum(['LOAN', 'ADVANCE']),
  principalRupees: z.coerce.number().positive(),
  emiRupees: z.coerce.number().positive(),
  tenureMonths: z.coerce.number().int().positive(),
  purpose: z.string().optional(),
  startedAt: z.string().min(1, 'Required'),
});
type FormValues = z.infer<typeof schema>;

export function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);

  const fetchLoans = () => {
    api.get<Resp>('/loans').then((r) => { setLoans(r.data.data); setTotal(r.data.meta.total); setStats(r.data.stats); }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(fetchLoans, []);

  const closeLoan = async (id: string) => {
    setClosing(id);
    try { await api.post(`/loans/${id}/close`); toast.success('Loan closed'); fetchLoans(); }
    catch { toast.error('Failed to close loan'); }
    finally { setClosing(null); }
  };

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: 'LOAN', startedAt: new Date().toISOString().slice(0, 10) },
  });

  const onSubmit = async (data: FormValues) => {
    try { await api.post('/loans', data); toast.success('Loan/advance created'); reset(); setAddOpen(false); fetchLoans(); }
    catch { toast.error('Failed to create loan'); }
  };

  const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

  return (
    <div>
      <PageHeader title="Advances & Loans" subtitle="Employee loan and advance disbursements."
        actions={<Button icon={Plus} variant="primary" onClick={() => setAddOpen(true)}>New Loan</Button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total Disbursed', value: stats ? inrPaiseToRupeesShort(stats.total_principal) : '—', tint: 250 },
          { label: 'Outstanding', value: stats ? inrPaiseToRupeesShort(stats.total_outstanding) : '—', tint: 60 },
          { label: 'Active Loans', value: stats ? String(stats.active) : '—', tint: 145 },
          { label: 'Total Records', value: String(total), tint: 25 },
        ].map((s) => (
          <Card key={s.label} padding={20}>
            <div style={{ fontSize: 11, color: 'var(--ck-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ck-ink)', letterSpacing: '-0.02em' }}>{loading ? '—' : s.value}</div>
          </Card>
        ))}
      </div>

      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {['Employee','Kind','Principal','Outstanding','EMI','Remaining','Status','Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && loans.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>No loan records yet.</td></tr>
              )}
              {loans.map((l, i) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--ck-line)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={`${l.first_name} ${l.last_name}`} hue={(i*47)%360} size={34} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{l.first_name} {l.last_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{l.code}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}><span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--ck-line-soft)', fontSize: 11.5, fontWeight: 600 }}>{l.kind}</span></td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{inrPaiseToRupeesShort(l.principal)}</td>
                  <td style={{ padding: '12px 16px', color: Number(l.outstanding) > 0 ? 'oklch(0.5 0.18 25)' : 'inherit', fontWeight: 600 }}>{inrPaiseToRupeesShort(l.outstanding)}</td>
                  <td style={{ padding: '12px 16px' }}>{inrPaiseToRupeesShort(l.emi)}/mo</td>
                  <td style={{ padding: '12px 16px', color: 'var(--ck-muted)' }}>{l.remaining} left</td>
                  <td style={{ padding: '12px 16px' }}><StatusPill status={STATUS_LABELS[l.status] ?? l.status} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    {l.status === 'ACTIVE' && (
                      <Button size="sm" variant="ghost" disabled={closing === l.id} onClick={() => closeLoan(l.id)}>
                        {closing === l.id ? 'Closing…' : 'Close'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={addOpen} onClose={() => { reset(); setAddOpen(false); }} title="New Loan / Advance" width={480}
        footer={<>
          <Button onClick={() => { reset(); setAddOpen(false); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="loan-form" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create'}</Button>
        </>}>
        <form id="loan-form" onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <F2 label="Employee ID *" error={errors.employeeId?.message}><input {...register('employeeId')} placeholder="CK-EMP-001" style={inp} /></F2>
            <F2 label="Kind *" error={errors.kind?.message}>
              <select {...register('kind')} style={inp}>
                <option value="LOAN">Loan</option>
                <option value="ADVANCE">Advance</option>
              </select>
            </F2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <F2 label="Principal (₹) *" error={errors.principalRupees?.message}><input type="number" {...register('principalRupees')} placeholder="100000" style={inp} /></F2>
              <F2 label="EMI (₹/mo) *" error={errors.emiRupees?.message}><input type="number" {...register('emiRupees')} placeholder="5000" style={inp} /></F2>
              <F2 label="Tenure (months) *" error={errors.tenureMonths?.message}><input type="number" {...register('tenureMonths')} placeholder="12" style={inp} /></F2>
              <F2 label="Start date *" error={errors.startedAt?.message}><input type="date" {...register('startedAt')} style={inp} /></F2>
            </div>
            <F2 label="Purpose"><input {...register('purpose')} placeholder="Optional" style={inp} /></F2>
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
