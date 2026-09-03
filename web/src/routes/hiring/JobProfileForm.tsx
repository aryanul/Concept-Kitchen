import { useState, useEffect, type ReactNode } from 'react';
import {
  FileText, ListChecks, Target, LayoutGrid, BookOpen,
  TrendingUp, CheckSquare, Users, UserSearch, ClipboardList,
  Plus, X, ChevronLeft, Eye, Pencil, Lock,
  Presentation as PresentationIcon, MapPin,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { IconAction } from '../../components/ui/IconAction';
import { Combobox } from '../../components/ui/Combobox';
import { LocationApplicableEditor, type JpLocation } from '../../components/hiring/jp/LocationApplicableEditor';
import { WorkShiftsEditor } from '../../components/hiring/jp/WorkShiftsEditor';
import { SkillPickerModal } from '../../components/hiring/jp/SkillPickerModal';
import { TrainingModulePickerModal } from '../../components/hiring/jp/TrainingModulePickerModal';
import { AtmTaskPickerModal } from '../../components/hiring/jp/AtmTaskPickerModal';
import { NestConnectImportModal } from '../../components/hiring/jp/NestConnectImportModal';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Dept = { id: string; name: string };
type Division = { id: string; code: string | null; name: string; department_id: string | null };
type DesignationOpt = { id: string; code: string | null; name: string; department_id: string | null; division_id: string | null };

export interface StepData {
  // Step 1
  jobTitle: string; alternateTitle: string;
  designationId: string;       // FK to designations master — source of truth for dept/div/desig
  departmentId: string;        // Mirrored from designation (read-only in UI)
  division: string;            // Mirrored from designation (read-only in UI)
  designation: string;         // Mirrored from designation (read-only in UI)
  locations: JpLocation[];     // Replaces single locationApplicable string
  reportingDept: string; reportingDivision: string; reportingDesignation: string;
  workShifts: string[];        // Replaces single workShift string
  // Step 2 — Role (Designation master) / Team (Division master) names; Key Focus picked from Skill Master
  shortDescRole: string; shortDescTeam: string; shortDescFocus: string[];
  // Picked from the Skill Master (stored as skill names) — Department Functions / Tools & Software / Cross-Department Interaction
  detailedResponsibilities: string[]; detailedTools: string[]; detailedCollaboration: string[];
  jobPurposeObjective: string; jobPurposeImpact: string;
  contributionToOrg: string;
  // Step 3
  minExperience: string; preferredExperience: string; skills: string[];
  // Step 4
  challenges: string[];
  // Step 5 — each row pulls from a specific Skill Master category
  deptAlignments: { label: string; category: string; selections: string[] }[];
  // Step 6 — references to training_modules master rows
  trainingModules: { id: string; name: string; description: string; chapters: number }[];
  // Step 7 / 8 — Induction & Onboarding template ids (auto-populate onboarding)
  inductionTemplateId: string;
  onboardingTemplateId: string;
  // Step 9 — Career Path: hierarchy references (IDs into designations master)
  careerParentDesignationId: string;       // Where this role sits below
  careerNextPromotionDesignationId: string; // Standard promotion path
  careerLateralDesignationIds: string[];   // Possible lateral moves
  // Step 8 — references to atm_task_catalogue rows
  atmTasks: { id: string; task: string; description: string }[];
  // Step 9 — read-only from DB
  // Step 10
  prospects: { name: string; email: string; platform: string; experience: string; role: string; company: string }[];
  // Step 11 — IDs into interview_templates master
  interviewTemplateIds: string[];
}

const DEFAULT_STEP_DATA: StepData = {
  jobTitle: '', alternateTitle: '',
  designationId: '', departmentId: '', division: '', designation: '',
  locations: [],
  reportingDept: '', reportingDivision: '', reportingDesignation: '',
  workShifts: [],
  shortDescRole: '', shortDescTeam: '', shortDescFocus: [],
  detailedResponsibilities: [], detailedTools: [], detailedCollaboration: [],
  jobPurposeObjective: '', jobPurposeImpact: '',
  contributionToOrg: '',
  minExperience: '', preferredExperience: '', skills: [],
  challenges: [],
  deptAlignments: [
    { label: 'Department Functions',          category: 'Department Functions',          selections: [] },
    { label: 'Documents Used',                category: 'Documents',                     selections: [] },
    { label: 'Tools & Software Used',         category: 'Tools & Software',              selections: [] },
    { label: 'Cross-Department Interaction',  category: 'Cross-Department Interaction',  selections: [] },
  ],
  trainingModules: [],
  inductionTemplateId: '',
  onboardingTemplateId: '',
  careerParentDesignationId: '',
  careerNextPromotionDesignationId: '',
  careerLateralDesignationIds: [],
  atmTasks: [],
  prospects: [],
  interviewTemplateIds: [],
};

// Coerce a value that may be a legacy comma-separated string OR an array into a clean string[].
function toNameArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim());
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

// Hydrate saved form_data, upgrading the three Step-2 fields from their legacy
// free-text string form to the chip array the Skill Master pickers expect.
function normalizeStepData(p?: Partial<StepData>): Partial<StepData> {
  if (!p) return {};
  return {
    ...p,
    shortDescFocus: toNameArray(p.shortDescFocus),
    detailedResponsibilities: toNameArray(p.detailedResponsibilities),
    detailedTools: toNameArray(p.detailedTools),
    detailedCollaboration: toNameArray(p.detailedCollaboration),
  };
}

const STEPS = [
  { num: 1,  label: 'Basic Job Information',       Icon: FileText },
  { num: 2,  label: 'Job Description',             Icon: FileText },
  { num: 3,  label: 'Job Requirement',             Icon: ListChecks },
  { num: 4,  label: 'Job Challenges & Performance', Icon: Target },
  { num: 5,  label: 'Department Alignments',       Icon: LayoutGrid },
  { num: 6,  label: 'Training',                    Icon: BookOpen },
  { num: 7,  label: 'Induction',                   Icon: PresentationIcon },
  { num: 8,  label: 'Onboarding',                  Icon: MapPin },
  { num: 9,  label: 'Career Path',                 Icon: TrendingUp },
  { num: 10, label: 'ATM (Auto Task Manager)',     Icon: CheckSquare },
  { num: 11, label: 'Employees & Alumni',          Icon: Users },
  { num: 12, label: 'Prospets',                    Icon: UserSearch },
  { num: 13, label: 'Interview Templates',         Icon: ClipboardList },
];

const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

// Sections 9–11 are read-only DB lists, so JP completeness only considers the user-editable steps 1–8.
//
// Returns the completion ratio alongside the label: the list view shows "Partially
// Done · 60%" so reviewers can tell a barely-started profile from a nearly-finished
// one at a glance. `pct` is rounded to a whole number in 0–100.
type JpCompletion = { status: 'Pending' | 'Partially Done' | 'Done'; pct: number };

