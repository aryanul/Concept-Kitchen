// Job Listing detail page — opened from the Job Listing tab when a user clicks
// a Designation cell. This is the Phase-3 shell: header + 6 tab containers
// (Applications, Screening, Interviews, Offers, Hire, Activities). Tab bodies
// are placeholders until Phases 4–9 build them out.

import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, UserRound, Briefcase, ListChecks, Mic, FileText, UserCheck, Activity } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { ApplicationsTab } from '../../components/hiring/ApplicationsTab';

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

type Lookup = { id: string; code: string; label: string; color: string | null };

type TabKey = 'applications' | 'screening' | 'interviews' | 'offers' | 'hire' | 'activities';
const TABS: { key: TabKey; label: string; icon: typeof Briefcase }[] = [
  { key: 'applications', label: 'Applications', icon: Briefcase },
  { key: 'screening',    label: 'Screening',    icon: ListChecks },
  { key: 'interviews',   label: 'Interviews',   icon: Mic },
  { key: 'offers',       label: 'Offers',       icon: FileText },
  { key: 'hire',         label: 'Hire',         icon: UserCheck },
  { key: 'activities',   label: 'Activities',   icon: Activity },
];

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<JobListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tab, setTab]         = useState<TabKey>('applications');
  const [listingStatuses, setListingStatuses] = useState<Lookup[]>([]);
  const [hiringStatuses, setHiringStatuses]   = useState<Lookup[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<{ data: JobListing }>(`/job-listings/${id}`)
      .then((r) => { setListing(r.data.data); setError(null); })
      .catch(() => setError('Listing not found'))
      .finally(() => setLoading(false));
    api.get<{ data: Lookup[] }>('/lookups', { params: { category: 'listing_status' } }).then((r) => setListingStatuses(r.data.data)).catch(() => {});
    api.get<{ data: Lookup[] }>('/lookups', { params: { category: 'hiring_status' } }).then((r) => setHiringStatuses(r.data.data)).catch(() => {});
  }, [id]);

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading listing…</div>;
  if (error || !listing) {
    return (
      <div>
        <PageHeader title="Job Listing" subtitle="Listing not found" actions={
          <Button onClick={() => navigate('/vacancy')} icon={ArrowLeft}>Back to listings</Button>
        } />
        <Card padding={48}>
          <div style={{ textAlign: 'center', color: 'var(--ck-muted)' }}>{error ?? 'Listing not available'}</div>
        </Card>
      </div>
    );
  }

  const recruiterName = [listing.recruiter_first_name, listing.recruiter_last_name].filter(Boolean).join(' ') || listing.recruiter_email || '—';
  const filled = Number(listing.filled) || 0;
  const positions = Math.max(1, Number(listing.positions) || 1);
  const fillPct = Math.min(100, Math.round((filled / positions) * 100));

  const daysElapsed = listing.published_at
    ? Math.max(0, Math.floor((Date.now() - new Date(listing.published_at).getTime()) / 86_400_000))
    : null;
  const daysToDeadline = listing.deadline_at
    ? Math.floor((new Date(listing.deadline_at).getTime() - Date.now()) / 86_400_000)
    : null;

  const lstyle = listingStatuses.find((s) => s.code === listing.status);
  const hstyle = hiringStatuses.find((s) => s.code === listing.hiring_status);

  return (
    <div>
      <PageHeader
        title={listing.designation ?? listing.job_title}
        subtitle={`${listing.listing_no} · ${listing.company_name} · ${listing.branch_name}${listing.location_name ? ' · ' + listing.location_name : ''}`}
        actions={<Button onClick={() => navigate('/vacancy')} icon={ArrowLeft}>Back</Button>}
      />

      {/* Header card */}
      <Card padding={20}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 18, marginBottom: 18 }}>
          <HeaderField label="Job Listing ID"  value={<span style={{ fontFamily: 'var(--ck-font-mono)', fontWeight: 700 }}>{listing.listing_no}</span>} />
          <HeaderField label="Company"     value={listing.company_name} />
          <HeaderField label="Branch"      value={listing.branch_name} />
          <HeaderField label="Location"    value={listing.location_name ?? listing.branch_city ?? '—'} />
          <HeaderField label="Department"  value={listing.department_name} />
          <HeaderField label="Division"    value={listing.division ?? '—'} />
          <HeaderField label="Designation" value={listing.designation ?? listing.job_title} />
          <HeaderField label="Status"      value={
            <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: lstyle?.color ?? '#222', color: '#fff' }}>
              {lstyle?.label ?? listing.status}
            </span>
          } />
          <HeaderField label="Hiring Status" value={
            <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--ck-line-soft)', color: 'var(--ck-ink-soft)' }}>
              {hstyle?.label ?? listing.hiring_status}
            </span>
          } />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, paddingTop: 16, borderTop: '1px solid var(--ck-line)' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Vacancy Tracker</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--ck-ink)' }}>{filled}/{positions}</span>
              <span style={{ fontSize: 12, color: 'var(--ck-muted)' }}>filled</span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'var(--ck-line-soft)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${fillPct}%`, height: '100%', background: 'var(--ck-accent)' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Time Elapsed / Deadline</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ck-ink)' }}>
              <CalendarClock size={16} style={{ color: 'var(--ck-muted)' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {daysElapsed != null ? `${daysElapsed}d elapsed` : 'Not published'}
                {daysToDeadline != null && ` · ${daysToDeadline >= 0 ? `${daysToDeadline}d to deadline` : `${Math.abs(daysToDeadline)}d overdue`}`}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Recruiter Owner</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ck-ink)' }}>
              <UserRound size={16} style={{ color: 'var(--ck-muted)' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{recruiterName}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tab navigation */}
      <div style={{ marginTop: 18 }}>
        <Card padding={0}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--ck-line)', padding: '0 8px', overflowX: 'auto' }}>
            {TABS.map((t) => (
              <DetailTabBtn key={t.key} icon={t.icon} active={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}
              </DetailTabBtn>
            ))}
          </div>
          <div style={{ padding: 24, minHeight: 240 }}>
            {tab === 'applications' && <ApplicationsTab listingId={listing.id} />}
            {tab === 'screening'    && <TabPlaceholder title="Screening"    hint="Eligibility analysis using the Screening template." icon={ListChecks} />}
            {tab === 'interviews'   && <TabPlaceholder title="Interviews"   hint="Scheduling, modes and performance scoring." icon={Mic} />}
            {tab === 'offers'       && <TabPlaceholder title="Offers"       hint="Offer letter draft, share, accept/decline tracking." icon={FileText} />}
            {tab === 'hire'         && <TabPlaceholder title="Hire"         hint="Hired candidates ready for onboarding handoff." icon={UserCheck} />}
            {tab === 'activities'   && <TabPlaceholder title="Activities"   hint="Audit log of all actions on this listing." icon={Activity} />}
          </div>
        </Card>
      </div>
    </div>
  );
}

function HeaderField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ck-ink)' }}>{value}</div>
    </div>
  );
}

function DetailTabBtn({ active, icon: Icon, onClick, children }: { active: boolean; icon: typeof Briefcase; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '12px 16px', border: 'none', cursor: 'pointer',
      fontSize: 13, fontWeight: 600, background: 'transparent',
      color: active ? 'var(--ck-ink)' : 'var(--ck-muted)',
      borderBottom: active ? '2px solid var(--ck-accent)' : '2px solid transparent',
    }}>
      <Icon size={14} />
      {children}
    </button>
  );
}

function TabPlaceholder({ title, hint, icon: Icon, count }: { title: string; hint: string; icon: typeof Briefcase; count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', color: 'var(--ck-muted)' }}>
      <Icon size={48} strokeWidth={1.4} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-ink)', marginBottom: 4 }}>
        {title}{count != null ? ` · ${count}` : ''}
      </div>
      <div style={{ fontSize: 12.5, maxWidth: 360 }}>{hint}</div>
      <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ck-faint)' }}>Coming in the next phase.</div>
    </div>
  );
}
