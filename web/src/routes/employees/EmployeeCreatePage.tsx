// Employee Master — direct add (bypasses the hiring flow).
//
// Brings existing staff onto the system in one form, mirroring the legacy
// EK Payroll "General Info" screen while mapping onto our current employee
// schema. The salary block is captured MONTHLY (legacy familiarity) and, on
// save, the server stores it as a linked "Joining" compensation (annualised).
// After creation we hand off to the full 8-tab detail page for the long tail
// (documents, experience, etc.).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';

type Company = { id: string; name: string };
type Branch = { id: string; name: string; company_id: string | null };
type Named = { id: string; name: string };
type Designation = { id: string; name: string };
type Grade = { id: string; code: string; kind: string };
type Shift = { id: string; code: string; name: string };
type LookupOpt = { code: string; label: string };

const EMPLOYMENT_TYPES = ['Permanent', 'Contract', 'Probation', 'Temporary', 'Intern'];
const WORK_MODES = ['On-site', 'Remote', 'Hybrid'];
const PAY_MODES = ['Cash', 'Cheque', 'Bank Transfer', 'UPI'];
const WAGE_BASES = ['Monthly', 'Daily', 'Hourly'];
const ACCOUNT_TYPES = ['Savings', 'Current'];
const STATUSES = ['ACTIVE', 'PROBATION', 'ON_LEAVE'];

const emptySalary = {
  grossMonthly: '', basicMonthly: '', hraMonthly: '', taMonthly: '',
  medicalMonthly: '', specialAllowanceMonthly: '', phoneAllowanceMonthly: '',
  pfApplicable: false, esiApplicable: false, tdsApplicable: false,
  effectiveFrom: '',
};

