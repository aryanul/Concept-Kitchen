// Employee Master — full-page detail / edit experience (Phase 2.A).
//
// Replaces the old drawer + edit-modal pattern. Renders the writeup's 8 tabs;
// only the Info tab is wired in this slice. View vs Edit modes are controlled
// by the `?mode=edit` query param.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Save, X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { IconAction } from '../../components/ui/IconAction';
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';

type Address = {
  line1?: string; line2?: string; city?: string; state?: string; country?: string; pin?: string;
};
type EmergencyContact = {
  id?: string;
  name: string;
  relation: string | null;
  phone: string | null;
  phone_country_code: string | null;
  address: string | null;
};
type Dependent = {
  id?: string;
  relation: string;
  name: string;
  phone: string | null;
  phone_country_code: string | null;
  email: string | null;
  dob: string | null;
};
type EmployeeDocument = {
  id?: string;
  doc_type: string;
  doc_number: string | null;
  description: string | null;
  file_url: string | null;
};
type Education = {
  id?: string;
  level: string | null;
  course_name: string | null;
  board_university: string | null;
  institute: string | null;
  specialization: string | null;
  passing_year: string | null;
  percentage_cgpa: string | null;
};
type WorkExperience = {
  id?: string;
  company_name: string | null;
  designation: string | null;
  from_date: string | null;
  to_date: string | null;
  reporting_manager_name: string | null;
  reporting_manager_phone: string | null;
  last_drawn_salary: string | null;
  reason_for_leaving: string | null;
  experience_letter_url: string | null;
};
type EmployeeSkill = {
  id?: string;
  skill_id: string;
  rating: number;
  notes: string | null;
  skill_code?: string | null;
  skill_name?: string;
  skill_category?: string | null;
};
type JobProfileOption = {
  id: string;
  jp_no: string | null;
  title: string;
  designation: string | null;
  department_name: string | null;
};
type Employee = {
  id: string; code: string;
  first_name: string; middle_name: string | null; last_name: string; display_name: string | null;
  designation: string; status: string;
  joining_date: string | null; exit_date: string | null;
  email: string; phone: string;
  ctc: number | string;
  bank_name: string | null; bank_account: string | null; ifsc: string | null;
  pan: string | null; aadhaar: string | null; pf: string | null; esic: string | null; uan: string | null;
  branch_id: string; branch_code: string; branch_name: string;
  department_id: string; department_name: string;
  grade_id: string; grade_code: string;
  company_id: string | null; company_name: string | null;
  division_id: string | null; division_name: string | null;
  location_id: string | null; location_name: string | null;
  // Info tab — added in migration 0025
  photo_url: string | null; gender: string | null; dob: string | null;
  marital_status: string | null; blood_group: string | null; nationality: string | null;
  religion: string | null; languages_known: string[] | string | null; caste_category: string | null;
  date_of_confirmation: string | null; employment_type: string | null; work_mode: string | null;
  probation_from: string | null; probation_to: string | null;
  contract_period: number | boolean; contract_from: string | null; contract_to: string | null;
  contract_attachment_url: string | null;
  personal_phone_country_code: string | null; alternate_phone: string | null;
  alternate_phone_country_code: string | null;
  office_contact_phone_id: string | null; office_contact_phone_number: string | null;
  personal_email: string | null;
  present_address: Address | string | null; permanent_address: Address | string | null;
  emergency_contacts: EmergencyContact[];
  dependents: Dependent[];
  documents: EmployeeDocument[];
  education: Education[];
  work_experience: WorkExperience[];
  // Job Profile tab — Phase 2.C
  job_profile_id: string | null;
  jp_no: string | null;
  jp_title: string | null;
  jp_alternate_title: string | null;
  jp_description: string | null;
  jp_requirements: string | null;
  jp_division: string | null;
  jp_designation: string | null;
  jp_location_applicable: string | null;
  jp_work_shift: string | null;
  skills: EmployeeSkill[];
  // Salary / ESIC / PF tab — Phase 2.D
  bank_branch: string | null;
  account_type: string | null;
  pf_applicable: number | boolean;
  esi_applicable: number | boolean;
  pt_state: string | null;
  form16_url: string | null;
  // Attendance & Leaves tab — Phase 2.E
  biometric_mapped: number | boolean;
  annual_leave_entitlement: number | null;
  attendance_rule_id: string | null;
  default_shift_id: string | null;
  // Increment tab
  next_review_due: string | null;
  increment_notes: string | null;
  // Other tab
  nda_signed: number | boolean;
  background_verification: string | null;
  policy_acknowledgements: string[] | string | null;
  linkedin_url: string | null;
  hobbies: string | null;
  willing_to_relocate: string | null;
  willing_to_travel: string | null;
  driving_license: number | boolean;
  medical_insurance_provider: string | null;
  medical_policy_number: string | null;
  medical_nominee: string | null;
  vaccination_status: string[] | string | null;
  bond_signed: number | boolean;
  visa_work_permit: string | null;
  legal_case_declaration: string | null;
  digital_signature_id: string | null;
  esignature_url: string | null;
  workflow_approver_roles: string[] | string | null;
  preferred_career_path: string | null;
  training_interests: string[] | string | null;
  open_to_mentorship: number | boolean;
  self_assessed_strengths: string | null;
  // Read-only derived summaries
  attendance_summary?: {
    last_attendance: { date: string; in_at: string | null; out_at: string | null; source: string; is_late: number } | null;
    leave_by_type: Array<{ type: string; opening: number; consumed: number; closing: number }>;
    open_leave_requests: number;
  };
  increment_summary?: {
    last: { effective: string; hike_pct: number | string; current_ctc: number | string; proposed_ctc: number | string; rating: string } | null;
    pending_count: number;
  };
  ledger_summary?: {
    advances_outstanding: number;
    loans_outstanding: number;
    last_advance: { kind: string; principal: number | string; outstanding: number | string; started_at: string } | null;
    last_payment: { amount: number | string; paid_at: string; kind: string } | null;
  };
  assets_summary?: {
    count: number;
    last_at: string | null;
  };
};
type DropdownOption = { id: string; name: string };

const TABS = [
  'Info',
  'Documents & Experience',
  'Job Profile',
  'Salary, ESIC & PF',
  'Attendance & Leaves',
  'Increment',
  'Ledger, Advances & Loans',
  'Other',
] as const;
type Tab = typeof TABS[number];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active', PROBATION: 'Probation', ON_LEAVE: 'On Leave', EXITED: 'Exited',
};

// Gender / Marital / Blood Group / Caste are now fed by lookup masters
// (categories: gender, marital_status, blood_group, caste_category).
const EMPLOYMENT_TYPES = ['Permanent', 'Contract', 'Intern', 'Consultant', 'Temporary'];
const WORK_MODES = ['Onsite', 'Hybrid', 'Remote'];
const COUNTRY_CODES = ['+91', '+1', '+44', '+61', '+65', '+971'];
const DOC_TYPES = ['PAN Card', 'Aadhaar', 'Passport', 'Driving License', 'Voter ID', 'Marksheet', 'Degree Certificate', 'Experience Letter', 'Relieving Letter', 'Salary Slip', 'Other'];
const EDU_LEVELS = ['High School', 'Higher Secondary', 'Diploma', 'Bachelor', 'Master', 'PhD', 'Certificate', 'Other'];
const LEAVING_REASONS = ['Better opportunity', 'Compensation', 'Career growth', 'Family reasons', 'Relocation', 'Company shut down', 'End of contract', 'Health', 'Other'];
const ACCOUNT_TYPES = ['Savings', 'Current', 'Salary', 'NRE', 'NRO'];
const BGV_STATUSES = ['Pending', 'In Progress', 'Clear', 'Issue Found', 'Rejected'];
const YES_NO = ['Yes', 'No'];
const TRAVEL_OPTIONS = ['Yes', 'No', 'Occasional'];
const PT_STATES = ['Andhra Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Meghalaya','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi'];
const POLICIES = ['Sexual Harassment Policy', 'Code of Conduct', 'IT Security Policy', 'Data Privacy Policy', 'Anti-Bribery Policy'];
const VACCINES = ['COVID-19 Dose 1', 'COVID-19 Dose 2', 'COVID-19 Booster', 'Hepatitis B', 'Tetanus', 'Typhoid'];
const APPROVER_ROLES = ['Line Manager', 'HR', 'Finance', 'Branch Manager', 'CXO'];