function computeJpCompletion(d: StepData): JpCompletion {
  const filled = (s: string) => s.trim().length > 0;
  const checks: boolean[] = [
    // Step 1 — basic info
    filled(d.jobTitle), filled(d.alternateTitle), filled(d.departmentId),
    filled(d.division), filled(d.designation), d.locations.length > 0,
    filled(d.reportingDept), filled(d.reportingDivision), filled(d.reportingDesignation),
    d.workShifts.length > 0,
    // Step 2 — description
    filled(d.shortDescRole), filled(d.shortDescTeam), d.shortDescFocus.length > 0,
    d.detailedResponsibilities.length > 0, d.detailedTools.length > 0, d.detailedCollaboration.length > 0,
    filled(d.jobPurposeObjective), filled(d.jobPurposeImpact),
    filled(d.contributionToOrg),
    // Step 3 — requirements
    filled(d.minExperience), filled(d.preferredExperience), d.skills.length > 0,
    // Step 4 — challenges
    d.challenges.length > 0,
    // Step 5 — every alignment row has at least one selection
    d.deptAlignments.every((r) => (r.selections ?? []).length > 0),
    // Step 6 — at least one training module
    d.trainingModules.length > 0,
    // Step 7 — career path: at least parent + next-promotion filled
    filled(d.careerParentDesignationId),
    filled(d.careerNextPromotionDesignationId),
    d.careerLateralDesignationIds.length > 0,
    // Step 8 — at least one ATM task
    d.atmTasks.length > 0,
  ];
  const filledCount = checks.filter(Boolean).length;
  const pct = checks.length === 0 ? 0 : Math.round((filledCount / checks.length) * 100);
  if (filledCount === 0) return { status: 'Pending', pct: 0 };
  if (filledCount === checks.length) return { status: 'Done', pct: 100 };
  // Guard the edges so a profile with one field left never reads as a flat "100%",
  // and one with a single field filled never reads as "0%" — both would contradict
  // the "Partially Done" label sitting next to the number.
  return { status: 'Partially Done', pct: Math.min(99, Math.max(1, pct)) };
}

// ─── Main form component ───────────────────────────────────────────────────────
export function JobProfileForm({
  editId,
  initialData,
  depts,
  onSaved,
  onCancel,
}: {
  editId: string | null;
  initialData?: Partial<StepData>;
  depts: Dept[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [activeStep, setActiveStep] = useState(1);
  const [data, setData] = useState<StepData>({ ...DEFAULT_STEP_DATA, ...normalizeStepData(initialData) });
  const [saving, setSaving] = useState(false);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [allDesignations, setAllDesignations] = useState<DesignationOpt[]>([]);

  const upd = (patch: Partial<StepData>) => setData((d) => ({ ...d, ...patch }));

  useEffect(() => {
    setData({ ...DEFAULT_STEP_DATA, ...normalizeStepData(initialData) });
    setActiveStep(1);
  }, [editId, initialData]);

  const saveProfile = async () => {
    if (!data.designationId && !data.designation && !data.jobTitle) {
      toast.error('Pick a designation from the master before saving');
      return;
    }
    setSaving(true);
    try {
      const completion = computeJpCompletion(data);
      const payload = {
        title: data.jobTitle || data.designation,
        alternateTitle: data.alternateTitle || undefined,
        designationId: data.designationId || undefined,
        // dept/div/desig are derived server-side from designationId; sent as fallback for legacy rows
        departmentId: data.departmentId || undefined,
        division: data.division || undefined,
        designation: data.designation || undefined,
        reportingDeptId: data.reportingDept || undefined,
        reportingDivision: data.reportingDivision || undefined,
        reportingDesignation: data.reportingDesignation || undefined,
        jpStatus: completion.status,
        jpCompletionPct: completion.pct,
        formData: data,
        locations: data.locations.map((l) => ({
          branchId: l.branchId,
          locationId: l.locationId,
          positions: l.positions,
        })),
        shifts: data.workShifts,
        interviewTemplateIds: data.interviewTemplateIds,
      };
      if (editId) {
        await api.patch(`/job-profiles/${editId}`, payload);
        toast.success('Job profile updated');
      } else {
        await api.post('/job-profiles', payload);
        toast.success('Job profile created');
      }
      onSaved();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    api.get<{ data: Division[] }>('/divisions').then((r) => setDivisions(r.data.data)).catch(() => {});
    api.get<{ data: DesignationOpt[] }>('/designations').then((r) => setAllDesignations(r.data.data)).catch(() => {});
  }, []);

  // Prefill Job Title from the linked Designation when it's still blank (editable thereafter).
  useEffect(() => {
    if (data.designation && !data.jobTitle.trim()) upd({ jobTitle: data.designation });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.designation]);

  // Step 2's Role and Team restate what Step 1 already knows — the designation
  // and the division. Making the user retype them was busywork and let the two
  // steps disagree, so carry them across. Only fills blanks: anything the user
  // has typed is left alone.
  useEffect(() => {
    const patch: Partial<StepData> = {};
    if (data.designation && !data.shortDescRole.trim()) patch.shortDescRole = data.designation;
    if (data.division && !data.shortDescTeam.trim()) patch.shortDescTeam = data.division;
    if (Object.keys(patch).length) upd(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.designation, data.division]);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 600 }}>
      {/* Left nav */}
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--ck-line)', background: 'var(--ck-bg)', overflowY: 'auto' }}>
        <div style={{ padding: '14px 16px 8px', fontSize: 11, fontWeight: 700, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Form Sections
        </div>
        {STEPS.map((s) => (
          <div key={s.num} onClick={() => setActiveStep(s.num)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer',
              background: activeStep === s.num ? '#fff' : 'transparent',
              borderLeft: activeStep === s.num ? '3px solid #222' : '3px solid transparent',
              transition: 'background 100ms',
            }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: activeStep === s.num ? '#222' : 'var(--ck-line-soft)',
              color: activeStep === s.num ? '#fff' : 'var(--ck-muted)',
            }}>
              <s.Icon size={15} strokeWidth={1.8} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: activeStep === s.num ? 700 : 500, color: activeStep === s.num ? 'var(--ck-ink)' : 'var(--ck-ink-soft)', lineHeight: 1.3 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ck-faint)' }}>Step {s.num}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Right content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Step toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--ck-line)', flexShrink: 0 }}>
          <button onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)', fontSize: 13 }}>
            <ChevronLeft size={16} /> Back to Directory
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {activeStep > 1 && <Button size="sm" onClick={() => setActiveStep((s) => s - 1)}>← Prev</Button>}
            {activeStep < 13 && <Button size="sm" variant="primary" onClick={() => setActiveStep((s) => s + 1)}>Next →</Button>}
            <Button size="sm" variant="primary" disabled={saving} onClick={saveProfile}>{saving ? 'Saving…' : 'Save Profile'}</Button>
          </div>
        </div>

        {/* Step content */}
        <div style={{ padding: 24, flex: 1 }}>
          {activeStep === 1 && <Step1 data={data} upd={upd} depts={depts} divisions={divisions} allDesignations={allDesignations} />}
          {activeStep === 2 && <Step2 data={data} upd={upd} divisions={divisions} allDesignations={allDesignations} />}
          {activeStep === 3 && <Step3 data={data} upd={upd} />}
          {activeStep === 4 && <Step4 data={data} upd={upd} />}
          {activeStep === 5 && <Step5 data={data} upd={upd} />}
          {activeStep === 6 && <Step6 data={data} upd={upd} />}
          {activeStep === 7 && <StepInduction data={data} upd={upd} />}
          {activeStep === 8 && <StepOnboarding data={data} upd={upd} />}
          {activeStep === 9 && <Step7 data={data} upd={upd} depts={depts} divisions={divisions} allDesignations={allDesignations} />}
          {activeStep === 10 && <Step8 data={data} upd={upd} />}
          {activeStep === 11 && <Step9 editId={editId} />}
          {activeStep === 12 && <Step10 data={data} upd={upd} />}
          {activeStep === 13 && <Step11 data={data} upd={upd} />}
        </div>
      </div>
    </div>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 14 }}>{children}</div>;
}
function DescTable({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 20 }}>
      <thead>
        <tr style={{ background: 'var(--ck-bg)' }}>
          <th style={{ padding: '8px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', width: '30%', border: '1px solid var(--ck-line)' }}>Sub Heading</th>
          <th style={{ padding: '8px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', border: '1px solid var(--ck-line)' }}>Description Details</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, content]) => (
          <tr key={label}>
            <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--ck-ink)', border: '1px solid var(--ck-line)', verticalAlign: 'top' }}>{label}</td>
            <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', color: 'var(--ck-ink-soft)', verticalAlign: 'top' }}>{content}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function FG({ label, children, full, span }: { label: string; children: ReactNode; full?: boolean; span?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: full ? '1 / -1' : span ? 'span 1' : 'auto' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ck-ink-soft)' }}>
        {label.replace('*', '')} {label.includes('*') && <span style={{ color: 'var(--ck-danger-fg)' }}>*</span>}
      </span>
      {children}
    </label>
  );
}

