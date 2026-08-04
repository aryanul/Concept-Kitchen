import { useEffect, useState, type ReactNode } from 'react';
import { CalendarDays, MapPin, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useServerListQuery, Pagination, SearchInput, FilterSelect, ClearFiltersButton } from '../../components/filters';

type Holiday = { id: string; date: string; name: string; kind: string; branch_names: string | null };
type Branch = { id: string; name: string };
const KIND_TONE: Record<string, { bg: string; fg: string }> = {
  Public:   { bg: 'oklch(0.95 0.05 250)', fg: 'oklch(0.45 0.13 250)' },
  Optional: { bg: 'oklch(0.96 0.06 70)',  fg: 'oklch(0.5 0.13 60)'  },
  Regional: { bg: 'oklch(0.95 0.05 145)', fg: 'oklch(0.42 0.12 145)' },
};

const schema = z.object({
  date: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  kind: z.string().min(1, 'Required'),
});
type FormValues = z.infer<typeof schema>;

type Filters = { kind: string; branchId: string; dateFrom: string; dateTo: string };

export function HolidaysPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editHoliday, setEditHoliday] = useState<Holiday | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  // KPI tiles reflect ALL holidays, independent of the filtered/paginated table below.
  const [statTotal, setStatTotal] = useState(0);
  const [statByKind, setStatByKind] = useState<Record<string, number>>({});
  const fetchStats = () => {
    api.get<{ data: Holiday[] }>('/holidays', { params: { pageSize: 1000 } })
      .then((r) => {
        const rows = r.data.data;
        const byKind: Record<string, number> = {};
        for (const h of rows) byKind[h.kind] = (byKind[h.kind] || 0) + 1;
        setStatTotal(rows.length);
        setStatByKind(byKind);
      })
      .catch(() => {});
  };
  useEffect(fetchStats, []);

  useEffect(() => {
    api.get<{ data: Branch[] }>('/branches').then((r) => setBranches(r.data.data)).catch(() => {});
  }, []);

  const {
    rows: holidays, loading, total, totalPages, page, setPage,
    searchInput, setSearchInput, applySearch,
    filters, setFilter, sortBy, sortDir, toggleSort,
    hasActiveFilters, clearAll, refetch,
  } = useServerListQuery<Holiday, Filters>({
    endpoint: '/holidays',
    defaultFilters: { kind: '', branchId: '', dateFrom: '', dateTo: '' },
    defaultSort: { sortBy: 'date', sortDir: 'asc' },
    pageSize: 20,
  });

  const refresh = () => { refetch(); fetchStats(); };

  const today = new Date(); today.setHours(0,0,0,0);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { kind: 'Public' } });
  const editForm = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    try { await api.post('/holidays', data); toast.success('Holiday added'); reset(); setAddOpen(false); refresh(); }
    catch { toast.error('Failed to add holiday'); }
  };

  const onEdit = async (data: FormValues) => {
    if (!editHoliday) return;
    try { await api.patch(`/holidays/${editHoliday.id}`, data); toast.success('Holiday updated'); setEditHoliday(null); refresh(); }
    catch { toast.error('Failed to update holiday'); }
  };

  const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

  return (
    <div>
      <PageHeader title="Holidays" subtitle="Public, regional and optional holidays for the year."
        actions={<Button icon={Plus} variant="primary" onClick={() => setAddOpen(true)}>Add Holiday</Button>} />

      <div className="ck-stats-4">
        <StatTile icon={CalendarDays} label="Total Holidays" value={String(statTotal)} tint={250} />
        <StatTile label="Public"   value={String(statByKind['Public']   || 0)} tint={250} />
        <StatTile label="Regional" value={String(statByKind['Regional'] || 0)} tint={145} />
        <StatTile label="Optional" value={String(statByKind['Optional'] || 0)} tint={60} />
      </div>

      <Card padding={0}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: 16, borderBottom: '1px solid var(--ck-line)', flexWrap: 'wrap' }}>
          <SearchInput value={searchInput} onChange={setSearchInput} onSubmit={applySearch} placeholder="Search holiday name…" />
          <FilterSelect label="Kind" value={filters.kind} onChange={(v) => setFilter('kind', v)} placeholder="All kinds"
            options={[
              { label: 'Public', value: 'Public' },
              { label: 'Regional', value: 'Regional' },
              { label: 'Optional', value: 'Optional' },
            ]} />
          <FilterSelect label="Branch" value={filters.branchId} onChange={(v) => setFilter('branchId', v)} placeholder="All branches"
            options={branches.map((b) => ({ label: b.name, value: b.id }))} />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--ck-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sort by</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['date', 'name', 'kind'] as const).map((k) => (
                <button key={k} type="button" onClick={() => toggleSort(k)}
                  style={{
                    height: 34, padding: '0 10px', borderRadius: 7, fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer',
                    border: sortBy === k ? '1px solid var(--ck-accent)' : '1px solid var(--ck-line)',
                    background: sortBy === k ? 'var(--ck-accent)' : 'var(--ck-bg)',
                    color: sortBy === k ? '#fff' : 'var(--ck-ink-soft)',
                  }}>
                  {k.charAt(0).toUpperCase() + k.slice(1)}{sortBy === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              ))}
            </div>
          </div>
          <ClearFiltersButton onClick={clearAll} visible={hasActiveFilters} />
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>{loading ? 'Loading…' : `${total.toLocaleString('en-IN')} result${total === 1 ? '' : 's'}`}</div>
        </div>
        <div>
          {!loading && holidays.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>No holidays match this filter.</div>
          )}
          {holidays.map((h) => {
            const d = new Date(h.date);
            const isPast = d < today;
            const tone = KIND_TONE[h.kind] || { bg: 'var(--ck-line-soft)', fg: 'var(--ck-muted)' };
            return (
              <div key={h.id} style={{ padding: '16px 22px', borderTop: '1px solid var(--ck-line)', display: 'flex', alignItems: 'center', gap: 18, opacity: isPast ? 0.55 : 1 }}>
                <div style={{ width: 60, height: 64, border: '1px solid var(--ck-line)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ck-accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d.toLocaleDateString('en-IN', { month: 'short' })}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ck-ink)', lineHeight: 1 }}>{String(d.getDate()).padStart(2,'0')}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--ck-muted)', marginTop: 2 }}>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ck-ink)' }}>{h.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MapPin size={13} />{h.branch_names || 'All Branches'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: tone.bg, color: tone.fg }}>{h.kind}</span>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setEditHoliday(h);
                    editForm.reset({ date: h.date, name: h.name, kind: h.kind });
                  }}>Edit</Button>
                </div>
              </div>
            );
          })}
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={20} onPageChange={setPage} />
      </Card>

      <Modal open={addOpen} onClose={() => { reset(); setAddOpen(false); }} title="Add Holiday" width={420}
        footer={<>
          <Button onClick={() => { reset(); setAddOpen(false); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="holiday-form" disabled={isSubmitting}>{isSubmitting ? 'Adding…' : 'Add Holiday'}</Button>
        </>}>
        <form id="holiday-form" onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <F2 label="Date *" error={errors.date?.message}><input type="date" {...register('date')} style={inp} /></F2>
            <F2 label="Holiday name *" error={errors.name?.message}><input {...register('name')} placeholder="e.g. Diwali" style={inp} /></F2>
            <F2 label="Kind *" error={errors.kind?.message}>
              <select {...register('kind')} style={inp}>
                <option value="Public">Public</option>
                <option value="Regional">Regional</option>
                <option value="Optional">Optional</option>
              </select>
            </F2>
          </div>
        </form>
      </Modal>

      <Modal open={!!editHoliday} onClose={() => { setEditHoliday(null); editForm.reset(); }} title="Edit Holiday" width={420}
        footer={<>
          <Button onClick={() => { setEditHoliday(null); editForm.reset(); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="edit-holiday-form" disabled={editForm.formState.isSubmitting}>{editForm.formState.isSubmitting ? 'Saving…' : 'Save'}</Button>
        </>}
      >
        <form id="edit-holiday-form" onSubmit={editForm.handleSubmit(onEdit)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <F2 label="Date *" error={editForm.formState.errors.date?.message}><input type="date" {...editForm.register('date')} style={inp} /></F2>
            <F2 label="Holiday name *" error={editForm.formState.errors.name?.message}><input {...editForm.register('name')} style={inp} /></F2>
            <F2 label="Kind *" error={editForm.formState.errors.kind?.message}>
              <select {...editForm.register('kind')} style={inp}>
                <option value="Public">Public</option>
                <option value="Regional">Regional</option>
                <option value="Optional">Optional</option>
              </select>
            </F2>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function StatTile({ icon: Cmp, label, value, tint }: { icon?: typeof CalendarDays; label: string; value: string; tint: number }) {
  return (
    <Card padding={20}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `oklch(0.95 0.04 ${tint})`, color: `oklch(0.45 0.13 ${tint})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {Cmp ? <Cmp size={18} strokeWidth={1.8} /> : <span style={{ fontSize: 16, fontWeight: 700 }}>·</span>}
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ck-faint)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ck-ink)', letterSpacing: '-0.02em' }}>{value}</div>
    </Card>
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
