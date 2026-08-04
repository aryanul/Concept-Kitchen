import { useEffect, useState } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { inrPaiseToRupeesShort } from '../../lib/format';
import { Modal } from '../../components/ui/Modal';
import { useServerListQuery, Pagination, SearchInput, FilterSelect, ClearFiltersButton } from '../../components/filters';

type Increment = {
  id: string; cycle_year: number; current_ctc: number|string; proposed_ctc: number|string;
  hike_pct: number|string; rating: string; stage: string; effective: string|null;
  employee_id: string; code: string; first_name: string; last_name: string; designation: string;
};

const TABS = ['In-flight', 'Approved', 'History'];
const STAGE_MAP: Record<string, string> = {
  manager_review: 'Manager Review', hr: 'HR', finance: 'Finance', done: 'Done',
};
const PIPELINE = ['manager_review', 'hr', 'finance', 'done'];
const RATINGS = ['Outstanding', 'Exceeds', 'Meets'];
const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'created_at', label: 'Date' },
  { value: 'hike_pct', label: 'Hike %' },
  { value: 'proposed_ctc', label: 'Proposed CTC' },
  { value: 'cycle_year', label: 'Cycle year' },
];

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  remarks: z.string().optional(),
});
type DecisionForm = z.infer<typeof decisionSchema>;

type Filters = { rating: string };

export function IncrementsPage() {
  const [tab, setTab] = useState('In-flight');
  const [deciding, setDeciding] = useState<Increment | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    rows: items, loading, total, totalPages, page, setPage,
    searchInput, setSearchInput, applySearch,
    filters, setFilter, sortBy, sortDir, toggleSort,
    hasActiveFilters, clearAll, refetch,
  } = useServerListQuery<Increment, Filters>({
    endpoint: '/increments',
    defaultFilters: { rating: '' },
    defaultSort: { sortBy: 'created_at', sortDir: 'desc' },
    pageSize: 12,
    extraParams: tab === 'In-flight' ? { stageExclude: 'done' } : tab === 'Approved' ? { stage: 'done' } : undefined,
  });

  // Tab changes narrow the stage server-side (via extraParams) — reset to page 1 so a
  // deep page from one tab doesn't carry over as an empty/out-of-range page on another.
  useEffect(() => { setPage(1); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchIncrements = refetch;

  const { register, handleSubmit, reset } = useForm<DecisionForm>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { decision: 'approve' },
  });

  const onDecide = async (data: DecisionForm) => {
    if (!deciding) return;
    setSaving(true);
    try {
      await api.post(`/increments/${deciding.id}/decide`, data);
      toast.success(`Increment ${data.decision === 'approve' ? 'approved' : 'rejected'}`);
      setDeciding(null);
      reset({ decision: 'approve', remarks: '' });
      fetchIncrements();
    } catch { toast.error('Action failed'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Increments & Appraisals" subtitle="Manage appraisal cycles and salary revisions."
        actions={<Button icon={Plus} variant="primary">New Increment</Button>} />

      <Card padding={0}>
        <div style={{ display: 'flex', gap: 4, padding: '14px 16px', borderBottom: '1px solid var(--ck-line)', alignItems: 'center' }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: tab === t ? 'var(--ck-ink)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--ck-muted)' }}>
              {t} {tab === t && !loading && `(${total})`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: 16, borderBottom: '1px solid var(--ck-line)', flexWrap: 'wrap' }}>
          <SearchInput value={searchInput} onChange={setSearchInput} onSubmit={applySearch} placeholder="Search employee name or code…" />
          <FilterSelect label="Rating" value={filters.rating} onChange={(v) => setFilter('rating', v)} placeholder="All ratings"
            options={RATINGS.map((r) => ({ label: r, value: r }))} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--ck-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort by</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={sortBy} onChange={(e) => toggleSort(e.target.value)}
                style={{ height: 34, padding: '0 10px', borderRadius: 7, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', fontSize: 13, minWidth: 130 }}>
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button type="button" onClick={() => toggleSort(sortBy ?? 'created_at')}
                title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                style={{ height: 34, width: 34, borderRadius: 7, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', color: 'var(--ck-ink-soft)', cursor: 'pointer' }}>
                {sortDir === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
          <ClearFiltersButton onClick={clearAll} visible={hasActiveFilters} />
        </div>

        {!loading && items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
            No increments match the current filters.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14, padding: 16 }}>
            {items.map((inc, i) => {
              const hike = Number(inc.hike_pct);
              const stageIdx = PIPELINE.indexOf(inc.stage);
              return (
                <Card key={inc.id} padding={20}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <Avatar name={`${inc.first_name} ${inc.last_name}`} hue={(i * 53) % 360} size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{inc.first_name} {inc.last_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ck-muted)' }}>{inc.designation} · {inc.code}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: 'oklch(0.95 0.05 145)', color: 'oklch(0.42 0.12 145)' }}>
                      {inc.rating}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--ck-muted)' }}>Current</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{inrPaiseToRupeesShort(inc.current_ctc)}</div>
                    </div>
                    <TrendingUp size={18} style={{ color: 'var(--ck-accent)', flexShrink: 0 }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--ck-muted)' }}>Proposed</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ck-accent)' }}>{inrPaiseToRupeesShort(inc.proposed_ctc)}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 999, background: 'var(--ck-accent-soft)', color: 'var(--ck-accent)', fontSize: 13, fontWeight: 700 }}>
                      +{hike.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {PIPELINE.map((p, pi) => (
                      <div key={p} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', margin: '0 auto 4px',
                          background: pi <= stageIdx ? 'var(--ck-accent)' : 'var(--ck-line)',
                          border: pi === stageIdx ? '3px solid var(--ck-accent)' : 'none',
                          boxShadow: pi === stageIdx ? '0 0 0 3px var(--ck-accent-soft)' : 'none' }} />
                        <div style={{ fontSize: 9, color: pi <= stageIdx ? 'var(--ck-accent)' : 'var(--ck-faint)', fontWeight: 600 }}>
                          {STAGE_MAP[p]}
                        </div>
                      </div>
                    ))}
                  </div>
                  {inc.stage !== 'done' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <Button size="sm" variant="accent" onClick={() => { setDeciding(inc); reset({ decision: 'approve', remarks: '' }); }}>Approve</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setDeciding(inc); reset({ decision: 'reject', remarks: '' }); }}>Reject</Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={12} onPageChange={setPage} />
      </Card>

      <Modal open={!!deciding} onClose={() => setDeciding(null)} title="Decision" subtitle={deciding ? `${deciding.first_name} ${deciding.last_name}` : undefined} width={420}
        footer={<>
          <Button onClick={() => setDeciding(null)}>Cancel</Button>
          <Button variant="primary" type="submit" form="increment-decision-form" disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</Button>
        </>}
      >
        <form id="increment-decision-form" onSubmit={handleSubmit(onDecide)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>Decision *</span>
              <select {...register('decision')} style={{ height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' }}>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>Remarks</span>
              <textarea {...register('remarks')} rows={3} style={{ padding: 10, border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' }} />
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