// ─── Step 1 — Basic Job Information ───────────────────────────────────────────
function Step1({
  data,
  upd,
  depts,
  divisions,
  allDesignations,
}: {
  data: StepData;
  upd: (p: Partial<StepData>) => void;
  depts: Dept[];
  divisions: Division[];
  allDesignations: DesignationOpt[];
}) {
  const linkedDept = depts.find((d) => d.id === data.departmentId);

  // Reporting Hierarchy cascades Department → Division → Designation. Each level
  // is disabled until its parent is chosen and only ever offers children of that
  // parent — picking a department used to still list every division in the system,
  // which defeats the point of having the hierarchy at all.
  const reportingDivisions = data.reportingDept
    ? divisions.filter((d) => d.department_id === data.reportingDept)
    : [];

  // reportingDivision stores the division *name*, not its id (that is the shape the
  // API and the rest of the form already use), so map back to an id to filter
  // designations. Resolve within the department-scoped subset — division names are
  // not globally unique in the CK master data.
  const selectedDivisionId = reportingDivisions.find((d) => d.name === data.reportingDivision)?.id ?? null;

  const reportingDesignations = !data.reportingDept
    ? []
    : allDesignations.filter((d) => {
        if (d.department_id !== data.reportingDept) return false;
        if (!selectedDivisionId) return false;
        return d.division_id === selectedDivisionId;
      });

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      {!data.designationId && (
        <div style={{ marginBottom: 16, padding: 12, background: 'var(--ck-warning-bg, #fff8e1)', border: '1px solid var(--ck-warning-border, #ffd54f)', borderRadius: 8, fontSize: 12.5, color: 'var(--ck-ink-soft)' }}>
          This Job Profile isn't linked to a designation yet. Department / Division / Designation will be empty until linked. Return to the directory and click "+ Add Designation" to pick one.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <FG label="Job Title*"><input value={data.jobTitle} onChange={(e) => upd({ jobTitle: e.target.value })} placeholder="Enter Job Title" style={inp} /></FG>
        <FG label="Alternate Title*"><input value={data.alternateTitle} onChange={(e) => upd({ alternateTitle: e.target.value })} placeholder="Enter Alternate Title" style={inp} /></FG>
        <FG label="Department">
          <ReadOnlyField value={linkedDept?.name ?? '—'} />
        </FG>
        <FG label="Division">
          <ReadOnlyField value={data.division || '—'} />
        </FG>
        <FG label="Designation">
          <ReadOnlyField value={data.designation || '—'} />
        </FG>
        <FG label="Location Applicable*">
          <LocationApplicableEditor value={data.locations} onChange={(locations) => upd({ locations })} />
        </FG>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 14 }}>Reporting Hierarchy</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <FG label="Department*">
          {/* Changing a level clears everything below it, so the form can never hold
              a division/designation that does not belong to the chosen department. */}
          <select
            value={data.reportingDept}
            onChange={(e) => upd({ reportingDept: e.target.value, reportingDivision: '', reportingDesignation: '' })}
            style={inp}
          >
            <option value="">Select</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </FG>
        <FG label="Division*">
          <select
            value={data.reportingDivision}
            onChange={(e) => upd({ reportingDivision: e.target.value, reportingDesignation: '' })}
            style={inp}
            disabled={!data.reportingDept}
          >
            <option value="">{data.reportingDept ? 'Select' : 'Select department first'}</option>
            {reportingDivisions.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </FG>
        <FG label="Designation*">
          <select
            value={data.reportingDesignation}
            onChange={(e) => upd({ reportingDesignation: e.target.value })}
            style={inp}
            disabled={!data.reportingDivision}
          >
            <option value="">
              {!data.reportingDivision
                ? 'Select division first'
                : reportingDesignations.length === 0
                  ? 'No designations in this division'
                  : 'Select'}
            </option>
            {reportingDesignations.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </FG>
      </div>

      <FG label="Work Shifts*">
        <WorkShiftsEditor value={data.workShifts} onChange={(workShifts) => upd({ workShifts })} />
      </FG>
    </div>
  );
}

function ReadOnlyField({ value }: { value: string }) {
  return (
    <div style={{
      width: '100%', height: 38, padding: '0 12px',
      display: 'flex', alignItems: 'center', gap: 8,
      border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13,
      background: 'var(--ck-bg)', color: 'var(--ck-ink)',
    }}>
      <Lock size={12} style={{ color: 'var(--ck-muted)', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

// ─── Step 2 — Job Description ─────────────────────────────────────────────────
function Step2({ data, upd, divisions, allDesignations }: { data: StepData; upd: (p: Partial<StepData>) => void; divisions: Division[]; allDesignations: DesignationOpt[] }) {
  const comboStyle: React.CSSProperties = { ...inp, border: 'none', background: 'transparent', color: 'var(--ck-ink)' };

  // Suggestions follow the department/division chosen in Step 1 — offering every
  // designation in the company here contradicts the Basic Job Information above.
  // Falls back to the full list while Step 1 is still blank.
  const teamOptions = data.departmentId
    ? divisions.filter((d) => d.department_id === data.departmentId)
    : divisions;
  const roleOptions = (() => {
    const divisionId = divisions.find((d) => d.name === data.division)?.id;
    if (divisionId) return allDesignations.filter((d) => d.division_id === divisionId);
    if (data.departmentId) return allDesignations.filter((d) => d.department_id === data.departmentId);
    return allDesignations;
  })();

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <SectionTitle>Short Description</SectionTitle>
      <DescTable rows={[
        ['Role',      <Combobox key="role" value={data.shortDescRole} onChange={(v) => upd({ shortDescRole: v })} options={roleOptions.map((d) => d.name)} placeholder="Type or pick a role…" style={comboStyle} />],
        ['Team',      <Combobox key="team" value={data.shortDescTeam} onChange={(v) => upd({ shortDescTeam: v })} options={teamOptions.map((d) => d.name)} placeholder="Type or pick a team…" style={comboStyle} />],
        ['Key Focus', <SkillCell key="focus" values={data.shortDescFocus} onChange={(v) => upd({ shortDescFocus: v })} category="Hard Skills" extraCategories={['Department Functions']} label="Key Focus" />],
      ]} />

      <SectionTitle>Detailed Job Description</SectionTitle>
      <DescTable rows={[
        ['Responsibilities', <SkillCell key="resp" values={data.detailedResponsibilities} onChange={(v) => upd({ detailedResponsibilities: v })} category="Department Functions" label="Responsibilities" />],
        ['Design Tools',     <SkillCell key="tools" values={data.detailedTools} onChange={(v) => upd({ detailedTools: v })} category="Tools & Software" label="Design Tools" />],
        ['Collaboration',    <SkillCell key="collab" values={data.detailedCollaboration} onChange={(v) => upd({ detailedCollaboration: v })} category="Cross-Department Interaction" label="Collaboration" />],
      ]} />

      <SectionTitle>Job Purpose</SectionTitle>
      <DescTable rows={[
        ['Objective', <input key="obj" value={data.jobPurposeObjective} onChange={(e) => upd({ jobPurposeObjective: e.target.value })} style={{ ...inp, border: 'none', background: 'transparent' }} placeholder="Purpose / objective of the role" />],
        ['Impact',    <input key="imp" value={data.jobPurposeImpact} onChange={(e) => upd({ jobPurposeImpact: e.target.value })} style={{ ...inp, border: 'none', background: 'transparent' }} placeholder="Expected business impact" />],
      ]} />

      <SectionTitle>Contribution to Org</SectionTitle>
      <DescTable rows={[
        ['Contribution', <textarea key="contrib" value={data.contributionToOrg} onChange={(e) => upd({ contributionToOrg: e.target.value })} rows={3} placeholder="How does this role contribute to the organization's goals?" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13, resize: 'vertical', padding: '4px 0' }} />],
      ]} />
    </div>
  );
}

// Inline chip picker for a single Skill Master category — used by Step 2's
// detailed rows so values are chosen from the master rather than free-typed.
function SkillCell({ values, onChange, category, extraCategories, label }: { values: string[]; onChange: (v: string[]) => void; category: string; extraCategories?: string[]; label: string }) {
  const [open, setOpen] = useState(false);
  const categories = [category, ...(extraCategories ?? [])];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '4px 0' }}>
      {values.length === 0 && (
        <span style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>None selected — click + to pick from {category}</span>
      )}
      {values.map((s) => (
        <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: '#222', color: '#fff', fontSize: 12, fontWeight: 600 }}>
          {s}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== s))} aria-label={`Remove ${s}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0, display: 'flex', alignItems: 'center' }}><X size={11} /></button>
        </span>
      ))}
      <button type="button" onClick={() => setOpen(true)} aria-label={`Add ${label}`}
        style={{ width: 28, height: 28, borderRadius: 7, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Plus size={14} />
      </button>
      <SkillPickerModal
        open={open}
        onClose={() => setOpen(false)}
        selected={values}
        onSave={(v) => onChange(v)}
        allowCategories={categories}
        title={`Pick ${label}`}
        subtitle={`From Skill Master · ${categories.join(' / ')}`}
      />
    </div>
  );
}

// ─── Step 3 — Job Requirement ─────────────────────────────────────────────────
function Step3({ data, upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <FG label="Minimum Experience*">
          <input type="number" step="0.5" value={data.minExperience} onChange={(e) => upd({ minExperience: e.target.value })} placeholder="0.00" style={inp} />
        </FG>
        <FG label="Preferred Experience*">
          <input type="number" step="0.5" value={data.preferredExperience} onChange={(e) => upd({ preferredExperience: e.target.value })} placeholder="0.00" style={inp} />
        </FG>
      </div>
      <FG label="Add Skills*">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, padding: '8px 12px', minHeight: 38, border: '1px dashed var(--ck-line)', borderRadius: 7, background: 'var(--ck-bg)', fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {data.skills.length === 0
              ? 'No skills selected. Click + to pick from Skill Master (Soft Skills, Hard Skills, Education, etc.)'
              : `${data.skills.length} skill${data.skills.length === 1 ? '' : 's'} selected`}
          </div>
          <button type="button" onClick={() => setPickerOpen(true)}
            style={{ width: 36, height: 38, borderRadius: 7, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={16} />
          </button>
        </div>
      </FG>
      {data.skills.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {data.skills.map((s) => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: '#222', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
              {s}
              <button onClick={() => upd({ skills: data.skills.filter((x) => x !== s) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0, display: 'flex', alignItems: 'center' }}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <SkillPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={data.skills}
        onSave={(skills) => upd({ skills })}
        allowCategories={['Soft Skills', 'Hard Skills', 'Education']}
        title="Pick Skills"
        subtitle="Choose required skills from Skill Master"
      />
    </div>
  );
}

// ─── Step 4 — Job Challenges & Performance ─────────────────────────────────────
function Step4({ data, upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <FG label="Challenges & Performances*">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, padding: '8px 12px', minHeight: 38, border: '1px dashed var(--ck-line)', borderRadius: 7, background: 'var(--ck-bg)', fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {data.challenges.length === 0
              ? 'No items selected. Click + to pick from Skill Master (any category).'
              : `${data.challenges.length} item${data.challenges.length === 1 ? '' : 's'} selected`}
          </div>
          <button type="button" onClick={() => setPickerOpen(true)}
            style={{ width: 36, height: 38, borderRadius: 7, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={16} />
          </button>
        </div>
      </FG>
      {data.challenges.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {data.challenges.map((c) => (
            <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: '#222', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
              {c}
              <button onClick={() => upd({ challenges: data.challenges.filter((x) => x !== c) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0 }}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <SkillPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={data.challenges}
        onSave={(challenges) => upd({ challenges })}
        title="Pick Challenges & Performance Areas"
        subtitle="Choose from Skill Master (any category)"
      />
    </div>
  );
}

// ─── Step 5 — Department Alignments ──────────────────────────────────────────
function Step5({ data, upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const EXAMPLES = [
    'Drafting, Quote Checking',
    'Blue Print, SPR Form',
    'AutoCAD, ERP',
    'Operations, QA, Engineering',
  ];

  const updateRow = (idx: number, selections: string[]) => {
    const updated = data.deptAlignments.map((r, i) => i === idx ? { ...r, selections } : r);
    upd({ deptAlignments: updated });
  };

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <SectionTitle>Departmental Alignment</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--ck-bg)' }}>
            <th style={alignTh}>Field</th>
            <th style={alignTh}>Selections (from Skill Master)</th>
            <th style={alignTh}>Examples</th>
          </tr>
        </thead>
        <tbody>
          {data.deptAlignments.map((row, idx) => {
            const selections = row.selections ?? [];
            return (
            <tr key={row.label} style={{ borderBottom: '1px solid var(--ck-line)' }}>
              <td style={{ ...alignTd, fontWeight: 600, color: 'var(--ck-ink)', width: '24%' }}>{row.label}</td>
              <td style={{ ...alignTd, width: '52%' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, padding: '6px 10px', minHeight: 36, border: '1px dashed var(--ck-line)', borderRadius: 7, background: 'var(--ck-bg)', fontSize: 12.5 }}>
                    {selections.length === 0 ? (
                      <span style={{ color: 'var(--ck-muted)' }}>None selected — click + to pick from {row.category}</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selections.map((s) => (
                          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 999, background: '#222', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                            {s}
                            <button type="button" onClick={() => updateRow(idx, selections.filter((x) => x !== s))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0, display: 'flex' }}>
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setActiveIdx(idx)}
                    style={{ width: 32, height: 36, borderRadius: 7, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Plus size={14} />
                  </button>
                </div>
              </td>
              <td style={{ ...alignTd, fontSize: 12, color: 'var(--ck-muted)' }}>e.g. {EXAMPLES[idx]}</td>
            </tr>
            );
          })}
        </tbody>
      </table>

      {activeIdx !== null && (
        <SkillPickerModal
          open={activeIdx !== null}
          onClose={() => setActiveIdx(null)}
          selected={data.deptAlignments[activeIdx].selections ?? []}
          onSave={(selections) => updateRow(activeIdx, selections)}
          allowCategories={[data.deptAlignments[activeIdx].category]}
          title={`Pick ${data.deptAlignments[activeIdx].label}`}
          subtitle={`From Skill Master · category "${data.deptAlignments[activeIdx].category}"`}
        />
      )}
    </div>
  );
}

const alignTh: React.CSSProperties = { padding: '9px 12px', fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', letterSpacing: '0.04em', border: '1px solid var(--ck-line)' };
const alignTd: React.CSSProperties = { padding: '10px 12px', border: '1px solid var(--ck-line)', verticalAlign: 'top' };

// ─── Step 6 — Training ────────────────────────────────────────────────────────
function Step6({ data, upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <SectionTitle>Training Modules</SectionTitle>
        <Button size="sm" variant="primary" icon={Plus} onClick={() => setPickerOpen(true)}>Pick from Master</Button>
      </div>
      {data.trainingModules.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)', border: '2px dashed var(--ck-line)', borderRadius: 10 }}>
          No training modules selected. Click "Pick from Master" to choose course modules.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {data.trainingModules.map((m, i) => (
            <div key={m.id || i} style={{ border: '1px solid var(--ck-line)', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
              <div style={{ height: 120, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ck-faint)' }}>
                <BookOpen size={32} strokeWidth={1} />
              </div>
              <button type="button" aria-label="Remove"
                onClick={() => upd({ trainingModules: data.trainingModules.filter((_, j) => j !== i) })}
                style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={13} />
              </button>
              <div style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>{m.name}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--ck-muted)', marginBottom: 6 }}>
                  <CheckSquare size={13} /> DESCRIPTION
                </div>
                <div style={{ fontSize: 12, color: 'var(--ck-ink-soft)', marginBottom: 10, minHeight: 32 }}>
                  {m.description || '—'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ck-muted)' }}>
                  <span>CHAPTER COUNTS</span>
                  <span style={{ fontWeight: 700 }}>{String(m.chapters).padStart(2, '0')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <TrainingModulePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedIds={data.trainingModules.map((m) => m.id).filter(Boolean) as string[]}
        onSave={(modules) => upd({ trainingModules: modules })}
      />
    </div>
  );
}

// ─── Steps 7 & 8 — Induction / Onboarding template pickers ───────────────────
type TplOpt = { id: string; name: string; description: string | null; item_count: number | string };

function TemplatePickerModal({ open, onClose, templates, selectedId, onPick, masterHint, Icon }: {
  open: boolean; onClose: () => void; templates: TplOpt[]; selectedId: string;
  onPick: (id: string) => void; masterHint: string; Icon: LucideIcon;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Pick from Master" subtitle="Choose one template" width={620}
      footer={<Button onClick={onClose}>Close</Button>}>
      {templates.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>
          No templates yet — create them in {masterHint}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map((t) => {
            const on = t.id === selectedId;
            return (
              <button key={t.id} type="button" onClick={() => onPick(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 12, textAlign: 'left', width: '100%',
                  border: '1px solid ' + (on ? 'var(--ck-accent)' : 'var(--ck-line)'), borderRadius: 10,
                  background: on ? 'var(--ck-surface-alt)' : 'var(--ck-surface)', cursor: 'pointer',
                }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ck-faint)', flexShrink: 0 }}>
                  <Icon size={20} strokeWidth={1.5} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ck-muted)' }}>{t.description || `${Number(t.item_count) || 0} item${Number(t.item_count) === 1 ? '' : 's'}`}</div>
                </div>
                {on && <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ck-accent)' }}>Selected</span>}
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function TemplateStep({ title, blurb, endpoint, masterHint, value, onChange, Icon }: {
  title: string; blurb: string; endpoint: string; masterHint: string; value: string; onChange: (v: string) => void; Icon: LucideIcon;
}) {
  const [templates, setTemplates] = useState<TplOpt[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    api.get<{ data: TplOpt[] }>(endpoint).then((r) => setTemplates(r.data.data ?? [])).catch(() => setTemplates([]));
  }, [endpoint]);
  const selected = templates.find((t) => t.id === value) ?? null;

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SectionTitle>{title}</SectionTitle>
        <Button size="sm" variant="primary" icon={Plus} onClick={() => setPickerOpen(true)}>Pick from Master</Button>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginTop: 0, marginBottom: 18 }}>{blurb}</p>
      {!value ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)', border: '2px dashed var(--ck-line)', borderRadius: 10 }}>
          No template selected. Click "Pick from Master" to choose one.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          <div style={{ border: '1px solid var(--ck-line)', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
            <div style={{ height: 120, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ck-faint)' }}>
              <Icon size={32} strokeWidth={1} />
            </div>
            <button type="button" aria-label="Remove" onClick={() => onChange('')}
              style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={13} />
            </button>
            <div style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>{selected?.name ?? '—'}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--ck-muted)', marginBottom: 6 }}>
                <CheckSquare size={13} /> DESCRIPTION
              </div>
              <div style={{ fontSize: 12, color: 'var(--ck-ink-soft)', marginBottom: 10, minHeight: 32 }}>
                {selected?.description || '—'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ck-muted)' }}>
                <span>ITEMS</span>
                <span style={{ fontWeight: 700 }}>{String(Number(selected?.item_count) || 0).padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      <TemplatePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        templates={templates}
        selectedId={value}
        masterHint={masterHint}
        Icon={Icon}
        onPick={(id) => { onChange(id); setPickerOpen(false); }}
      />
    </div>
  );
}

function StepInduction({ data, upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  return (
    <TemplateStep
      title="Induction Plan"
      blurb="Pick an induction template (presentations + forms/documents). It auto-fills the candidate's Induction tab when they're onboarded — no manual adding needed."
      endpoint="/induction-templates"
      masterHint="Masters → Induction Templates"
      value={data.inductionTemplateId}
      onChange={(v) => upd({ inductionTemplateId: v })}
      Icon={PresentationIcon}
    />
  );
}

function StepOnboarding({ data, upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  return (
    <TemplateStep
      title="Onboarding Plan"
      blurb="Pick an onboarding template (programs / tours / activities). It auto-fills the candidate's Onboarding tab when they're onboarded — no manual adding needed."
      endpoint="/onboarding-templates"
      masterHint="Masters → Onboarding Templates"
      value={data.onboardingTemplateId}
      onChange={(v) => upd({ onboardingTemplateId: v })}
      Icon={MapPin}
    />
  );
}

/** One rung of the career-path preview: the role, plus where it sits. */
function PathCard({
  name, context, caption, current = false, compact = false,
}: {
  name: string; context: string; caption?: string; current?: boolean; compact?: boolean;
}) {
  return (
    <span style={{
      display: 'inline-flex', flexDirection: 'column', gap: 2,
      padding: compact ? '4px 10px' : '7px 14px', borderRadius: 8,
      background: current ? '#222' : 'var(--ck-line-soft)',
      color: current ? '#fff' : 'var(--ck-ink-soft)',
      border: current ? 'none' : '1px solid var(--ck-line)',
    }}>
      <span style={{ fontWeight: 600, fontSize: compact ? 12 : 13 }}>{name}</span>
      {(context || caption) && (
        <span style={{ fontSize: 10.5, opacity: current ? 0.75 : 1, color: current ? '#fff' : 'var(--ck-muted)' }}>
          {[caption, context].filter(Boolean).join(' — ')}
        </span>
      )}
    </span>
  );
}

// ─── Step 7 — Career Path (Hierarchy Master) ─────────────────────────────────
function Step7({
  data,
  upd,
  depts,
  divisions,
  allDesignations,
}: {
  data: StepData;
  upd: (p: Partial<StepData>) => void;
  depts: Dept[];
  divisions: Division[];
  allDesignations: DesignationOpt[];
}) {
  const [lateralPickerOpen, setLateralPickerOpen] = useState(false);

  // Narrowing the role lists by Department → Division. The Designation Master
  // runs to hundreds of rows across the group, so an unfiltered dropdown made
  // finding the right promotion role impractical. Seeded from the profile's own
  // department/division, which is the overwhelmingly common case.
  const ownDivisionId = divisions.find((d) => d.name === data.division)?.id ?? '';
  const [filterDept, setFilterDept] = useState(data.departmentId);
  const [filterDivision, setFilterDivision] = useState(ownDivisionId);

  const filterDivisions = filterDept
    ? divisions.filter((d) => d.department_id === filterDept)
    : [];

  const byId = (id: string) => allDesignations.find((d) => d.id === id);
  const designationName = (id: string) => byId(id)?.name ?? '—';

  /** Department / Division caption for a designation, for the preview cards. */
  const contextOf = (id: string) => {
    const d = byId(id);
    if (!d) return '';
    const dept = depts.find((x) => x.id === d.department_id)?.name;
    const div = divisions.find((x) => x.id === d.division_id)?.name;
    return [dept, div].filter(Boolean).join(' · ');
  };

  // Can't be your own parent, promotion or lateral move.
  const options = allDesignations.filter((d) => {
    if (d.id === data.designationId) return false;
    if (filterDivision) return d.division_id === filterDivision;
    if (filterDept) return d.department_id === filterDept;
    return true;
  });

  const lateralSelected = data.careerLateralDesignationIds
    .map((id) => byId(id))
    .filter(Boolean) as DesignationOpt[];

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <SectionTitle>Career Path — Hierarchy</SectionTitle>
      <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginBottom: 18 }}>
        Configure how this role fits into the organisational hierarchy. All three fields draw from the Designation Master.
      </div>

      {/* Narrows every role picker below. Division stays locked until a
          department is chosen, matching the rest of the app. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <FG label="Filter by Department">
          <select
            value={filterDept}
            onChange={(e) => { setFilterDept(e.target.value); setFilterDivision(''); }}
            style={inp}
          >
            <option value="">All Departments</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </FG>
        <FG label="Filter by Division">
          <select
            value={filterDivision}
            onChange={(e) => setFilterDivision(e.target.value)}
            disabled={!filterDept}
            title={!filterDept ? 'Select a Department first' : undefined}
            style={{ ...inp, ...(filterDept ? null : { background: 'var(--ck-line-soft)', cursor: 'not-allowed' }) }}
          >
            <option value="">All</option>
            {filterDept && filterDivisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </FG>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
        <FG label="Parent Role">
          <select value={data.careerParentDesignationId} onChange={(e) => upd({ careerParentDesignationId: e.target.value })} style={inp}>
            <option value="">— Select —</option>
            {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <span style={{ fontSize: 11, color: 'var(--ck-muted)', marginTop: 4 }}>Who this role reports up to.</span>
        </FG>
        <FG label="Next Promotion Role">
          <select value={data.careerNextPromotionDesignationId} onChange={(e) => upd({ careerNextPromotionDesignationId: e.target.value })} style={inp}>
            <option value="">— Select —</option>
            {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <span style={{ fontSize: 11, color: 'var(--ck-muted)', marginTop: 4 }}>Standard upward career step.</span>
        </FG>
      </div>
      {options.length === 0 && (filterDept || filterDivision) && (
        <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--ck-muted)' }}>
          No other designations in this department / division — widen the filter above.
        </div>
      )}

      <FG label="Lateral Movement Options">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, padding: '8px 12px', minHeight: 38, border: '1px dashed var(--ck-line)', borderRadius: 7, background: 'var(--ck-bg)', fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {lateralSelected.length === 0
              ? 'No lateral moves selected. Click + to pick designations this role can move sideways into.'
              : `${lateralSelected.length} lateral role${lateralSelected.length === 1 ? '' : 's'} configured`}
          </div>
          <button type="button" onClick={() => setLateralPickerOpen(true)}
            style={{ width: 36, height: 38, borderRadius: 7, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={16} />
          </button>
        </div>
      </FG>
      {lateralSelected.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {lateralSelected.map((d) => (
            <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: '#222', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
              {d.name}
              <button type="button" onClick={() => upd({ careerLateralDesignationIds: data.careerLateralDesignationIds.filter((x) => x !== d.id) })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0, display: 'flex', alignItems: 'center' }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <DesignationMultiPicker
        open={lateralPickerOpen}
        onClose={() => setLateralPickerOpen(false)}
        designations={options}
        // Don't allow picking the parent / next-promotion as lateral too — that's confusing
        excludeIds={[data.careerParentDesignationId, data.careerNextPromotionDesignationId].filter(Boolean)}
        selectedIds={data.careerLateralDesignationIds}
        onSave={(careerLateralDesignationIds) => upd({ careerLateralDesignationIds })}
      />

      {(data.careerParentDesignationId || data.careerNextPromotionDesignationId) && (
        <div style={{ marginTop: 24, padding: 16, background: 'var(--ck-bg)', border: '1px solid var(--ck-line)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Preview
          </div>
          {/* Read bottom-up: seniority increases going up the ladder. The old
              preview drew the promotion *below* this role, which said the
              opposite of what it meant. Each card carries its department ·
              division so a cross-division move is obvious at a glance. */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, fontSize: 13 }}>
            {data.careerNextPromotionDesignationId && (
              <>
                <PathCard
                  name={designationName(data.careerNextPromotionDesignationId)}
                  context={contextOf(data.careerNextPromotionDesignationId)}
                  caption="Next promotion"
                />
                <span style={{ color: 'var(--ck-muted)', paddingLeft: 14 }}>↑</span>
              </>
            )}
            <PathCard
              name={data.designation || 'This role'}
              context={[
                depts.find((d) => d.id === data.departmentId)?.name,
                data.division,
              ].filter(Boolean).join(' · ')}
              caption="This role"
              current
            />
            {data.careerParentDesignationId && (
              <>
                <span style={{ color: 'var(--ck-muted)', paddingLeft: 14 }}>↑</span>
                <PathCard
                  name={designationName(data.careerParentDesignationId)}
                  context={contextOf(data.careerParentDesignationId)}
                  caption="Reports to"
                />
              </>
            )}
          </div>
          {lateralSelected.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--ck-muted)' }}>↔ Lateral moves:</span>
              {lateralSelected.map((d) => (
                <PathCard key={d.id} name={d.name} context={contextOf(d.id)} compact />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DesignationMultiPicker({
  open, onClose, designations, excludeIds, selectedIds, onSave,
}: {
  open: boolean;
  onClose: () => void;
  designations: DesignationOpt[];
  excludeIds: string[];
  selectedIds: string[];
  onSave: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) { setDraft(new Set(selectedIds)); setSearch(''); }
  }, [open, selectedIds]);

  const visible = designations
    .filter((d) => !excludeIds.includes(d.id))
    .filter((d) => !search.trim() || d.name.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <Modal open={open} onClose={onClose}
      title="Pick Lateral Movement Options"
      subtitle="Select designations this role can move sideways into"
      width={560}
      footer={<>
        <Button size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="primary" onClick={() => { onSave(Array.from(draft)); onClose(); }}>
          Save Selection ({draft.size})
        </Button>
      </>}>
      <div style={{ marginBottom: 12 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search designation…"
          style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }} />
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--ck-line)', borderRadius: 8 }}>
        {visible.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>No designations available.</div>
        )}
        {visible.map((d) => {
          const checked = draft.has(d.id);
          return (
            <label key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderBottom: '1px solid var(--ck-line)',
              background: checked ? 'var(--ck-surface-alt)' : 'transparent', cursor: 'pointer',
            }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(d.id)} />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--ck-ink)', fontWeight: 500 }}>{d.name}</span>
              {d.code && <span style={{ fontFamily: 'var(--ck-font-mono)', fontSize: 10.5, color: 'var(--ck-faint)' }}>{d.code}</span>}
            </label>
          );
        })}
      </div>
    </Modal>
  );
}

// ─── Step 8 — ATM (Auto Task Mapping) ─────────────────────────────────────────
function Step8({ data, upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const removeTask = (id: string) => upd({ atmTasks: data.atmTasks.filter((t) => t.id !== id) });

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>ATM (Auto Task Mapping)</SectionTitle>
        <Button size="sm" variant="primary" icon={Plus} onClick={() => setPickerOpen(true)}>Pick Auto Tasks</Button>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginBottom: 14 }}>
        Auto-tasks are hard-coded in the ATM catalogue (sourcing, screening, interview, offer, onboarding stages). Pick the ones that apply to this Job Profile.
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--ck-bg)' }}>
            <th style={{ padding: '8px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', border: '1px solid var(--ck-line)', width: 80 }}>SR No.</th>
            <th style={{ padding: '8px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', border: '1px solid var(--ck-line)' }}>Task</th>
            <th style={{ padding: '8px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', border: '1px solid var(--ck-line)' }}>Task Description</th>
            <th style={{ padding: '8px 14px', width: 50, border: '1px solid var(--ck-line)' }}></th>
          </tr>
        </thead>
        <tbody>
          {data.atmTasks.length === 0 && (
            <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', border: '1px solid var(--ck-line)' }}>
              No tasks selected. Click "Pick Auto Tasks" to choose from the catalogue.
            </td></tr>
          )}
          {data.atmTasks.map((t, i) => (
            <tr key={t.id || i}>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', fontFamily: 'var(--ck-font-mono)', fontSize: 12, color: 'var(--ck-muted)' }}>SR{String(i + 1).padStart(3, '0')}</td>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', fontWeight: 600 }}>{t.task}</td>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', color: 'var(--ck-ink-soft)' }}>{t.description}</td>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', textAlign: 'center' }}>
                <button type="button" onClick={() => removeTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-danger-fg, #b00)' }}>
                  <X size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <AtmTaskPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedIds={data.atmTasks.map((t) => t.id).filter(Boolean) as string[]}
        onSave={(tasks) => upd({ atmTasks: tasks })}
      />
    </div>
  );
}

// ─── Step 9 — Employees & Alumni (filtered by this JP's designation) ─────────
type JpEmployee = {
  id: string; code: string; first_name: string; last_name: string;
  designation: string; status: string; joining_date: string;
  email: string | null; phone: string | null;
  branch_id: string; branch_name: string; branch_city: string | null;
  department_name: string;
};

function Step9({ editId }: { editId: string | null }) {
  const [active, setActive] = useState<JpEmployee[]>([]);
  const [alumni, setAlumni] = useState<JpEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'card' | 'list'>('list');
  const [tab, setTab] = useState<'active' | 'alumni'>('active');

  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    api.get<{ data: { active: JpEmployee[]; alumni: JpEmployee[] } }>(`/job-profiles/${editId}/employees`)
      .then((r) => { setActive(r.data.data.active); setAlumni(r.data.data.alumni); })
      .catch(() => { setActive([]); setAlumni([]); })
      .finally(() => setLoading(false));
  }, [editId]);

  if (!editId) {
    return (
      <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 48, border: '1px solid var(--ck-line)', textAlign: 'center', color: 'var(--ck-muted)' }}>
        Employees & Alumni list will appear here after you save this Job Profile.
      </div>
    );
  }

  const rows = tab === 'active' ? active : alumni;

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>Employees & Alumni</SectionTitle>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => setView('list')} title="List view"
            style={viewBtn(view === 'list')}><ClipboardList size={14} /></button>
          <button type="button" onClick={() => setView('card')} title="Card view"
            style={viewBtn(view === 'card')}><LayoutGrid size={14} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--ck-line)' }}>
        <button type="button" onClick={() => setTab('active')} style={tabBtn(tab === 'active')}>
          Active <span style={{ color: 'var(--ck-faint)', marginLeft: 4 }}>({active.length})</span>
        </button>
        <button type="button" onClick={() => setTab('alumni')} style={tabBtn(tab === 'alumni')}>
          Alumni <span style={{ color: 'var(--ck-faint)', marginLeft: 4 }}>({alumni.length})</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>
          No {tab === 'active' ? 'active employees' : 'alumni'} with this designation.
        </div>
      ) : view === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {rows.map((e) => (
            <div key={e.id} style={{ padding: 14, border: '1px solid var(--ck-line)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--ck-ink-soft)' }}>
                  {(e.first_name[0] ?? '') + (e.last_name[0] ?? '')}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ck-ink)' }}>{e.first_name} {e.last_name}</div>
                  <div style={{ fontFamily: 'var(--ck-font-mono)', fontSize: 11, color: 'var(--ck-muted)' }}>{e.code}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ck-ink-soft)', lineHeight: 1.7 }}>
                <div><strong style={{ color: 'var(--ck-muted)' }}>Dept:</strong> {e.department_name}</div>
                <div><strong style={{ color: 'var(--ck-muted)' }}>Branch:</strong> {e.branch_name}{e.branch_city ? `, ${e.branch_city}` : ''}</div>
                <div><strong style={{ color: 'var(--ck-muted)' }}>Status:</strong> {e.status}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--ck-bg)' }}>
              {['CODE', 'NAME', 'DEPARTMENT', 'BRANCH', 'STATUS', 'JOINED'].map((h) => (
                <th key={h} style={{ padding: '8px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', border: '1px solid var(--ck-line)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', fontFamily: 'var(--ck-font-mono)', fontSize: 12, color: 'var(--ck-muted)' }}>{e.code}</td>
                <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', fontWeight: 600 }}>{e.first_name} {e.last_name}</td>
                <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', color: 'var(--ck-ink-soft)' }}>{e.department_name}</td>
                <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', color: 'var(--ck-ink-soft)' }}>{e.branch_name}{e.branch_city ? `, ${e.branch_city}` : ''}</td>
                <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)' }}>
                  <span style={{ padding: '3px 9px', borderRadius: 5, fontSize: 11.5, fontWeight: 600, background: e.status === 'EXITED' ? '#eee' : 'var(--ck-line-soft)', color: e.status === 'EXITED' ? '#666' : 'var(--ck-ink-soft)' }}>
                    {e.status}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', color: 'var(--ck-ink-soft)', fontSize: 12 }}>{e.joining_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function viewBtn(active: boolean): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 7, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--ck-ink)' : 'var(--ck-line)'}`,
    background: active ? 'var(--ck-ink)' : 'transparent',
    color: active ? '#fff' : 'var(--ck-muted)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '9px 16px', border: 'none', background: 'transparent',
    borderBottom: active ? '2px solid var(--ck-ink)' : '2px solid transparent',
    color: active ? 'var(--ck-ink)' : 'var(--ck-muted)',
    cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500, marginBottom: -1,
  };
}

