// Vacancy & Job Listing management.
//
// • Tab "Vacancy"      → read-only derived view of (job_profile × branch × location)
//   slots, one row per JP location. Row action "Create Job Listing" opens a modal
//   that writes a `job_listings` row (positions defaulting to the JP slot's
//   positions). "Prospects" is a stub for now.
//
// • Tab "Job Listing"  → list of created job_listings with Sr No, JL ID,
//   hiring_status, status, deadline, recruiter. Designation cell is hyperlinked
//   to /hiring/listings/:id (detail page).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Briefcase, Users, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { IconAction } from '../../components/ui/IconAction';

// ─── Types ────────────────────────────────────────────────────────────────────
type Vacancy = {
  id: string;
  job_profile_id: string; branch_id: string; location_id: string | null;
  positions: number | string;
  job_title: string; designation: string | null; designation_id: string | null;
  division: string | null; department_id: string; department_name: string;
  branch_name: string; branch_city: string | null;
  location_name: string | null; location_city: string | null;
  company_name: string;
  listing_count: number | string;
};

type JobListing = {
  id: string; listing_no: string; sr_no: number | string;
  positions: number | string; filled: number | string;
  company_name: string; status: string; hiring_status: string;
  published_at: string | null; deadline_at: string | null;
  created_at: string;
  job_profile_id: string; branch_id: string; location_id: string | null;
  recruiter_user_id: string | null;
  job_title: string; designation: string | null; division: string | null;
  department_name: string;
  branch_name: string; branch_city: string | null;
  location_name: string | null; location_city: string | null;
  recruiter_email: string | null;
  recruiter_first_name: string | null; recruiter_last_name: string | null;
  applicant_count: number | string;
};

type Lookup = { id: string; code: string; label: string; color: string | null; sort_order: number | string; is_default: number | boolean; is_active: number | boolean };
type Department = { id: string; name: string };
type UserRow = { id: string; email: string; first_name: string | null; last_name: string | null };

