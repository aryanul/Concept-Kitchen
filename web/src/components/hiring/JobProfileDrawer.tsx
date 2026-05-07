import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Briefcase, Building2, MapPin, Clock, FileText } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { StatusPill } from '../ui/StatusPill';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import type { StepData } from '../../routes/hiring/JobProfileForm';

type Shift = { id: string; code: string; name: string; start_time: string; end_time: string };

type JobProfileDetail = {
  id: string;
  jp_no: string;
  title: string | null;
  alternate_title: string | null;
  department_id: string;
  department_name: string;
  division: string | null;
  designation: string | null;
  jp_status: string;
  description: string | null;
  requirements: string | null;
  status: string | null;
  created_at: string;
  location_applicable?: string | null;
  work_shift?: string | null;
  reporting_dept_id?: string | null;
  reporting_department_name?: string | null;
  reporting_division?: string | null;
  reporting_designation?: string | null;
  form_data?: StepData | string | null;
};

type Props = {
  profileId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
};

const STEP_TITLES = [
  'Step 1 — Basic Job Information',
  'Step 2 — Job Description',
  'Step 3 — Job Requirement',
  'Step 4 — Job Challenges & Performance',
  'Step 5 — Department Alignments',
  'Step 6 — Training',
  'Step 7 — Career Path',
  'Step 8 — ATM (Auto Task Manager)',
  'Step 9 — Employees & Alumni',
  'Step 10 — Prospects',
  'Step 11 — Interview Templates',
];