// ─── Step 10 — Prospets (full combined table from DB) ─────────────────────────

type Prospect = {
  id: string; name: string; email: string; phone: string | null; platform: string;
  experience_years: number | string | null; current_role: string | null;
  company: string | null; location: string | null; salary_range: string | null;
  education: string | null; institution: string | null; match_ratio: number | null;
  engagement_signal: string | null; application_status: string;
};

function Step10({ data: _data, upd: _upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  const [rows, setRows]           = useState<Prospect[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const pageSize = 5;

  const fetchRows = () => {
    setLoading(true);
    const params: Record<string, unknown> = { page, pageSize };
    if (search) params.search = search;
    api.get<{ data: Prospect[]; meta: { total: number } }>('/prospects', { params })
      .then((r) => { setRows(r.data.data); setTotal(r.data.meta.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchRows, [page, search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const HEADERS = ['IMAGE','SR No.','NAME','EMAIL','PHONE','PLATFORM','WORK EXPERIENCE','CURRENT ROLE','COMPANY','LOCATION','SALARY RANGE','EDUCATION','INSTITUTION','MATCH RATIO','ENGAGEMENT SIGNALS','APPLICATION STATUS','ACTIONS'];

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <SectionTitle>Prospects</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" icon={UserSearch} onClick={() => setImportOpen(true)}>Nest Connect</Button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, role, company…"
          style={{ height: 36, padding: '0 12px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)', width: '100%', maxWidth: 360 }} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12.5, minWidth: 1200 }}>
          <thead>
            <tr style={{ background: 'var(--ck-bg)' }}>
              {HEADERS.map((h) => (
                <th key={h} style={{
                  padding: '9px 12px', fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)',
                  textAlign: 'left', whiteSpace: 'nowrap', letterSpacing: '0.04em',
                  borderBottom: '2px solid var(--ck-line)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={HEADERS.length} style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={HEADERS.length} style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>No prospects found.</td></tr>
            )}
            {rows.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--ck-line)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                {/* Avatar */}
                <td style={{ padding: '11px 12px' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: `oklch(0.92 0.04 ${(i * 53) % 360})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: `oklch(0.42 0.08 ${(i * 53) % 360})` }}>
                    {p.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                </td>
                {/* SR No. */}
                <td style={{ padding: '11px 12px', fontFamily: 'var(--ck-font-mono)', fontSize: 12, color: 'var(--ck-muted)' }}>
                  {String((page - 1) * pageSize + i + 1).padStart(3, '0')}
                </td>
                {/* Name */}
                <td style={{ padding: '11px 12px', fontWeight: 700, color: 'var(--ck-ink)', whiteSpace: 'nowrap' }}>{p.name}</td>
                {/* Email */}
                <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--ck-ink-soft)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</td>
                {/* Phone */}
                <td style={{ padding: '11px 12px', fontSize: 12, color: 'var(--ck-ink-soft)', whiteSpace: 'nowrap' }}>{p.phone ?? '—'}</td>
                {/* Platform */}
                <td style={{ padding: '11px 12px', color: 'oklch(0.55 0.14 250)', fontWeight: 600 }}>{p.platform}</td>
                {/* Work Exp */}
                <td style={{ padding: '11px 12px', fontWeight: 700, color: 'var(--ck-ink)', textAlign: 'center' }}>
                  {p.experience_years != null ? String(p.experience_years).padStart(2, '0') : '—'}
                </td>
                {/* Current Role */}
                <td style={{ padding: '11px 12px', color: 'var(--ck-ink-soft)', whiteSpace: 'nowrap' }}>{p.current_role ?? '—'}</td>
                {/* Company */}
                <td style={{ padding: '11px 12px', color: 'var(--ck-ink-soft)', whiteSpace: 'nowrap' }}>{p.company ?? '—'}</td>
                {/* Location */}
                <td style={{ padding: '11px 12px', fontWeight: 700, color: 'var(--ck-ink)', whiteSpace: 'nowrap' }}>
                  {p.location?.toUpperCase() ?? '—'}
                </td>
                {/* Salary Range */}
                <td style={{ padding: '11px 12px', fontWeight: 600, color: 'var(--ck-ink-soft)' }}>{p.salary_range ?? '—'}</td>
                {/* Education */}
                <td style={{ padding: '11px 12px', fontWeight: 700, color: 'var(--ck-ink)' }}>{p.education ?? '—'}</td>
                {/* Institution */}
                <td style={{ padding: '11px 12px', fontWeight: 700, color: 'var(--ck-ink)' }}>{p.institution ?? '—'}</td>
                {/* Match Ratio */}
                <td style={{ padding: '11px 12px', fontWeight: 700, color: 'var(--ck-ink)' }}>
                  {p.match_ratio != null ? `${p.match_ratio}%` : '—'}
                </td>
                {/* Engagement Signal */}
                <td style={{ padding: '11px 12px' }}>
                  <span style={{ padding: '3px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600, background: 'var(--ck-line-soft)', color: 'var(--ck-ink-soft)', border: '1px solid var(--ck-line)', whiteSpace: 'nowrap' }}>
                    {p.engagement_signal ?? '—'}
                  </span>
                </td>
                {/* Application Status */}
                <td style={{ padding: '11px 12px', fontWeight: 600, whiteSpace: 'nowrap',
                  color: p.application_status === 'Applied' ? 'oklch(0.42 0.12 145)' : 'var(--ck-ink-soft)' }}>
                  {p.application_status}
                </td>
                {/* Actions */}
                <td style={{ padding: '11px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <IconAction icon={Eye} label="View" hint="View prospect" iconSize={15} />
                    <IconAction icon={Pencil} label="Edit" hint="Edit prospect" iconSize={15} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 12.5, color: 'var(--ck-muted)' }}>
        <span>
          {loading ? 'Loading…' : `Showing ${Math.min((page - 1) * pageSize + 1, total)} to ${Math.min(page * pageSize, total)} of ${total} results`}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          {Array.from({ length: Math.min(3, totalPages) }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setPage(n)}
              style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${page === n ? '#222' : 'var(--ck-line)'}`, background: page === n ? '#222' : 'transparent', color: page === n ? '#fff' : 'var(--ck-ink)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {n}
            </button>
          ))}
          <Button size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <NestConnectImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={fetchRows} />
    </div>
  );
}

// ─── Step 11 — Interview Templates (mapped to this JP) ───────────────────────
type InterviewTemplate = { id: string; title: string; description: string | null };

function Step11({ data, upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [viewing, setViewing]     = useState<InterviewTemplate | null>(null);

  const fetchTemplates = () => {
    setLoading(true);
    api.get<{ data: InterviewTemplate[] }>('/hiring/interview-templates')
      .then((r) => setTemplates(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchTemplates, []);

  // Templates are reference data owned by the Interview Template master, so
  // "+ Add Template" sends the user there rather than duplicating a cut-down
  // create form here. Opened in a new tab deliberately: this Job Profile form
  // holds unsaved state that navigating away would discard.
  const openMaster = () => {
    window.open('/masters/interview-templates?new=1', '_blank', 'noopener');
    toast.info('Opened the Interview Template master in a new tab.', {
      description: 'Add the template there, then come back — the list refreshes automatically.',
    });
  };

  // Pick the new template up when the user switches back from the master tab.
  useEffect(() => {
    const onFocus = () => fetchTemplates();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMap = (id: string) => {
    const has = data.interviewTemplateIds.includes(id);
    upd({ interviewTemplateIds: has
      ? data.interviewTemplateIds.filter((x) => x !== id)
      : [...data.interviewTemplateIds, id] });
  };

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <SectionTitle>Interview Templates</SectionTitle>
        <Button size="sm" variant="primary" icon={Plus} onClick={openMaster}>+ Add Template</Button>
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginBottom: 16 }}>
        Tick the templates that should be used during interviews for this Job Profile. Multiple templates can be combined (e.g. one generic + one specialised).
        Templates themselves are managed in <strong>Settings → Interview Templates</strong> (the Interview Template master).
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading templates…</div>
      ) : templates.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>
          No templates in the master yet. Click "+ Add Template" to create one in the Interview Template master.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {templates.map((t) => {
            const checked = data.interviewTemplateIds.includes(t.id);
            return (
              <div key={t.id} style={{
                border: `2px solid ${checked ? 'var(--ck-ink)' : 'var(--ck-line)'}`,
                borderRadius: 10, overflow: 'hidden',
                background: checked ? 'var(--ck-surface-alt)' : 'var(--ck-surface)',
                transition: 'border-color 120ms',
              }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ height: 120, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ck-faint)' }}>
                    <ClipboardList size={36} strokeWidth={1} />
                  </div>
                  <label style={{ position: 'absolute', top: 10, left: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(255,255,255,0.9)', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleMap(t.id)} />
                    {checked ? 'Mapped' : 'Map'}
                  </label>
                  <div style={{ position: 'absolute', top: 10, right: 12 }}>
                    <button type="button" onClick={() => setViewing(t)} title="View"
                      style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t.title}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--ck-muted)', marginBottom: 6 }}>
                    <CheckSquare size={12} /> DESCRIPTION
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ck-ink-soft)', lineHeight: 1.5, minHeight: 36 }}>
                    {t.description ?? '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.interviewTemplateIds.length > 0 && (
        <div style={{ marginTop: 18, padding: 12, background: 'var(--ck-bg)', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 12.5, color: 'var(--ck-ink-soft)' }}>
          <strong style={{ color: 'var(--ck-ink)' }}>{data.interviewTemplateIds.length}</strong> template{data.interviewTemplateIds.length === 1 ? '' : 's'} mapped to this Job Profile. Save to persist.
        </div>
      )}

      {viewing && (
        <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing.title} subtitle="Interview template details" width={560}
          footer={<Button size="sm" onClick={() => setViewing(null)}>Close</Button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 13.5, color: 'var(--ck-ink)', lineHeight: 1.6 }}>
                {viewing.description ?? 'No description available.'}
              </div>
            </div>
            <div style={{ padding: 12, background: 'var(--ck-bg)', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 12.5, color: 'var(--ck-muted)' }}>
              Sections, scoring rubric and AI-led interview behaviour for this template will appear here in a later phase.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