const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function VacanciesPage() {
  const [tab, setTab] = useState<'vacancy' | 'listing'>('vacancy');
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [listings, setListings]   = useState<JobListing[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);

  // Lookups (so picklists are always master-driven)
  const [listingStatuses, setListingStatuses] = useState<Lookup[]>([]);
  const [hiringStatuses, setHiringStatuses]   = useState<Lookup[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [createTarget, setCreateTarget] = useState<Vacancy | null>(null);
  const [prospectsTarget, setProspectsTarget] = useState<Vacancy | null>(null);

  const fetchVacancies = () => {
    setLoading(true);
    api.get<{ data: Vacancy[] }>('/vacancies', { params: { search, departmentId: deptFilter || undefined } })
      .then((r) => setVacancies(r.data.data))
      .catch(() => setVacancies([]))
      .finally(() => setLoading(false));
  };
  const fetchListings = () => {
    api.get<{ data: JobListing[] }>('/job-listings', { params: { search, departmentId: deptFilter || undefined } })
      .then((r) => setListings(r.data.data))
      .catch(() => setListings([]));
  };

  useEffect(() => {
    api.get<{ data: Department[] }>('/departments').then((r) => setDepartments(r.data.data)).catch(() => {});
    api.get<{ data: Lookup[] }>('/lookups', { params: { category: 'listing_status' } }).then((r) => setListingStatuses(r.data.data)).catch(() => {});
    api.get<{ data: Lookup[] }>('/lookups', { params: { category: 'hiring_status' } }).then((r) => setHiringStatuses(r.data.data)).catch(() => {});
    api.get<{ data: UserRow[] }>('/users').then((r) => setUsers(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'vacancy') fetchVacancies();
    else fetchListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search, deptFilter]);

  const onCreateClicked = (v: Vacancy) => { setCreateTarget(v); setCreateOpen(true); };

  const totalPositions = useMemo(() => vacancies.reduce((s, v) => s + (Number(v.positions) || 0), 0), [vacancies]);
  const publishedCount = useMemo(() => listings.filter((l) => l.status === 'Published').length, [listings]);
  const openCount      = useMemo(() => listings.filter((l) => l.status === 'Open').length, [listings]);

  return (
    <div>
      <PageHeader title="Hiring Management" subtitle="Manage hiring and designation requisition" />

      <Card padding={0}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--ck-line)', padding: '0 16px', gap: 8 }}>
          <TabBtn active={tab === 'vacancy'} onClick={() => setTab('vacancy')}>Vacancy</TabBtn>
          <TabBtn active={tab === 'listing'} onClick={() => setTab('listing')}>Job Listing</TabBtn>
        </div>

        {/* Header + filters */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ck-line)' }}>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ck-ink)' }}>
              {tab === 'vacancy' ? 'Vacancy Management' : 'Job Listings'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>
              {tab === 'vacancy'
                ? 'Auto-derived from Job Profiles (one row per branch + location).'
                : 'Open and published listings with hiring progress.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420 }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--ck-muted)', pointerEvents: 'none' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === 'vacancy' ? 'Search by designation, branch...' : 'Search by JL ID, designation, branch...'}
                style={{ width: '100%', height: 36, padding: '0 12px 0 32px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 12.5, background: 'var(--ck-surface)' }} />
            </div>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
              style={{ height: 36, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, background: 'var(--ck-surface)', fontSize: 12.5, minWidth: 180 }}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <Button variant="ghost" size="sm" icon={SlidersHorizontal}>Filters</Button>
            <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>
              {tab === 'vacancy'
                ? `${vacancies.length} vacancies · ${totalPositions} positions`
                : `${listings.length} listings · ${publishedCount} published · ${openCount} open`}
            </div>
          </div>
        </div>

        {tab === 'vacancy'
          ? <VacancyTable rows={vacancies} loading={loading} onCreate={onCreateClicked} onProspects={(v) => setProspectsTarget(v)} />
          : <ListingTable rows={listings} loading={loading} listingStatuses={listingStatuses} hiringStatuses={hiringStatuses} />}
      </Card>

      {createTarget && (
        <CreateListingModal
          open={createOpen}
          target={createTarget}
          users={users}
          listingStatuses={listingStatuses}
          hiringStatuses={hiringStatuses}
          onClose={() => { setCreateOpen(false); setCreateTarget(null); }}
          onCreated={() => { setCreateOpen(false); setCreateTarget(null); fetchVacancies(); if (tab === 'listing') fetchListings(); toast.success('Job Listing created'); }}
        />
      )}
      {prospectsTarget && (
        <Modal open onClose={() => setProspectsTarget(null)} title="Prospects" subtitle={prospectsTarget.designation ?? prospectsTarget.job_title} width={480}>
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ck-muted)' }}>
            <UserSearch size={48} strokeWidth={1.4} style={{ display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ck-ink)', marginBottom: 4 }}>Prospects flow coming soon</div>
            <div style={{ fontSize: 12.5 }}>This will surface talent-pool candidates matching this vacancy.</div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Vacancy table (derived view) ─────────────────────────────────────────────
function VacancyTable({ rows, loading, onCreate, onProspects }: {
  rows: Vacancy[]; loading: boolean; onCreate: (v: Vacancy) => void; onProspects: (v: Vacancy) => void;
}) {
  return (
    <div className="ck-table-wrap">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
            {['COMPANY', 'BRANCH', 'LOCATION', 'DEPARTMENT', 'DIVISION', 'DESIGNATION', 'VACANCY', 'ACTIONS'].map((h) => (
              <th key={h} style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!loading && rows.length === 0 && (
            <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
              No vacancies yet. Add a Location Applicable row in a Job Profile to generate one.
            </td></tr>
          )}
          {rows.map((v) => (
            <tr key={v.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
              <td style={{ padding: '12px', fontWeight: 600, color: 'var(--ck-ink)' }}>{v.company_name}</td>
              <td style={{ padding: '12px', color: 'var(--ck-ink-soft)' }}>{v.branch_name}</td>
              <td style={{ padding: '12px', color: 'var(--ck-ink-soft)' }}>{v.location_name ?? v.branch_city ?? '—'}</td>
              <td style={{ padding: '12px', color: 'var(--ck-ink-soft)' }}>{v.department_name}</td>
              <td style={{ padding: '12px', color: 'var(--ck-muted)', fontSize: 12 }}>{v.division ?? '—'}</td>
              <td style={{ padding: '12px', fontWeight: 700, color: 'var(--ck-ink)' }}>{v.designation ?? v.job_title}</td>
              <td style={{ padding: '12px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: 30, padding: '0 8px', borderRadius: '50%', background: 'var(--ck-line-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ck-ink)' }}>
                  {String(v.positions).padStart(2, '0')}
                </span>
                {Number(v.listing_count) > 0 && (
                  <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, background: 'var(--ck-line-soft)', fontSize: 11, color: 'var(--ck-muted)' }}>
                    {Number(v.listing_count)} listing{Number(v.listing_count) === 1 ? '' : 's'}
                  </span>
                )}
              </td>
              <td style={{ padding: '12px' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <IconAction icon={Briefcase} label="Vacancy" hint="Create Job Listing" onClick={() => onCreate(v)} />
                  <IconAction icon={Users} label="Prospects" hint="View matching prospects" onClick={() => onProspects(v)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Job Listing table ────────────────────────────────────────────────────────
function ListingTable({ rows, loading, listingStatuses, hiringStatuses }: {
  rows: JobListing[]; loading: boolean; listingStatuses: Lookup[]; hiringStatuses: Lookup[];
}) {
  const lstyleByCode = useMemo(() => Object.fromEntries(listingStatuses.map((s) => [s.code, s])), [listingStatuses]);
  const hstyleByCode = useMemo(() => Object.fromEntries(hiringStatuses.map((s) => [s.code, s])), [hiringStatuses]);

  return (
    <div className="ck-table-wrap">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
            {['SR NO', 'JOB LISTING ID', 'COMPANY', 'BRANCH', 'LOCATION', 'DEPARTMENT', 'DIVISION', 'DESIGNATION', 'VACANCY', 'STATUS', 'HIRING STATUS'].map((h) => (
              <th key={h} style={{ padding: '10px 10px', fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!loading && rows.length === 0 && (
            <tr><td colSpan={11} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
              No job listings yet. Use the Vacancy tab to create one.
            </td></tr>
          )}
          {rows.map((l) => {
            const ls = lstyleByCode[l.status];
            const hs = hstyleByCode[l.hiring_status];
            return (
              <tr key={l.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
                <td style={{ padding: '10px', color: 'var(--ck-muted)', fontFamily: 'var(--ck-font-mono)', fontSize: 12 }}>{String(l.sr_no).padStart(3, '0')}</td>
                <td style={{ padding: '10px', fontFamily: 'var(--ck-font-mono)', fontSize: 12, fontWeight: 600 }}>{l.listing_no}</td>
                <td style={{ padding: '10px', fontWeight: 600, color: 'var(--ck-ink)' }}>{l.company_name}</td>
                <td style={{ padding: '10px', color: 'var(--ck-ink-soft)' }}>{l.branch_name}</td>
                <td style={{ padding: '10px', color: 'var(--ck-ink-soft)' }}>{l.location_name ?? l.branch_city ?? '—'}</td>
                <td style={{ padding: '10px', color: 'var(--ck-ink-soft)' }}>{l.department_name}</td>
                <td style={{ padding: '10px', color: 'var(--ck-muted)' }}>{l.division ?? '—'}</td>
                <td style={{ padding: '10px' }}>
                  <Link to={`/hiring/listings/${l.id}`}
                    style={{ fontWeight: 700, color: 'var(--ck-accent)', textDecoration: 'none' }}>
                    {l.designation ?? l.job_title}
                  </Link>
                </td>
                <td style={{ padding: '10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: 'var(--ck-line-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ck-ink)' }}>
                    {String(l.positions).padStart(2, '0')}
                  </span>
                </td>
                <td style={{ padding: '10px' }}><StatusBadge label={ls?.label ?? l.status} color={ls?.color ?? '#888'} /></td>
                <td style={{ padding: '10px' }}><StatusBadge label={hs?.label ?? l.hiring_status} color={hs?.color ?? null} muted /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ label, color, muted }: { label: string; color: string | null; muted?: boolean }) {
  if (muted) {
    return <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--ck-line-soft)', color: 'var(--ck-ink-soft)' }}>{label}</span>;
  }
  const bg = color ?? '#222';
  return <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: bg, color: '#fff' }}>{label}</span>;
}

// ─── Create Listing Modal ─────────────────────────────────────────────────────
const createSchema = z.object({
  positions:     z.coerce.number().int().positive(),
  companyName:   z.string().min(1, 'Required'),
  status:        z.string().min(1, 'Required'),
  hiringStatus:  z.string().min(1, 'Required'),
  recruiterUserId: z.string().optional(),
  publishedAt:   z.string().optional(),
  deadlineAt:    z.string().optional(),
  notes:         z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateListingModal({ open, target, users, listingStatuses, hiringStatuses, onClose, onCreated }: {
  open: boolean; target: Vacancy; users: UserRow[];
  listingStatuses: Lookup[]; hiringStatuses: Lookup[];
  onClose: () => void; onCreated: () => void;
}) {
  const defaultListing = listingStatuses.find((s) => Number(s.is_default))?.code ?? listingStatuses[0]?.code ?? 'Open';
  const defaultHiring  = hiringStatuses.find((s) => Number(s.is_default))?.code  ?? hiringStatuses[0]?.code  ?? 'Applications Invited';
  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      positions:    Number(target.positions) || 1,
      companyName:  target.company_name,
      status:       defaultListing,
      hiringStatus: defaultHiring,
      recruiterUserId: '',
      publishedAt: '',
      deadlineAt: '',
      notes: '',
    },
  });

  const onSubmit = async (data: CreateForm) => {
    try {
      await api.post('/job-listings', {
        jobProfileId: target.job_profile_id,
        branchId:     target.branch_id,
        locationId:   target.location_id,
        positions:    data.positions,
        companyName:  data.companyName,
        status:       data.status,
        hiringStatus: data.hiringStatus,
        recruiterUserId: data.recruiterUserId || undefined,
        publishedAt:  data.publishedAt || undefined,
        deadlineAt:   data.deadlineAt  || undefined,
        notes:        data.notes       || undefined,
      });
      onCreated();
    } catch { toast.error('Failed to create listing'); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Job Listing"
      subtitle={`${target.designation ?? target.job_title} · ${target.branch_name}${target.location_name ? ' · ' + target.location_name : ''}`}
      width={560}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" form="jl-form" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Creating…' : 'Create Listing'}
        </Button>
      </>}>
      <form id="jl-form" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="ck-form-grid-2">
          <F label="Positions *" error={form.formState.errors.positions?.message}>
            <input type="number" min={1} {...form.register('positions')} style={inp} />
          </F>
          <F label="Company name *" error={form.formState.errors.companyName?.message}>
            <input {...form.register('companyName')} style={inp} />
          </F>
          <F label="Status *" error={form.formState.errors.status?.message}>
            <select {...form.register('status')} style={inp}>
              {listingStatuses.map((s) => <option key={s.id} value={s.code}>{s.label}</option>)}
            </select>
          </F>
          <F label="Hiring status *" error={form.formState.errors.hiringStatus?.message}>
            <select {...form.register('hiringStatus')} style={inp}>
              {hiringStatuses.map((s) => <option key={s.id} value={s.code}>{s.label}</option>)}
            </select>
          </F>
          <F label="Recruiter">
            <select {...form.register('recruiterUserId')} style={inp}>
              <option value="">— None —</option>
              {users.map((u) => <option key={u.id} value={u.id}>
                {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email}
              </option>)}
            </select>
          </F>
          <F label="Published at"><input type="date" {...form.register('publishedAt')} style={inp} /></F>
          <F label="Deadline"><input type="date" {...form.register('deadlineAt')} style={inp} /></F>
          <F label="Notes" full><textarea {...form.register('notes')} rows={3} style={{ ...inp, height: 'auto', padding: 10 }} /></F>
        </div>
      </form>
    </Modal>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
      fontSize: 13.5, fontWeight: 600,
      background: active ? 'var(--ck-surface)' : 'transparent',
      color: active ? 'var(--ck-ink)' : 'var(--ck-muted)',
      borderBottom: active ? '2px solid var(--ck-accent)' : '2px solid transparent',
    }}>{children}</button>
  );
}

function F({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: full ? '1 / -1' : 'auto' }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11.5, color: 'var(--ck-danger-fg)' }}>{error}</span>}
    </label>
  );
}
