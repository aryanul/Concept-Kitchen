import { useEffect, useState, type ReactNode } from 'react';
import { Plus, Search, SlidersHorizontal, Briefcase, Eye,
  CheckCircle2, XCircle, ArrowRight, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Drawer } from '../../components/ui/Drawer';
import { Avatar } from '../../components/ui/Avatar';

// ─── Types ────────────────────────────────────────────────────────────────────
type Vacancy = {
  id: string; company_name: string; job_id: string | null; location: string | null;
  division: string | null; positions: number; filled: number; status: string;
  listing_status: string; notes: string | null; created_at: string;
  job_title: string; designation: string | null; job_profile_id: string;
  branch_name: string; branch_city: string; branch_id: string;
  department_name: string; hiring_status: string; applicant_count: number | string;
};
type Applicant = {
  id: string; full_name: string; email: string; phone: string | null;
  current_company: string | null; experience_years: number | string | null;
  notes: string | null; stage: string; applied_at: string;
};
type JobProfile = { id: string; designation: string | null; title: string };
type Branch = { id: string; name: string };

const STAGES = [
  { key: 'applied',   label: 'Applied',   color: 'oklch(0.55 0.14 250)', bg: 'oklch(0.95 0.04 250)' },
  { key: 'screening', label: 'Screening', color: 'oklch(0.55 0.15 75)',  bg: 'oklch(0.96 0.06 75)'  },
  { key: 'interview', label: 'Interview', color: 'oklch(0.55 0.14 280)', bg: 'oklch(0.95 0.04 280)' },
  { key: 'offer',     label: 'Offer',     color: 'oklch(0.45 0.16 340)', bg: 'oklch(0.95 0.06 340)' },
  { key: 'hired',     label: 'Hired',     color: 'oklch(0.42 0.12 145)', bg: 'oklch(0.95 0.05 145)' },
  { key: 'rejected',  label: 'Rejected',  color: 'oklch(0.45 0.16 25)',  bg: 'oklch(0.95 0.05 25)'  },
];
const STAGE_MAP = new Map(STAGES.map((s) => [s.key, s]));
const PIPELINE_ORDER = ['applied', 'screening', 'interview', 'offer'];

const LISTING_STATUS_STYLE: Record<string, { background: string; color: string; border: string }> = {
  Published: { background: '#222', color: '#fff', border: '1px solid #222' },
  Open:       { background: 'transparent', color: '#444', border: '1px solid #888' },
  Draft:      { background: '#f3f3f3', color: '#888', border: '1px solid #ddd' },
};

