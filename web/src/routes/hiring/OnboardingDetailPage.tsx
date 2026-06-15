import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Printer, Trash2, Mail, Phone as PhoneIcon, Activity as ActivityIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';

// ─── Types ─────────────────────────────────────────────────────────────────
type Address = {
  line1?: string; line2?: string; city?: string; state?: string; country?: string; pin?: string;
};
type ApplicantEmergencyContact = {
  id?: string;
  name: string;
  relation: string | null;
  phone: string | null;
  phone_country_code: string | null;
  address: string | null;
};
type ApplicantDependent = {
  id?: string;
  relation: string;
  name: string;
  phone: string | null;
  phone_country_code: string | null;
  email: string | null;
  dob: string | null;
};
type AOParent = Record<string, unknown> & {
  id: string;
  applicant_id: string;
  status: string;
  dob: string | null;
  blood_group: string | null;
  division_id: string | null;
  department_id: string | null;
  designation_id: string | null;
  branch_id: string | null;
  location_id: string | null;
  setup_email_account: number;
  email_assigned: string | null;
  phone_assigned: string | null;
  induction_buddy_employee_id: string | null;
  id_card_printed_at: string | null;
  face_mapped_at: string | null;
  biometric_mapped_at: string | null;
  closed_at: string | null;
  induction_notes: string | null;
  onboarding_notes: string | null;
  training_notes: string | null;
  // Personal / Info-tab capture (Phase 2.G)
  gender: string | null;
  marital_status: string | null;
  nationality: string | null;
  religion: string | null;
  languages_known: string[] | string | null;
  caste_category: string | null;
  alternate_phone: string | null;
  alternate_phone_country_code: string | null;
  probation_from: string | null;
  probation_to: string | null;
  employment_type: string | null;
  work_mode: string | null;
  present_address: Address | string | null;
  permanent_address: Address | string | null;
  pan: string | null;
  aadhaar: string | null;
};

type Applicant = {
  id: string; app_no: string | null; full_name: string; email: string; phone: string | null;
  current_company: string | null; experience_years: number | string | null;
  match_score: number | null; screen_score: number | null; interview_score: number | null;
  source: string | null; branch_name?: string; company_name?: string;
  designation?: string | null; job_title?: string; onboarding_status?: string;
};

type FullData = {
  parent: AOParent | null;
  giveaways?: Array<{ id: string; giveaway_template_id: string | null; custom_name: string | null; status: string; template_name?: string; template_thumbnail?: string | null }>;
  erp?: Array<{ link_id: string; erp_module_id: string; code: string; name: string; description: string | null; icon: string | null; status: string }>;
  assets?: Array<{ id: string; asset_id: string; asset_tag: string; asset_name: string; category_name: string | null; serial_no: string | null }>;
  presentations?: Array<{ id: string; presentation_id: string; title: string; category: string | null; sub_category: string | null; thumbnail_url: string | null; file_url: string | null; status: string }>;
  docs?: Array<{ id: string; doc_id: string; title: string; category: string | null; sub_category: string | null; thumbnail_url: string | null; file_url: string | null; requires_signature: number; status: string }>;
  items?: Array<{ id: string; item_id: string; kind: string; title: string; category: string | null; sub_category: string | null; thumbnail_url: string | null; status: string }>;
  trainings?: Array<{ id: string; training_module_id: string; code: string; name: string; description: string | null; cover_image_url: string | null; duration_hours: string | null; chapter_count: number | string; status: string; due_at: string | null }>;
  emergency_contacts?: ApplicantEmergencyContact[];
  dependents?: ApplicantDependent[];
};

type GiveawayTemplate = { id: string; name: string; category: string | null; occasion: string | null; thumbnail_url: string | null };
type ErpModule = { id: string; code: string; name: string; description: string | null; icon: string | null };
type Asset = { id: string; asset_tag: string; name: string; status: string; category_name: string | null };
type Presentation = { id: string; title: string; category: string | null; sub_category: string | null; thumbnail_url: string | null };
type OnboardingDoc = { id: string; title: string; category: string | null; sub_category: string | null; thumbnail_url: string | null; requires_signature: number };
type OnboardingItem = { id: string; kind: string; title: string; category: string | null; sub_category: string | null; thumbnail_url: string | null };
type TrainingModule = { id: string; code: string; name: string; description: string | null; cover_image_url: string | null; duration_hours: string | null; chapter_count: number | string };
type Employee = { id: string; code: string; first_name: string; last_name: string; designation: string | null; department_name?: string | null };
type Department = { id: string; name: string };
type Division = { id: string; name: string };
type Designation = { id: string; name: string; department_id: string | null; division_id: string | null };
type Branch = { id: string; name: string };
type Location = { id: string; name: string };
type PhonePool = { id: string; number: string; status: string };

type TabKey = 'pre' | 'induction' | 'onboarding' | 'trainings' | 'activities';
type SalaryGrade = { id: string; code: string; kind: string };
type OnboardingActivity = {
  id: string; ao_id: string; applicant_id: string; actor_user_id: string | null;
  actor_name: string | null; actor_email: string | null;
  action: string; section: string | null; message: string | null;
  meta_json: unknown; created_at: string;
};

// ─── Main page ─────────────────────────────────────────────────────────────
export function OnboardingDetailPage() {
  const { applicantId = '' } = useParams<{ applicantId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('pre');
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [data, setData] = useState<FullData>({ parent: null });
  const [loading, setLoading] = useState(true);
  const [closeOpen, setCloseOpen] = useState(false);
  const [grades, setGrades] = useState<SalaryGrade[]>([]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [appRes, fullRes] = await Promise.all([
        api.get<{ data: Applicant }>(`/applicants/${applicantId}`),
        api.get<{ data: FullData }>(`/applicants/${applicantId}/onboarding/full`),
      ]);
      setApplicant(appRes.data.data);
      setData(fullRes.data.data);
    } catch {
      toast.error('Failed to load onboarding');
    } finally { setLoading(false); }
  };
  useEffect(() => { if (applicantId) fetchAll(); }, [applicantId]);
  useEffect(() => {
    api.get<{ data: SalaryGrade[] }>('/salary-grades', { params: { pageSize: 200 } })
      .then((r) => setGrades(r.data.data ?? [])).catch(() => {});
  }, []);


  const progress = useMemo(() => computeProgress(data), [data]);

  if (loading || !applicant) {
    return <div style={{ padding: 40, color: 'var(--ck-muted)' }}>Loading…</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/onboarding')}>Back</Button>
      </div>

      <Header applicant={applicant} parent={data.parent} />

      <Card padding={0} style={{ marginTop: 16 }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--ck-line)' }}>
          {([
            { key: 'pre' as const,        label: 'Pre On Boarding' },
            { key: 'induction' as const,  label: 'Induction' },
            { key: 'onboarding' as const, label: 'Onboarding' },
            { key: 'trainings' as const,  label: 'Trainings' },
            { key: 'activities' as const, label: 'Activities' },
          ]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '14px 22px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: 'transparent',
                borderBottom: tab === t.key ? '2px solid var(--ck-ink)' : '2px solid transparent',
                color: tab === t.key ? 'var(--ck-ink)' : 'var(--ck-muted)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {tab === 'pre'        && <PreOnboardingTab applicantId={applicantId} data={data} onRefresh={fetchAll} />}
          {tab === 'induction'  && <InductionTab applicantId={applicantId} data={data} onRefresh={fetchAll} />}
          {tab === 'onboarding' && <OnboardingTab applicantId={applicantId} data={data} onRefresh={fetchAll} />}
          {tab === 'trainings'  && <TrainingsTab applicantId={applicantId} data={data} onRefresh={fetchAll} />}
          {tab === 'activities' && <ActivitiesTab applicantId={applicantId} />}
        </div>
      </Card>

      {/* Footer: progress + Close & Archive */}
      <Card padding={20} style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minWidth: 260 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ck-ink)' }}>Onboarding Status</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ck-ink)' }}>{progress.pct}% — {progress.label}</div>
            </div>
            <div style={{ height: 10, background: 'var(--ck-line-soft)', borderRadius: 999 }}>
              <div style={{
                height: '100%', width: `${progress.pct}%`,
                background: progress.pct === 100 ? '#16a34a' : '#2563eb',
                borderRadius: 999, transition: 'width 240ms ease',
              }} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ck-muted)', marginTop: 6 }}>
              {progress.done} of {progress.total} sub-sections completed.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => navigate('/onboarding')}>Close</Button>
            <Button variant="primary" disabled={data.parent?.status === 'onboarded'} onClick={() => setCloseOpen(true)}>
              {data.parent?.status === 'onboarded' ? 'Onboarded' : 'Close & Archive'}
            </Button>
          </div>
        </div>
      </Card>

      {closeOpen && applicant && (
        <CloseArchiveModal
          applicantId={applicantId}
          applicantName={applicant.full_name}
          grades={grades}
          onClose={() => setCloseOpen(false)}
          onSaved={() => { setCloseOpen(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

function CloseArchiveModal({ applicantId, applicantName, grades, onClose, onSaved }: {
  applicantId: string; applicantName: string; grades: SalaryGrade[];
  onClose: () => void; onSaved: () => void;
}) {
  const [gradeId, setGradeId] = useState('');
  const [createEmployee, setCreateEmployee] = useState(true);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const r = await api.post<{ data: { employeeId: string | null; employeeCode: string | null; warning: string | null } }>(
        `/applicants/${applicantId}/onboarding/close`,
        { createEmployee, gradeId: gradeId || null }
      );
      if (r.data.data?.warning) {
        // Required fields were missing — the onboarding got archived but no
        // Employee Master row was created. Make this very visible so HR doesn't
        // mistake the silence for success.
        toast.error(r.data.data.warning, { duration: 8000 });
      } else if (r.data.data?.employeeCode) {
        toast.success(`Onboarding closed. Employee: ${r.data.data.employeeCode}`);
      } else {
        toast.success('Onboarding closed');
      }
      onSaved();
    } catch { toast.error('Failed to close'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="Close & Archive Onboarding" subtitle={applicantName} width={520}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={saving || (createEmployee && !gradeId)}>
          {saving ? 'Closing…' : 'Close & Archive'}
        </Button>
      </>}>
      <div style={{ fontSize: 13, color: 'var(--ck-ink-soft)', marginBottom: 14, lineHeight: 1.55 }}>
        Marks onboarding as <strong>onboarded</strong>. When "Create employee" is on, an Employees
        record is created from the offer + onboarding header, allocated assets are re-pointed
        to the new employee, and the assigned phone is bound to them.
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" checked={createEmployee} onChange={(e) => setCreateEmployee(e.target.checked)} />
        Create employees record on close
      </label>
      {createEmployee && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>Salary grade *</span>
          <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} style={inp}>
            <option value="">Select grade</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.code} · {g.kind}</option>)}
          </select>
          <span style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>
            Other fields (branch, department, designation, CTC, joining date) come from the offer and onboarding header.
          </span>
        </label>
      )}
    </Modal>
  );
}

