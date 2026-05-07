import { useState, useEffect, type ReactNode } from 'react';
import {
  FileText, ListChecks, Target, LayoutGrid, BookOpen,
  TrendingUp, CheckSquare, Users, UserSearch, ClipboardList,
  Plus, X, ChevronLeft, Eye, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Dept = { id: string; name: string };

interface StepData {
  // Step 1
  jobTitle: string; alternateTitle: string; departmentId: string;
  division: string; designation: string; locationApplicable: string;
  reportingDept: string; reportingDivision: string; reportingDesignation: string;
  workShift: string;
  // Step 2
  shortDescRole: string; shortDescTeam: string; shortDescFocus: string;
  detailedResponsibilities: string; detailedTools: string; detailedCollaboration: string;
  jobPurposeObjective: string; jobPurposeImpact: string;
  // Step 3
  minExperience: string; preferredExperience: string; skills: string[];
  // Step 4
  challenges: string[];
  // Step 5
  deptAlignments: { label: string; notes: string }[];
  // Step 6
  trainingModules: { title: string; description: string; chapters: number }[];
  // Step 7 (same as step 1 for career path)
  careerJobTitle: string; careerAlternateTitle: string; careerDepartmentId: string;
  careerDivision: string; careerDesignation: string; careerLocationApplicable: string;
  careerReportingDept: string; careerReportingDivision: string; careerReportingDesignation: string;
  careerWorkShift: string;
  // Step 8
  atmTasks: { task: string; description: string }[];
  // Step 9 — read-only from DB
  // Step 10
  prospects: { name: string; email: string; platform: string; experience: string; role: string; company: string }[];
  // Step 11
  interviewTemplates: { title: string; description: string }[];
}

const DEFAULT_STEP_DATA: StepData = {
  jobTitle: '', alternateTitle: '', departmentId: '', division: '',
  designation: '', locationApplicable: '', reportingDept: '', reportingDivision: '',
  reportingDesignation: '', workShift: '',
  shortDescRole: '', shortDescTeam: '', shortDescFocus: '',
  detailedResponsibilities: '', detailedTools: '', detailedCollaboration: '',
  jobPurposeObjective: '', jobPurposeImpact: '',
  minExperience: '', preferredExperience: '', skills: [],
  challenges: [],
  deptAlignments: [
    { label: 'Department Functions', notes: '' },
    { label: 'Documents Used',       notes: '' },
    { label: 'Tools & Software Used', notes: '' },
    { label: 'Cross-Department Interaction', notes: '' },
  ],
  trainingModules: [],
  careerJobTitle: '', careerAlternateTitle: '', careerDepartmentId: '', careerDivision: '',
  careerDesignation: '', careerLocationApplicable: '', careerReportingDept: '',
  careerReportingDivision: '', careerReportingDesignation: '', careerWorkShift: '',
  atmTasks: [],
  prospects: [],
  interviewTemplates: [],
};

const STEPS = [
  { num: 1,  label: 'Basic Job Information',       Icon: FileText },
  { num: 2,  label: 'Job Description',             Icon: FileText },
  { num: 3,  label: 'Job Requirement',             Icon: ListChecks },
  { num: 4,  label: 'Job Challenges & Performance', Icon: Target },
  { num: 5,  label: 'Department Alignments',       Icon: LayoutGrid },
  { num: 6,  label: 'Training',                    Icon: BookOpen },
  { num: 7,  label: 'Career Path',                 Icon: TrendingUp },
  { num: 8,  label: 'ATM (Auto Task Manager)',     Icon: CheckSquare },
  { num: 9,  label: 'Employees & Alumni',          Icon: Users },
  { num: 10, label: 'Prospets',                    Icon: UserSearch },
  { num: 11, label: 'Interview Templates',         Icon: ClipboardList },
];

const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

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
  const [data, setData] = useState<StepData>({ ...DEFAULT_STEP_DATA, ...initialData });
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [challengeInput, setChallengeInput] = useState('');
  const [atmInput, setAtmInput] = useState({ task: '', description: '' });

  const upd = (patch: Partial<StepData>) => setData((d) => ({ ...d, ...patch }));

  const saveProfile = async () => {
    if (!data.departmentId && !data.jobTitle && !data.designation) {
      toast.error('Fill in at least Job Title, Department and Designation in Step 1');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: data.jobTitle || data.designation,
        alternateTitle: data.alternateTitle || undefined,
        departmentId: data.departmentId || undefined,
        division: data.division || undefined,
        designation: data.designation || undefined,
        locationApplicable: data.locationApplicable || undefined,
        workShift: data.workShift || undefined,
        reportingDivision: data.reportingDivision || undefined,
        reportingDesignation: data.reportingDesignation || undefined,
        jpStatus: 'Partially Done',
        formData: data,
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
            {activeStep < 11 && <Button size="sm" variant="primary" onClick={() => setActiveStep((s) => s + 1)}>Next →</Button>}
            <Button size="sm" variant="primary" disabled={saving} onClick={saveProfile}>{saving ? 'Saving…' : 'Save Profile'}</Button>
          </div>
        </div>

        {/* Step content */}
        <div style={{ padding: 24, flex: 1 }}>
          {activeStep === 1 && <Step1 data={data} upd={upd} depts={depts} />}
          {activeStep === 2 && <Step2 data={data} upd={upd} />}
          {activeStep === 3 && <Step3 data={data} upd={upd} tagInput={tagInput} setTagInput={setTagInput} />}
          {activeStep === 4 && <Step4 data={data} upd={upd} input={challengeInput} setInput={setChallengeInput} />}
          {activeStep === 5 && <Step5 data={data} upd={upd} />}
          {activeStep === 6 && <Step6 data={data} upd={upd} />}
          {activeStep === 7 && <Step7 data={data} upd={upd} depts={depts} />}
          {activeStep === 8 && <Step8 data={data} upd={upd} atmInput={atmInput} setAtmInput={setAtmInput} />}
          {activeStep === 9 && <Step9 />}
          {activeStep === 10 && <Step10 data={data} upd={upd} />}
          {activeStep === 11 && <Step11 data={data} upd={upd} />}
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
function Step1({ data, upd, depts }: { data: StepData; upd: (p: Partial<StepData>) => void; depts: Dept[] }) {
  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <FG label="Job Title*"><input value={data.jobTitle} onChange={(e) => upd({ jobTitle: e.target.value })} placeholder="Enter Job Title" style={inp} /></FG>
        <FG label="Alternate Title*"><input value={data.alternateTitle} onChange={(e) => upd({ alternateTitle: e.target.value })} placeholder="Enter Alternate Title" style={inp} /></FG>
        <FG label="Department*">
          <input value={depts.find((d) => d.id === data.departmentId)?.name ?? data.departmentId} readOnly style={{ ...inp, background: 'var(--ck-line-soft)', color: 'var(--ck-ink)' }} placeholder="—" />
        </FG>
        <FG label="Division*"><input value={data.division} onChange={(e) => upd({ division: e.target.value })} placeholder="e.g. Operation" style={inp} /></FG>
        <FG label="Designation*"><input value={data.designation} onChange={(e) => upd({ designation: e.target.value })} placeholder="e.g. Team Leader" style={inp} /></FG>
        <FG label="Location Applicable*">
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={data.locationApplicable} onChange={(e) => upd({ locationApplicable: e.target.value })} placeholder="City" style={{ ...inp, flex: 1 }} />
            <button style={{ width: 36, height: 38, borderRadius: 7, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
          </div>
        </FG>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 14 }}>Reporting Hierarchy</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <FG label="Department*">
          <select value={data.reportingDept} onChange={(e) => upd({ reportingDept: e.target.value })} style={inp}>
            <option value="">Select</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </FG>
        <FG label="Division*">
          <select value={data.reportingDivision} onChange={(e) => upd({ reportingDivision: e.target.value })} style={inp}>
            <option value="">Select</option>
            <option value="Operations">Operations</option>
            <option value="Technology">Technology</option>
            <option value="Product">Product</option>
            <option value="Lead">Lead</option>
          </select>
        </FG>
        <FG label="Designation*">
          <select value={data.reportingDesignation} onChange={(e) => upd({ reportingDesignation: e.target.value })} style={inp}>
            <option value="">Select</option>
            <option value="Senior Manager">Senior Manager</option>
            <option value="Manager">Manager</option>
            <option value="Team Leader">Team Leader</option>
            <option value="HR Executive">HR Executive</option>
          </select>
        </FG>
      </div>

      <FG label="Work Shift*">
        <div style={{ display: 'flex', gap: 8, maxWidth: 300 }}>
          <input value={data.workShift} onChange={(e) => upd({ workShift: e.target.value })} placeholder="09 Hours" style={{ ...inp, flex: 1 }} />
          <button style={{ width: 36, height: 38, borderRadius: 7, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
        </div>
      </FG>
    </div>
  );
}

// ─── Step 2 — Job Description ─────────────────────────────────────────────────
function Step2({ data, upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <SectionTitle>Short Description</SectionTitle>
      <DescTable rows={[
        ['Role',      <input key="role" value={data.shortDescRole} onChange={(e) => upd({ shortDescRole: e.target.value })} style={{ ...inp, border: 'none', background: 'transparent' }} placeholder="e.g. Senior UI Designer" />],
        ['Team',      <input key="team" value={data.shortDescTeam} onChange={(e) => upd({ shortDescTeam: e.target.value })} style={{ ...inp, border: 'none', background: 'transparent' }} placeholder="e.g. Product Design" />],
        ['Key Focus', <input key="focus" value={data.shortDescFocus} onChange={(e) => upd({ shortDescFocus: e.target.value })} style={{ ...inp, border: 'none', background: 'transparent' }} placeholder="e.g. Dashboard Prototypes" />],
      ]} />

      <SectionTitle>Detailed Job Description</SectionTitle>
      <DescTable rows={[
        ['Responsibilities', <textarea key="resp" value={data.detailedResponsibilities} onChange={(e) => upd({ detailedResponsibilities: e.target.value })} rows={3} placeholder="List key responsibilities…" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 13, resize: 'vertical', padding: '4px 0' }} />],
        ['Design Tools',     <input key="tools" value={data.detailedTools} onChange={(e) => upd({ detailedTools: e.target.value })} style={{ ...inp, border: 'none', background: 'transparent' }} placeholder="e.g. Figma, UXPin, Antetype" />],
        ['Collaboration',    <input key="collab" value={data.detailedCollaboration} onChange={(e) => upd({ detailedCollaboration: e.target.value })} style={{ ...inp, border: 'none', background: 'transparent' }} placeholder="e.g. Work with product, dev…" />],
      ]} />

      <SectionTitle>Job Purpose</SectionTitle>
      <DescTable rows={[
        ['Objective', <input key="obj" value={data.jobPurposeObjective} onChange={(e) => upd({ jobPurposeObjective: e.target.value })} style={{ ...inp, border: 'none', background: 'transparent' }} placeholder="Purpose / objective of the role" />],
        ['Impact',    <input key="imp" value={data.jobPurposeImpact} onChange={(e) => upd({ jobPurposeImpact: e.target.value })} style={{ ...inp, border: 'none', background: 'transparent' }} placeholder="Expected business impact" />],
      ]} />
    </div>
  );
}

// ─── Step 3 — Job Requirement ─────────────────────────────────────────────────
function Step3({ data, upd, tagInput, setTagInput }: { data: StepData; upd: (p: Partial<StepData>) => void; tagInput: string; setTagInput: (v: string) => void }) {
  const addSkill = () => {
    const s = tagInput.trim();
    if (s && !data.skills.includes(s)) upd({ skills: [...data.skills, s] });
    setTagInput('');
  };
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
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="e.g. Leadership, Designer etc"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
            style={{ ...inp, flex: 1 }} />
          <button onClick={addSkill} style={{ width: 36, height: 38, borderRadius: 7, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
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
    </div>
  );
}

// ─── Step 4 — Job Challenges & Performance ─────────────────────────────────────
function Step4({ data, upd, input, setInput }: { data: StepData; upd: (p: Partial<StepData>) => void; input: string; setInput: (v: string) => void }) {
  const add = () => {
    const s = input.trim();
    if (s && !data.challenges.includes(s)) upd({ challenges: [...data.challenges, s] });
    setInput('');
  };
  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <FG label="Challenges & Performances*">
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add Skills & Performances"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            style={{ ...inp, flex: 1 }} />
          <button onClick={add} style={{ width: 36, height: 38, borderRadius: 7, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
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
    </div>
  );
}

// ─── Step 5 — Department Alignments ──────────────────────────────────────────
function Step5({ data, upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  const updateRow = (idx: number, notes: string) => {
    const updated = data.deptAlignments.map((r, i) => i === idx ? { ...r, notes } : r);
    upd({ deptAlignments: updated });
  };
  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <SectionTitle>Department Functions</SectionTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <colgroup><col style={{ width: '28%' }} /><col style={{ width: '22%' }} /><col style={{ width: '22%' }} /><col /></colgroup>
        {data.deptAlignments.map((row, idx) => (
          <tr key={row.label} style={{ borderBottom: '1px solid var(--ck-line)' }}>
            <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--ck-ink)' }}>{row.label}</td>
            <td style={{ padding: '12px 8px' }}>
              <select style={inp}><option>Multi-Select</option></select>
            </td>
            <td style={{ padding: '12px 8px' }}>
              <select style={inp}><option>Skill Master</option></select>
            </td>
            <td style={{ padding: '12px 8px' }}>
              <input value={row.notes} onChange={(e) => updateRow(idx, e.target.value)} placeholder={`e.g. ${idx === 0 ? 'Drafting, Quote, Check…' : idx === 1 ? 'Blue Print, SPR Form…' : idx === 2 ? 'AutoCAD, ERP…' : 'Which teams this role…'}`} style={inp} />
            </td>
          </tr>
        ))}
      </table>
    </div>
  );
}

// ─── Step 6 — Training ────────────────────────────────────────────────────────
function Step6({ data, upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  const addModule = () => upd({ trainingModules: [...data.trainingModules, { title: 'New Module', description: '', chapters: 0 }] });
  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <SectionTitle>Training Module</SectionTitle>
        <Button size="sm" variant="primary" icon={Plus} onClick={addModule}>Add Course Module</Button>
      </div>
      {data.trainingModules.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)', border: '2px dashed var(--ck-line)', borderRadius: 10 }}>
          No training modules yet. Click "Add Course Module" to add one.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {data.trainingModules.map((m, i) => (
            <div key={i} style={{ border: '1px solid var(--ck-line)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ height: 120, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ck-faint)' }}>
                <Eye size={32} strokeWidth={1} />
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>{m.title}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--ck-muted)', marginBottom: 6 }}>
                  <CheckSquare size={13} /> DESCRIPTION
                </div>
                <div style={{ fontSize: 12, color: 'var(--ck-ink-soft)', marginBottom: 10 }}>{m.description || 'Add a description…'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ck-muted)' }}>
                  <span>CHAPTER COUNTS</span><span style={{ fontWeight: 700 }}>{String(m.chapters).padStart(2, '0')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 7 — Career Path (reuses Step 1 layout) ─────────────────────────────
function Step7({ data, upd, depts }: { data: StepData; upd: (p: Partial<StepData>) => void; depts: Dept[] }) {
  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <SectionTitle>Career Path — Target Role</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <FG label="Job Title*"><input value={data.careerJobTitle} onChange={(e) => upd({ careerJobTitle: e.target.value })} placeholder="Enter Job Title" style={inp} /></FG>
        <FG label="Alternate Title*"><input value={data.careerAlternateTitle} onChange={(e) => upd({ careerAlternateTitle: e.target.value })} placeholder="Alternate Title" style={inp} /></FG>
        <FG label="Department*">
          <select value={data.careerDepartmentId} onChange={(e) => upd({ careerDepartmentId: e.target.value })} style={inp}>
            <option value="">Select</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </FG>
        <FG label="Division*"><input value={data.careerDivision} onChange={(e) => upd({ careerDivision: e.target.value })} placeholder="Division" style={inp} /></FG>
        <FG label="Designation*"><input value={data.careerDesignation} onChange={(e) => upd({ careerDesignation: e.target.value })} placeholder="Designation" style={inp} /></FG>
        <FG label="Location Applicable*">
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={data.careerLocationApplicable} onChange={(e) => upd({ careerLocationApplicable: e.target.value })} placeholder="City" style={{ ...inp, flex: 1 }} />
            <button style={{ width: 36, height: 38, borderRadius: 7, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
          </div>
        </FG>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 14 }}>Reporting Hierarchy</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <FG label="Department*">
          <select value={data.careerReportingDept} onChange={(e) => upd({ careerReportingDept: e.target.value })} style={inp}>
            <option value="">Select</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </FG>
        <FG label="Division*"><input value={data.careerReportingDivision} onChange={(e) => upd({ careerReportingDivision: e.target.value })} placeholder="Division" style={inp} /></FG>
        <FG label="Designation*"><input value={data.careerReportingDesignation} onChange={(e) => upd({ careerReportingDesignation: e.target.value })} placeholder="Designation" style={inp} /></FG>
      </div>
      <FG label="Work Shift*">
        <div style={{ display: 'flex', gap: 8, maxWidth: 300 }}>
          <input value={data.careerWorkShift} onChange={(e) => upd({ careerWorkShift: e.target.value })} placeholder="09 Hours" style={{ ...inp, flex: 1 }} />
          <button style={{ width: 36, height: 38, borderRadius: 7, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
        </div>
      </FG>
    </div>
  );
}

// ─── Step 8 — ATM ─────────────────────────────────────────────────────────────
function Step8({ data, upd, atmInput, setAtmInput }: { data: StepData; upd: (p: Partial<StepData>) => void; atmInput: { task: string; description: string }; setAtmInput: (v: { task: string; description: string }) => void }) {
  const addTask = () => {
    if (!atmInput.task) return;
    upd({ atmTasks: [...data.atmTasks, { ...atmInput }] });
    setAtmInput({ task: '', description: '' });
  };
  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>ATM (Auto Task Mapping)</SectionTitle>
        <Button size="sm" variant="primary" icon={Plus} onClick={addTask}>Add Auto Task</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <input value={atmInput.task} onChange={(e) => setAtmInput({ ...atmInput, task: e.target.value })} placeholder="Task name" style={inp} />
        <input value={atmInput.description} onChange={(e) => setAtmInput({ ...atmInput, description: e.target.value })} placeholder="Task description" style={inp} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--ck-bg)' }}>
            <th style={{ padding: '8px 14px', width: 40, border: '1px solid var(--ck-line)' }}></th>
            <th style={{ padding: '8px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', border: '1px solid var(--ck-line)', width: 80 }}>SR No.</th>
            <th style={{ padding: '8px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', border: '1px solid var(--ck-line)' }}>Task</th>
            <th style={{ padding: '8px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', border: '1px solid var(--ck-line)' }}>Task Description</th>
          </tr>
        </thead>
        <tbody>
          {data.atmTasks.length === 0 && (
            <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', border: '1px solid var(--ck-line)' }}>No tasks yet.</td></tr>
          )}
          {data.atmTasks.map((t, i) => (
            <tr key={i}>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)' }}><input type="checkbox" /></td>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', fontFamily: 'var(--ck-font-mono)', fontSize: 12, color: 'var(--ck-muted)' }}>SR{String(i + 1).padStart(3, '0')}</td>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', fontWeight: 600 }}>{t.task}</td>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', color: 'var(--ck-ink-soft)' }}>{t.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Step 9 — Employees & Alumni (from DB) ────────────────────────────────────
type HiringCompany = { id: string; lc_no: string; name: string; branch: string | null; city: string | null; location: string | null };

function Step9() {
  const [companies, setCompanies] = useState<HiringCompany[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const pageSize = 5;

  useEffect(() => {
    setLoading(true);
    api.get<{ data: HiringCompany[]; meta: { total: number } }>('/hiring/companies', { params: { page, pageSize } })
      .then((r) => { setCompanies(r.data.data); setTotal(r.data.meta.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>List of Candidates</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" variant="ghost" icon={LayoutGrid}> </Button>
          <Button size="sm" variant="ghost" icon={ClipboardList}> </Button>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--ck-bg)' }}>
            {['LC No.', 'COMPANY', 'BRANCH', 'LOCATION', 'ACTIONS'].map((h) => (
              <th key={h} style={{ padding: '8px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', border: '1px solid var(--ck-line)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', border: '1px solid var(--ck-line)' }}>Loading…</td></tr>}
          {!loading && companies.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', border: '1px solid var(--ck-line)' }}>No companies seeded yet.</td></tr>}
          {companies.map((c) => (
            <tr key={c.id}>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', fontFamily: 'var(--ck-font-mono)', fontSize: 12, color: 'var(--ck-muted)' }}>{c.lc_no}</td>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', fontWeight: 600 }}>{c.name}</td>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', color: 'var(--ck-ink-soft)' }}>{c.branch ?? '—'}</td>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)', color: 'var(--ck-ink-soft)', fontSize: 12 }}>{c.location ?? '—'}</td>
              <td style={{ padding: '10px 14px', border: '1px solid var(--ck-line)' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)' }}><Eye size={15} /></button>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)' }}><Pencil size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12.5, color: 'var(--ck-muted)' }}>
        <span>{loading ? 'Loading…' : `Showing ${Math.min((page-1)*pageSize+1,total)} to ${Math.min(page*pageSize,total)} of ${total} results`}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          {Array.from({ length: Math.min(3, totalPages) }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setPage(n)}
              style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${page === n ? '#222' : 'var(--ck-line)'}`, background: page === n ? '#222' : 'transparent', color: page === n ? '#fff' : 'var(--ck-ink)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{n}
            </button>
          ))}
          <Button size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 10 — Prospets (full combined table from DB) ─────────────────────────

type Prospect = {
  id: string; name: string; email: string; platform: string;
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
  const pageSize = 5;

  useEffect(() => {
    setLoading(true);
    const params: Record<string, unknown> = { page, pageSize };
    if (search) params.search = search;
    api.get<{ data: Prospect[]; meta: { total: number } }>('/prospects', { params })
      .then((r) => { setRows(r.data.data); setTotal(r.data.meta.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const HEADERS = ['IMAGE','SR No.','NAME','EMAIL','PLATFORM','WORK EXPERIENCE','CURRENT ROLE','COMPANY','LOCATION','SALARY RANGE','EDUCATION','INSTITUTION','MATCH RATIO','ENGAGEMENT SIGNALS','APPLICATION STATUS','ACTIONS'];

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>Prospets</SectionTitle>
        <Button size="sm" variant="primary" icon={Plus}>+ Add Employee</Button>
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
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)' }}><Eye size={15} /></button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)' }}><Pencil size={15} /></button>
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
    </div>
  );
}

// ─── Step 11 — Interview Templates (from DB) ─────────────────────────────────
type InterviewTemplate = { id: string; title: string; description: string | null };

function Step11({ data: _data, upd: _upd }: { data: StepData; upd: (p: Partial<StepData>) => void }) {
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [addOpen, setAddOpen]     = useState(false);
  const [newTitle, setNewTitle]   = useState('');
  const [newDesc, setNewDesc]     = useState('');
  const [saving, setSaving]       = useState(false);

  const fetchTemplates = () => {
    setLoading(true);
    api.get<{ data: InterviewTemplate[] }>('/hiring/interview-templates')
      .then((r) => setTemplates(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchTemplates, []);

  const saveTemplate = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await api.post('/hiring/interview-templates', { title: newTitle.trim(), description: newDesc.trim() || undefined });
      toast.success('Template added');
      setNewTitle(''); setNewDesc(''); setAddOpen(false);
      fetchTemplates();
    } catch {
      toast.error('Failed to add template');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ background: 'var(--ck-surface)', borderRadius: 10, padding: 24, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <SectionTitle>Interview Templates</SectionTitle>
        <Button size="sm" variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>+ Add Templates</Button>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading templates…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {templates.map((t) => (
            <div key={t.id} style={{ border: '1px solid var(--ck-line)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ height: 120, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ck-faint)' }}>
                  <ClipboardList size={36} strokeWidth={1} />
                </div>
                <div style={{ position: 'absolute', top: 10, left: 12 }}><input type="checkbox" /></div>
                <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', gap: 8 }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)' }}><Eye size={15} /></button>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-muted)' }}><Pencil size={15} /></button>
                </div>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t.title}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: 'var(--ck-muted)', marginBottom: 6 }}>
                  <CheckSquare size={12} /> DESCRIPTION
                </div>
                <div style={{ fontSize: 12, color: 'var(--ck-ink-soft)', lineHeight: 1.5 }}>{t.description ?? '—'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add template inline */}
      {addOpen && (
        <div style={{ marginTop: 16, padding: 16, background: 'var(--ck-bg)', borderRadius: 10, border: '1px solid var(--ck-line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ck-ink)' }}>New Interview Template</div>
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Template title *"
            style={{ height: 36, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' }} />
          <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} placeholder="Description (optional)"
            style={{ padding: 10, border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" onClick={() => { setAddOpen(false); setNewTitle(''); setNewDesc(''); }}>Cancel</Button>
            <Button size="sm" variant="primary" disabled={saving || !newTitle.trim()} onClick={saveTemplate}>
              {saving ? 'Saving…' : 'Add'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
