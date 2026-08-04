import { useState, type ReactNode } from 'react';
import { Plus, ArrowRight } from 'lucide-react';
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
import { inrPaiseToRupeesShort, formatDate } from '../../lib/format';
import { Modal } from '../../components/ui/Modal';
import { useServerListQuery, Pagination, SearchInput, FilterSelect, ClearFiltersButton, SortableTh } from '../../components/filters';

type Tour = {
  id: string; code: string; from_city: string; to_city: string; from_date: string; to_date: string;
  advance: number|string; expense: number|string; status: string;
  employee_id: string; emp_code: string; first_name: string; last_name: string; designation: string;
};
const STATUS_LABELS: Record<string,string> = { requested: 'Requested', approved: 'Approved', in_progress: 'In Progress', settled: 'Settled', rejected: 'Rejected' };

type Filters = { status: string; dateFrom: string; dateTo: string };
type SortKey = 'created_at' | 'from_date' | 'status' | 'expense';

const requestSchema = z.object({
  employeeId: z.string().min(1, 'Required'),
  fromCity: z.string().min(1, 'Required'),
  toCity: z.string().min(1, 'Required'),
  fromDate: z.string().min(1, 'Required'),
  toDate: z.string().min(1, 'Required'),
  advanceRupees: z.coerce.number().positive(),
  notes: z.string().optional(),
});
type RequestForm = z.infer<typeof requestSchema>;

const settleSchema = z.object({
  expenseRupees: z.coerce.number().positive(),
  notes: z.string().optional(),
});
type SettleForm = z.infer<typeof settleSchema>;

export function ToursPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState<Tour | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    rows: tours, loading, total, totalPages, page, setPage,
    searchInput, setSearchInput, applySearch,
    filters, setFilter, sortBy, sortDir, toggleSort,
    hasActiveFilters, clearAll, refetch,
  } = useServerListQuery<Tour, Filters>({
    endpoint: '/tours',
    defaultFilters: { status: '', dateFrom: '', dateTo: '' },
    defaultSort: { sortBy: 'created_at', sortDir: 'desc' },
    pageSize: 20,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RequestForm>({ resolver: zodResolver(requestSchema) });
  const settleForm = useForm<SettleForm>({ resolver: zodResolver(settleSchema) });

  const onSubmit = async (data: RequestForm) => {
    try {
      await api.post('/tours', { ...data, itinerary: data.notes ? [{ notes: data.notes }] : [] });
      toast.success('Tour request created');
      reset(); setAddOpen(false); refetch();
    } catch { toast.error('Failed to create tour request'); }
  };

  const onSettle = async (data: SettleForm) => {
    if (!settleOpen) return;
    setSaving(true);
    try {
      await api.post(`/tours/${settleOpen.id}/settle`, data);
      toast.success('Tour settled');
      setSettleOpen(null); settleForm.reset(); refetch();
    } catch { toast.error('Failed to settle tour'); }
    finally { setSaving(false); }
  };

  const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

  return (
    <div>
      <PageHeader title="Tour & Travel" subtitle="Employee travel requests, advances and expense settlements."
        actions={<Button icon={Plus} variant="primary" onClick={() => setAddOpen(true)}>New Tour Request</Button>} />
      <Card padding={0}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: 16, borderBottom: '1px solid var(--ck-line)', flexWrap: 'wrap' }}>
          <SearchInput value={searchInput} onChange={setSearchInput} onSubmit={applySearch} placeholder="Search employee, code, or city…" />
          <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} placeholder="All statuses"
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value }))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--ck-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>From date</span>
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)}
              style={{ height: 34, padding: '0 10px', borderRadius: 7, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--ck-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>To date</span>
            <input type="date" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)}
              style={{ height: 34, padding: '0 10px', borderRadius: 7, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', fontSize: 13 }} />
          </div>
          <ClearFiltersButton onClick={clearAll} visible={hasActiveFilters} />
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>{loading ? 'Loading…' : `${total.toLocaleString('en-IN')} result${total === 1 ? '' : 's'}`}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {['Tour ID', 'Employee', 'Route'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
                <SortableTh<SortKey> label="Dates" sortKey="from_date" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}
                  style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em', textTransform: 'none', background: 'transparent', border: 'none' }} />
                <th style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Advance</th>
                <SortableTh<SortKey> label="Expense" sortKey="expense" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}
                  style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em', textTransform: 'none', background: 'transparent', border: 'none' }} />
                <SortableTh<SortKey> label="Status" sortKey="status" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}
                  style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em', textTransform: 'none', background: 'transparent', border: 'none' }} />
                <th style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && tours.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>No tour requests yet.</td></tr>
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
                  <td style={{ padding: '12px 16px' }}>
                    {t.status !== 'settled' && (
                      <Button size="sm" variant="ghost" onClick={() => { setSettleOpen(t); settleForm.reset({ expenseRupees: Number(t.expense) / 100 || 0, notes: '' }); }}>
                        Settle
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={20} onPageChange={setPage} />
      </Card>

      <Modal open={addOpen} onClose={() => { reset(); setAddOpen(false); }} title="New Tour Request" width={520}
        footer={<>
          <Button onClick={() => { reset(); setAddOpen(false); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="tour-form" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Create'}</Button>
        </>}
      >
        <form id="tour-form" onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <F2 label="Employee ID *" error={errors.employeeId?.message}><input {...register('employeeId')} placeholder="CK-EMP-001" style={inp} /></F2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <F2 label="From city *" error={errors.fromCity?.message}><input {...register('fromCity')} style={inp} /></F2>
              <F2 label="To city *" error={errors.toCity?.message}><input {...register('toCity')} style={inp} /></F2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <F2 label="From date *" error={errors.fromDate?.message}><input type="date" {...register('fromDate')} style={inp} /></F2>
              <F2 label="To date *" error={errors.toDate?.message}><input type="date" {...register('toDate')} style={inp} /></F2>
            </div>
            <F2 label="Advance (₹) *" error={errors.advanceRupees?.message}><input type="number" {...register('advanceRupees')} style={inp} /></F2>
            <F2 label="Notes"><textarea {...register('notes')} rows={3} style={{ ...inp, height: 'auto', padding: 10 }} /></F2>
          </div>
        </form>
      </Modal>

      <Modal open={!!settleOpen} onClose={() => { setSettleOpen(null); settleForm.reset(); }} title="Settle Tour" width={420}
        footer={<>
          <Button onClick={() => { setSettleOpen(null); settleForm.reset(); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="tour-settle-form" disabled={saving}>{saving ? 'Saving…' : 'Settle'}</Button>
        </>}
      >
        <form id="tour-settle-form" onSubmit={settleForm.handleSubmit(onSettle)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <F2 label="Expense (₹) *" error={settleForm.formState.errors.expenseRupees?.message}>
              <input type="number" {...settleForm.register('expenseRupees')} style={inp} />
            </F2>
            <F2 label="Notes">
              <textarea {...settleForm.register('notes')} rows={3} style={{ ...inp, height: 'auto', padding: 10 }} />
            </F2>
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