export function JobProfileDrawer({ profileId, onClose, onEdit }: Props) {
  const [profile, setProfile] = useState<JobProfileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Record<number, boolean>>({ 1: true, 2: true });
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => {
    if (!profileId) {
      setProfile(null);
      return;
    }
    setLoading(true);
    api
      .get<{ data: JobProfileDetail }>(`/job-profiles/${profileId}`)
      .then((r) => setProfile(r.data.data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    api
      .get<{ data: Shift[] }>('/shifts')
      .then((r) => setShifts(r.data.data))
      .catch(() => {});
  }, [profileId]);

  const formData = useMemo(() => normalizeFormData(profile), [profile]);
  const workShiftLabel = formatShift(formData?.workShift, shifts) || formData?.workShift || '—';
  const careerShiftLabel = formatShift(formData?.careerWorkShift, shifts) || formData?.careerWorkShift || '—';

  return (
    <Drawer open={!!profileId} onClose={onClose} width={760}>
      {loading && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</div>
      )}
      {!loading && profile && (
        <div>
          <div style={{ padding: '28px 32px 18px', background: 'var(--ck-bg)', borderBottom: '1px solid var(--ck-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Briefcase size={20} style={{ color: 'var(--ck-muted)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ck-ink)' }}>
                  {profile.designation ?? profile.title ?? 'Designation'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>
                  <span style={{ fontFamily: 'var(--ck-font-mono)' }}>{profile.jp_no}</span> · {profile.department_name}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <StatusPill status={profile.jp_status} />
                <Button size="sm" variant="ghost" onClick={() => onEdit(profile.id)}>Edit</Button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: 'var(--ck-muted)', fontSize: 12.5 }}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Building2 size={13} />{profile.division ?? '—'}</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><MapPin size={13} />{profile.location_applicable ?? '—'}</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Clock size={13} />{workShiftLabel}</span>
            </div>
          </div>

          <div style={{ padding: 24 }}>
            <AccordionSection title={STEP_TITLES[0]} open={!!open[1]} onToggle={() => toggle(open, setOpen, 1)}>
              <Grid>
                <Field icon={FileText} label="Job Title" value={formData?.jobTitle || profile.title || '—'} />
                <Field icon={FileText} label="Alternate Title" value={formData?.alternateTitle || profile.alternate_title || '—'} />
                <Field icon={Building2} label="Department" value={profile.department_name || '—'} />
                <Field icon={Building2} label="Division" value={formData?.division || profile.division || '—'} />
                <Field icon={Briefcase} label="Designation" value={formData?.designation || profile.designation || '—'} />
                <Field icon={MapPin} label="Location" value={formData?.locationApplicable || profile.location_applicable || '—'} />
                <Field icon={Building2} label="Reporting Dept" value={profile.reporting_department_name || formData?.reportingDept || '—'} />
                <Field icon={Building2} label="Reporting Division" value={formData?.reportingDivision || profile.reporting_division || '—'} />
                <Field icon={Briefcase} label="Reporting Designation" value={formData?.reportingDesignation || profile.reporting_designation || '—'} />
                <Field icon={Clock} label="Work Shift" value={workShiftLabel} />
              </Grid>
            </AccordionSection>

            <AccordionSection title={STEP_TITLES[1]} open={!!open[2]} onToggle={() => toggle(open, setOpen, 2)}>
              <SectionText label="Short description">
                {compactList([
                  formData?.shortDescRole && `Role: ${formData.shortDescRole}`,
                  formData?.shortDescTeam && `Team: ${formData.shortDescTeam}`,
                  formData?.shortDescFocus && `Key focus: ${formData.shortDescFocus}`,
                ]) || '—'}
              </SectionText>
              <SectionText label="Responsibilities">
                {formData?.detailedResponsibilities || profile.description || '—'}
              </SectionText>
              <SectionText label="Tools">
                {formData?.detailedTools || '—'}
              </SectionText>
              <SectionText label="Collaboration">
                {formData?.detailedCollaboration || '—'}
              </SectionText>
              <SectionText label="Job purpose">
                {compactList([
                  formData?.jobPurposeObjective && `Objective: ${formData.jobPurposeObjective}`,
                  formData?.jobPurposeImpact && `Impact: ${formData.jobPurposeImpact}`,
                ]) || '—'}
              </SectionText>
            </AccordionSection>

            <AccordionSection title={STEP_TITLES[2]} open={!!open[3]} onToggle={() => toggle(open, setOpen, 3)}>
              <Grid>
                <Field icon={FileText} label="Minimum Experience" value={formData?.minExperience || '—'} />
                <Field icon={FileText} label="Preferred Experience" value={formData?.preferredExperience || '—'} />
              </Grid>
              <SectionText label="Skills">
                {formData?.skills?.length ? formData.skills.join(', ') : '—'}
              </SectionText>
            </AccordionSection>

            <AccordionSection title={STEP_TITLES[3]} open={!!open[4]} onToggle={() => toggle(open, setOpen, 4)}>
              <SectionText label="Challenges & performance">
                {formData?.challenges?.length ? formData.challenges.join(', ') : '—'}
              </SectionText>
            </AccordionSection>

            <AccordionSection title={STEP_TITLES[4]} open={!!open[5]} onToggle={() => toggle(open, setOpen, 5)}>
              {formData?.deptAlignments?.length ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {formData.deptAlignments.map((row, idx) => (
                    <div key={`${row.label}-${idx}`} style={{ padding: '10px 12px', border: '1px solid var(--ck-line)', borderRadius: 8 }}>
                      <div style={{ fontWeight: 600, color: 'var(--ck-ink)', marginBottom: 4 }}>{row.label}</div>
                      <div style={{ color: 'var(--ck-muted)', fontSize: 12.5 }}>{row.notes || '—'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--ck-muted)' }}>—</div>
              )}
            </AccordionSection>

            <AccordionSection title={STEP_TITLES[5]} open={!!open[6]} onToggle={() => toggle(open, setOpen, 6)}>
              {formData?.trainingModules?.length ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {formData.trainingModules.map((m, idx) => (
                    <div key={`${m.title}-${idx}`} style={{ padding: '10px 12px', border: '1px solid var(--ck-line)', borderRadius: 8 }}>
                      <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{m.title}</div>
                      <div style={{ color: 'var(--ck-muted)', fontSize: 12.5, marginTop: 4 }}>{m.description || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--ck-faint)', marginTop: 6 }}>Chapters: {m.chapters}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--ck-muted)' }}>—</div>
              )}
            </AccordionSection>

            <AccordionSection title={STEP_TITLES[6]} open={!!open[7]} onToggle={() => toggle(open, setOpen, 7)}>
              <Grid>
                <Field icon={FileText} label="Career Job Title" value={formData?.careerJobTitle || '—'} />
                <Field icon={FileText} label="Career Alternate Title" value={formData?.careerAlternateTitle || '—'} />
                <Field icon={Building2} label="Career Department" value={formData?.careerDepartmentId || '—'} />
                <Field icon={Building2} label="Career Division" value={formData?.careerDivision || '—'} />
                <Field icon={Briefcase} label="Career Designation" value={formData?.careerDesignation || '—'} />
                <Field icon={MapPin} label="Career Location" value={formData?.careerLocationApplicable || '—'} />
                <Field icon={Building2} label="Career Reporting Dept" value={formData?.careerReportingDept || '—'} />
                <Field icon={Building2} label="Career Reporting Division" value={formData?.careerReportingDivision || '—'} />
                <Field icon={Briefcase} label="Career Reporting Designation" value={formData?.careerReportingDesignation || '—'} />
                <Field icon={Clock} label="Career Work Shift" value={careerShiftLabel} />
              </Grid>
            </AccordionSection>

            <AccordionSection title={STEP_TITLES[7]} open={!!open[8]} onToggle={() => toggle(open, setOpen, 8)}>
              {formData?.atmTasks?.length ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {formData.atmTasks.map((t, idx) => (
                    <div key={`${t.task}-${idx}`} style={{ padding: '10px 12px', border: '1px solid var(--ck-line)', borderRadius: 8 }}>
                      <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{t.task}</div>
                      <div style={{ color: 'var(--ck-muted)', fontSize: 12.5, marginTop: 4 }}>{t.description || '—'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--ck-muted)' }}>—</div>
              )}
            </AccordionSection>

            <AccordionSection title={STEP_TITLES[8]} open={!!open[9]} onToggle={() => toggle(open, setOpen, 9)}>
              <div style={{ color: 'var(--ck-muted)' }}>Managed in the Employees & Alumni section.</div>
            </AccordionSection>

            <AccordionSection title={STEP_TITLES[9]} open={!!open[10]} onToggle={() => toggle(open, setOpen, 10)}>
              <div style={{ color: 'var(--ck-muted)' }}>Managed in the Prospects section.</div>
            </AccordionSection>

            <AccordionSection title={STEP_TITLES[10]} open={!!open[11]} onToggle={() => toggle(open, setOpen, 11)}>
              <div style={{ color: 'var(--ck-muted)' }}>Managed in the Interview Templates section.</div>
            </AccordionSection>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function normalizeFormData(profile: JobProfileDetail | null): Partial<StepData> | undefined {
  if (!profile) return undefined;
  if (profile.form_data) {
    if (typeof profile.form_data === 'string') {
      try {
        return JSON.parse(profile.form_data) as Partial<StepData>;
      } catch {
        return undefined;
      }
    }
    return profile.form_data as Partial<StepData>;
  }
  return {
    jobTitle: profile.title ?? '',
    alternateTitle: profile.alternate_title ?? '',
    departmentId: profile.department_id ?? '',
    division: profile.division ?? '',
    designation: profile.designation ?? '',
    locationApplicable: profile.location_applicable ?? '',
    reportingDept: profile.reporting_dept_id ?? '',
    reportingDivision: profile.reporting_division ?? '',
    reportingDesignation: profile.reporting_designation ?? '',
    workShift: profile.work_shift ?? '',
  };
}

function formatShift(value: string | undefined, shifts: Shift[]): string | undefined {
  if (!value) return undefined;
  const match = shifts.find((s) => s.id === value || s.code === value);
  if (!match) return undefined;
  return `${match.name} (${match.start_time} - ${match.end_time})`;
}

function toggle(state: Record<number, boolean>, setState: (s: Record<number, boolean>) => void, key: number) {
  setState({ ...state, [key]: !state[key] });
}

function compactList(items: Array<string | false | undefined>): string | null {
  const filtered = items.filter(Boolean) as string[];
  return filtered.length ? filtered.join(' · ') : null;
}

function AccordionSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--ck-line)', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', background: 'var(--ck-surface)', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ck-ink)' }}>{title}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && <div style={{ padding: 14, background: 'var(--ck-bg)' }}>{children}</div>}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

function Field({ icon: Icon, label, value }: { icon: typeof Briefcase; label: string; value: string }) {
  return (
    <div style={{ padding: '10px 12px', background: 'var(--ck-surface)', borderRadius: 8, border: '1px solid var(--ck-line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Icon size={13} style={{ color: 'var(--ck-muted)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ck-ink)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function SectionText({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ck-ink)' }}>{children}</div>
    </div>
  );
}