function parseAddress(v: Address | string | null | undefined): Address {
  if (!v) return {};
  if (typeof v === 'string') {
    try { return JSON.parse(v) as Address; } catch { return {}; }
  }
  return v;
}
function parseLanguages(v: string[] | string | null | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
// Shared parser for any JSON-stored string array (policy ack, vaccinations, etc.).
function parseStringArray(v: string[] | string | null | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const wantEdit = searchParams.get('mode') === 'edit';

  const [emp, setEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(wantEdit);
  const [tab, setTab] = useState<Tab>('Info');

  // Reference data needed by Info / Job Profile tab dropdowns.
  const [departments, setDepartments] = useState<DropdownOption[]>([]);
  const [divisions, setDivisions] = useState<DropdownOption[]>([]);
  const [phonePool, setPhonePool] = useState<Array<{ id: string; number: string; status: string; assigned_employee_id: string | null }>>([]);
  const [skillMaster, setSkillMaster] = useState<Array<{ id: string; code: string | null; name: string; category: string | null }>>([]);
  const [jobProfiles, setJobProfiles] = useState<JobProfileOption[]>([]);
  const [shifts, setShifts] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [attendanceRules, setAttendanceRules] = useState<Array<{ id: string; name: string }>>([]);

  const reloadEmployee = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await api.get<{ data: Employee }>(`/employees/${id}`);
      const data = r.data.data;
      setEmp(data);
      setForm(data);
    } catch {
      toast.error('Failed to load employee');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reloadEmployee();
    Promise.all([
      api.get<{ data: DropdownOption[] }>('/departments'),
      api.get<{ data: DropdownOption[] }>('/divisions'),
      api.get<{ data: Array<{ id: string; number: string; status: string; assigned_employee_id: string | null }> }>('/onboarding/phone-pool'),
      api.get<{ data: Array<{ id: string; code: string | null; name: string; category: string | null; is_active: number | boolean }> }>('/skills'),
      api.get<{ data: JobProfileOption[] }>('/job-profiles', { params: { pageSize: 1000 } }),
      api.get<{ data: Array<{ id: string; code: string; name: string }> }>('/shifts'),
      api.get<{ data: Array<{ id: string; name: string; is_active?: number | boolean }> }>('/attendance-rules'),
    ]).then(([d, dv, p, sk, jp, sh, ar]) => {
      setDepartments(d.data.data ?? []);
      setDivisions(dv.data.data ?? []);
      setPhonePool(p.data.data ?? []);
      setSkillMaster((sk.data.data ?? []).filter((s) => Number(s.is_active ?? 1) === 1));
      setJobProfiles(jp.data.data ?? []);
      setShifts(sh.data.data ?? []);
      setAttendanceRules((ar.data.data ?? []).filter((r) => Number((r as { is_active?: number }).is_active ?? 1) === 1));
    }).catch(() => {});
  }, [reloadEmployee]);

  // Keep editing toggle synced with URL.
  useEffect(() => { setEditing(wantEdit); }, [wantEdit]);

  const startEdit = () => setSearchParams({ mode: 'edit' });
  const cancelEdit = () => {
    setForm(emp);
    setSearchParams({});
  };

  const onSave = async () => {
    if (!form || !emp) return;
    setSaving(true);
    try {
      // Build PATCH body — only Info-tab columns this slice can update.
      const body: Record<string, unknown> = {
        first_name: form.first_name,
        middle_name: form.middle_name || null,
        last_name: form.last_name,
        display_name: form.display_name || null,
        designation: form.designation,
        department_id: form.department_id,
        division_id: form.division_id || null,
        job_profile_id: form.job_profile_id || null,
        photo_url: form.photo_url || null,
        gender: form.gender || null,
        dob: form.dob || null,
        marital_status: form.marital_status || null,
        blood_group: form.blood_group || null,
        nationality: form.nationality || null,
        religion: form.religion || null,
        languages_known: parseLanguages(form.languages_known),
        caste_category: form.caste_category || null,
        joining_date: form.joining_date || null,
        date_of_confirmation: form.date_of_confirmation || null,
        employment_type: form.employment_type || null,
        work_mode: form.work_mode || null,
        probation_from: form.probation_from || null,
        probation_to: form.probation_to || null,
        contract_period: !!form.contract_period,
        contract_from: form.contract_from || null,
        contract_to: form.contract_to || null,
        contract_attachment_url: form.contract_attachment_url || null,
        personal_phone_country_code: form.personal_phone_country_code || '+91',
        phone: form.phone,
        alternate_phone: form.alternate_phone || null,
        alternate_phone_country_code: form.alternate_phone_country_code || null,
        office_contact_phone_id: form.office_contact_phone_id || null,
        personal_email: form.personal_email || null,
        email: form.email,
        present_address: parseAddress(form.present_address),
        permanent_address: parseAddress(form.permanent_address),
        // Salary/ESIC/PF tab
        bank_name: form.bank_name || null,
        bank_branch: form.bank_branch || null,
        bank_account: form.bank_account || null,
        ifsc: form.ifsc || null,
        account_type: form.account_type || null,
        pf_applicable: !!form.pf_applicable,
        uan: form.uan || null,
        esi_applicable: !!form.esi_applicable,
        esic: form.esic || null,
        pt_state: form.pt_state || null,
        pan: form.pan || null,
        form16_url: form.form16_url || null,
        // Attendance & Leaves tab
        biometric_mapped: !!form.biometric_mapped,
        annual_leave_entitlement: form.annual_leave_entitlement ?? null,
        attendance_rule_id: form.attendance_rule_id || null,
        default_shift_id: form.default_shift_id || null,
        // Increment tab
        next_review_due: form.next_review_due || null,
        increment_notes: form.increment_notes || null,
        // Other tab
        nda_signed: !!form.nda_signed,
        background_verification: form.background_verification || null,
        policy_acknowledgements: parseStringArray(form.policy_acknowledgements),
        linkedin_url: form.linkedin_url || null,
        hobbies: form.hobbies || null,
        willing_to_relocate: form.willing_to_relocate || null,
        willing_to_travel: form.willing_to_travel || null,
        driving_license: !!form.driving_license,
        medical_insurance_provider: form.medical_insurance_provider || null,
        medical_policy_number: form.medical_policy_number || null,
        medical_nominee: form.medical_nominee || null,
        vaccination_status: parseStringArray(form.vaccination_status),
        bond_signed: !!form.bond_signed,
        visa_work_permit: form.visa_work_permit || null,
        legal_case_declaration: form.legal_case_declaration || null,
        digital_signature_id: form.digital_signature_id || null,
        esignature_url: form.esignature_url || null,
        workflow_approver_roles: parseStringArray(form.workflow_approver_roles),
        preferred_career_path: form.preferred_career_path || null,
        training_interests: parseStringArray(form.training_interests),
        open_to_mentorship: !!form.open_to_mentorship,
        self_assessed_strengths: form.self_assessed_strengths || null,
      };
      await api.patch(`/employees/${emp.id}`, body);
      await api.put(`/employees/${emp.id}/emergency-contacts`, { items: form.emergency_contacts });
      await api.put(`/employees/${emp.id}/dependents`,         { items: form.dependents });
      await api.put(`/employees/${emp.id}/documents`,          { items: form.documents });
      await api.put(`/employees/${emp.id}/education`,          { items: form.education });
      await api.put(`/employees/${emp.id}/work-experience`,    { items: form.work_experience });
      await api.put(`/employees/${emp.id}/skills`,             { items: form.skills });
      toast.success('Employee saved');
      setSearchParams({});
      reloadEmployee();
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !emp || !form) {
    return (
      <div>
        <PageHeader title="Employee" subtitle="Loading…" />
        <Card padding={48}><div style={{ textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</div></Card>
      </div>
    );
  }

  const fullName = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ');

  return (
    <div>
      <PageHeader
        title={fullName}
        subtitle={`${emp.designation} · ${emp.code}`}
        actions={<>
          <Button icon={ArrowLeft} variant="ghost" onClick={() => navigate('/employees')}>Back to list</Button>
          {!editing && <Button icon={Pencil} variant="primary" onClick={startEdit}>Edit</Button>}
          {editing && (<>
            <Button icon={X} onClick={cancelEdit} disabled={saving}>Cancel</Button>
            <Button icon={Save} variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </>)}
        </>}
      />

      {/* Identity band */}
      <Card padding={20}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <Avatar name={fullName} hue={340} size={72} />
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <KV label="Employee Code" value={emp.code} />
            <KV label="Status">
              <StatusPill status={STATUS_LABELS[emp.status] ?? emp.status} />
            </KV>
            <KV label="Department" value={emp.department_name} />
            <KV label="Division" value={emp.division_name ?? '—'} />
            <KV label="Designation" value={emp.designation} />
            <KV label="Company" value={emp.company_name ?? '—'} />
            <KV label="Branch" value={emp.branch_name} />
            <KV label="Location" value={emp.location_name ?? '—'} />
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Card padding={0} style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--ck-line)', overflowX: 'auto' }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '14px 18px', border: 'none', background: 'transparent',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                color: tab === t ? 'var(--ck-ink)' : 'var(--ck-muted)',
                borderBottom: tab === t ? '2px solid var(--ck-accent)' : '2px solid transparent',
              }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ padding: 24 }}>
          {tab === 'Info' && (
            <InfoTab
              form={form} setForm={setForm} emp={emp} editing={editing}
              departments={departments} divisions={divisions} phonePool={phonePool}
            />
          )}
          {tab === 'Documents & Experience' && (
            <DocsExperienceTab form={form} setForm={setForm} editing={editing} />
          )}
          {tab === 'Job Profile' && (
            <JobProfileTab form={form} setForm={setForm} editing={editing}
              jobProfiles={jobProfiles} skillMaster={skillMaster} />
          )}
          {tab === 'Salary, ESIC & PF'        && <SalaryTab          form={form} setForm={setForm} editing={editing} />}
          {tab === 'Attendance & Leaves'      && <AttendanceLeavesTab form={form} setForm={setForm} editing={editing} shifts={shifts} attendanceRules={attendanceRules} />}
          {tab === 'Increment'                && <IncrementTab       form={form} setForm={setForm} editing={editing} />}
          {tab === 'Ledger, Advances & Loans' && <LedgerTab          form={form} />}
          {tab === 'Other'                    && <OtherTab           form={form} setForm={setForm} editing={editing} />}
        </div>
      </Card>
    </div>
  );
}

