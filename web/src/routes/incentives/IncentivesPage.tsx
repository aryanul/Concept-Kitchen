import { useEffect, useState, type ReactNode } from 'react';
import { Plus, CheckCircle, Gift } from 'lucide-react';
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
import { inrPaiseToRupeesShort } from '../../lib/format';
import { Modal } from '../../components/ui/Modal';
import { useServerListQuery, Pagination, SearchInput, FilterSelect, ClearFiltersButton, SortableTh } from '../../components/filters';

type Incentive = {
  id: string; kind: string; month: number; year: number; amount: number|string;
  status: string; pushed: number|boolean; pushed_at: string|null; created_at: string;
  employee_id: string; code: string; first_name: string; last_name: string; designation: string;
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_LABELS: Record<string,string> = { draft: 'Draft', approved: 'Approved', rejected: 'Rejected' };

const schema = z.object({
  employeeId: z.string().min(1, 'Required'),
  kind: z.string().min(1, 'Required'),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
  amountRupees: z.coerce.number().positive(),
});
type FormValues = z.infer<typeof schema>;

type Filters = { status: string; kind: string; month: string; year: string };
type SortKey = 'created_at' | 'amount' | 'month' | 'year';

export function IncentivesPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  const {
    rows: items, loading, total, totalPages, page, setPage,
    search, searchInput, setSearchInput, applySearch,
    filters, setFilter, sortBy, sortDir, toggleSort,
    hasActiveFilters, clearAll, refetch,
  } = useServerListQuery<Incentive, Filters>({
    endpoint: '/incentives',
    defaultFilters: { status: '', kind: '', month: '', year: '' },
    defaultSort: { sortBy: 'created_at', sortDir: 'desc' },
    pageSize: 20,
  });

  // Selection is page-scoped: toggleAll only ever touches the currently-visible page, and
  // any change to page/filters/search/sort drops the (now off-screen) selection entirely
  // rather than silently carrying stale ids into the "Push to Payroll" bulk action.
  useEffect(() => { setSelected(new Set()); }, [page, filters, search, sortBy, sortDir]);

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setDeciding(id);
    try {
      await api.post(`/incentives/${id}/decide`, { decision });
      toast.success(`Incentive ${decision === 'approve' ? 'approved' : 'rejected'}`);
      refetch();
    } catch { toast.error('Action failed'); }
    finally { setDeciding(null); }
  };

  const pushSelected = async () => {
    if (!selected.size) return;
    setPushing(true);
    try {
      await api.post('/incentives/push-to-payroll', { ids: Array.from(selected) });
      toast.success('Incentives pushed to payroll');
      setSelected(new Set());
      refetch();
    } catch { toast.error('Failed to push incentives'); }
    finally { setPushing(false); }
  };

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await api.post('/incentives', data);
      toast.success('Incentive added');
      reset(); setAddOpen(false); refetch();
    } catch { toast.error('Failed to add incentive'); }
  };

  const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

  return (
    <div>
      <PageHeader title="Incentives & Perks" subtitle="Manage and push performance incentives to payroll."
        actions={<Button icon={Plus} variant="primary" onClick={() => setAddOpen(true)}>Add Incentive</Button>} />

      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--ck-ink)', borderRadius: 10, marginBottom: 14, color: '#fff' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{selected.size} selected (this page)</span>
          <Button size="sm" variant="accent" icon={CheckCircle} disabled={pushing} onClick={pushSelected}>
            {pushing ? 'Pushing…' : 'Push to Payroll'}
          </Button>
          <button onClick={() => setSelected(new Set())} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
        </div>
      )}

      <Card padding={0}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: 16, borderBottom: '1px solid var(--ck-line)', flexWrap: 'wrap' }}>
          <SearchInput value={searchInput} onChange={setSearchInput} onSubmit={applySearch} placeholder="Search employee name or code…" />
          <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} placeholder="All statuses"
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value }))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--ck-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Kind</span>
            <input value={filters.kind} onChange={(e) => setFilter('kind', e.target.value)} placeholder="e.g. Spot bonus"
              style={{ height: 34, padding: '0 10px', borderRadius: 7, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', fontSize: 13, minWidth: 140 }} />
          </div>
          <FilterSelect label="Month" value={filters.month} onChange={(v) => setFilter('month', v)} placeholder="All months"
            options={MONTHS.map((m, i) => ({ label: m, value: String(i + 1) }))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--ck-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Year</span>
            <input type="number" value={filters.year} onChange={(e) => setFilter('year', e.target.value)} placeholder="2026"
              style={{ height: 34, padding: '0 10px', borderRadius: 7, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', fontSize: 13, width: 90 }} />
          </div>
          <ClearFiltersButton onClick={clearAll} visible={hasActiveFilters} />
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>{loading ? 'Loading…' : `${total.toLocaleString('en-IN')} result${total === 1 ? '' : 's'}`}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px', width: 44 }}>
                  <input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                <th style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Employee</th>
                <th style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Kind</th>
                <SortableTh<SortKey> label="Month" sortKey="month" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}
                  style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em', textTransform: 'none', background: 'transparent', border: 'none' }} />
                <SortableTh<SortKey> label="Amount" sortKey="amount" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}
                  style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em', textTransform: 'none', background: 'transparent', border: 'none' }} />
                {['Status', 'In Payroll', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                  <Gift size={40} strokeWidth={1.4} style={{ display: 'block', margin: '0 auto 12px', color: 'var(--ck-faint)' }} />
                  No incentive records match the current filters.
                </td></tr>
              )}
              {items.map((it, i) => (
                <tr key={it.id} style={{ borderTop: '1px solid var(--ck-line)', background: selected.has(it.id) ? 'var(--ck-accent-soft)' : '' }}
                  onMouseEnter={(e) => { if (!selected.has(it.id)) e.currentTarget.style.background = 'var(--ck-surface-alt)'; }}
                  onMouseLeave={(e) => { if (!selected.has(it.id)) e.currentTarget.style.background = ''; }}>
                  <td style={{ padding: '12px 16px' }}>
                    <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={`${it.first_name} ${it.last_name}`} hue={(i * 47) % 360} size={34} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{it.first_name} {it.last_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{it.designation}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--ck-line-soft)', fontSize: 11.5, fontWeight: 600 }}>{it.kind}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--ck-ink-soft)' }}>{MONTHS[it.month - 1]} {it.year}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--ck-ink)' }}>{inrPaiseToRupeesShort(it.amount)}</td>
                  <td style={{ padding: '12px 16px' }}><StatusPill status={STATUS_LABELS[it.status] ?? it.status} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    {it.pushed ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'oklch(0.42 0.12 145)', fontWeight: 600 }}>
                        <CheckCircle size={14} /> Pushed
                      </span>
                    ) : <span style={{ color: 'var(--ck-faint)', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {it.status === 'draft' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button size="sm" variant="accent" disabled={deciding === it.id} onClick={() => decide(it.id, 'approve')}>Approve</Button>
                        <Button size="sm" variant="ghost" disabled={deciding === it.id} onClick={() => decide(it.id, 'reject')}>Reject</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={20} onPageChange={setPage} />
      </Card>

      <Modal open={addOpen} onClose={() => { reset(); setAddOpen(false); }} title="Add Incentive" width={460}
        footer={<>
          <Button onClick={() => { reset(); setAddOpen(false); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="incentive-form" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</Button>
        </>}
      >
        <form id="incentive-form" onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <F2 label="Employee ID *" error={errors.employeeId?.message}><input {...register('employeeId')} placeholder="CK-EMP-001" style={inp} /></F2>
            <F2 label="Kind *" error={errors.kind?.message}><input {...register('kind')} placeholder="Spot bonus" style={inp} /></F2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <F2 label="Month *" error={errors.month?.message}><input type="number" min={1} max={12} {...register('month')} style={inp} /></F2>
              <F2 label="Year *" error={errors.year?.message}><input type="number" {...register('year')} style={inp} /></F2>
            </div>
            <F2 label="Amount (₹) *" error={errors.amountRupees?.message}><input type="number" {...register('amountRupees')} placeholder="5000" style={inp} /></F2>
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