function ActivitiesTab({ applicantId }: { applicantId: string }) {
  const [rows, setRows] = useState<OnboardingActivity[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.get<{ data: OnboardingActivity[] }>(`/applicants/${applicantId}/onboarding/activities`)
      .then((r) => setRows(r.data.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [applicantId]);
  return (
    <div>
      {loading && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</div>}
      {!loading && rows.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <ActivityIcon size={28} />
          <div>No activity yet. Actions on this onboarding will appear here.</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: 12, padding: '12px 4px', borderBottom: '1px solid var(--ck-line)' }}>
            <div style={{ minWidth: 150, fontSize: 11.5, color: 'var(--ck-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {new Date(r.created_at).toLocaleString()}
            </div>
            <div style={{ flex: 1, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{r.actor_name ?? r.actor_email ?? 'System'}</span>
              {' · '}
              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, background: 'var(--ck-line-soft)', color: 'var(--ck-ink-soft)', fontWeight: 600 }}>
                {r.action.replace(/_/g, ' ')}
              </span>
              {r.section && (
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ck-muted)' }}>· {r.section}</span>
              )}
              {r.message && <div style={{ fontSize: 12, color: 'var(--ck-ink-soft)', marginTop: 2 }}>{r.message}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeProgress(d: FullData): { done: number; total: number; pct: number; label: string } {
  if (!d.parent) return { done: 0, total: 9, pct: 0, label: 'Pending' };
  let done = 0;
  const total = 9;
  if ((d.giveaways?.length ?? 0) > 0) done++;
  if (d.parent.email_assigned || d.parent.phone_assigned) done++;
  if ((d.erp?.filter((e) => e.status === 'active').length ?? 0) > 0) done++;
  if (d.parent.id_card_printed_at) done++;
  if (d.parent.face_mapped_at || d.parent.biometric_mapped_at) done++;
  if ((d.assets?.length ?? 0) > 0) done++;
  if ((d.presentations?.length ?? 0) > 0 || (d.docs?.length ?? 0) > 0) done++;
  if ((d.items?.length ?? 0) > 0) done++;
  if ((d.trainings?.length ?? 0) > 0) done++;
  const pct = Math.round((done / total) * 100);
  const label = pct === 0 ? 'Pending' : pct < 50 ? 'Partially Done' : pct < 100 ? 'Mostly Done' : '100% Completed';
  return { done, total, pct, label };
}

// ─── Header ────────────────────────────────────────────────────────────────
function Header({ applicant, parent }: { applicant: Applicant; parent: AOParent | null }) {
  const status = parent?.status ?? 'pending';
  return (
    <Card padding={20}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Avatar name={applicant.full_name} hue={220} size={72} />
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--ck-font-mono)', fontSize: 12, color: 'var(--ck-muted)' }}>{applicant.app_no ?? '—'}</span>
            <span style={{
              padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
              background: status === 'onboarded' ? '#dcfce7' : status === 'onboarding' ? '#dbeafe' : '#f3f4f6',
              color: status === 'onboarded' ? '#15803d' : status === 'onboarding' ? '#1d4ed8' : '#4b5563',
            }}>{status}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 6 }}>{applicant.full_name}</div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: 'var(--ck-muted)', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={12} />{applicant.email}</span>
            {applicant.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PhoneIcon size={12} />{applicant.phone}</span>}
            {applicant.company_name && <span>{applicant.company_name}</span>}
            {applicant.branch_name && <span>{applicant.branch_name}</span>}
            {applicant.designation && <span>{applicant.designation}</span>}
            {applicant.source && <span style={{ color: 'oklch(0.55 0.14 250)' }}>{applicant.source}</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Pre-Onboarding Tab ────────────────────────────────────────────────────
function PreOnboardingTab({ applicantId, data, onRefresh }: { applicantId: string; data: FullData; onRefresh: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <HeaderInfoSection applicantId={applicantId} parent={data.parent} onRefresh={onRefresh} />
      <PersonalDetailsSection applicantId={applicantId} parent={data.parent} onRefresh={onRefresh} />
      <AddressesSection applicantId={applicantId} parent={data.parent} onRefresh={onRefresh} />
      <EmergencyContactsSection applicantId={applicantId} items={data.emergency_contacts ?? []} onRefresh={onRefresh} />
      <DependentsSection applicantId={applicantId} items={data.dependents ?? []} onRefresh={onRefresh} />
      <GiveawaysSection applicantId={applicantId} items={data.giveaways ?? []} onRefresh={onRefresh} />
      <EmailPhoneSection applicantId={applicantId} parent={data.parent} onRefresh={onRefresh} />
      <ErpSection applicantId={applicantId} items={data.erp ?? []} designationId={data.parent?.designation_id ?? null} onRefresh={onRefresh} />
      <IdCardSection applicantId={applicantId} parent={data.parent} onRefresh={onRefresh} />
      <FaceBiometricsSection applicantId={applicantId} parent={data.parent} onRefresh={onRefresh} />
      <AssetsSection applicantId={applicantId} items={data.assets ?? []} onRefresh={onRefresh} />
      <BuddySection applicantId={applicantId} parent={data.parent} onRefresh={onRefresh} />
    </div>
  );
}

function HeaderInfoSection({ applicantId, parent, onRefresh }: { applicantId: string; parent: AOParent | null; onRefresh: () => void }) {
  const [dob, setDob] = useState(parent?.dob ?? '');
  const [bloodGroup, setBloodGroup] = useState(parent?.blood_group ?? '');
  const [divisionId, setDivisionId] = useState(parent?.division_id ?? '');
  const [departmentId, setDepartmentId] = useState(parent?.department_id ?? '');
  const [designationId, setDesignationId] = useState(parent?.designation_id ?? '');
  const [branchId, setBranchId] = useState(parent?.branch_id ?? '');
  const [locationId, setLocationId] = useState(parent?.location_id ?? '');

  // Re-sync local state when the parent row arrives or refreshes — useState
  // initializers run once, so without this the inputs would stay empty even
  // after the pre-filled row loads.
  useEffect(() => {
    setDob(parent?.dob ?? '');
    setBloodGroup(parent?.blood_group ?? '');
    setDivisionId(parent?.division_id ?? '');
    setDepartmentId(parent?.department_id ?? '');
    setDesignationId(parent?.designation_id ?? '');
    setBranchId(parent?.branch_id ?? '');
    setLocationId(parent?.location_id ?? '');
  }, [parent?.id, parent?.dob, parent?.blood_group, parent?.division_id, parent?.department_id, parent?.designation_id, parent?.branch_id, parent?.location_id]);

  const [divs, setDivs] = useState<Division[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [desigs, setDesigs] = useState<Designation[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [locs, setLocs] = useState<Location[]>([]);
  const [bloodOpts, setBloodOpts] = useState<Array<{ code: string; label: string }>>([]);

  useEffect(() => {
    Promise.all([
      api.get('/divisions'), api.get('/departments'), api.get('/designations'),
      api.get('/branches'), api.get('/locations'),
      api.get('/lookups', { params: { category: 'blood_group' } }),
    ]).then(([dv, dp, dg, br, lo, bg]) => {
      setDivs(dv.data?.data ?? []); setDepts(dp.data?.data ?? []); setDesigs(dg.data?.data ?? []);
      setBranches(br.data?.data ?? []); setLocs(lo.data?.data ?? []);
      setBloodOpts(bg.data?.data ?? []);
    }).catch(() => {});
  }, []);

  const save = async () => {
    try {
      await api.patch(`/applicants/${applicantId}/onboarding/header`, {
        dob: dob || null, bloodGroup: bloodGroup || null,
        divisionId: divisionId || null, departmentId: departmentId || null,
        designationId: designationId || null, branchId: branchId || null, locationId: locationId || null,
      });
      toast.success('Saved');
      onRefresh();
    } catch { toast.error('Save failed'); }
  };

  return (
    <Section title="Header / Other Info" right={<Button size="sm" variant="primary" onClick={save}>Save</Button>}>
      <div style={fourColGrid}>
        <Field label="DOB"><input type="date" value={dob ?? ''} onChange={(e) => setDob(e.target.value)} style={inp} /></Field>
        <Field label="Blood Group">
          <select value={bloodGroup ?? ''} onChange={(e) => setBloodGroup(e.target.value)} style={inp}>
            <option value="">—</option>
            {bloodOpts.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="Branch">
          <select value={branchId ?? ''} onChange={(e) => setBranchId(e.target.value)} style={inp}>
            <option value="">—</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Location">
          <select value={locationId ?? ''} onChange={(e) => setLocationId(e.target.value)} style={inp}>
            <option value="">—</option>
            {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <Field label="Division">
          <select value={divisionId ?? ''} onChange={(e) => setDivisionId(e.target.value)} style={inp}>
            <option value="">—</option>
            {divs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Department">
          <select value={departmentId ?? ''} onChange={(e) => setDepartmentId(e.target.value)} style={inp}>
            <option value="">—</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Designation">
          <select value={designationId ?? ''} onChange={(e) => setDesignationId(e.target.value)} style={inp}>
            <option value="">—</option>
            {desigs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      </div>
    </Section>
  );
}

// ─── Personal Details (Phase 2.G) ─────────────────────────────────────────
// Gender / Marital Status / Nationality / Religion / Caste / Languages are now
// fed by lookup masters (categories: gender, marital_status, nationality,
// religion, caste_category, language) instead of hard-coded arrays.
const EMP_TYPE_OPTS  = ['Permanent', 'Contract', 'Intern', 'Consultant', 'Temporary'];
const WORK_MODE_OPTS = ['Onsite', 'Hybrid', 'Remote'];
const COUNTRY_CODES  = ['+91', '+1', '+44', '+61', '+65', '+971'];

function parseLangs(v: string[] | string | null | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch { return []; }
}
function parseAddr(v: Address | string | null | undefined): Address {
  if (!v) return {};
  if (typeof v === 'string') { try { return JSON.parse(v) as Address; } catch { return {}; } }
  return v;
}

function PersonalDetailsSection({ applicantId, parent, onRefresh }: {
  applicantId: string; parent: AOParent | null; onRefresh: () => void;
}) {
  const [gender,            setGender]            = useState(parent?.gender ?? '');
  const [maritalStatus,     setMaritalStatus]     = useState(parent?.marital_status ?? '');
  const [nationality,       setNationality]       = useState(parent?.nationality ?? '');
  const [religion,          setReligion]          = useState(parent?.religion ?? '');
  const [languages,         setLanguages]         = useState<string[]>(parseLangs(parent?.languages_known));
  const [casteCategory,     setCasteCategory]     = useState(parent?.caste_category ?? '');
  const [alternatePhone,    setAlternatePhone]    = useState(parent?.alternate_phone ?? '');
  const [altCountryCode,    setAltCountryCode]    = useState(parent?.alternate_phone_country_code ?? '+91');
  const [employmentType,    setEmploymentType]    = useState(parent?.employment_type ?? 'Permanent');
  const [workMode,          setWorkMode]          = useState(parent?.work_mode ?? 'Onsite');
  const [probationFrom,     setProbationFrom]     = useState(parent?.probation_from ?? '');
  const [probationTo,       setProbationTo]       = useState(parent?.probation_to ?? '');
  const [pan,               setPan]               = useState(parent?.pan ?? '');
  const [aadhaar,           setAadhaar]           = useState(parent?.aadhaar ?? '');

  useEffect(() => {
    setGender(parent?.gender ?? '');
    setMaritalStatus(parent?.marital_status ?? '');
    setNationality(parent?.nationality ?? '');
    setReligion(parent?.religion ?? '');
    setLanguages(parseLangs(parent?.languages_known));
    setCasteCategory(parent?.caste_category ?? '');
    setAlternatePhone(parent?.alternate_phone ?? '');
    setAltCountryCode(parent?.alternate_phone_country_code ?? '+91');
    setEmploymentType(parent?.employment_type ?? 'Permanent');
    setWorkMode(parent?.work_mode ?? 'Onsite');
    setProbationFrom(parent?.probation_from ?? '');
    setProbationTo(parent?.probation_to ?? '');
    setPan(parent?.pan ?? '');
    setAadhaar(parent?.aadhaar ?? '');
  }, [parent?.id, parent?.gender, parent?.marital_status, parent?.nationality, parent?.religion,
      parent?.languages_known, parent?.caste_category, parent?.alternate_phone, parent?.alternate_phone_country_code,
      parent?.employment_type, parent?.work_mode, parent?.probation_from, parent?.probation_to, parent?.pan, parent?.aadhaar]);

  // Lookup-master option sets (editable from /masters/lookups).
  type Opt = { code: string; label: string };
  const [genderOpts,      setGenderOpts]      = useState<Opt[]>([]);
  const [maritalOpts,     setMaritalOpts]     = useState<Opt[]>([]);
  const [nationalityOpts, setNationalityOpts] = useState<Opt[]>([]);
  const [religionOpts,    setReligionOpts]    = useState<Opt[]>([]);
  const [casteOpts,       setCasteOpts]       = useState<Opt[]>([]);
  const [langOpts,        setLangOpts]        = useState<Opt[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/lookups', { params: { category: 'gender' } }),
      api.get('/lookups', { params: { category: 'marital_status' } }),
      api.get('/lookups', { params: { category: 'nationality' } }),
      api.get('/lookups', { params: { category: 'religion' } }),
      api.get('/lookups', { params: { category: 'caste_category' } }),
      api.get('/lookups', { params: { category: 'language' } }),
    ]).then(([g, m, n, r, c, l]) => {
      setGenderOpts(g.data?.data ?? []);
      setMaritalOpts(m.data?.data ?? []);
      setNationalityOpts(n.data?.data ?? []);
      setReligionOpts(r.data?.data ?? []);
      setCasteOpts(c.data?.data ?? []);
      setLangOpts(l.data?.data ?? []);
    }).catch(() => {});
  }, []);

  // Union master codes with any already-saved values so legacy entries stay visible.
  const langChoices = Array.from(new Set([...langOpts.map((o) => o.code), ...languages]));

  const save = async () => {
    try {
      await api.patch(`/applicants/${applicantId}/onboarding/header`, {
        gender: gender || null,
        maritalStatus: maritalStatus || null,
        nationality: nationality || null,
        religion: religion || null,
        languagesKnown: languages,
        casteCategory: casteCategory || null,
        alternatePhone: alternatePhone || null,
        alternatePhoneCountryCode: altCountryCode || null,
        employmentType: employmentType || null,
        workMode: workMode || null,
        probationFrom: probationFrom || null,
        probationTo: probationTo || null,
        pan: pan || null,
        aadhaar: aadhaar || null,
      });
      toast.success('Personal details saved');
      onRefresh();
    } catch { toast.error('Save failed'); }
  };

  return (
    <Section title="Personal Details" right={<Button size="sm" variant="primary" onClick={save}>Save</Button>}>
      <div style={fourColGrid}>
        <Field label="Gender">
          <select value={gender} onChange={(e) => setGender(e.target.value)} style={inp}>
            <option value="">—</option>
            {genderOpts.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}
          </select>
        </Field>
        <Field label="Marital Status">
          <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} style={inp}>
            <option value="">—</option>
            {maritalOpts.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Nationality">
          <select value={nationality ?? ''} onChange={(e) => setNationality(e.target.value)} style={inp}>
            <option value="">—</option>
            {nationalityOpts.map((n) => <option key={n.code} value={n.code}>{n.label}</option>)}
          </select>
        </Field>
        <Field label="Religion">
          <select value={religion ?? ''} onChange={(e) => setReligion(e.target.value)} style={inp}>
            <option value="">—</option>
            {religionOpts.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="Caste Category">
          <select value={casteCategory} onChange={(e) => setCasteCategory(e.target.value)} style={inp}>
            <option value="">—</option>
            {casteOpts.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Alternate Phone">
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={altCountryCode} onChange={(e) => setAltCountryCode(e.target.value)} style={{ ...inp, width: 80 }}>
              {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={alternatePhone} onChange={(e) => setAlternatePhone(e.target.value)} placeholder="9XXXXXXXXX" style={inp} />
          </div>
        </Field>
        <Field label="Employment Type">
          <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} style={inp}>
            {EMP_TYPE_OPTS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </Field>
        <Field label="Work Mode">
          <select value={workMode} onChange={(e) => setWorkMode(e.target.value)} style={inp}>
            {WORK_MODE_OPTS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
        <Field label="Probation From">
          <input type="date" value={probationFrom ?? ''} onChange={(e) => setProbationFrom(e.target.value)} style={inp} />
        </Field>
        <Field label="Probation To">
          <input type="date" value={probationTo ?? ''} onChange={(e) => setProbationTo(e.target.value)} style={inp} />
        </Field>
        <Field label="PAN">
          <input value={pan} onChange={(e) => setPan(e.target.value)} placeholder="ABCDE1234F" style={inp} />
        </Field>
        <Field label="Aadhaar">
          <input value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} placeholder="XXXXXXXXXXXX" style={inp} />
        </Field>
      </div>
      <div style={{ marginTop: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>Languages Known</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
          {langChoices.length === 0 && <span style={{ fontSize: 13, color: 'var(--ck-muted)' }}>No language options — add them in the Lookup Master.</span>}
          {langChoices.map((code) => {
            const label = langOpts.find((o) => o.code === code)?.label ?? code;
            const checked = languages.includes(code);
            return (
              <label key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setLanguages((prev) => (e.target.checked ? [...prev, code] : prev.filter((x) => x !== code)))}
                />
                {label}
              </label>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

function AddressesSection({ applicantId, parent, onRefresh }: {
  applicantId: string; parent: AOParent | null; onRefresh: () => void;
}) {
  const [present,   setPresent]   = useState<Address>(parseAddr(parent?.present_address));
  const [permanent, setPermanent] = useState<Address>(parseAddr(parent?.permanent_address));

  useEffect(() => {
    setPresent(parseAddr(parent?.present_address));
    setPermanent(parseAddr(parent?.permanent_address));
  }, [parent?.id, parent?.present_address, parent?.permanent_address]);

  const save = async () => {
    try {
      await api.patch(`/applicants/${applicantId}/onboarding/header`, {
        presentAddress: present,
        permanentAddress: permanent,
      });
      toast.success('Addresses saved');
      onRefresh();
    } catch { toast.error('Save failed'); }
  };

  return (
    <Section title="Addresses" right={
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" onClick={() => setPermanent({ ...present })}>Copy present → permanent</Button>
        <Button size="sm" variant="primary" onClick={save}>Save</Button>
      </div>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AddressBlock title="Present Address"   value={present}   onChange={setPresent} />
        <AddressBlock title="Permanent Address" value={permanent} onChange={setPermanent} />
      </div>
    </Section>
  );
}

function AddressBlock({ title, value, onChange }: { title: string; value: Address; onChange: (a: Address) => void }) {
  const upd = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Line 1"><input value={value.line1 ?? ''} onChange={(e) => upd({ line1: e.target.value })} style={inp} /></Field>
        <Field label="Line 2"><input value={value.line2 ?? ''} onChange={(e) => upd({ line2: e.target.value })} style={inp} /></Field>
        <Field label="City"><input value={value.city ?? ''} onChange={(e) => upd({ city: e.target.value })} style={inp} /></Field>
        <Field label="State"><input value={value.state ?? ''} onChange={(e) => upd({ state: e.target.value })} style={inp} /></Field>
        <Field label="Country"><input value={value.country ?? ''} onChange={(e) => upd({ country: e.target.value })} placeholder="India" style={inp} /></Field>
        <Field label="PIN / ZIP"><input value={value.pin ?? ''} onChange={(e) => upd({ pin: e.target.value })} style={inp} /></Field>
      </div>
    </div>
  );
}

function EmergencyContactsSection({ applicantId, items, onRefresh }: {
  applicantId: string; items: ApplicantEmergencyContact[]; onRefresh: () => void;
}) {
  const [rows, setRows] = useState<ApplicantEmergencyContact[]>(items);
  useEffect(() => { setRows(items); }, [items]);
  const save = async () => {
    try {
      await api.put(`/applicants/${applicantId}/onboarding/emergency-contacts`, { items: rows });
      toast.success('Emergency contacts saved');
      onRefresh();
    } catch { toast.error('Save failed'); }
  };
  const add = () => setRows([...rows, { name: '', relation: '', phone: '', phone_country_code: '+91', address: '' }]);
  const del = (i: number) => setRows(rows.filter((_, j) => j !== i));
  const upd = (i: number, patch: Partial<ApplicantEmergencyContact>) => {
    const next = [...rows]; next[i] = { ...next[i], ...patch }; setRows(next);
  };
  return (
    <Section title="Emergency Contacts" right={
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" icon={Plus} onClick={add}>Add</Button>
        <Button size="sm" variant="primary" onClick={save}>Save</Button>
      </div>}>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--ck-muted)', fontStyle: 'italic' }}>No emergency contacts captured.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 2fr 40px', gap: 10, alignItems: 'center' }}>
              <input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Name" style={inp} />
              <input value={r.relation ?? ''} onChange={(e) => upd(i, { relation: e.target.value })} placeholder="Relation" style={inp} />
              <div style={{ display: 'flex', gap: 4 }}>
                <select value={r.phone_country_code ?? '+91'} onChange={(e) => upd(i, { phone_country_code: e.target.value })} style={{ ...inp, width: 80 }}>
                  {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input value={r.phone ?? ''} onChange={(e) => upd(i, { phone: e.target.value })} placeholder="Phone" style={inp} />
              </div>
              <input value={r.address ?? ''} onChange={(e) => upd(i, { address: e.target.value })} placeholder="Address" style={inp} />
              <button onClick={() => del(i)} aria-label="Delete" style={{ background: 'none', border: '1px solid var(--ck-line)', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: 'var(--ck-ink-soft)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function DependentsSection({ applicantId, items, onRefresh }: {
  applicantId: string; items: ApplicantDependent[]; onRefresh: () => void;
}) {
  const [rows, setRows] = useState<ApplicantDependent[]>(items);
  useEffect(() => { setRows(items); }, [items]);
  const save = async () => {
    try {
      await api.put(`/applicants/${applicantId}/onboarding/dependents`, { items: rows });
      toast.success('Dependents saved');
      onRefresh();
    } catch { toast.error('Save failed'); }
  };
  const add = () => setRows([...rows, { relation: '', name: '', phone: '', phone_country_code: '+91', email: '', dob: '' }]);
  const del = (i: number) => setRows(rows.filter((_, j) => j !== i));
  const upd = (i: number, patch: Partial<ApplicantDependent>) => {
    const next = [...rows]; next[i] = { ...next[i], ...patch }; setRows(next);
  };
  return (
    <Section title="Dependents & Family" right={
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" icon={Plus} onClick={add}>Add</Button>
        <Button size="sm" variant="primary" onClick={save}>Save</Button>
      </div>}>
      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--ck-muted)', fontStyle: 'italic' }}>No dependents captured.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1.2fr 1.5fr 1fr 40px', gap: 10, alignItems: 'center' }}>
              <input value={r.relation} onChange={(e) => upd(i, { relation: e.target.value })} placeholder="Relation" style={inp} />
              <input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="Name" style={inp} />
              <div style={{ display: 'flex', gap: 4 }}>
                <select value={r.phone_country_code ?? '+91'} onChange={(e) => upd(i, { phone_country_code: e.target.value })} style={{ ...inp, width: 80 }}>
                  {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input value={r.phone ?? ''} onChange={(e) => upd(i, { phone: e.target.value })} placeholder="Phone" style={inp} />
              </div>
              <input value={r.email ?? ''} onChange={(e) => upd(i, { email: e.target.value })} placeholder="email@example.com" style={inp} />
              <input type="date" value={r.dob ?? ''} onChange={(e) => upd(i, { dob: e.target.value })} style={inp} />
              <button onClick={() => del(i)} aria-label="Delete" style={{ background: 'none', border: '1px solid var(--ck-line)', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: 'var(--ck-ink-soft)' }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function GiveawaysSection({ applicantId, items, onRefresh }: { applicantId: string; items: NonNullable<FullData['giveaways']>; onRefresh: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templates, setTemplates] = useState<GiveawayTemplate[]>([]);
  const [occasion, setOccasion] = useState<string>('');

  useEffect(() => { if (pickerOpen) api.get('/onboarding/giveaways').then((r) => setTemplates(r.data?.data ?? [])).catch(() => {}); }, [pickerOpen]);

  const occasions = useMemo(() => Array.from(new Set(templates.map((t) => t.occasion).filter(Boolean))) as string[], [templates]);
  const visible = templates.filter((t) => !occasion || t.occasion === occasion);

  const add = async (templateId: string) => {
    try { await api.post(`/applicants/${applicantId}/onboarding/giveaways`, { giveawayTemplateId: templateId }); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  const remove = async (id: string) => {
    try { await api.delete(`/applicants/onboarding/giveaways/${id}`); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  const setStatus = async (id: string, status: 'planned' | 'given') => {
    try { await api.patch(`/applicants/onboarding/giveaways/${id}`, { status }); onRefresh(); }
    catch { toast.error('Failed'); }
  };

  return (
    <Section title="Give Aways" right={<Button size="sm" variant="primary" icon={Plus} onClick={() => setPickerOpen(true)}>Add</Button>}>
      {items.length === 0 && <Empty msg="No give-aways added yet." />}
      <div style={tileGrid}>
        {items.map((g) => (
          <div key={g.id} style={tileCard}>
            <button onClick={() => remove(g.id)} style={tileDel}><Trash2 size={13} /></button>
            {g.template_thumbnail
              ? <img src={g.template_thumbnail} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
              : <div style={tileEmoji}>🎁</div>}
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)', textAlign: 'center' }}>{g.template_name ?? g.custom_name ?? '—'}</span>
            <button onClick={() => setStatus(g.id, g.status === 'given' ? 'planned' : 'given')}
              style={{
                marginTop: 4, padding: '3px 8px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                border: 'none', background: g.status === 'given' ? '#dcfce7' : '#f3f4f6',
                color: g.status === 'given' ? '#15803d' : '#4b5563',
              }}>{g.status === 'given' ? '✓ Given' : 'Planned'}</button>
          </div>
        ))}
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Pick Give Aways" width={720}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <Chip selected={!occasion} onClick={() => setOccasion('')}>All</Chip>
          {occasions.map((o) => <Chip key={o} selected={occasion === o} onClick={() => setOccasion(o)}>{o}</Chip>)}
        </div>
        <div style={tileGrid}>
          {visible.map((t) => (
            <div key={t.id} style={{ ...tileCard, cursor: 'pointer' }} onClick={() => { add(t.id); setPickerOpen(false); }}>
              {t.thumbnail_url
                ? <img src={t.thumbnail_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
                : <div style={tileEmoji}>🎁</div>}
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)', textAlign: 'center' }}>{t.name}</span>
              {t.occasion && <span style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{t.occasion}</span>}
            </div>
          ))}
          {visible.length === 0 && <Empty msg="No templates. Add some in Masters → Giveaways." />}
        </div>
      </Modal>
    </Section>
  );
}

function EmailPhoneSection({ applicantId, parent, onRefresh }: { applicantId: string; parent: AOParent | null; onRefresh: () => void }) {
  const [setup, setSetup] = useState(Boolean(parent?.setup_email_account));
  const [email, setEmail] = useState(parent?.email_assigned ?? '');
  const [phone, setPhone] = useState(parent?.phone_assigned ?? '');
  const [password, setPassword] = useState('');
  const [pool, setPool] = useState<PhonePool[]>([]);

  // Sync local state when parent reloads (initializers only run once).
  useEffect(() => {
    setSetup(Boolean(parent?.setup_email_account));
    setEmail(parent?.email_assigned ?? '');
    setPhone(parent?.phone_assigned ?? '');
  }, [parent?.id, parent?.setup_email_account, parent?.email_assigned, parent?.phone_assigned]);

  useEffect(() => {
    api.get('/onboarding/phone-pool').then((r) => setPool(r.data?.data ?? [])).catch(() => {});
  }, []);
  const save = async () => {
    try {
      await api.patch(`/applicants/${applicantId}/onboarding/header`, {
        setupEmailAccount: setup, emailAssigned: email || null, phoneAssigned: phone || null,
      });
      // Password handling is a write-only stub; real provisioning will hook in
      // when the email-server integration arrives. Clear it after save so it
      // doesn't linger in the input.
      setPassword('');
      toast.success('Saved'); onRefresh();
    } catch { toast.error('Save failed'); }
  };
  return (
    <Section title="Email & Phone" right={<Button size="sm" variant="primary" onClick={save}>Save</Button>}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" checked={setup} onChange={(e) => setSetup(e.target.checked)} />
        Setup Company Email Account
      </label>
      <div style={twoColGrid}>
        <Field label="Email Address">
          <input value={email ?? ''} onChange={(e) => setEmail(e.target.value)} placeholder="firstname@company.com"
            style={{ ...inp, background: setup ? 'var(--ck-surface)' : 'var(--ck-line-soft)' }} disabled={!setup} />
        </Field>
        {setup && (
          <Field label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" style={inp} />
          </Field>
        )}
        <Field label="Phone Assignment">
          <select value={phone ?? ''} onChange={(e) => setPhone(e.target.value)} style={inp}>
            <option value="">Select from pool</option>
            {pool.filter((p) => p.status === 'available' || p.number === phone).map((p) => (
              <option key={p.id} value={p.number}>{p.number} {p.status === 'assigned' ? '(assigned)' : ''}</option>
            ))}
          </select>
        </Field>
      </div>
    </Section>
  );
}

function ErpSection({ applicantId, items, designationId, onRefresh }: { applicantId: string; items: NonNullable<FullData['erp']>; designationId: string | null; onRefresh: () => void }) {
  const [all, setAll] = useState<ErpModule[]>([]);
  useEffect(() => { api.get('/onboarding/erp-modules').then((r) => setAll(r.data?.data ?? [])).catch(() => {}); }, []);

  // Module IDs already linked
  const linkedIds = new Set(items.map((i) => i.erp_module_id));
  const setStatus = async (linkId: string, status: 'active' | 'inactive' | 'blocked') => {
    try { await api.patch(`/applicants/onboarding/erp-modules/${linkId}`, { status }); onRefresh(); }
    catch { toast.error('Failed'); }
  };

  // Allow adding any module not yet linked, then immediately set status on the new link.
  // We use the PUT endpoint to push the merged list.
  const syncAll = async (next: Array<{ erpModuleId: string; status: string }>) => {
    try { await api.put(`/applicants/${applicantId}/onboarding/erp-modules`, { modules: next }); onRefresh(); }
    catch { toast.error('Failed'); }
  };

  const addModule = (id: string) => {
    const merged = [
      ...items.map((i) => ({ erpModuleId: i.erp_module_id, status: i.status })),
      { erpModuleId: id, status: 'active' },
    ];
    syncAll(merged);
  };

  const prefillFromDesignation = async () => {
    if (!designationId) {
      toast.error('Set a designation in the header first.');
      return;
    }
    try {
      const r = await api.get<{ data: Array<{ id: string; default_status: string }> }>(`/designations/${designationId}/erp-modules`);
      const defaults = r.data?.data ?? [];
      if (defaults.length === 0) {
        toast.message('No ERP defaults set for this designation. Configure them in Masters → DDD → Designation.');
        return;
      }
      // Merge: existing linked rows keep their current status; defaults that aren't linked are added with their default status.
      const next = [
        ...items.map((i) => ({ erpModuleId: i.erp_module_id, status: i.status })),
        ...defaults.filter((d) => !linkedIds.has(d.id)).map((d) => ({ erpModuleId: d.id, status: d.default_status ?? 'active' })),
      ];
      await syncAll(next);
      toast.success(`Pre-filled ${defaults.length} default module(s) from designation.`);
    } catch { toast.error('Failed to pre-fill'); }
  };

  return (
    <Section title="ERP Activation"
      right={<Button size="sm" variant="ghost" onClick={prefillFromDesignation}>Pre-fill from designation</Button>}>
      <div style={tileGrid}>
        {items.map((m) => (
          <div key={m.link_id} style={{ ...tileCard, alignItems: 'flex-start', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <strong style={{ color: 'var(--ck-ink)' }}>{m.name}</strong>
              <span style={erpPill(m.status)}>{m.status}</span>
            </div>
            {m.description && <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{m.description}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={() => setStatus(m.link_id, 'active')}   style={erpBtn(m.status === 'active', '#16a34a')}>Active</button>
              <button onClick={() => setStatus(m.link_id, 'inactive')} style={erpBtn(m.status === 'inactive', '#6b7280')}>Inactive</button>
              <button onClick={() => setStatus(m.link_id, 'blocked')}  style={erpBtn(m.status === 'blocked', '#dc2626')}>Block</button>
            </div>
          </div>
        ))}
        {/* Pickable modules not yet linked */}
        {all.filter((m) => !linkedIds.has(m.id)).map((m) => (
          <div key={m.id} onClick={() => addModule(m.id)} style={{ ...tileCard, border: '2px dashed var(--ck-line)', cursor: 'pointer', opacity: 0.7 }}>
            <Plus size={20} />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</span>
            <span style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{m.code}</span>
          </div>
        ))}
        {all.length === 0 && <Empty msg="No ERP modules. Add some in Masters → ERP Modules." />}
      </div>
    </Section>
  );
}

function IdCardSection({ applicantId, parent }: { applicantId: string; parent: AOParent | null; onRefresh: () => void }) {
  const printed = parent?.id_card_printed_at;
  const openPrintPage = () => {
    window.open(`/onboarding/${applicantId}/id-card`, '_blank', 'noopener,noreferrer');
  };
  return (
    <Section title="ID & Access Card" right={
      <Button size="sm" variant="primary" icon={Printer} onClick={openPrintPage}>{printed ? 'Re-print' : 'Open Print Page'}</Button>
    }>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{
          width: 260, height: 160, borderRadius: 12, border: '1px solid var(--ck-line)',
          background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', color: '#fff',
          padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.12em' }}>CONCEPT KITCHEN</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>ID Card Preview</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Click "Open Print Page" to view + print the full card.</div>
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>
          {printed ? <>Printed at: <strong>{new Date(printed).toLocaleString()}</strong></> : 'Not yet printed.'}
        </div>
      </div>
    </Section>
  );
}

function FaceBiometricsSection({ applicantId, parent, onRefresh }: { applicantId: string; parent: AOParent | null; onRefresh: () => void }) {
  const set = async (field: 'faceMappedAt' | 'biometricMappedAt', clear = false) => {
    try {
      await api.patch(`/applicants/${applicantId}/onboarding/header`, { [field]: clear ? null : new Date().toISOString() });
      onRefresh();
    } catch { toast.error('Failed'); }
  };
  return (
    <Section title="Face & Biometrics">
      <div style={twoColGrid}>
        <StatusTile title="Face Detection" stampedAt={parent?.face_mapped_at}
          onMap={() => set('faceMappedAt')} onClear={() => set('faceMappedAt', true)} />
        <StatusTile title="Biometrics" stampedAt={parent?.biometric_mapped_at}
          onMap={() => set('biometricMappedAt')} onClear={() => set('biometricMappedAt', true)} />
      </div>
    </Section>
  );
}

function StatusTile({ title, stampedAt, onMap, onClear }: { title: string; stampedAt: string | null | undefined; onMap: () => void; onClear: () => void }) {
  return (
    <div style={{ border: '1px solid var(--ck-line)', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--ck-muted)' }}>
          {stampedAt ? `Mapped at ${new Date(stampedAt).toLocaleString()}` : 'Status: Pending'}
        </div>
      </div>
      {stampedAt
        ? <Button size="sm" onClick={onClear}>Clear</Button>
        : <Button size="sm" variant="primary" onClick={onMap}>Map</Button>}
    </div>
  );
}

function AssetsSection({ applicantId, items, onRefresh }: { applicantId: string; items: NonNullable<FullData['assets']>; onRefresh: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [avail, setAvail] = useState<Asset[]>([]);
  useEffect(() => {
    if (pickerOpen) api.get('/onboarding/assets', { params: { status: 'available' } }).then((r) => setAvail(r.data?.data ?? [])).catch(() => {});
  }, [pickerOpen]);

  const add = async (assetId: string) => {
    try { await api.post(`/applicants/${applicantId}/onboarding/assets`, { assetId }); onRefresh(); setPickerOpen(false); }
    catch { toast.error('Failed'); }
  };
  const remove = async (id: string) => {
    try { await api.delete(`/applicants/onboarding/assets/${id}`); onRefresh(); }
    catch { toast.error('Failed'); }
  };

  return (
    <Section title="Assets" right={<Button size="sm" variant="primary" icon={Plus} onClick={() => setPickerOpen(true)}>Allocate Asset</Button>}>
      {items.length === 0 && <Empty msg="No assets allocated." />}
      <div className="ck-table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
            {['Tag', 'Asset', 'Category', 'Serial #', ''].map((h) => <th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
                <td style={td}><Mono>{a.asset_tag}</Mono></td>
                <td style={td}><strong>{a.asset_name}</strong></td>
                <td style={td}>{a.category_name ?? '—'}</td>
                <td style={td}>{a.serial_no ?? '—'}</td>
                <td style={td}><button onClick={() => remove(a.id)} style={iconBtn}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Available Assets" width={720}>
        {avail.length === 0 ? <Empty msg="No available assets." /> : (
          <div className="ck-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {['Tag', 'Asset', 'Category', ''].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {avail.map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
                    <td style={td}><Mono>{a.asset_tag}</Mono></td>
                    <td style={td}><strong>{a.name}</strong></td>
                    <td style={td}>{a.category_name ?? '—'}</td>
                    <td style={td}><Button size="sm" variant="primary" onClick={() => add(a.id)}>Allocate</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </Section>
  );
}

function BuddySection({ applicantId, parent, onRefresh }: { applicantId: string; parent: AOParent | null; onRefresh: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [buddy, setBuddy] = useState<Employee | null>(null);

  useEffect(() => {
    if (parent?.induction_buddy_employee_id) {
      api.get(`/employees/${parent.induction_buddy_employee_id}`).then((r) => setBuddy(r.data?.data ?? null)).catch(() => {});
    } else setBuddy(null);
  }, [parent?.induction_buddy_employee_id]);

  useEffect(() => {
    if (pickerOpen) api.get('/employees', { params: { pageSize: 200 } }).then((r) => setEmployees(r.data?.data ?? [])).catch(() => {});
  }, [pickerOpen]);

  const assign = async (id: string | null) => {
    try {
      await api.patch(`/applicants/${applicantId}/onboarding/header`, { inductionBuddyEmployeeId: id });
      onRefresh(); setPickerOpen(false);
    } catch { toast.error('Failed'); }
  };

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return !q || `${e.first_name} ${e.last_name} ${e.code}`.toLowerCase().includes(q);
  });

  return (
    <Section title="Induction Buddy" right={
      buddy
        ? <Button size="sm" variant="ghost" onClick={() => assign(null)}>Clear</Button>
        : <Button size="sm" variant="primary" icon={Plus} onClick={() => setPickerOpen(true)}>Assign Buddy</Button>
    }>
      {buddy ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, border: '1px solid var(--ck-line)', borderRadius: 12 }}>
          <Avatar name={`${buddy.first_name} ${buddy.last_name}`} hue={140} size={44} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{buddy.first_name} {buddy.last_name}</div>
            <div style={{ fontSize: 12, color: 'var(--ck-muted)' }}>{buddy.code} · {buddy.designation ?? '—'}</div>
          </div>
        </div>
      ) : <Empty msg="No buddy assigned." />}

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Select Induction Buddy" width={620}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code…"
          style={{ ...inp, marginBottom: 12 }} />
        <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((e) => (
            <button key={e.id} onClick={() => assign(e.id)}
              style={{ textAlign: 'left', padding: 10, border: '1px solid var(--ck-line)', borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center' }}>
              <Avatar name={`${e.first_name} ${e.last_name}`} hue={140} size={32} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{e.first_name} {e.last_name}</div>
                <div style={{ fontSize: 12, color: 'var(--ck-muted)' }}>{e.code} · {e.designation ?? '—'}</div>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </Section>
  );
}

// ─── Induction Tab ─────────────────────────────────────────────────────────
function InductionTab({ applicantId, data, onRefresh }: { applicantId: string; data: FullData; onRefresh: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <PresentationsSection applicantId={applicantId} items={data.presentations ?? []} onRefresh={onRefresh} />
      <DocsSection applicantId={applicantId} items={data.docs ?? []} onRefresh={onRefresh} />
    </div>
  );
}

function PresentationsSection({ applicantId, items, onRefresh }: { applicantId: string; items: NonNullable<FullData['presentations']>; onRefresh: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [all, setAll] = useState<Presentation[]>([]);
  useEffect(() => { if (pickerOpen) api.get('/onboarding/presentations').then((r) => setAll(r.data?.data ?? [])).catch(() => {}); }, [pickerOpen]);
  const linked = new Set(items.map((i) => i.presentation_id));
  const add = async (id: string) => {
    try { await api.post(`/applicants/${applicantId}/onboarding/presentations`, { presentationId: id }); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  const remove = async (id: string) => {
    try { await api.delete(`/applicants/onboarding/presentations/${id}`); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  const toggleDone = async (id: string, status: string) => {
    try { await api.patch(`/applicants/onboarding/presentations/${id}`, { status: status === 'done' ? 'pending' : 'done' }); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  return (
    <Section title="Presentations" right={<Button size="sm" variant="primary" icon={Plus} onClick={() => setPickerOpen(true)}>Add Presentations</Button>}>
      {items.length === 0 && <Empty msg="No presentations added." />}
      <div style={tileGrid}>
        {items.map((p) => (
          <div key={p.id} style={tileCard}>
            <button onClick={() => remove(p.id)} style={tileDel}><Trash2 size={13} /></button>
            {p.thumbnail_url
              ? <img src={p.thumbnail_url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
              : <div style={tileEmoji}>📊</div>}
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)', textAlign: 'center' }}>{p.title}</span>
            {p.category && <span style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{p.category}</span>}
            <button onClick={() => toggleDone(p.id, p.status)}
              style={{ marginTop: 4, padding: '3px 8px', borderRadius: 999, fontSize: 11, cursor: 'pointer', border: 'none',
                background: p.status === 'done' ? '#dcfce7' : '#f3f4f6', color: p.status === 'done' ? '#15803d' : '#4b5563' }}>
              {p.status === 'done' ? '✓ Done' : 'Pending'}
            </button>
          </div>
        ))}
      </div>
      <PickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Pick Presentations"
        items={all.filter((a) => !linked.has(a.id))} emptyMsg="No presentations. Add some in Masters → Presentations."
        renderItem={(p) => (
          <div key={p.id} style={{ ...tileCard, cursor: 'pointer' }} onClick={() => { add(p.id); setPickerOpen(false); }}>
            {p.thumbnail_url
              ? <img src={p.thumbnail_url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
              : <div style={tileEmoji}>📊</div>}
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)', textAlign: 'center' }}>{p.title}</span>
            {p.category && <span style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{p.category}</span>}
          </div>
        )} />
    </Section>
  );
}

function DocsSection({ applicantId, items, onRefresh }: { applicantId: string; items: NonNullable<FullData['docs']>; onRefresh: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [all, setAll] = useState<OnboardingDoc[]>([]);
  useEffect(() => { if (pickerOpen) api.get('/onboarding/docs').then((r) => setAll(r.data?.data ?? [])).catch(() => {}); }, [pickerOpen]);
  const linked = new Set(items.map((i) => i.doc_id));
  const add = async (id: string) => {
    try { await api.post(`/applicants/${applicantId}/onboarding/docs`, { docId: id }); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  const remove = async (id: string) => {
    try { await api.delete(`/applicants/onboarding/docs/${id}`); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  const toggleSigned = async (id: string, status: string) => {
    try { await api.patch(`/applicants/onboarding/docs/${id}`, { status: status === 'signed' ? 'pending' : 'signed' }); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  return (
    <Section title="Forms & Documents" right={<Button size="sm" variant="primary" icon={Plus} onClick={() => setPickerOpen(true)}>Add Documents</Button>}>
      {items.length === 0 && <Empty msg="No documents added." />}
      <div style={tileGrid}>
        {items.map((d) => (
          <div key={d.id} style={tileCard}>
            <button onClick={() => remove(d.id)} style={tileDel}><Trash2 size={13} /></button>
            <div style={tileEmoji}>📄</div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)', textAlign: 'center' }}>{d.title}</span>
            {d.requires_signature ? (
              <button onClick={() => toggleSigned(d.id, d.status)}
                style={{ marginTop: 4, padding: '3px 8px', borderRadius: 999, fontSize: 11, cursor: 'pointer', border: 'none',
                  background: d.status === 'signed' ? '#dcfce7' : '#fef3c7', color: d.status === 'signed' ? '#15803d' : '#92400e' }}>
                {d.status === 'signed' ? '✓ Signed' : 'Awaiting signature'}
              </button>
            ) : <span style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{d.category ?? ''}</span>}
          </div>
        ))}
      </div>
      <PickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Pick Documents"
        items={all.filter((a) => !linked.has(a.id))} emptyMsg="No documents. Add some in Masters → Onboarding Docs."
        renderItem={(d) => (
          <div key={d.id} style={{ ...tileCard, cursor: 'pointer' }} onClick={() => { add(d.id); setPickerOpen(false); }}>
            <div style={tileEmoji}>📄</div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)', textAlign: 'center' }}>{d.title}</span>
            {d.category && <span style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{d.category}</span>}
          </div>
        )} />
    </Section>
  );
}

// ─── Onboarding Tab ────────────────────────────────────────────────────────
function OnboardingTab({ applicantId, data, onRefresh }: { applicantId: string; data: FullData; onRefresh: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <ItemKindSection title="Onboarding Programs" kind="program" emoji="🎓" applicantId={applicantId} items={(data.items ?? []).filter((i) => i.kind === 'program')} onRefresh={onRefresh} />
      <ItemKindSection title="Tours & Visits" kind="tour" emoji="🗺️" applicantId={applicantId} items={(data.items ?? []).filter((i) => i.kind === 'tour')} onRefresh={onRefresh} />
      <ItemKindSection title="Activities" kind="activity" emoji="🎯" applicantId={applicantId} items={(data.items ?? []).filter((i) => i.kind === 'activity')} onRefresh={onRefresh} />
    </div>
  );
}

function ItemKindSection({ title, kind, emoji, applicantId, items, onRefresh }: {
  title: string; kind: 'program' | 'tour' | 'activity'; emoji: string;
  applicantId: string; items: NonNullable<FullData['items']>; onRefresh: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [all, setAll] = useState<OnboardingItem[]>([]);
  useEffect(() => { if (pickerOpen) api.get('/onboarding/items', { params: { kind } }).then((r) => setAll(r.data?.data ?? [])).catch(() => {}); }, [pickerOpen, kind]);
  const linked = new Set(items.map((i) => i.item_id));
  const add = async (id: string) => {
    try { await api.post(`/applicants/${applicantId}/onboarding/items`, { itemId: id }); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  const remove = async (id: string) => {
    try { await api.delete(`/applicants/onboarding/items/${id}`); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  const cycleStatus = async (id: string, status: string) => {
    const next = status === 'pending' ? 'ongoing' : status === 'ongoing' ? 'done' : 'pending';
    try { await api.patch(`/applicants/onboarding/items/${id}`, { status: next }); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  return (
    <Section title={title} right={<Button size="sm" variant="primary" icon={Plus} onClick={() => setPickerOpen(true)}>Add</Button>}>
      {items.length === 0 && <Empty msg={`No ${kind}s added.`} />}
      <div style={tileGrid}>
        {items.map((i) => (
          <div key={i.id} style={tileCard}>
            <button onClick={() => remove(i.id)} style={tileDel}><Trash2 size={13} /></button>
            {i.thumbnail_url
              ? <img src={i.thumbnail_url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
              : <div style={tileEmoji}>{emoji}</div>}
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)', textAlign: 'center' }}>{i.title}</span>
            {i.category && <span style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{i.category}</span>}
            <button onClick={() => cycleStatus(i.id, i.status)} style={itemPill(i.status)}>{i.status}</button>
          </div>
        ))}
      </div>
      <PickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} title={`Pick ${title}`}
        items={all.filter((a) => !linked.has(a.id))} emptyMsg={`No ${kind}s available. Add some in Masters → Programs/Tours/Activities.`}
        renderItem={(it) => (
          <div key={it.id} style={{ ...tileCard, cursor: 'pointer' }} onClick={() => { add(it.id); setPickerOpen(false); }}>
            <div style={tileEmoji}>{emoji}</div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)', textAlign: 'center' }}>{it.title}</span>
            {it.category && <span style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{it.category}</span>}
          </div>
        )} />
    </Section>
  );
}

// ─── Trainings Tab ─────────────────────────────────────────────────────────
function TrainingsTab({ applicantId, data, onRefresh }: { applicantId: string; data: FullData; onRefresh: () => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [all, setAll] = useState<TrainingModule[]>([]);
  useEffect(() => { if (pickerOpen) api.get('/training-modules').then((r) => setAll(r.data?.data ?? [])).catch(() => {}); }, [pickerOpen]);
  const items = data.trainings ?? [];
  const linked = new Set(items.map((i) => i.training_module_id));
  const add = async (id: string) => {
    try { await api.post(`/applicants/${applicantId}/onboarding/trainings`, { trainingModuleId: id }); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  const remove = async (id: string) => {
    try { await api.delete(`/applicants/onboarding/trainings/${id}`); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  const setStatus = async (id: string, status: 'pending' | 'ongoing' | 'done' | 'overdue') => {
    try { await api.patch(`/applicants/onboarding/trainings/${id}`, { status }); onRefresh(); }
    catch { toast.error('Failed'); }
  };
  return (
    <Section title="Training Modules" right={<Button size="sm" variant="primary" icon={Plus} onClick={() => setPickerOpen(true)}>Add Training</Button>}>
      {items.length === 0 && <Empty msg="No training modules assigned." />}
      <div style={tileGrid}>
        {items.map((t) => (
          <div key={t.id} style={{ ...tileCard, alignItems: 'flex-start', padding: 14 }}>
            <button onClick={() => remove(t.id)} style={tileDel}><Trash2 size={13} /></button>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              {t.cover_image_url
                ? <img src={t.cover_image_url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
                : <div style={tileEmoji}>📚</div>}
              <div style={{ flex: 1 }}>
                <strong style={{ color: 'var(--ck-ink)' }}>{t.name}</strong>
                <div style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{t.code} · {t.chapter_count} chapters{t.duration_hours ? ` · ${t.duration_hours}h` : ''}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {(['pending', 'ongoing', 'done', 'overdue'] as const).map((s) => (
                <button key={s} onClick={() => setStatus(t.id, s)}
                  style={{
                    padding: '3px 9px', borderRadius: 999, fontSize: 11, cursor: 'pointer', border: 'none', textTransform: 'capitalize',
                    background: t.status === s ? trainColor(s) : '#f3f4f6',
                    color: t.status === s ? '#fff' : '#4b5563', fontWeight: t.status === s ? 600 : 500,
                  }}>{s}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <PickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Pick Training Modules"
        items={all.filter((a) => !linked.has(a.id))} emptyMsg="No training modules. Add some in Masters → Training Modules."
        renderItem={(t) => (
          <div key={t.id} style={{ ...tileCard, cursor: 'pointer' }} onClick={() => { add(t.id); setPickerOpen(false); }}>
            {t.cover_image_url
              ? <img src={t.cover_image_url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
              : <div style={tileEmoji}>📚</div>}
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)', textAlign: 'center' }}>{t.name}</span>
            <span style={{ fontSize: 11, color: 'var(--ck-muted)' }}>{t.code}</span>
          </div>
        )} />
    </Section>
  );
}

// ─── Tiny presentational helpers ───────────────────────────────────────────
function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)' }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>{label}</span>
      {children}
    </label>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: 24, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13, background: 'var(--ck-line-soft)', borderRadius: 8 }}>{msg}</div>;
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 11px', borderRadius: 999, border: `1px solid ${selected ? 'var(--ck-ink)' : 'var(--ck-line)'}`,
      background: selected ? 'var(--ck-ink)' : 'transparent', color: selected ? '#fff' : 'var(--ck-ink)',
      fontSize: 12, cursor: 'pointer',
    }}>{children}</button>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: 'var(--ck-font-mono)', color: 'var(--ck-ink-soft)', fontSize: 12.5 }}>{children}</span>;
}

function PickerModal<T>({ open, onClose, title, items, renderItem, emptyMsg }: {
  open: boolean; onClose: () => void; title: string; items: T[]; renderItem: (item: T) => ReactNode; emptyMsg: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={720}>
      {items.length === 0 ? <Empty msg={emptyMsg} /> : <div style={tileGrid}>{items.map(renderItem)}</div>}
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const inp: CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };
const twoColGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 };
const fourColGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 };
const tileGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 };
const tileCard: CSSProperties = { position: 'relative', padding: 12, border: '1px solid var(--ck-line)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'var(--ck-surface)' };
const tileEmoji: CSSProperties = { width: 48, height: 48, borderRadius: 8, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 };
const tileDel: CSSProperties = { position: 'absolute', top: 6, right: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)', padding: 2 };
const th: CSSProperties = { padding: '10px 12px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em' };
const td: CSSProperties = { padding: '10px 12px' };
const iconBtn: CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)' };

function erpPill(status: string): CSSProperties {
  const map: Record<string, [string, string]> = {
    active: ['#dcfce7', '#15803d'], inactive: ['#f3f4f6', '#4b5563'], blocked: ['#fee2e2', '#b91c1c'],
  };
  const [bg, fg] = map[status] ?? map.inactive;
  return { padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color: fg, textTransform: 'capitalize' };
}
function erpBtn(active: boolean, color: string): CSSProperties {
  return { flex: 1, padding: '5px', borderRadius: 6, border: `1px solid ${active ? color : 'var(--ck-line)'}`, background: active ? color : 'transparent', color: active ? '#fff' : 'var(--ck-ink)', fontSize: 11, fontWeight: 600, cursor: 'pointer' };
}
function itemPill(status: string): CSSProperties {
  const map: Record<string, [string, string]> = {
    pending: ['#f3f4f6', '#4b5563'], ongoing: ['#dbeafe', '#1d4ed8'], done: ['#dcfce7', '#15803d'],
  };
  const [bg, fg] = map[status] ?? map.pending;
  return { marginTop: 4, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: bg, color: fg, textTransform: 'capitalize' };
}
function trainColor(s: string) {
  return s === 'done' ? '#16a34a' : s === 'ongoing' ? '#2563eb' : s === 'overdue' ? '#dc2626' : '#6b7280';
}