// ─── Info tab ──────────────────────────────────────────────────────────────
function InfoTab({ form, setForm, emp, editing, departments, divisions, phonePool }: {
  form: Employee; setForm: (e: Employee) => void; emp: Employee; editing: boolean;
  departments: DropdownOption[]; divisions: DropdownOption[];
  phonePool: Array<{ id: string; number: string; status: string; assigned_employee_id: string | null }>;
}) {
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setForm({ ...form, [k]: v });
  const presentAddress = parseAddress(form.present_address);
  const permanentAddress = parseAddress(form.permanent_address);
  const languages = parseLanguages(form.languages_known);

  // Personal-detail lookup masters (editable from /masters/lookups).
  type LookupOpt = { code: string; label: string };
  const [genderOpts, setGenderOpts] = useState<LookupOpt[]>([]);
  const [maritalOpts, setMaritalOpts] = useState<LookupOpt[]>([]);
  const [bloodOpts, setBloodOpts] = useState<LookupOpt[]>([]);
  const [nationalityOpts, setNationalityOpts] = useState<LookupOpt[]>([]);
  const [religionOpts, setReligionOpts] = useState<LookupOpt[]>([]);
  const [casteOpts, setCasteOpts] = useState<LookupOpt[]>([]);
  const opt = (rows: LookupOpt[]) => rows.map((r) => ({ value: r.code, label: r.label }));

  useEffect(() => {
    Promise.all([
      api.get<{ data: LookupOpt[] }>('/lookups', { params: { category: 'gender' } }),
      api.get<{ data: LookupOpt[] }>('/lookups', { params: { category: 'marital_status' } }),
      api.get<{ data: LookupOpt[] }>('/lookups', { params: { category: 'blood_group' } }),
      api.get<{ data: LookupOpt[] }>('/lookups', { params: { category: 'nationality' } }),
      api.get<{ data: LookupOpt[] }>('/lookups', { params: { category: 'religion' } }),
      api.get<{ data: LookupOpt[] }>('/lookups', { params: { category: 'caste_category' } }),
    ]).then(([g, m, b, n, r, c]) => {
      setGenderOpts(g.data.data ?? []);
      setMaritalOpts(m.data.data ?? []);
      setBloodOpts(b.data.data ?? []);
      setNationalityOpts(n.data.data ?? []);
      setReligionOpts(r.data.data ?? []);
      setCasteOpts(c.data.data ?? []);
    }).catch(() => {});
  }, []);

  const updatePresent = (patch: Partial<Address>) => set('present_address', { ...presentAddress, ...patch });
  const updatePermanent = (patch: Partial<Address>) => set('permanent_address', { ...permanentAddress, ...patch });

  // Phone-pool dropdown: available phones + the one currently assigned to this employee.
  const phoneOptions = useMemo(() => {
    return phonePool.filter((p) =>
      p.status === 'available' ||
      p.id === form.office_contact_phone_id ||
      p.assigned_employee_id === emp.id
    );
  }, [phonePool, form.office_contact_phone_id, emp.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      <Section title="Identity">
        <Grid3>
          <Field label="First Name *" required>
            <Input value={form.first_name} editing={editing} onChange={(v) => set('first_name', v)} />
          </Field>
          <Field label="Middle Name">
            <Input value={form.middle_name ?? ''} editing={editing} onChange={(v) => set('middle_name', v)} />
          </Field>
          <Field label="Surname *" required>
            <Input value={form.last_name} editing={editing} onChange={(v) => set('last_name', v)} />
          </Field>
        </Grid3>
        <Grid2>
          <Field label="Display / Preferred Name">
            <Input value={form.display_name ?? ''} editing={editing} onChange={(v) => set('display_name', v)} placeholder={`${form.first_name} ${form.last_name}`} />
          </Field>
          <Field label="Photo URL">
            <Input value={form.photo_url ?? ''} editing={editing} onChange={(v) => set('photo_url', v)} placeholder="https://…/profile.jpg" />
          </Field>
        </Grid2>
      </Section>

      <Section title="Role">
        <Grid3>
          <Field label="Department">
            <Select value={form.department_id ?? ''} editing={editing} onChange={(v) => set('department_id', v)}
              options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          </Field>
          <Field label="Division">
            <Select value={form.division_id ?? ''} editing={editing} onChange={(v) => set('division_id', v || null)}
              options={divisions.map((d) => ({ value: d.id, label: d.name }))} allowEmpty />
          </Field>
          <Field label="Designation">
            <Input value={form.designation ?? ''} editing={editing} onChange={(v) => set('designation', v)} />
          </Field>
        </Grid3>
      </Section>

      <Section title="Personal">
        <Grid3>
          <Field label="Gender">
            <Select value={form.gender ?? ''} editing={editing} onChange={(v) => set('gender', v || null)}
              options={opt(genderOpts)} allowEmpty />
          </Field>
          <Field label="Date of Birth">
            <DateInput value={form.dob ?? ''} editing={editing} onChange={(v) => set('dob', v || null)} />
          </Field>
          <Field label="Marital Status">
            <Select value={form.marital_status ?? ''} editing={editing} onChange={(v) => set('marital_status', v || null)}
              options={opt(maritalOpts)} allowEmpty />
          </Field>
        </Grid3>
        <Grid3>
          <Field label="Blood Group">
            <Select value={form.blood_group ?? ''} editing={editing} onChange={(v) => set('blood_group', v || null)}
              options={opt(bloodOpts)} allowEmpty />
          </Field>
          <Field label="Nationality">
            <Select value={form.nationality ?? ''} editing={editing} onChange={(v) => set('nationality', v || null)}
              options={opt(nationalityOpts)} allowEmpty />
          </Field>
          <Field label="Religion">
            <Select value={form.religion ?? ''} editing={editing} onChange={(v) => set('religion', v || null)}
              options={opt(religionOpts)} allowEmpty />
          </Field>
        </Grid3>
        <Grid2>
          <Field label="Languages Known">
            <Input
              value={languages.join(', ')}
              editing={editing}
              onChange={(v) => set('languages_known', v.split(',').map((s) => s.trim()).filter(Boolean))}
              placeholder="English, Hindi, Gujarati"
            />
          </Field>
          <Field label="Caste Category">
            <Select value={form.caste_category ?? ''} editing={editing} onChange={(v) => set('caste_category', v || null)}
              options={opt(casteOpts)} allowEmpty />
          </Field>
        </Grid2>
      </Section>

      <Section title="Employment">
        <Grid3>
          <Field label="Date of Joining">
            <DateInput value={form.joining_date ?? ''} editing={editing} onChange={(v) => set('joining_date', v || null)} />
          </Field>
          <Field label="Date of Confirmation">
            <DateInput value={form.date_of_confirmation ?? ''} editing={editing} onChange={(v) => set('date_of_confirmation', v || null)} />
          </Field>
          <Field label="Employment Type">
            <Select value={form.employment_type ?? ''} editing={editing} onChange={(v) => set('employment_type', v || null)}
              options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t }))} allowEmpty />
          </Field>
        </Grid3>
        <Grid3>
          <Field label="Work Mode">
            <Select value={form.work_mode ?? ''} editing={editing} onChange={(v) => set('work_mode', v || null)}
              options={WORK_MODES.map((w) => ({ value: w, label: w }))} allowEmpty />
          </Field>
          <Field label="Probation From">
            <DateInput value={form.probation_from ?? ''} editing={editing} onChange={(v) => set('probation_from', v || null)} />
          </Field>
          <Field label="Probation To">
            <DateInput value={form.probation_to ?? ''} editing={editing} onChange={(v) => set('probation_to', v || null)} />
          </Field>
        </Grid3>
        <div>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: editing ? 'pointer' : 'default' }}>
            <input type="checkbox" checked={!!form.contract_period} disabled={!editing}
              onChange={(e) => set('contract_period', e.target.checked ? 1 : 0)} />
            Contract Period
          </label>
        </div>
        {!!form.contract_period && (
          <Grid3>
            <Field label="Contract From">
              <DateInput value={form.contract_from ?? ''} editing={editing} onChange={(v) => set('contract_from', v || null)} />
            </Field>
            <Field label="Contract To">
              <DateInput value={form.contract_to ?? ''} editing={editing} onChange={(v) => set('contract_to', v || null)} />
            </Field>
            <Field label="Contract Attachment URL">
              <Input value={form.contract_attachment_url ?? ''} editing={editing} onChange={(v) => set('contract_attachment_url', v)} placeholder="https://…/contract.pdf" />
            </Field>
          </Grid3>
        )}
      </Section>

      <Section title="Contact">
        <Grid2>
          <Field label="Personal Mobile *" required>
            <PhoneInput
              countryCode={form.personal_phone_country_code ?? '+91'}
              number={form.phone}
              editing={editing}
              onCountryCode={(v) => set('personal_phone_country_code', v)}
              onNumber={(v) => set('phone', v)}
            />
          </Field>
          <Field label="Alternate Contact">
            <PhoneInput
              countryCode={form.alternate_phone_country_code ?? '+91'}
              number={form.alternate_phone ?? ''}
              editing={editing}
              onCountryCode={(v) => set('alternate_phone_country_code', v)}
              onNumber={(v) => set('alternate_phone', v || null)}
            />
          </Field>
        </Grid2>
        <Grid2>
          <Field label="Office Contact (Phone Pool)">
            {editing ? (
              <select value={form.office_contact_phone_id ?? ''} onChange={(e) => set('office_contact_phone_id', e.target.value || null)} style={inpStyle}>
                <option value="">— None —</option>
                {phoneOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.number}{p.status !== 'available' ? ` (${p.status})` : ''}</option>
                ))}
              </select>
            ) : (
              <ReadOnly value={form.office_contact_phone_number ?? '—'} />
            )}
          </Field>
          <Field label="Personal Email">
            <Input value={form.personal_email ?? ''} editing={editing} onChange={(v) => set('personal_email', v || null)} placeholder="user@example.com" />
          </Field>
        </Grid2>
        <Field label="Official Email *" required>
          <Input value={form.email} editing={editing} onChange={(v) => set('email', v)} />
        </Field>
      </Section>

      <Section title="Present Address">
        <AddressBlock value={presentAddress} editing={editing} onChange={updatePresent} />
      </Section>

      <Section
        title="Permanent Address"
        right={editing ? (
          <button type="button" onClick={() => set('permanent_address', presentAddress)}
            style={ghostBtn}>Copy from present</button>
        ) : null}>
        <AddressBlock value={permanentAddress} editing={editing} onChange={updatePermanent} />
      </Section>

      <Section
        title="Emergency Contacts"
        right={editing ? (
          <button type="button" onClick={() => set('emergency_contacts', [...form.emergency_contacts, { name: '', relation: '', phone: '', phone_country_code: '+91', address: '' }])} style={ghostBtn}>
            <Plus size={14} style={{ marginRight: 4 }} /> Add
          </button>
        ) : null}>
        {form.emergency_contacts.length === 0 ? (
          <Muted>No emergency contacts recorded.</Muted>
        ) : (
          <RowGrid cols="1.4fr 1fr 1.4fr 2fr 40px">
            <HeaderCell>Name</HeaderCell>
            <HeaderCell>Relation</HeaderCell>
            <HeaderCell>Phone</HeaderCell>
            <HeaderCell>Address</HeaderCell>
            <HeaderCell />
            {form.emergency_contacts.map((ec, i) => (
              <EmergencyRow key={i} value={ec} editing={editing}
                onChange={(v) => {
                  const next = [...form.emergency_contacts]; next[i] = v; set('emergency_contacts', next);
                }}
                onDelete={() => {
                  const next = form.emergency_contacts.filter((_, j) => j !== i);
                  set('emergency_contacts', next);
                }}
              />
            ))}
          </RowGrid>
        )}
      </Section>

      <Section
        title="Dependents & Family"
        right={editing ? (
          <button type="button" onClick={() => set('dependents', [...form.dependents, { relation: '', name: '', phone: '', phone_country_code: '+91', email: '', dob: '' }])} style={ghostBtn}>
            <Plus size={14} style={{ marginRight: 4 }} /> Add
          </button>
        ) : null}>
        {form.dependents.length === 0 ? (
          <Muted>No dependents recorded.</Muted>
        ) : (
          <RowGrid cols="0.9fr 1.4fr 1.3fr 1.5fr 1fr 70px 40px">
            <HeaderCell>Relation</HeaderCell>
            <HeaderCell>Name</HeaderCell>
            <HeaderCell>Phone</HeaderCell>
            <HeaderCell>Email</HeaderCell>
            <HeaderCell>DOB</HeaderCell>
            <HeaderCell>Age</HeaderCell>
            <HeaderCell />
            {form.dependents.map((dep, i) => (
              <DependentRow key={i} value={dep} editing={editing}
                onChange={(v) => {
                  const next = [...form.dependents]; next[i] = v; set('dependents', next);
                }}
                onDelete={() => {
                  const next = form.dependents.filter((_, j) => j !== i);
                  set('dependents', next);
                }}
              />
            ))}
          </RowGrid>
        )}
      </Section>
    </div>
  );
}