const postSchema = z.object({
  jobProfileId: z.string().min(1, 'Select a job profile'),
  branchId:     z.string().min(1, 'Select a branch'),
  positions:    z.coerce.number().int().positive(),
  companyName:  z.string().default('Concept Kitchen'),
  location:     z.string().optional(),
  division:     z.string().optional(),
  listingStatus: z.string().default('Draft'),
  notes:        z.string().optional(),
});
const applicantSchema = z.object({
  fullName:        z.string().min(1, 'Required'),
  email:           z.string().email('Valid email required'),
  phone:           z.string().optional(),
  currentCompany:  z.string().optional(),
  experienceYears: z.coerce.number().optional(),
  notes:           z.string().optional(),
});
type PostForm = z.infer<typeof postSchema>;
type AppForm  = z.infer<typeof applicantSchema>;
const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function VacanciesPage() {
  const [vacancies,   setVacancies]   = useState<Vacancy[]>([]);
  const [jobProfiles, setJobProfiles] = useState<JobProfile[]>([]);
  const [branches,    setBranches]    = useState<Branch[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<'vacancy' | 'listing'>('vacancy');
  const [deptFilter,  setDeptFilter]  = useState('');
  const [search,      setSearch]      = useState('');
  const [addOpen,     setAddOpen]     = useState(false);
  const [selected,    setSelected]    = useState<Vacancy | null>(null);

  const fetchVacancies = () => {
    api.get<{ data: Vacancy[] }>('/vacancies')
      .then((r) => setVacancies(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    fetchVacancies();
    Promise.all([api.get<{ data: JobProfile[] }>('/job-profiles'), api.get<{ data: Branch[] }>('/branches')])
      .then(([jp, br]) => { setJobProfiles(jp.data.data); setBranches(br.data.data); }).catch(() => {});
  }, []);

  const vForm = useForm<PostForm>({ resolver: zodResolver(postSchema), defaultValues: { companyName: 'Concept Kitchen', listingStatus: 'Draft' } });
  const onPost = async (data: PostForm) => {
    try { await api.post('/vacancies', data); toast.success('Vacancy posted'); vForm.reset({ companyName: 'Concept Kitchen', listingStatus: 'Draft' }); setAddOpen(false); fetchVacancies(); }
    catch { toast.error('Failed'); }
  };

  const displayedV = vacancies.filter((v) => !deptFilter || v.department_name.toLowerCase().includes(deptFilter.toLowerCase()))
    .filter((v) => !search || v.job_title?.toLowerCase().includes(search.toLowerCase()) || v.designation?.toLowerCase().includes(search.toLowerCase()));
  const listed = displayedV.filter((v) => v.listing_status === 'Published' || v.listing_status === 'Open');
  const totalPositions = displayedV.filter((v) => v.status === 'open').reduce((s, v) => s + v.positions, 0);

  return (
    <div>
      <PageHeader title="Hiring Management" subtitle="Manage Hiring and Designation Requisition"
        actions={<Button icon={Plus} variant="primary" onClick={() => { vForm.reset({ companyName: 'Concept Kitchen', listingStatus: 'Draft' }); setAddOpen(true); }}>Post Vacancy</Button>} />

      <Card padding={0}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--ck-line)', padding: '0 16px', gap: 8 }}>
          <TabBtn active={tab === 'vacancy'} onClick={() => setTab('vacancy')}>Vacancy</TabBtn>
          <TabBtn active={tab === 'listing'} onClick={() => setTab('listing')}>Job Listing</TabBtn>
        </div>

        {/* Filters */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ck-line)' }}>
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ck-ink)' }}>
              {tab === 'vacancy' ? 'Vacancy Management' : 'Job Listings'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>
              {tab === 'vacancy' ? 'Auto-generated vacancies based on job profiles and requirements' : 'Active job postings and their hiring progress'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420 }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--ck-muted)', pointerEvents: 'none' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === 'vacancy' ? 'Search Vacancies....' : 'Search Job listings....'}
                style={{ width: '100%', height: 36, padding: '0 12px 0 32px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 12.5, background: 'var(--ck-surface)' }} />
            </div>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
              style={{ height: 36, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, background: 'var(--ck-surface)', fontSize: 12.5, minWidth: 160 }}>
              <option value="">All Department</option>
            </select>
            <Button variant="ghost" size="sm" icon={SlidersHorizontal}>Filters</Button>
            <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>
              {tab === 'vacancy'
                ? `Total Vacancies: ${displayedV.length}  Positions: ${String(totalPositions).padStart(2, '0')}`
                : `Active: ${listed.filter((v) => v.listing_status === 'Published').length}  Draft: ${vacancies.filter((v) => v.listing_status === 'Draft').length}  Positions: ${String(totalPositions).padStart(2, '0')}`}
            </div>
          </div>
        </div>

        {/* Tables */}
        {tab === 'vacancy' ? (
          <VacancyTable vacancies={displayedV} loading={loading} onSelect={setSelected} onVacancyChanged={fetchVacancies} />
        ) : (
          <ListingTable vacancies={listed.length > 0 ? listed : displayedV} loading={loading} onSelect={setSelected} />
        )}

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--ck-line)', fontSize: 12.5, color: 'var(--ck-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Showing 1 to {Math.min(5, displayedV.length)} of {displayedV.length} results</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Button size="sm" disabled>Previous</Button>
            <button style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--ck-ink)', background: 'var(--ck-ink)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>1</button>
            <button style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--ck-line)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>2</button>
            <Button size="sm">Next</Button>
          </div>
        </div>
      </Card>

      {/* Post vacancy modal */}
      <Modal open={addOpen} onClose={() => { vForm.reset(); setAddOpen(false); }} title="Post Vacancy" width={520}
        footer={<>
          <Button onClick={() => { vForm.reset(); setAddOpen(false); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="vac-form" disabled={vForm.formState.isSubmitting}>
            {vForm.formState.isSubmitting ? 'Posting…' : 'Post Vacancy'}
          </Button>
        </>}>
        <form id="vac-form" onSubmit={vForm.handleSubmit(onPost)}>
          <div className="ck-form-grid-2">
            <F label="Job profile *" error={vForm.formState.errors.jobProfileId?.message} full>
              <select {...vForm.register('jobProfileId')} style={inp}>
                <option value="">Select job profile</option>
                {jobProfiles.map((j) => <option key={j.id} value={j.id}>{j.designation ?? j.title}</option>)}
              </select>
            </F>
            <F label="Branch *" error={vForm.formState.errors.branchId?.message}>
              <select {...vForm.register('branchId')} style={inp}>
                <option value="">Select branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </F>
            <F label="Positions *" error={vForm.formState.errors.positions?.message}>
              <input type="number" min={1} {...vForm.register('positions')} style={inp} />
            </F>
            <F label="Company name">
              <input {...vForm.register('companyName')} style={inp} />
            </F>
            <F label="Location">
              <input {...vForm.register('location')} placeholder="City" style={inp} />
            </F>
            <F label="Division">
              <input {...vForm.register('division')} placeholder="Software Development, etc." style={inp} />
            </F>
            <F label="Listing status" full>
              <select {...vForm.register('listingStatus')} style={inp}>
                <option value="Draft">Draft</option>
                <option value="Open">Open</option>
                <option value="Published">Published</option>
              </select>
            </F>
          </div>
        </form>
      </Modal>

      {selected && <ApplicantDrawer vacancy={selected} onClose={() => setSelected(null)} onChanged={fetchVacancies} />}
    </div>
  );
}

// ─── Vacancy tab table ────────────────────────────────────────────────────────
function VacancyTable({ vacancies, loading, onSelect, onVacancyChanged }: { vacancies: Vacancy[]; loading: boolean; onSelect: (v: Vacancy) => void; onVacancyChanged: () => void }) {
  const close = async (id: string) => {
    try { await api.patch(`/vacancies/${id}`, { status: 'closed' }); toast.success('Closed'); onVacancyChanged(); }
    catch { toast.error('Failed'); }
  };
  return (
    <div className="ck-table-wrap">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
            <th style={{ width: 40, padding: '10px 10px 10px 16px' }}><input type="checkbox" /></th>
            {['COMPANY', 'BRANCH', 'LOCATION', 'DEPARTMENT', 'DIVISION', 'DESIGNATION', 'VACANCY', 'ACTION'].map((h) => (
              <th key={h} style={{ padding: '10px 12px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!loading && vacancies.length === 0 && (
            <tr><td colSpan={9} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
              No vacancies posted yet.
            </td></tr>
          )}
          {vacancies.map((v) => (
            <tr key={v.id} style={{ borderTop: '1px solid var(--ck-line)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
              <td style={{ padding: '12px 10px 12px 16px' }}><input type="checkbox" /></td>
              <td style={{ padding: '12px', fontWeight: 600, color: 'var(--ck-ink)' }}>{v.company_name}</td>
              <td style={{ padding: '12px', color: 'var(--ck-ink-soft)' }}>{v.branch_name}</td>
              <td style={{ padding: '12px', color: 'var(--ck-ink-soft)' }}>{v.location ?? v.branch_city ?? '—'}</td>
              <td style={{ padding: '12px', color: 'var(--ck-ink-soft)' }}>{v.department_name}</td>
              <td style={{ padding: '12px', color: 'var(--ck-muted)', fontSize: 12 }}>{v.division ?? '—'}</td>
              <td style={{ padding: '12px', fontWeight: 700, color: 'var(--ck-ink)' }}>{v.designation ?? v.job_title}</td>
              <td style={{ padding: '12px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', background: 'var(--ck-line-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ck-ink)' }}>
                  {String(v.positions).padStart(2, '0')}
                </span>
              </td>
              <td style={{ padding: '12px' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button aria-label="Applicants" onClick={() => onSelect(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)' }}><Briefcase size={16} /></button>
                  <button aria-label="View" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)' }}><Eye size={16} /></button>
                  {v.status === 'open' && <Button size="sm" variant="ghost" onClick={() => close(v.id)}>Close</Button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Job Listing tab table ─────────────────────────────────────────────────────
function ListingTable({ vacancies, loading, onSelect }: { vacancies: Vacancy[]; loading: boolean; onSelect: (v: Vacancy) => void }) {
  return (
    <div className="ck-table-wrap">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
            <th style={{ width: 40, padding: '10px 10px 10px 16px' }}><input type="checkbox" /></th>
            {['SR No.', 'JOB ID', 'COMPANY', 'LOCATION', 'DEPARTMENT', 'DESIGNATION', 'VACANCY', 'STATUS', 'HIRING STATUS'].map((h) => (
              <th key={h} style={{ padding: '10px 10px', fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!loading && vacancies.length === 0 && (
            <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
              No published listings. Post a vacancy and set status to Published or Open.
            </td></tr>
          )}
          {vacancies.map((v, idx) => {
            const lstyle = LISTING_STATUS_STYLE[v.listing_status] ?? LISTING_STATUS_STYLE['Draft'];
            return (
              <tr key={v.id} style={{ borderTop: '1px solid var(--ck-line)', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                onClick={() => onSelect(v)}>
                <td style={{ padding: '12px 10px 12px 16px' }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                <td style={{ padding: '10px', color: 'var(--ck-muted)', fontFamily: 'var(--ck-font-mono)', fontSize: 12 }}>{String(idx + 1).padStart(3, '0')}</td>
                <td style={{ padding: '10px', fontFamily: 'var(--ck-font-mono)', fontSize: 12, fontWeight: 600 }}>{v.job_id ?? '—'}</td>
                <td style={{ padding: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{v.company_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{v.branch_name}</div>
                </td>
                <td style={{ padding: '10px', color: 'var(--ck-ink-soft)' }}>{v.location ?? v.branch_city ?? '—'}</td>
                <td style={{ padding: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{v.department_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{v.division ?? '—'}</div>
                </td>
                <td style={{ padding: '10px', fontWeight: 700, color: 'var(--ck-ink)' }}>{v.designation ?? v.job_title}</td>
                <td style={{ padding: '10px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: 'var(--ck-line-soft)', fontSize: 12, fontWeight: 700, color: 'var(--ck-ink)' }}>
                    {String(v.positions).padStart(2, '0')}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>
                  <span style={{ ...lstyle, padding: '4px 12px', borderRadius: 6, fontSize: 12, display: 'inline-block' }}>
                    {v.listing_status}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>
                  <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--ck-line-soft)', color: 'var(--ck-ink-soft)' }}>
                    {v.hiring_status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Applicant Pipeline Drawer (reused from previous) ─────────────────────────
function ApplicantDrawer({ vacancy, onClose, onChanged }: { vacancy: Vacancy; onClose: () => void; onChanged: () => void }) {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading]       = useState(true);
  const [stageTab, setStageTab]     = useState('all');
  const [addOpen, setAddOpen]       = useState(false);
  const [acting, setActing]         = useState<string | null>(null);

  const fetchApplicants = () => {
    setLoading(true);
    api.get<{ data: Applicant[] }>(`/vacancies/${vacancy.id}/applicants`)
      .then((r) => setApplicants(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetchApplicants(); }, [vacancy.id]);

  const aForm = useForm<AppForm>({ resolver: zodResolver(applicantSchema) });
  const onAdd = async (data: AppForm) => {
    try { await api.post(`/vacancies/${vacancy.id}/applicants`, data); toast.success('Added'); aForm.reset(); setAddOpen(false); fetchApplicants(); }
    catch { toast.error('Failed'); }
  };

  const advance = async (a: Applicant) => {
    const idx = PIPELINE_ORDER.indexOf(a.stage);
    if (idx < 0 || idx >= PIPELINE_ORDER.length - 1) return;
    setActing(a.id);
    try { await api.patch(`/applicants/${a.id}`, { stage: PIPELINE_ORDER[idx + 1] }); fetchApplicants(); }
    catch { toast.error('Failed'); } finally { setActing(null); }
  };
  const hire = async (a: Applicant) => {
    setActing(a.id);
    try { await api.post(`/applicants/${a.id}/hire`); toast.success(`${a.full_name} hired`); fetchApplicants(); onChanged(); }
    catch { toast.error('Failed'); } finally { setActing(null); }
  };
  const reject = async (a: Applicant) => {
    setActing(a.id);
    try { await api.post(`/applicants/${a.id}/reject`); fetchApplicants(); }
    catch { toast.error('Failed'); } finally { setActing(null); }
  };

  const counts = STAGES.reduce<Record<string, number>>((acc, s) => { acc[s.key] = applicants.filter((a) => a.stage === s.key).length; return acc; }, {});
  const displayed = stageTab === 'all' ? applicants : applicants.filter((a) => a.stage === stageTab);

  return (
    <Drawer open onClose={onClose} width={760}>
      <div style={{ padding: '28px 28px 0', background: 'var(--ck-bg)', borderBottom: '1px solid var(--ck-line)', paddingRight: 60 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Applicant Pipeline</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 2 }}>{vacancy.designation ?? vacancy.job_title}</div>
        <div style={{ fontSize: 13, color: 'var(--ck-muted)', marginBottom: 14 }}>{vacancy.company_name} · {vacancy.branch_name} · {vacancy.filled}/{vacancy.positions} filled</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {STAGES.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div onClick={() => setStageTab(stageTab === s.key ? 'all' : s.key)}
                style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color, cursor: 'pointer', border: stageTab === s.key ? `2px solid ${s.color}` : '2px solid transparent' }}>
                {s.label} {counts[s.key] ?? 0}
              </div>
              {i < STAGES.length - 2 && <ArrowRight size={11} style={{ color: 'var(--ck-faint)' }} />}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <TabBtn active={stageTab === 'all'} onClick={() => setStageTab('all')}>All ({applicants.length})</TabBtn>
        </div>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--ck-muted)' }}>{loading ? 'Loading…' : `${displayed.length} applicants`}</div>
          <Button icon={UserPlus} variant="primary" size="sm" onClick={() => { aForm.reset(); setAddOpen(true); }}>Add Applicant</Button>
        </div>
        {!loading && displayed.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
            <UserPlus size={40} strokeWidth={1.4} style={{ display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-ink)', marginBottom: 6 }}>No applicants</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayed.map((a, i) => {
              const stage = STAGE_MAP.get(a.stage);
              const pIdx = PIPELINE_ORDER.indexOf(a.stage);
              const isTerminal = a.stage === 'hired' || a.stage === 'rejected';
              return (
                <Card key={a.id} padding={16}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <Avatar name={a.full_name} hue={(i * 53) % 360} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ck-ink)' }}>{a.full_name}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: stage?.bg ?? 'var(--ck-line-soft)', color: stage?.color ?? 'var(--ck-muted)' }}>{stage?.label ?? a.stage}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>
                        {a.email}{a.phone && ` · ${a.phone}`}{a.current_company && ` · ${a.current_company}`}{a.experience_years != null && ` · ${a.experience_years}y exp`}
                      </div>
                    </div>
                    {!isTerminal && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {pIdx >= 0 && pIdx < PIPELINE_ORDER.length - 1 && (
                          <Button size="sm" variant="accent" disabled={acting === a.id} onClick={() => advance(a)}>
                            → {STAGE_MAP.get(PIPELINE_ORDER[pIdx + 1])?.label}
                          </Button>
                        )}
                        {a.stage === 'offer' && (
                          <Button size="sm" variant="primary" icon={CheckCircle2} disabled={acting === a.id} onClick={() => hire(a)}>Hire</Button>
                        )}
                        <Button size="sm" variant="ghost" icon={XCircle} disabled={acting === a.id} onClick={() => reject(a)}>Reject</Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <Modal open={addOpen} onClose={() => { aForm.reset(); setAddOpen(false); }} title="Add Applicant"
        subtitle={`${vacancy.designation ?? vacancy.job_title} — ${vacancy.branch_name}`} width={480}
        footer={<>
          <Button onClick={() => { aForm.reset(); setAddOpen(false); }}>Cancel</Button>
          <Button variant="primary" type="submit" form="app-form" disabled={aForm.formState.isSubmitting}>Add</Button>
        </>}>
        <form id="app-form" onSubmit={aForm.handleSubmit(onAdd)}>
          <div className="ck-form-grid-2">
            <F label="Full name *" error={aForm.formState.errors.fullName?.message}><input {...aForm.register('fullName')} style={inp} /></F>
            <F label="Email *" error={aForm.formState.errors.email?.message}><input type="email" {...aForm.register('email')} style={inp} /></F>
            <F label="Phone"><input {...aForm.register('phone')} style={inp} /></F>
            <F label="Experience (years)"><input type="number" step="0.5" {...aForm.register('experienceYears')} style={inp} /></F>
            <F label="Current company" full><input {...aForm.register('currentCompany')} style={inp} /></F>
            <F label="Notes" full><textarea {...aForm.register('notes')} rows={3} style={{ ...inp, height: 'auto', padding: 10 }} /></F>
          </div>
        </form>
      </Modal>
    </Drawer>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
      background: active ? 'var(--ck-surface)' : 'transparent',
      color: active ? 'var(--ck-ink)' : 'var(--ck-muted)',
      borderBottom: active ? '2px solid var(--ck-accent)' : '2px solid transparent' }}>
      {children}
    </button>
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