export function EmployeeCreatePage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Named[]>([]);
  const [divisions, setDivisions] = useState<Named[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [genders, setGenders] = useState<LookupOpt[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<LookupOpt[]>([]);
  const [bloodGroups, setBloodGroups] = useState<LookupOpt[]>([]);

  const [f, setF] = useState({
    firstName: '', middleName: '', lastName: '', displayName: '',
    gender: '', dob: '', maritalStatus: '', bloodGroup: '',
    companyId: '', branchId: '', divisionId: '', departmentId: '', designation: '',
    employmentType: 'Permanent', workMode: 'On-site', defaultShiftId: '',
    payMode: 'Bank Transfer', wageBasis: 'Monthly', gradeId: '',
    joiningDate: '', status: 'ACTIVE',
    email: '', phone: '', personalEmail: '', alternatePhone: '',
    pan: '', aadhaar: '', pf: '', esic: '', uan: '', ptState: '',
    bankName: '', bankBranch: '', accountType: '', bankAccount: '', ifsc: '',
  });
  const [salary, setSalary] = useState({ ...emptySalary });

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const setS = <K extends keyof typeof salary>(k: K, v: (typeof salary)[K]) => setSalary((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([
      api.get<{ data: Company[] }>('/hiring/companies', { params: { pageSize: 1000 } }),
      api.get<{ data: Branch[] }>('/branches'),
      api.get<{ data: Named[] }>('/departments'),
      api.get<{ data: Named[] }>('/divisions'),
      api.get<{ data: Designation[] }>('/designations'),
      api.get<{ data: Grade[] }>('/salary-grades'),
      api.get<{ data: Shift[] }>('/shifts', { params: { pageSize: 1000 } }),
      api.get<{ data: LookupOpt[] }>('/lookups', { params: { category: 'gender' } }),
      api.get<{ data: LookupOpt[] }>('/lookups', { params: { category: 'marital_status' } }),
      api.get<{ data: LookupOpt[] }>('/lookups', { params: { category: 'blood_group' } }),
    ]).then(([c, b, d, dv, des, g, s, gn, ms, bg]) => {
      setCompanies(c.data.data ?? []);
      setBranches(b.data.data ?? []);
      setDepartments(d.data.data ?? []);
      setDivisions(dv.data.data ?? []);
      setDesignations(des.data.data ?? []);
      setGrades(g.data.data ?? []);
      setShifts(s.data.data ?? []);
      setGenders(gn.data.data ?? []);
      setMaritalStatuses(ms.data.data ?? []);
      setBloodGroups(bg.data.data ?? []);
    }).catch(() => toast.error('Failed to load reference data.'));
  }, []);

  // Company narrows the branch list (a branch belongs to one company).
  const visibleBranches = useMemo(
    () => (f.companyId ? branches.filter((b) => b.company_id === f.companyId) : branches),
    [branches, f.companyId],
  );

  const gross = Number(salary.grossMonthly) || 0;
  const annualCtc = gross * 12;

  async function submit() {
    if (!f.firstName.trim() || !f.lastName.trim() || !f.email.trim() || !f.phone.trim()
      || !f.designation || !f.branchId || !f.departmentId) {
      toast.error('Fill the required fields: name, email, phone, designation, branch, department.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: f.firstName.trim(),
        middleName: f.middleName.trim() || undefined,
        lastName: f.lastName.trim(),
        displayName: f.displayName.trim() || undefined,
        gender: f.gender || undefined,
        dob: f.dob || undefined,
        maritalStatus: f.maritalStatus || undefined,
        bloodGroup: f.bloodGroup || undefined,
        email: f.email.trim(),
        phone: f.phone.trim(),
        personalEmail: f.personalEmail.trim() || undefined,
        alternatePhone: f.alternatePhone.trim() || undefined,
        designation: f.designation,
        companyId: f.companyId || undefined,
        branchId: f.branchId,
        divisionId: f.divisionId || undefined,
        departmentId: f.departmentId,
        gradeId: f.gradeId || undefined,
        employmentType: f.employmentType || undefined,
        workMode: f.workMode || undefined,
        defaultShiftId: f.defaultShiftId || undefined,
        payMode: f.payMode || undefined,
        wageBasis: f.wageBasis || undefined,
        joiningDate: f.joiningDate || undefined,
        status: f.status,
        pan: f.pan.trim() || undefined,
        aadhaar: f.aadhaar.trim() || undefined,
        pf: f.pf.trim() || undefined,
        esic: f.esic.trim() || undefined,
        uan: f.uan.trim() || undefined,
        ptState: f.ptState.trim() || undefined,
        bankName: f.bankName.trim() || undefined,
        bankBranch: f.bankBranch.trim() || undefined,
        accountType: f.accountType || undefined,
        bankAccount: f.bankAccount.trim() || undefined,
        ifsc: f.ifsc.trim() || undefined,
      };
      if (gross > 0) {
        payload.salary = {
          grossMonthly: gross,
          basicMonthly: salary.basicMonthly || undefined,
          hraMonthly: salary.hraMonthly || undefined,
          taMonthly: salary.taMonthly || undefined,
          medicalMonthly: salary.medicalMonthly || undefined,
          specialAllowanceMonthly: salary.specialAllowanceMonthly || undefined,
          phoneAllowanceMonthly: salary.phoneAllowanceMonthly || undefined,
          pfApplicable: salary.pfApplicable,
          esiApplicable: salary.esiApplicable,
          effectiveFrom: salary.effectiveFrom || f.joiningDate || undefined,
        };
        payload.pfApplicable = salary.pfApplicable;
        payload.esiApplicable = salary.esiApplicable;
        payload.tdsApplicable = salary.tdsApplicable;
      }
      const r = await api.post<{ data: { id: string; code: string } }>('/employees', payload);
      toast.success(`Employee ${r.data.data.code} created.`);
      navigate(`/employees/${r.data.data.id}?mode=edit`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || 'Failed to create employee.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Add New Employee"
        subtitle="Direct entry into the Employee Master. Salary is captured monthly and stored as a linked Joining compensation."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => navigate('/employees')}>
              <ArrowLeft size={15} style={{ marginRight: 6 }} /> Back
            </Button>
            <Button variant="primary" size="sm" disabled={saving} onClick={submit}>
              <Save size={15} style={{ marginRight: 6 }} /> {saving ? 'Saving…' : 'Save Employee'}
            </Button>
          </div>
        }
      />

      <Section title="Identity">
        <Field label="Employee Code"><ReadOnly>Auto-generated (CK-EMP-####)</ReadOnly></Field>
        <Field label="First Name *"><Input value={f.firstName} onChange={(v) => set('firstName', v)} /></Field>
        <Field label="Middle Name"><Input value={f.middleName} onChange={(v) => set('middleName', v)} /></Field>
        <Field label="Last Name *"><Input value={f.lastName} onChange={(v) => set('lastName', v)} /></Field>
        <Field label="Display Name"><Input value={f.displayName} onChange={(v) => set('displayName', v)} placeholder="Shown across the app" /></Field>
        <Field label="Gender">
          <Select value={f.gender} onChange={(v) => set('gender', v)} placeholder="Select">
            {genders.map((o) => <option key={o.code} value={o.label}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Date of Birth"><Input type="date" value={f.dob} onChange={(v) => set('dob', v)} /></Field>
        <Field label="Marital Status">
          <Select value={f.maritalStatus} onChange={(v) => set('maritalStatus', v)} placeholder="Select">
            {maritalStatuses.map((o) => <option key={o.code} value={o.label}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Blood Group">
          <Select value={f.bloodGroup} onChange={(v) => set('bloodGroup', v)} placeholder="Select">
            {bloodGroups.map((o) => <option key={o.code} value={o.label}>{o.label}</option>)}
          </Select>
        </Field>
      </Section>

      <Section title="Organization & Employment">
        <Field label="Category / Company">
          <Select value={f.companyId} onChange={(v) => { set('companyId', v); set('branchId', ''); }} placeholder="Select company">
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Branch *">
          <Select value={f.branchId} onChange={(v) => set('branchId', v)} placeholder="Select branch">
            {visibleBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Division">
          <Select value={f.divisionId} onChange={(v) => set('divisionId', v)} placeholder="Select division">
            {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Department *">
          <Select value={f.departmentId} onChange={(v) => set('departmentId', v)} placeholder="Select department">
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Designation *">
          <Select value={f.designation} onChange={(v) => set('designation', v)} placeholder="Select designation">
            {designations.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Employment Type">
          <Select value={f.employmentType} onChange={(v) => set('employmentType', v)}>
            {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Work Mode">
          <Select value={f.workMode} onChange={(v) => set('workMode', v)}>
            {WORK_MODES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Duty Shift">
          <Select value={f.defaultShiftId} onChange={(v) => set('defaultShiftId', v)} placeholder="Select shift">
            {shifts.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </Select>
        </Field>
        <Field label="Pay Mode">
          <Select value={f.payMode} onChange={(v) => set('payMode', v)}>
            {PAY_MODES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Wage Basis">
          <Select value={f.wageBasis} onChange={(v) => set('wageBasis', v)}>
            {WAGE_BASES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Salary Grade">
          <Select value={f.gradeId} onChange={(v) => set('gradeId', v)} placeholder="Select grade">
            {grades.map((g) => <option key={g.id} value={g.id}>{g.code} ({g.kind})</option>)}
          </Select>
        </Field>
        <Field label="Date of Joining"><Input type="date" value={f.joiningDate} onChange={(v) => set('joiningDate', v)} /></Field>
        <Field label="Status">
          <Select value={f.status} onChange={(v) => set('status', v)}>
            {STATUSES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="Official Email *"><Input type="email" value={f.email} onChange={(v) => set('email', v)} /></Field>
        <Field label="Mobile No *"><Input value={f.phone} onChange={(v) => set('phone', v)} /></Field>
        <Field label="Personal Email"><Input type="email" value={f.personalEmail} onChange={(v) => set('personalEmail', v)} /></Field>
        <Field label="Alternate Phone"><Input value={f.alternatePhone} onChange={(v) => set('alternatePhone', v)} /></Field>
      </Section>

      <Section
        title="Salary (Monthly)"
        note={gross > 0 ? `Annual CTC ₹ ${annualCtc.toLocaleString('en-IN')} · stored as a Joining compensation` : 'Leave blank to set salary later from the Compensation module'}
      >
        <Field label="Gross Salary / month"><Rupees value={salary.grossMonthly} onChange={(v) => setS('grossMonthly', v)} /></Field>
        <Field label="Basic"><Rupees value={salary.basicMonthly} onChange={(v) => setS('basicMonthly', v)} /></Field>
        <Field label="HRA"><Rupees value={salary.hraMonthly} onChange={(v) => setS('hraMonthly', v)} /></Field>
        <Field label="TA / Conveyance"><Rupees value={salary.taMonthly} onChange={(v) => setS('taMonthly', v)} /></Field>
        <Field label="Medical Allowance"><Rupees value={salary.medicalMonthly} onChange={(v) => setS('medicalMonthly', v)} /></Field>
        <Field label="Special Allowance"><Rupees value={salary.specialAllowanceMonthly} onChange={(v) => setS('specialAllowanceMonthly', v)} /></Field>
        <Field label="Phone Allowance"><Rupees value={salary.phoneAllowanceMonthly} onChange={(v) => setS('phoneAllowanceMonthly', v)} /></Field>
        <Field label="Deductions">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', height: 36 }}>
            <Check label="EPF" checked={salary.pfApplicable} onChange={(v) => setS('pfApplicable', v)} />
            <Check label="ESIC" checked={salary.esiApplicable} onChange={(v) => setS('esiApplicable', v)} />
            <Check label="TDS" checked={salary.tdsApplicable} onChange={(v) => setS('tdsApplicable', v)} />
          </div>
        </Field>
        <Field label="Effective From"><Input type="date" value={salary.effectiveFrom} onChange={(v) => setS('effectiveFrom', v)} /></Field>
      </Section>

      <Section title="Statutory & Bank">
        <Field label="PAN"><Input value={f.pan} onChange={(v) => set('pan', v)} /></Field>
        <Field label="Aadhaar"><Input value={f.aadhaar} onChange={(v) => set('aadhaar', v)} /></Field>
        <Field label="PF No"><Input value={f.pf} onChange={(v) => set('pf', v)} /></Field>
        <Field label="ESIC No"><Input value={f.esic} onChange={(v) => set('esic', v)} /></Field>
        <Field label="UAN"><Input value={f.uan} onChange={(v) => set('uan', v)} /></Field>
        <Field label="PT State"><Input value={f.ptState} onChange={(v) => set('ptState', v)} /></Field>
        <Field label="Bank Name"><Input value={f.bankName} onChange={(v) => set('bankName', v)} /></Field>
        <Field label="Bank Branch"><Input value={f.bankBranch} onChange={(v) => set('bankBranch', v)} /></Field>
        <Field label="Account Type">
          <Select value={f.accountType} onChange={(v) => set('accountType', v)} placeholder="Select">
            {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Account No"><Input value={f.bankAccount} onChange={(v) => set('bankAccount', v)} /></Field>
        <Field label="IFSC"><Input value={f.ifsc} onChange={(v) => set('ifsc', v)} /></Field>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="secondary" onClick={() => navigate('/employees')}>Cancel</Button>
        <Button variant="primary" disabled={saving} onClick={submit}>
          <Save size={15} style={{ marginRight: 6 }} /> {saving ? 'Saving…' : 'Save Employee'}
        </Button>
      </div>
    </div>
  );
}

// ── Presentational helpers (inline-style pattern, matching ui/ primitives) ──

const inp: React.CSSProperties = {
  height: 36, width: '100%', padding: '0 10px', border: '1px solid var(--ck-line)',
  borderRadius: 7, background: 'var(--ck-surface)', fontSize: 13, color: 'var(--ck-ink)',
};

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Card padding={0} style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--ck-line)' }}>
        <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--ck-ink)' }}>{title}</h2>
        {note && <span style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{note}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(200px, 1fr))', gap: 14, padding: 16 }}>
        {children}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, type = 'text', placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={inp} />;
}

function Rupees({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 10, top: 9, fontSize: 13, color: 'var(--ck-muted)' }}>₹</span>
      <input type="number" min={0} value={value} placeholder="0" onChange={(e) => onChange(e.target.value)}
        style={{ ...inp, paddingLeft: 22 }} />
    </div>
  );
}

function Select({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder?: string; children: ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ ...inp, color: value ? 'var(--ck-ink)' : 'var(--ck-muted)' }}>
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ck-ink)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function ReadOnly({ children }: { children: ReactNode }) {
  return <div style={{ ...inp, display: 'flex', alignItems: 'center', color: 'var(--ck-muted)', background: 'var(--ck-bg)' }}>{children}</div>;
}