// ─── Documents & Experience tab ────────────────────────────────────────────
function DocsExperienceTab({ form, setForm, editing }: {
  form: Employee; setForm: (e: Employee) => void; editing: boolean;
}) {
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setForm({ ...form, [k]: v });

  const addDoc = () => set('documents', [...form.documents, { doc_type: '', doc_number: '', description: '', file_url: '' }]);
  const addEdu = () => set('education', [...form.education, { level: '', course_name: '', board_university: '', institute: '', specialization: '', passing_year: '', percentage_cgpa: '' }]);
  const addExp = () => set('work_experience', [...form.work_experience, {
    company_name: '', designation: '', from_date: '', to_date: '',
    reporting_manager_name: '', reporting_manager_phone: '',
    last_drawn_salary: '', reason_for_leaving: '', experience_letter_url: '',
  }]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      <Section
        title="Documents"
        right={editing ? <button type="button" onClick={addDoc} style={ghostBtn}><Plus size={14} style={{ marginRight: 4 }} /> Add Document</button> : null}>
        {form.documents.length === 0 ? (
          <Muted>No documents recorded.</Muted>
        ) : (
          <RowGrid cols="40px 1.4fr 1.2fr 2fr 1.2fr 40px">
            <HeaderCell>#</HeaderCell>
            <HeaderCell>Document Type</HeaderCell>
            <HeaderCell>Document Number</HeaderCell>
            <HeaderCell>Description</HeaderCell>
            <HeaderCell>File</HeaderCell>
            <HeaderCell />
            {form.documents.map((d, i) => (
              <DocumentRow key={i} idx={i} value={d} editing={editing}
                onChange={(v) => { const next = [...form.documents]; next[i] = v; set('documents', next); }}
                onDelete={() => set('documents', form.documents.filter((_, j) => j !== i))}
              />
            ))}
          </RowGrid>
        )}
      </Section>

      <Section
        title="Education"
        right={editing ? <button type="button" onClick={addEdu} style={ghostBtn}><Plus size={14} style={{ marginRight: 4 }} /> Add Education</button> : null}>
        {form.education.length === 0 ? (
          <Muted>No education records.</Muted>
        ) : (
          <RowGrid cols="1fr 1.4fr 1.4fr 1.4fr 1.2fr 100px 90px 40px">
            <HeaderCell>Level</HeaderCell>
            <HeaderCell>Course</HeaderCell>
            <HeaderCell>Board / University</HeaderCell>
            <HeaderCell>Institute</HeaderCell>
            <HeaderCell>Specialization</HeaderCell>
            <HeaderCell>Passing Year</HeaderCell>
            <HeaderCell>% / CGPA</HeaderCell>
            <HeaderCell />
            {form.education.map((e, i) => (
              <EducationRow key={i} value={e} editing={editing}
                onChange={(v) => { const next = [...form.education]; next[i] = v; set('education', next); }}
                onDelete={() => set('education', form.education.filter((_, j) => j !== i))}
              />
            ))}
          </RowGrid>
        )}
      </Section>

      <Section
        title="Work Experience"
        right={editing ? <button type="button" onClick={addExp} style={ghostBtn}><Plus size={14} style={{ marginRight: 4 }} /> Add Experience</button> : null}>
        {form.work_experience.length === 0 ? (
          <Muted>No prior work experience recorded.</Muted>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {form.work_experience.map((w, i) => (
              <WorkExperienceCard key={i} value={w} editing={editing}
                onChange={(v) => { const next = [...form.work_experience]; next[i] = v; set('work_experience', next); }}
                onDelete={() => set('work_experience', form.work_experience.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// Each Document row: Sr No, Type select, Number, Description, File URL, Delete.
function DocumentRow({ idx, value, editing, onChange, onDelete }: {
  idx: number; value: EmployeeDocument; editing: boolean;
  onChange: (v: EmployeeDocument) => void; onDelete: () => void;
}) {
  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--ck-ink-soft)' }}>{idx + 1}</div>
      {editing ? (
        <select value={value.doc_type} onChange={(e) => onChange({ ...value, doc_type: e.target.value })} style={inpStyle}>
          <option value="">— Select —</option>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 600 }}>{value.doc_type || '—'}</div>
      )}
      <RowInput val={value.doc_number ?? ''} editing={editing} onChange={(v) => onChange({ ...value, doc_number: v })} placeholder="ABCDE1234F" />
      <RowInput val={value.description ?? ''} editing={editing} onChange={(v) => onChange({ ...value, description: v })} placeholder="Notes" />
      {editing ? (
        <input value={value.file_url ?? ''} onChange={(e) => onChange({ ...value, file_url: e.target.value })} placeholder="https://…/file.pdf" style={inpStyle} />
      ) : value.file_url ? (
        <a href={value.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--ck-accent)', textDecoration: 'none' }}>View</a>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--ck-muted)' }}>—</div>
      )}
      {editing
        ? <IconAction icon={Trash2} label="Delete" hint="Remove this row" iconOnly tone="danger" onClick={onDelete} />
        : <span />}
    </>
  );
}

function EducationRow({ value, editing, onChange, onDelete }: {
  value: Education; editing: boolean;
  onChange: (v: Education) => void; onDelete: () => void;
}) {
  return (
    <>
      {editing ? (
        <select value={value.level ?? ''} onChange={(e) => onChange({ ...value, level: e.target.value || null })} style={inpStyle}>
          <option value="">— Level —</option>
          {EDU_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 600 }}>{value.level || '—'}</div>
      )}
      <RowInput val={value.course_name ?? ''} editing={editing} onChange={(v) => onChange({ ...value, course_name: v })} placeholder="B.E. Mechanical" />
      <RowInput val={value.board_university ?? ''} editing={editing} onChange={(v) => onChange({ ...value, board_university: v })} placeholder="Gujarat Tech Univ" />
      <RowInput val={value.institute ?? ''} editing={editing} onChange={(v) => onChange({ ...value, institute: v })} placeholder="K.K. Institute" />
      <RowInput val={value.specialization ?? ''} editing={editing} onChange={(v) => onChange({ ...value, specialization: v })} placeholder="Mechanical" />
      <RowDate val={value.passing_year ?? ''} editing={editing} onChange={(v) => onChange({ ...value, passing_year: v })} />
      <RowInput val={value.percentage_cgpa ?? ''} editing={editing} onChange={(v) => onChange({ ...value, percentage_cgpa: v })} placeholder="72%" />
      {editing
        ? <IconAction icon={Trash2} label="Delete" hint="Remove this row" iconOnly tone="danger" onClick={onDelete} />
        : <span />}
    </>
  );
}

// Work experience is wider than docs/education — render as a card with
// labeled fields rather than a row, otherwise the columns get too cramped.
function WorkExperienceCard({ value, editing, onChange, onDelete }: {
  value: WorkExperience; editing: boolean;
  onChange: (v: WorkExperience) => void; onDelete: () => void;
}) {
  return (
    <div style={{ padding: 16, border: '1px solid var(--ck-line)', borderRadius: 10, background: 'var(--ck-bg)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Company Name">
          <Input value={value.company_name ?? ''} editing={editing} onChange={(v) => onChange({ ...value, company_name: v })} placeholder="M/s Alpha Engineering" />
        </Field>
        <Field label="Designation">
          <Input value={value.designation ?? ''} editing={editing} onChange={(v) => onChange({ ...value, designation: v })} placeholder="Jr. Supervisor" />
        </Field>
        <Field label="Last Drawn Salary">
          <Input value={value.last_drawn_salary ?? ''} editing={editing} onChange={(v) => onChange({ ...value, last_drawn_salary: v })} placeholder="₹25,000" />
        </Field>
        <Field label="From">
          <DateInput value={value.from_date ?? ''} editing={editing} onChange={(v) => onChange({ ...value, from_date: v || null })} />
        </Field>
        <Field label="To">
          <DateInput value={value.to_date ?? ''} editing={editing} onChange={(v) => onChange({ ...value, to_date: v || null })} />
        </Field>
        <Field label="Reason for Leaving">
          <Select
            value={value.reason_for_leaving ?? ''} editing={editing}
            onChange={(v) => onChange({ ...value, reason_for_leaving: v || null })}
            options={LEAVING_REASONS.map((r) => ({ value: r, label: r }))} allowEmpty
          />
        </Field>
        <Field label="Reporting Manager Name">
          <Input value={value.reporting_manager_name ?? ''} editing={editing} onChange={(v) => onChange({ ...value, reporting_manager_name: v })} placeholder="Mr. Suresh" />
        </Field>
        <Field label="Reporting Manager Phone">
          <Input value={value.reporting_manager_phone ?? ''} editing={editing} onChange={(v) => onChange({ ...value, reporting_manager_phone: v })} placeholder="+91 9812345678" />
        </Field>
        <Field label="Experience Letter URL">
          <Input value={value.experience_letter_url ?? ''} editing={editing} onChange={(v) => onChange({ ...value, experience_letter_url: v })} placeholder="https://…/letter.pdf" />
        </Field>
      </div>
      {editing && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onDelete} style={{ ...ghostBtn, color: 'var(--ck-danger-fg)' }}><Trash2 size={14} style={{ marginRight: 4 }} /> Remove</button>
        </div>
      )}
    </div>
  );
}

// ─── Job Profile tab ───────────────────────────────────────────────────────
function JobProfileTab({ form, setForm, editing, jobProfiles, skillMaster }: {
  form: Employee; setForm: (e: Employee) => void; editing: boolean;
  jobProfiles: JobProfileOption[];
  skillMaster: Array<{ id: string; code: string | null; name: string; category: string | null }>;
}) {
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setForm({ ...form, [k]: v });

  const currentJp = jobProfiles.find((j) => j.id === form.job_profile_id);

  // Skills not already added (so the picker doesn't list duplicates).
  const usedSkillIds = new Set(form.skills.map((s) => s.skill_id));
  const availableSkills = skillMaster.filter((s) => !usedSkillIds.has(s.id));

  const addSkill = (skillId: string) => {
    const sk = skillMaster.find((s) => s.id === skillId);
    if (!sk) return;
    const newSkill: EmployeeSkill = {
      skill_id: sk.id, rating: 3, notes: '',
      skill_code: sk.code, skill_name: sk.name, skill_category: sk.category,
    };
    set('skills', [...form.skills, newSkill]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      <Section
        title="Mapped Job Profile"
        right={editing ? null : (
          currentJp ? <span style={{ fontSize: 12, color: 'var(--ck-muted)' }}>{currentJp.jp_no || '—'}</span> : null
        )}>
        {editing ? (
          <Grid2>
            <Field label="Job Profile">
              <select value={form.job_profile_id ?? ''} onChange={(e) => set('job_profile_id', e.target.value || null)} style={inpStyle}>
                <option value="">— None —</option>
                {jobProfiles.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jp_no ? `[${j.jp_no}] ` : ''}{j.title}{j.designation ? ` — ${j.designation}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <div />
          </Grid2>
        ) : !form.job_profile_id ? (
          <Muted>No job profile mapped.</Muted>
        ) : null}

        {form.job_profile_id && (
          <>
            <Grid3>
              <Field label="Job Profile ID"><ReadOnly value={form.jp_no || '—'} /></Field>
              <Field label="Job Title"><ReadOnly value={form.jp_title || '—'} /></Field>
              <Field label="Alternate Title"><ReadOnly value={form.jp_alternate_title || '—'} /></Field>
            </Grid3>
            <Grid3>
              <Field label="Division"><ReadOnly value={form.jp_division || '—'} /></Field>
              <Field label="Designation"><ReadOnly value={form.jp_designation || '—'} /></Field>
              <Field label="Work Shift"><ReadOnly value={form.jp_work_shift || '—'} /></Field>
            </Grid3>
            <Field label="Location Applicable"><ReadOnly value={form.jp_location_applicable || '—'} /></Field>
            <Field label="Job Short Description">
              <ReadOnlyBlock value={form.jp_description || '—'} />
            </Field>
            <Field label="Job Requirements (Summary)">
              <ReadOnlyBlock value={form.jp_requirements || '—'} />
            </Field>
          </>
        )}
      </Section>

      <Section
        title="Skills & Rating"
        right={editing ? (
          <select
            value=""
            onChange={(e) => { if (e.target.value) addSkill(e.target.value); }}
            disabled={availableSkills.length === 0}
            style={{ ...inpStyle, width: 220 }}
          >
            <option value="">{availableSkills.length === 0 ? 'All skills added' : '+ Add skill from master'}</option>
            {availableSkills.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.category ? ` (${s.category})` : ''}</option>
            ))}
          </select>
        ) : null}>
        {form.skills.length === 0 ? (
          <Muted>No skills mapped.</Muted>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {form.skills.map((s, i) => (
              <SkillRow
                key={s.skill_id} value={s} editing={editing}
                onChange={(v) => { const next = [...form.skills]; next[i] = v; set('skills', next); }}
                onDelete={() => set('skills', form.skills.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function SkillRow({ value, editing, onChange, onDelete }: {
  value: EmployeeSkill; editing: boolean;
  onChange: (v: EmployeeSkill) => void; onDelete: () => void;
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1.4fr 1fr 2fr 200px 40px',
      gap: 12, alignItems: 'center',
      padding: 12, border: '1px solid var(--ck-line)', borderRadius: 8, background: 'var(--ck-bg)',
    }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ck-ink)' }}>{value.skill_name ?? '—'}</div>
        {value.skill_code && <div style={{ fontSize: 11, color: 'var(--ck-muted)', fontFamily: 'var(--ck-font-mono)' }}>{value.skill_code}</div>}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>{value.skill_category || '—'}</div>
      {editing ? (
        <input value={value.notes ?? ''} onChange={(e) => onChange({ ...value, notes: e.target.value })} placeholder="Notes (optional)" style={inpStyle} />
      ) : (
        <div style={{ fontSize: 13, color: value.notes ? 'var(--ck-ink-soft)' : 'var(--ck-muted)' }}>{value.notes || '—'}</div>
      )}
      <RatingPicker value={value.rating} editing={editing} onChange={(r) => onChange({ ...value, rating: r })} />
      {editing
        ? <IconAction icon={Trash2} label="Delete" hint="Remove this row" iconOnly tone="danger" onClick={onDelete} />
        : <span />}
    </div>
  );
}

function RatingPicker({ value, editing, onChange }: { value: number; editing: boolean; onChange: (v: number) => void }) {
  // Star-style 1..5 selector. Filled = ★, empty = ☆. Click sets the rating.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => editing && onChange(n)}
          disabled={!editing}
          aria-label={`Rate ${n} of 5`}
          style={{
            background: 'none', border: 'none', padding: 0,
            cursor: editing ? 'pointer' : 'default',
            fontSize: 18,
            color: n <= value ? 'var(--ck-accent, #f59e0b)' : 'var(--ck-line)',
          }}>
          {n <= value ? '★' : '☆'}
        </button>
      ))}
      <span style={{ fontSize: 12, color: 'var(--ck-muted)', marginLeft: 4 }}>{value}/5</span>
    </div>
  );
}

function ReadOnlyBlock({ value }: { value: string }) {
  return (
    <div style={{
      fontSize: 13.5, padding: '10px 12px', background: 'var(--ck-bg)', borderRadius: 7,
      color: 'var(--ck-ink)', whiteSpace: 'pre-wrap', minHeight: 60,
    }}>
      {value}
    </div>
  );
}

// ─── Salary, ESIC & PF tab ─────────────────────────────────────────────────
function SalaryTab({ form, setForm, editing }: { form: Employee; setForm: (e: Employee) => void; editing: boolean }) {
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setForm({ ...form, [k]: v });
  // CTC in paise → rupees for display.
  const ctcRupees = Math.round(Number(form.ctc ?? 0) / 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Section
        title="Compensation Snapshot"
        right={
          <a href={`/compensations?employeeId=${form.id}`}
             style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-accent)', textDecoration: 'none' }}>
            View full compensation history →
          </a>
        }>
        <Grid2>
          <Field label="Current CTC (Snapshot)">
            <ReadOnly value={ctcRupees ? `₹ ${ctcRupees.toLocaleString('en-IN')}/year` : '—'} />
          </Field>
          <Field label="Form 16 / 26AS Attachment">
            <Input value={form.form16_url ?? ''} editing={editing} onChange={(v) => set('form16_url', v || null)} placeholder="https://…/form16.pdf" />
          </Field>
        </Grid2>
      </Section>

      <Section title="Bank Details">
        <Grid3>
          <Field label="Bank Name">
            <Input value={form.bank_name ?? ''} editing={editing} onChange={(v) => set('bank_name', v || null)} placeholder="HDFC Bank" />
          </Field>
          <Field label="Bank Branch">
            <Input value={form.bank_branch ?? ''} editing={editing} onChange={(v) => set('bank_branch', v || null)} placeholder="Ashram Road Branch" />
          </Field>
          <Field label="Account Type">
            <Select value={form.account_type ?? ''} editing={editing} onChange={(v) => set('account_type', v || null)}
              options={ACCOUNT_TYPES.map((a) => ({ value: a, label: a }))} allowEmpty />
          </Field>
          <Field label="Account Number">
            <Input value={form.bank_account ?? ''} editing={editing} onChange={(v) => set('bank_account', v || null)} placeholder="XXXXXX1234" />
          </Field>
          <Field label="IFSC Code">
            <Input value={form.ifsc ?? ''} editing={editing} onChange={(v) => set('ifsc', v || null)} placeholder="HDFC0001234" />
          </Field>
          <div />
        </Grid3>
      </Section>

      <Section title="Statutory">
        <Grid3>
          <Field label="PAN">
            <Input value={form.pan ?? ''} editing={editing} onChange={(v) => set('pan', v || null)} placeholder="ABCDE1234F" />
          </Field>
          <Field label="UAN Number">
            <Input value={form.uan ?? ''} editing={editing} onChange={(v) => set('uan', v || null)} placeholder="100200300400" />
          </Field>
          <Field label="Professional Tax State">
            <Select value={form.pt_state ?? ''} editing={editing} onChange={(v) => set('pt_state', v || null)}
              options={PT_STATES.map((s) => ({ value: s, label: s }))} allowEmpty />
          </Field>
        </Grid3>
        <Grid2>
          <CheckboxField label="PF Applicable" checked={!!form.pf_applicable} editing={editing}
            onChange={(b) => set('pf_applicable', b ? 1 : 0)} />
          {!!form.pf_applicable && (
            <Field label="PF Number">
              <Input value={form.pf ?? ''} editing={editing} onChange={(v) => set('pf', v || null)} placeholder="PF/XX/12345" />
            </Field>
          )}
          <CheckboxField label="ESI Applicable" checked={!!form.esi_applicable} editing={editing}
            onChange={(b) => set('esi_applicable', b ? 1 : 0)} />
          {!!form.esi_applicable && (
            <Field label="ESI Number">
              <Input value={form.esic ?? ''} editing={editing} onChange={(v) => set('esic', v || null)} placeholder="11000000000000" />
            </Field>
          )}
        </Grid2>
      </Section>
    </div>
  );
}

// ─── Attendance & Leaves tab ───────────────────────────────────────────────
function AttendanceLeavesTab({ form, setForm, editing, shifts, attendanceRules }: {
  form: Employee; setForm: (e: Employee) => void; editing: boolean;
  shifts: Array<{ id: string; code: string; name: string }>;
  attendanceRules: Array<{ id: string; name: string }>;
}) {
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setForm({ ...form, [k]: v });
  const sum = form.attendance_summary;
  const last = sum?.last_attendance;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Section title="Attendance Setup">
        <Grid3>
          <Field label="Shift Assigned (Default)">
            <Select value={form.default_shift_id ?? ''} editing={editing} onChange={(v) => set('default_shift_id', v || null)}
              options={shifts.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))} allowEmpty />
          </Field>
          <Field label="Attendance Rule">
            <Select value={form.attendance_rule_id ?? ''} editing={editing} onChange={(v) => set('attendance_rule_id', v || null)}
              options={attendanceRules.map((r) => ({ value: r.id, label: r.name }))} allowEmpty />
          </Field>
          <CheckboxField label="Biometric Mapped" checked={!!form.biometric_mapped} editing={editing}
            onChange={(b) => set('biometric_mapped', b ? 1 : 0)} />
        </Grid3>
        <Field label="Last Punch">
          <ReadOnly value={last
            ? `${formatDate(last.date)} — In ${last.in_at ? formatTime(last.in_at) : '—'} / Out ${last.out_at ? formatTime(last.out_at) : '—'} (${last.source}${last.is_late ? ', Late' : ''})`
            : 'No attendance recorded yet.'} />
        </Field>
      </Section>

      <Section title="Leave Entitlement & Balance"
        right={sum && sum.open_leave_requests > 0 ? (
          <span style={{ fontSize: 12, padding: '4px 10px', background: 'var(--ck-warning-bg, #FEF3C7)', color: 'var(--ck-warning-fg, #92400E)', borderRadius: 999, fontWeight: 600 }}>
            {sum.open_leave_requests} open request{sum.open_leave_requests === 1 ? '' : 's'}
          </span>
        ) : null}>
        <Grid2>
          <Field label="Annual Leave Entitlement (days/year)">
            {editing ? (
              <input type="number" min={0} value={form.annual_leave_entitlement ?? ''}
                onChange={(e) => set('annual_leave_entitlement', e.target.value === '' ? null : Number(e.target.value))}
                placeholder="24" style={inpStyle} />
            ) : (
              <ReadOnly value={form.annual_leave_entitlement != null ? `${form.annual_leave_entitlement} days` : '—'} />
            )}
          </Field>
          <div />
        </Grid2>
        {(!sum || sum.leave_by_type.length === 0) ? (
          <Muted>No leave balance set up for the current year yet.</Muted>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {sum.leave_by_type.map((b) => (
              <div key={b.type} style={{ padding: 12, border: '1px solid var(--ck-line)', borderRadius: 8, background: 'var(--ck-bg)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{b.type}</div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12.5 }}>
                  <Stat label="Opening" value={Number(b.opening).toFixed(1)} />
                  <Stat label="Taken"   value={Number(b.consumed).toFixed(1)} />
                  <Stat label="Balance" value={Number(b.closing).toFixed(1)} highlight />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Increment tab ─────────────────────────────────────────────────────────
function IncrementTab({ form, setForm, editing }: { form: Employee; setForm: (e: Employee) => void; editing: boolean }) {
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setForm({ ...form, [k]: v });
  const sum = form.increment_summary;
  const last = sum?.last;
  const lastFromPaise = (v: number | string | null | undefined) => {
    if (v == null) return '—';
    const r = Math.round(Number(v) / 100);
    return r ? `₹ ${r.toLocaleString('en-IN')}` : '—';
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Section
        title="Last Increment"
        right={sum && sum.pending_count > 0 ? (
          <span style={{ fontSize: 12, padding: '4px 10px', background: 'var(--ck-warning-bg, #FEF3C7)', color: 'var(--ck-warning-fg, #92400E)', borderRadius: 999, fontWeight: 600 }}>
            {sum.pending_count} pending request{sum.pending_count === 1 ? '' : 's'}
          </span>
        ) : null}>
        {!last ? (
          <Muted>No increment history yet.</Muted>
        ) : (
          <Grid3>
            <Field label="Last Increment Date"><ReadOnly value={formatDate(last.effective)} /></Field>
            <Field label="Hike %"><ReadOnly value={`${Number(last.hike_pct).toFixed(2)}%`} /></Field>
            <Field label="Rating"><ReadOnly value={last.rating || '—'} /></Field>
            <Field label="Previous CTC"><ReadOnly value={lastFromPaise(last.current_ctc)} /></Field>
            <Field label="New CTC"><ReadOnly value={lastFromPaise(last.proposed_ctc)} /></Field>
            <div />
          </Grid3>
        )}
      </Section>

      <Section title="Next Review">
        <Grid2>
          <Field label="Next Review Due">
            <DateInput value={form.next_review_due ?? ''} editing={editing} onChange={(v) => set('next_review_due', v || null)} />
          </Field>
          <div />
        </Grid2>
        <Field label="Increment Notes">
          {editing ? (
            <textarea value={form.increment_notes ?? ''} onChange={(e) => set('increment_notes', e.target.value || null)}
              placeholder="Performance-linked annual increment" rows={4}
              style={{ ...inpStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }} />
          ) : (
            <ReadOnlyBlock value={form.increment_notes || '—'} />
          )}
        </Field>
      </Section>
    </div>
  );
}

// ─── Ledger, Advances & Loans tab (read-only summary) ──────────────────────
function LedgerTab({ form }: { form: Employee }) {
  const sum = form.ledger_summary;
  const advPaise   = sum?.advances_outstanding ?? 0;
  const loansPaise = sum?.loans_outstanding ?? 0;
  const fmt = (paise: number) => paise ? `₹ ${Math.round(paise / 100).toLocaleString('en-IN')}` : '₹ 0';
  const lastAdv = sum?.last_advance;
  const lastPay = sum?.last_payment;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Section title="Outstanding">
        <Grid2>
          <Field label="Total Advances Outstanding"><ReadOnly value={fmt(advPaise)} /></Field>
          <Field label="Total Loans Outstanding"><ReadOnly value={fmt(loansPaise)} /></Field>
        </Grid2>
      </Section>

      <Section title="Recent Activity">
        <Grid2>
          <Field label="Last Advance Taken">
            <ReadOnly value={lastAdv
              ? `${formatDate(lastAdv.started_at)} — ${fmt(Number(lastAdv.principal))}`
              : '—'} />
          </Field>
          <Field label="Last Payroll Recovery / Payment">
            <ReadOnly value={lastPay
              ? `${formatDate(lastPay.paid_at)} — ${fmt(Number(lastPay.amount))} (${lastPay.kind})`
              : '—'} />
          </Field>
        </Grid2>
      </Section>

      <Section title="Open Finance Ledger" right={null}>
        <Muted>
          Detailed transaction history will move to the Finance module / Compensation Master in a later phase.
          Use the Loans &amp; Advances page in Employment for now.
        </Muted>
      </Section>
    </div>
  );
}

// ─── Other tab ─────────────────────────────────────────────────────────────
function OtherTab({ form, setForm, editing }: { form: Employee; setForm: (e: Employee) => void; editing: boolean }) {
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setForm({ ...form, [k]: v });
  const assetsCount = form.assets_summary?.count ?? 0;
  const lastAssetAt = form.assets_summary?.last_at ?? null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      <Section title="HR & Compliance">
        <Grid3>
          <CheckboxField label="NDA Signed" checked={!!form.nda_signed} editing={editing}
            onChange={(b) => set('nda_signed', b ? 1 : 0)} />
          <Field label="Background Verification">
            <Select value={form.background_verification ?? ''} editing={editing}
              onChange={(v) => set('background_verification', v || null)}
              options={BGV_STATUSES.map((s) => ({ value: s, label: s }))} allowEmpty />
          </Field>
          <CheckboxField label="Bond / Contract Signed" checked={!!form.bond_signed} editing={editing}
            onChange={(b) => set('bond_signed', b ? 1 : 0)} />
        </Grid3>
        <Field label="Policy Acknowledgement">
          <MultiCheck options={POLICIES} value={parseStringArray(form.policy_acknowledgements)} editing={editing}
            onChange={(v) => set('policy_acknowledgements', v)} />
        </Field>
      </Section>

      <Section title="Other Info">
        <Grid3>
          <Field label="LinkedIn">
            <Input value={form.linkedin_url ?? ''} editing={editing} onChange={(v) => set('linkedin_url', v || null)} placeholder="https://linkedin.com/in/…" />
          </Field>
          <Field label="Willing to Relocate">
            <Select value={form.willing_to_relocate ?? ''} editing={editing} onChange={(v) => set('willing_to_relocate', v || null)}
              options={YES_NO.map((o) => ({ value: o, label: o }))} allowEmpty />
          </Field>
          <Field label="Willing to Travel">
            <Select value={form.willing_to_travel ?? ''} editing={editing} onChange={(v) => set('willing_to_travel', v || null)}
              options={TRAVEL_OPTIONS.map((o) => ({ value: o, label: o }))} allowEmpty />
          </Field>
          <CheckboxField label="Driving License" checked={!!form.driving_license} editing={editing}
            onChange={(b) => set('driving_license', b ? 1 : 0)} />
          <div /><div />
        </Grid3>
        <Field label="Hobbies / Interests">
          {editing ? (
            <textarea value={form.hobbies ?? ''} onChange={(e) => set('hobbies', e.target.value || null)}
              rows={3} placeholder="Cricket, Cooking, Reading" style={{ ...inpStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }} />
          ) : (
            <ReadOnlyBlock value={form.hobbies || '—'} />
          )}
        </Field>
      </Section>

      <Section title="Health & Insurance">
        <Grid3>
          <Field label="Insurance Provider">
            <Input value={form.medical_insurance_provider ?? ''} editing={editing} onChange={(v) => set('medical_insurance_provider', v || null)} placeholder="Star Health" />
          </Field>
          <Field label="Policy Number">
            <Input value={form.medical_policy_number ?? ''} editing={editing} onChange={(v) => set('medical_policy_number', v || null)} placeholder="STH1234567" />
          </Field>
          <Field label="Nominee">
            <Input value={form.medical_nominee ?? ''} editing={editing} onChange={(v) => set('medical_nominee', v || null)} placeholder="Meena Patel (Wife)" />
          </Field>
        </Grid3>
        <Field label="Vaccination Status">
          <MultiCheck options={VACCINES} value={parseStringArray(form.vaccination_status)} editing={editing}
            onChange={(v) => set('vaccination_status', v)} />
        </Field>
      </Section>

      <Section title="Legal & Compliance">
        <Grid2>
          <Field label="Visa / Work Permit">
            <Input value={form.visa_work_permit ?? ''} editing={editing} onChange={(v) => set('visa_work_permit', v || null)} placeholder="N/A" />
          </Field>
          <div />
        </Grid2>
        <Field label="Court / Legal Case Declaration">
          {editing ? (
            <textarea value={form.legal_case_declaration ?? ''} onChange={(e) => set('legal_case_declaration', e.target.value || null)}
              rows={3} placeholder="None" style={{ ...inpStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }} />
          ) : (
            <ReadOnlyBlock value={form.legal_case_declaration || '—'} />
          )}
        </Field>
      </Section>

      <Section title="Company Assets">
        <Grid2>
          <Field label="Assets Currently Issued">
            <ReadOnly value={assetsCount === 0 ? 'None' : `${assetsCount} item${assetsCount === 1 ? '' : 's'} issued`} />
          </Field>
          <Field label="Last Asset Issue Date">
            <ReadOnly value={lastAssetAt ? formatDate(lastAssetAt) : '—'} />
          </Field>
        </Grid2>
      </Section>

      <Section title="Digital Signatures & Workflow">
        <Grid2>
          <Field label="Digital Signature ID">
            <Input value={form.digital_signature_id ?? ''} editing={editing} onChange={(v) => set('digital_signature_id', v || null)} placeholder="DSC-4567" />
          </Field>
          <Field label="e-Signature Image URL">
            <Input value={form.esignature_url ?? ''} editing={editing} onChange={(v) => set('esignature_url', v || null)} placeholder="https://…/esign.png" />
          </Field>
        </Grid2>
        <Field label="Workflow Approver Roles">
          <MultiCheck options={APPROVER_ROLES} value={parseStringArray(form.workflow_approver_roles)} editing={editing}
            onChange={(v) => set('workflow_approver_roles', v)} />
        </Field>
      </Section>

      <Section title="Career Preferences">
        <Grid3>
          <Field label="Preferred Career Path">
            <Input value={form.preferred_career_path ?? ''} editing={editing} onChange={(v) => set('preferred_career_path', v || null)} placeholder="Technical Lead" />
          </Field>
          <CheckboxField label="Open to Mentorship" checked={!!form.open_to_mentorship} editing={editing}
            onChange={(b) => set('open_to_mentorship', b ? 1 : 0)} />
          <div />
        </Grid3>
        <Field label="Training Interests">
          <MultiCheck options={['Lean Manufacturing', 'Leadership', 'Six Sigma', 'Project Management', 'Communication', 'Technical Skill Upgrade']}
            value={parseStringArray(form.training_interests)} editing={editing}
            onChange={(v) => set('training_interests', v)} />
        </Field>
        <Field label="Self-assessed Strengths">
          {editing ? (
            <textarea value={form.self_assessed_strengths ?? ''} onChange={(e) => set('self_assessed_strengths', e.target.value || null)}
              rows={3} placeholder="Team Leadership, Process Improvement" style={{ ...inpStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }} />
          ) : (
            <ReadOnlyBlock value={form.self_assessed_strengths || '—'} />
          )}
        </Field>
      </Section>
    </div>
  );
}

// ─── Small helpers used by the new tabs ────────────────────────────────────
function CheckboxField({ label, checked, editing, onChange }: { label: string; checked: boolean; editing: boolean; onChange: (b: boolean) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, padding: '8px 10px', background: 'var(--ck-bg)', borderRadius: 7, minHeight: 36 }}>
        <input type="checkbox" checked={checked} disabled={!editing} onChange={(e) => onChange(e.target.checked)} />
        {checked ? 'Yes' : 'No'}
      </label>
    </div>
  );
}

function MultiCheck({ options, value, editing, onChange }: {
  options: string[]; value: string[]; editing: boolean; onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };
  if (!editing) {
    return value.length === 0
      ? <ReadOnly value="—" />
      : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map((v) => (
            <span key={v} style={{ fontSize: 12, padding: '4px 10px', background: 'var(--ck-bg)', borderRadius: 999, fontWeight: 600, color: 'var(--ck-ink-soft)' }}>{v}</span>
          ))}
        </div>
      );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt) => {
        const on = value.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            style={{
              padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              background: on ? 'var(--ck-ink)' : 'transparent',
              color: on ? '#fff' : 'var(--ck-ink-soft)',
              border: `1px solid ${on ? 'var(--ck-ink)' : 'var(--ck-line)'}`,
            }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 10.5, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: highlight ? 'var(--ck-accent, #2563eb)' : 'var(--ck-ink)' }}>{value}</span>
    </div>
  );
}

function formatTime(s: string) {
  try { return new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); } catch { return s; }
}

// ─── Form primitives ───────────────────────────────────────────────────────
const inpStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--ck-line)',
  borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)', color: 'var(--ck-ink)',
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: 7,
  border: '1px solid var(--ck-line)', background: 'transparent', fontSize: 12.5, fontWeight: 600,
  color: 'var(--ck-ink-soft)', cursor: 'pointer',
};

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
        {right}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}
function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>;
}
function Grid3({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>{children}</div>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}{required && <span style={{ color: 'var(--ck-danger-fg)', marginLeft: 4 }}>*</span>}
      </span>
      {children}
    </label>
  );
}
function Input({ value, editing, onChange, placeholder }: { value: string; editing: boolean; onChange: (v: string) => void; placeholder?: string }) {
  if (!editing) return <ReadOnly value={value || '—'} />;
  return <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inpStyle} />;
}
function DateInput({ value, editing, onChange }: { value: string; editing: boolean; onChange: (v: string) => void }) {
  if (!editing) return <ReadOnly value={value ? formatDate(value) : '—'} />;
  return <input type="date" value={value?.slice(0, 10) ?? ''} onChange={(e) => onChange(e.target.value)} style={inpStyle} />;
}
function Select({ value, editing, onChange, options, allowEmpty }: {
  value: string; editing: boolean; onChange: (v: string) => void;
  options: { value: string; label: string }[]; allowEmpty?: boolean;
}) {
  if (!editing) {
    const match = options.find((o) => o.value === value);
    return <ReadOnly value={match?.label || '—'} />;
  }
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={inpStyle}>
      {allowEmpty && <option value="">— Select —</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function PhoneInput({ countryCode, number, editing, onCountryCode, onNumber }: {
  countryCode: string; number: string; editing: boolean;
  onCountryCode: (v: string) => void; onNumber: (v: string) => void;
}) {
  if (!editing) return <ReadOnly value={number ? `${countryCode} ${number}` : '—'} />;
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <select value={countryCode} onChange={(e) => onCountryCode(e.target.value)} style={{ ...inpStyle, width: 90 }}>
        {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input value={number ?? ''} onChange={(e) => onNumber(e.target.value)} placeholder="9XXXXXXXXX" style={inpStyle} />
    </div>
  );
}
function ReadOnly({ value }: { value: string }) {
  return <div style={{ fontSize: 13.5, padding: '8px 10px', background: 'var(--ck-bg)', borderRadius: 7, color: 'var(--ck-ink)', minHeight: 36, display: 'flex', alignItems: 'center' }}>{value}</div>;
}
function KV({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ck-ink)' }}>{children ?? value ?? '—'}</div>
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: 'var(--ck-muted)', fontStyle: 'italic' }}>{children}</div>;
}
function RowGrid({ cols, children }: { cols: string; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center' }}>{children}</div>;
}
function HeaderCell({ children }: { children?: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</div>;
}

// ─── Address block ─────────────────────────────────────────────────────────
function AddressBlock({ value, editing, onChange }: { value: Address; editing: boolean; onChange: (patch: Partial<Address>) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <Field label="Line 1"><Input value={value.line1 ?? ''} editing={editing} onChange={(v) => onChange({ line1: v })} /></Field>
      <Field label="Line 2"><Input value={value.line2 ?? ''} editing={editing} onChange={(v) => onChange({ line2: v })} /></Field>
      <Field label="City"><Input value={value.city ?? ''} editing={editing} onChange={(v) => onChange({ city: v })} /></Field>
      <Field label="State"><Input value={value.state ?? ''} editing={editing} onChange={(v) => onChange({ state: v })} /></Field>
      <Field label="Country"><Input value={value.country ?? ''} editing={editing} onChange={(v) => onChange({ country: v })} placeholder="India" /></Field>
      <Field label="PIN / ZIP"><Input value={value.pin ?? ''} editing={editing} onChange={(v) => onChange({ pin: v })} /></Field>
    </div>
  );
}

// ─── Emergency contact + dependent rows ────────────────────────────────────
function EmergencyRow({ value, editing, onChange, onDelete }: {
  value: EmergencyContact; editing: boolean;
  onChange: (v: EmergencyContact) => void; onDelete: () => void;
}) {
  return (
    <>
      <RowInput val={value.name} editing={editing} onChange={(v) => onChange({ ...value, name: v })} placeholder="Name" />
      <RowInput val={value.relation ?? ''} editing={editing} onChange={(v) => onChange({ ...value, relation: v })} placeholder="Wife / Father / …" />
      <RowPhone
        cc={value.phone_country_code ?? '+91'} num={value.phone ?? ''} editing={editing}
        onCc={(v) => onChange({ ...value, phone_country_code: v })}
        onNum={(v) => onChange({ ...value, phone: v })}
      />
      <RowInput val={value.address ?? ''} editing={editing} onChange={(v) => onChange({ ...value, address: v })} placeholder="Address" />
      {editing
        ? <IconAction icon={Trash2} label="Delete" hint="Remove this row" iconOnly tone="danger" onClick={onDelete} />
        : <span />}
    </>
  );
}
function DependentRow({ value, editing, onChange, onDelete }: {
  value: Dependent; editing: boolean;
  onChange: (v: Dependent) => void; onDelete: () => void;
}) {
  const age = useMemo(() => {
    if (!value.dob) return '';
    const d = new Date(value.dob); if (Number.isNaN(d.getTime())) return '';
    const now = new Date(); let a = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--;
    return String(a);
  }, [value.dob]);
  return (
    <>
      <RowInput val={value.relation} editing={editing} onChange={(v) => onChange({ ...value, relation: v })} placeholder="Son / Wife / …" />
      <RowInput val={value.name} editing={editing} onChange={(v) => onChange({ ...value, name: v })} placeholder="Name" />
      <RowPhone
        cc={value.phone_country_code ?? '+91'} num={value.phone ?? ''} editing={editing}
        onCc={(v) => onChange({ ...value, phone_country_code: v })}
        onNum={(v) => onChange({ ...value, phone: v })}
      />
      <RowInput val={value.email ?? ''} editing={editing} onChange={(v) => onChange({ ...value, email: v })} placeholder="email@example.com" />
      <RowDate val={value.dob ?? ''} editing={editing} onChange={(v) => onChange({ ...value, dob: v })} />
      <div style={{ fontSize: 13, color: 'var(--ck-ink-soft)' }}>{age || '—'}</div>
      {editing
        ? <IconAction icon={Trash2} label="Delete" hint="Remove this row" iconOnly tone="danger" onClick={onDelete} />
        : <span />}
    </>
  );
}
function RowInput({ val, editing, onChange, placeholder }: { val: string; editing: boolean; onChange: (v: string) => void; placeholder?: string }) {
  if (!editing) return <div style={{ fontSize: 13 }}>{val || '—'}</div>;
  return <input value={val ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inpStyle} />;
}
function RowDate({ val, editing, onChange }: { val: string; editing: boolean; onChange: (v: string) => void }) {
  if (!editing) return <div style={{ fontSize: 13 }}>{val ? formatDate(val) : '—'}</div>;
  return <input type="date" value={val?.slice(0, 10) ?? ''} onChange={(e) => onChange(e.target.value)} style={inpStyle} />;
}
function RowPhone({ cc, num, editing, onCc, onNum }: { cc: string; num: string; editing: boolean; onCc: (v: string) => void; onNum: (v: string) => void }) {
  if (!editing) return <div style={{ fontSize: 13 }}>{num ? `${cc} ${num}` : '—'}</div>;
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <select value={cc} onChange={(e) => onCc(e.target.value)} style={{ ...inpStyle, width: 80 }}>
        {COUNTRY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input value={num} onChange={(e) => onNum(e.target.value)} placeholder="9XXXXXXXXX" style={inpStyle} />
    </div>
  );
}
function formatDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return s; }
}
