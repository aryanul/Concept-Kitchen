// Hiring funnel tabs (Screening / Interviews / Offers / Hire / Activities) for
// the Job Listing detail page. Each tab is a stage-filtered view of the
// applicants list with its own action set, sharing common bits with the
// Applications tab via local helpers.
//
// Each action calls a dedicated funnel endpoint that writes an
// applicant_activities audit row, so the Activities tab is automatically
// populated as users move candidates through the pipeline.

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Search, Eye, ClipboardCheck, PauseCircle, Ban, Tag as TagIcon, ArrowRight,
  Calendar, Send, Play, FileText, CheckCircle2, XCircle, UserCheck, UserX, Activity as ActivityIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { IconAction } from '../ui/IconAction';
import { ActionBar } from '../ui/ActionBar';
import type { Applicant } from './ApplicationsTab';

// ─── Shared types ──────────────────────────────────────────────────────────
type Lookup = { id: string; code: string; label: string; color: string | null };
type Tag = { id: string; name: string; color: string | null };
type ScreeningTemplate = { id: string; name: string; description: string | null; fields_json: ScreeningField[] | string | null; is_default: number | boolean };
type InterviewTemplate = { id: string; title: string; description: string | null; fields_json: ScreeningField[] | string | null; is_default: number | boolean };
type OfferTemplate = { id: string; name: string; description: string | null; body_md: string | null; is_default: number | boolean };
type ScreeningField = { name: string; label: string; type: 'text' | 'number' | 'select' | 'checkbox'; options?: string[]; required?: boolean; weight?: number };
type Screening = { id: string; applicant_id: string; template_id: string | null; template_name?: string; responses_json: unknown; score: number | null; result: string | null; notes: string | null; screened_at: string | null };
type Interview = {
  id: string; applicant_id: string; round_no: number; template_id: string | null;
  template_title?: string | null; template_fields?: unknown;
  mode: string | null; scheduled_at: string | null; duration_minutes: number | null;
  interviewer_user_id: string | null; interviewer_name?: string | null; interviewer_email?: string | null;
  meeting_url: string | null; recording_url: string | null;
  shared_at: string | null; started_at: string | null; completed_at: string | null;
  responses_json: unknown; score: number | null; result: string | null; notes: string | null;
};
type OfferRow = {
  id: string; applicant_id: string; template_id: string | null; template_name?: string | null; template_body?: string | null;
  draft_body: string | null; ctc: string | number | null; ctc_currency: string | null;
  joining_date: string | null; designation: string | null; status: string;
  drafted_at: string | null; sent_at: string | null; shared_at: string | null;
  accepted_at: string | null; declined_at: string | null; signed_copy_url: string | null;
};
type UserRow = { id: string; email: string; employee_code?: string | null; first_name?: string | null; last_name?: string | null };
type ActivityRow = {
  id: string; applicant_id: string; actor_user_id: string | null;
  actor_name: string | null; actor_email: string | null;
  applicant_name?: string; app_no?: string | null;
  action: string; from_stage: string | null; to_stage: string | null;
  from_status: string | null; to_status: string | null;
  message: string | null; meta_json: unknown; created_at: string;
};

// ─── Shared helpers ────────────────────────────────────────────────────────
const inp: CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

function formatSalary(min: number | string | null, max: number | string | null, currency: string | null): string {
  const lo = min != null && min !== '' ? Number(min) : null;
  const hi = max != null && max !== '' ? Number(max) : null;
  if (lo == null && hi == null) return '—';
  const cur = currency ?? '';
  if (lo != null && hi != null) return `${cur}${lo.toLocaleString('en-IN')} – ${hi.toLocaleString('en-IN')}`;
  return `${cur}${(lo ?? hi)?.toLocaleString('en-IN')}`;
}

function asFields(fj: unknown): ScreeningField[] {
  if (Array.isArray(fj)) return fj as ScreeningField[];
  if (typeof fj === 'string' && fj) {
    try { const v = JSON.parse(fj); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}

function computeWeightedScore(fields: ScreeningField[], responses: Record<string, unknown>): number | null {
  const numeric = fields.filter((f) => f.type === 'number' && f.weight);
  if (!numeric.length) return null;
  const totalWeight = numeric.reduce((a, f) => a + (f.weight ?? 0), 0);
  if (!totalWeight) return null;
  let acc = 0;
  for (const f of numeric) {
    const v = Number(responses[f.name] ?? 0);
    acc += Math.min(10, Math.max(0, v)) * (f.weight ?? 0);
  }
  return Math.round((acc / (totalWeight * 10)) * 100);
}

function renderMergeTokens(body: string, ctx: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => ctx[k] ?? '');
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return String(iso); }
}

function CandidateCell({ a, idx }: { a: Applicant; idx: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar name={a.full_name} src={a.image_url} hue={(idx * 53) % 360} size={34} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{a.full_name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ck-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
          <span style={{ fontFamily: 'var(--ck-font-mono)' }}>{a.app_no ?? '—'}</span>
          {a.email ? ` · ${a.email}` : ''}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ a, statuses }: { a: Applicant; statuses: Lookup[] }) {
  const status = statuses.find((s) => s.code === a.status);
  return (
    <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: status?.color ?? 'var(--ck-line-soft)', color: status?.color ? '#fff' : 'var(--ck-ink-soft)' }}>
      {status?.label ?? a.status}
    </span>
  );
}

function TagsCell({ tags }: { tags: Applicant['tags'] }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 180 }}>
      {tags.map((t) => (
        <span key={t.id} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, background: t.color ?? 'var(--ck-line-soft)', color: t.color ? '#fff' : 'var(--ck-ink-soft)' }}>
          {t.name}
        </span>
      ))}
    </div>
  );
}

// Hook: standard funnel lookups
function useFunnelLookups() {
  const [statuses, setStatuses] = useState<Lookup[]>([]);
  const [tags, setTags]         = useState<Tag[]>([]);
  useEffect(() => {
    api.get<{ data: Lookup[] }>('/lookups', { params: { category: 'applicant_status' } })
      .then((r) => setStatuses(r.data.data)).catch(() => {});
    api.get<{ data: Tag[] }>('/tags').then((r) => setTags(r.data.data)).catch(() => {});
  }, []);
  return { statuses, tags };
}

// Hook: applicants for a listing, filtered by stage(s)
function useStageApplicants(listingId: string, opts: { stages?: string[]; search?: string }) {
  const [apps, setApps] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const params: Record<string, string> = {};
  if (opts.search) params.search = opts.search;
  if (opts.stages?.length) params.stages = opts.stages.join(',');
  const paramKey = JSON.stringify(params);
  useEffect(() => {
    setLoading(true);
    api.get<{ data: Applicant[] }>(`/job-listings/${listingId}/applicants`, { params })
      .then((r) => setApps(r.data.data))
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, paramKey, reloadToken]);
  return { apps, loading, refresh: () => setReloadToken((v) => v + 1) };
}

// Shared Tag picker modal
function TagPickerModal({ applicant, tags, onClose, onSaved }: {
  applicant: Applicant; tags: Tag[]; onClose: () => void; onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(applicant.tags.map((t) => t.id));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await api.patch(`/job-listing-applicants/${applicant.id}`, { tags: selected }); onSaved(); }
    catch { toast.error('Failed'); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="Tag applicant" subtitle={applicant.full_name} width={420}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon={TagIcon} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save tags'}</Button>
      </>}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tags.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button key={t.id} onClick={() => setSelected(on ? selected.filter((x) => x !== t.id) : [...selected, t.id])}
              style={{
                padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: on ? (t.color ?? 'var(--ck-ink)') : 'var(--ck-surface-alt)',
                color: on ? '#fff' : 'var(--ck-ink-soft)',
                border: '1px solid ' + (on ? (t.color ?? 'var(--ck-ink)') : 'var(--ck-line)'),
              }}>
              {t.name}
            </button>
          );
        })}
        {tags.length === 0 && <div style={{ fontSize: 13, color: 'var(--ck-muted)' }}>No tags. Add some in Masters → Tags.</div>}
      </div>
    </Modal>
  );
}

// Shared minimal View modal
function ViewApplicantModal({ applicant, statuses, onClose }: { applicant: Applicant; statuses: Lookup[]; onClose: () => void }) {
  const status = statuses.find((s) => s.code === applicant.status);
  return (
    <Modal open onClose={onClose} title={applicant.full_name} subtitle={applicant.app_no ?? ''} width={560}
      footer={<Button onClick={onClose}>Close</Button>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Detail label="Email" value={applicant.email} />
        <Detail label="Phone" value={applicant.phone ?? '—'} />
        <Detail label="Source" value={applicant.source ?? '—'} />
        <Detail label="Status" value={
          <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: status?.color ?? 'var(--ck-line-soft)', color: status?.color ? '#fff' : 'var(--ck-ink-soft)' }}>
            {status?.label ?? applicant.status}
          </span>
        } />
        <Detail label="Experience" value={applicant.experience_years != null ? `${applicant.experience_years} years` : '—'} />
        <Detail label="Match %" value={applicant.match_ratio != null ? `${applicant.match_ratio}%` : '—'} />
        <Detail label="Screening Score" value={applicant.screen_score != null ? `${applicant.screen_score}%` : '—'} />
        <Detail label="Interview Score" value={applicant.interview_score != null ? `${applicant.interview_score}%` : '—'} />
        <Detail label="Current role" value={applicant.current_role ?? '—'} />
        <Detail label="Current company" value={applicant.current_company ?? '—'} />
        <Detail label="Location" value={applicant.location ?? '—'} />
        <Detail label="Salary" value={formatSalary(applicant.salary_min, applicant.salary_max, applicant.salary_currency)} />
        <Detail label="Education" value={applicant.education_level ?? '—'} />
        <Detail label="Institution" value={applicant.institution ?? '—'} />
      </div>
    </Modal>
  );
}

function Detail({ label, value, full }: { label: string; value: ReactNode; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ck-ink)' }}>{value}</div>
    </div>
  );
}

function Toolbar({ search, setSearch, right }: { search: string; setSearch: (v: string) => void; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--ck-muted)', pointerEvents: 'none' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, App ID..."
          style={{ width: '100%', height: 36, padding: '0 12px 0 32px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 12.5, background: 'var(--ck-surface)' }} />
      </div>
      {right && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{right}</div>}
    </div>
  );
}

const th: CSSProperties = { padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em', whiteSpace: 'nowrap', textAlign: 'left' };
const thRight: CSSProperties = { ...th, textAlign: 'right' };
const td: CSSProperties = { padding: '12px 16px', verticalAlign: 'middle' };
const tdRight: CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };

// Essential applicant columns shared by Screening / Interviews / Offers / Hire.
// Source, role, company, location, salary, education and the screen/interview
// scores live in the View panel (ViewApplicantModal) to keep the table readable.
function CommonCols({ a, idx, statuses }: { a: Applicant; idx: number; statuses: Lookup[] }) {
  return (
    <>
      <td style={td}><CandidateCell a={a} idx={idx} /></td>
      <td style={{ ...td, color: 'var(--ck-ink-soft)' }}>{a.experience_years != null ? `${a.experience_years}y` : '—'}</td>
      <td style={{ ...td, fontWeight: 700, color: 'var(--ck-accent)' }}>{a.match_ratio != null ? `${a.match_ratio}%` : '—'}</td>
      <td style={td}><StatusBadge a={a} statuses={statuses} /></td>
    </>
  );
}

// Render a funnel table header: shared essentials + per-tab trailing cols.
// 'ACTIONS' is right-aligned to sit at the table edge.
function FunnelHead({ trailing }: { trailing: string[] }) {
  return (
    <thead>
      <tr style={{ background: 'var(--ck-bg)' }}>
        {[...COMMON_HEADERS, ...trailing].map((h) => <th key={h} style={h === 'ACTIONS' ? thRight : th}>{h}</th>)}
      </tr>
    </thead>
  );
}

const COMMON_HEADERS = ['CANDIDATE', 'EXP', 'MATCH %', 'STATUS'];
// Trimmed tables share the same column count → one colSpan for loading/empty rows.
const FUNNEL_COLSPAN = 6;

// ─── SCREENING TAB ─────────────────────────────────────────────────────────
export function ScreeningTab({ listingId }: { listingId: string }) {
  const [search, setSearch] = useState('');
  const { statuses, tags } = useFunnelLookups();
  const { apps, loading, refresh } = useStageApplicants(listingId, { stages: ['screening'], search });

  const [target, setTarget] = useState<Applicant | null>(null);
  const [viewTarget, setViewTarget] = useState<Applicant | null>(null);
  const [tagTarget, setTagTarget] = useState<Applicant | null>(null);

  const approve = async (a: Applicant) => {
    try { await api.post(`/applicants/${a.id}/approve-interview`); toast.success(`${a.full_name} → Interview`); refresh(); }
    catch { toast.error('Failed'); }
  };
  const hold = async (a: Applicant) => {
    try { await api.post(`/applicants/${a.id}/hold`); refresh(); }
    catch { toast.error('Failed'); }
  };
  const reject = async (a: Applicant) => {
    if (!window.confirm(`Reject ${a.full_name}?`)) return;
    try { await api.post(`/applicants/${a.id}/reject`); refresh(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div>
      <Toolbar search={search} setSearch={setSearch} />
      <div className="ck-table-wrap" style={{ border: '1px solid var(--ck-line)', borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <FunnelHead trailing={['TAGS', 'ACTIONS']} />
          <tbody>
            {loading && <tr><td colSpan={FUNNEL_COLSPAN} style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</td></tr>}
            {!loading && apps.length === 0 && (
              <tr><td colSpan={FUNNEL_COLSPAN} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                No candidates in screening yet. Click "Send to Screening" on an application.
              </td></tr>
            )}
            {apps.map((a, i) => (
              <tr key={a.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
                <CommonCols a={a} idx={i} statuses={statuses} />
                <td style={td}><TagsCell tags={a.tags} /></td>
                <td style={tdRight}>
                  <ActionBar actions={[
                    { icon: Eye, label: 'View', hint: 'View applicant', onClick: () => setViewTarget(a) },
                    { icon: ClipboardCheck, label: 'Screen', hint: 'Fill screening', onClick: () => setTarget(a) },
                    { icon: ArrowRight, label: 'Approve', hint: a.screen_score != null ? 'Approve for interview' : 'Complete the screening first', tone: 'success', disabled: a.screen_score == null, onClick: () => approve(a) },
                    { icon: PauseCircle, label: 'Hold', hint: 'Put applicant on hold', tone: 'warning', onClick: () => hold(a) },
                    { icon: Ban, label: 'Reject', hint: 'Reject applicant', tone: 'danger', onClick: () => reject(a) },
                    { icon: TagIcon, label: 'Tag', hint: 'Tag applicant', onClick: () => setTagTarget(a) },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target && <ScreeningModal applicant={target} onClose={() => setTarget(null)} onSaved={() => { setTarget(null); refresh(); }} />}
      {viewTarget && <ViewApplicantModal applicant={viewTarget} statuses={statuses} onClose={() => setViewTarget(null)} />}
      {tagTarget && <TagPickerModal applicant={tagTarget} tags={tags} onClose={() => setTagTarget(null)} onSaved={() => { setTagTarget(null); refresh(); }} />}
    </div>
  );
}

function ScreeningModal({ applicant, onClose, onSaved }: { applicant: Applicant; onClose: () => void; onSaved: () => void }) {
  const [templates, setTemplates] = useState<ScreeningTemplate[]>([]);
  const [existing,  setExisting]  = useState<Screening | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState('');
  const [notes, setNotes] = useState('');
  const [score, setScore] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ data: ScreeningTemplate[] }>('/hiring/screening-templates').then((r) => {
      setTemplates(r.data.data);
      const def = r.data.data.find((t) => Number(t.is_default)) ?? r.data.data[0];
      setTemplateId((cur) => cur || def?.id || '');
    }).catch(() => {});
    api.get<{ data: Screening | null }>(`/applicants/${applicant.id}/screening`).then((r) => {
      const s = r.data.data;
      if (s) {
        setExisting(s);
        setTemplateId(s.template_id ?? '');
        setResponses(parseObj(s.responses_json));
        setResult(s.result ?? '');
        setNotes(s.notes ?? '');
        setScore(s.score ?? '');
      }
    }).catch(() => {});
  }, [applicant.id]);

  const tpl = templates.find((t) => t.id === templateId);
  const fields = asFields(tpl?.fields_json);
  const computed = useMemo(() => computeWeightedScore(fields, responses), [fields, responses]);
  const effectiveScore = score === '' ? computed : Number(score);

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/applicants/${applicant.id}/screening`, {
        templateId: templateId || null, responses, score: effectiveScore, result: result || null, notes: notes || null,
      });
      toast.success('Screening saved');
      onSaved();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Screening" subtitle={applicant.full_name} width={620}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : existing ? 'Update' : 'Save'}</Button>
      </>}>
      <FormGrid>
        <Field label="Template">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={inp}>
            <option value="">Select template</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label={`Score (${computed != null ? `auto ${computed}%` : 'manual'})`}>
          <input type="number" min={0} max={100} value={score} placeholder={computed != null ? String(computed) : ''}
            onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
        </Field>
        <Field label="Result">
          <select value={result} onChange={(e) => setResult(e.target.value)} style={inp}>
            <option value="">—</option>
            <option value="pass">Pass</option>
            <option value="maybe">Maybe</option>
            <option value="fail">Fail</option>
          </select>
        </Field>
        <Field label="Notes" full>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inp, height: 'auto', padding: 10 }} />
        </Field>
        {fields.length > 0 && (
          <Field label="Questionnaire" full>
            <DynamicFieldsForm fields={fields} responses={responses} setResponses={setResponses} />
          </Field>
        )}
      </FormGrid>
    </Modal>
  );
}

// ─── INTERVIEWS TAB ────────────────────────────────────────────────────────
export function InterviewsTab({ listingId }: { listingId: string }) {
  const [search, setSearch] = useState('');
  const { statuses, tags } = useFunnelLookups();
  const { apps, loading, refresh } = useStageApplicants(listingId, { stages: ['interview'], search });

  const [scheduleTarget, setScheduleTarget] = useState<Applicant | null>(null);
  const [completeTarget, setCompleteTarget] = useState<Applicant | null>(null);
  const [viewTarget, setViewTarget] = useState<Applicant | null>(null);
  const [tagTarget, setTagTarget] = useState<Applicant | null>(null);

  const offer = async (a: Applicant) => {
    try {
      await api.post(`/applicants/${a.id}/offer`, {});
      toast.success(`${a.full_name} → Offers`);
      refresh();
    } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <Toolbar search={search} setSearch={setSearch} />
      <div className="ck-table-wrap" style={{ border: '1px solid var(--ck-line)', borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <FunnelHead trailing={['TAGS', 'ACTIONS']} />
          <tbody>
            {loading && <tr><td colSpan={FUNNEL_COLSPAN} style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</td></tr>}
            {!loading && apps.length === 0 && (
              <tr><td colSpan={FUNNEL_COLSPAN} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                No interviews scheduled. Approve a screened candidate to begin.
              </td></tr>
            )}
            {apps.map((a, i) => (
              <tr key={a.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
                <CommonCols a={a} idx={i} statuses={statuses} />
                <td style={td}><TagsCell tags={a.tags} /></td>
                <td style={tdRight}>
                  <ActionBar actions={[
                    { icon: Eye, label: 'View', hint: 'View applicant', onClick: () => setViewTarget(a) },
                    { icon: Calendar, label: 'Schedule', hint: 'Schedule interview', onClick: () => setScheduleTarget(a) },
                    { icon: Play, label: 'Start', hint: a.status === 'Interview Scheduled' ? 'Start / score interview' : 'Schedule the interview first', disabled: a.status !== 'Interview Scheduled', onClick: () => setCompleteTarget(a) },
                    { icon: ArrowRight, label: 'Offer', hint: a.status === 'Interview Scheduled' ? 'Offer job' : 'Schedule & conduct the interview first', tone: 'success', disabled: a.status !== 'Interview Scheduled', onClick: () => offer(a) },
                    { icon: UserX, label: 'No Show', hint: a.status === 'Interview Scheduled' ? 'Mark as no show' : 'No interview scheduled yet', tone: 'warning', disabled: a.status !== 'Interview Scheduled', onClick: async () => { await api.post(`/applicants/${a.id}/no-show`); refresh(); } },
                    { icon: PauseCircle, label: 'Hold', hint: 'Put applicant on hold', tone: 'warning', onClick: async () => { await api.post(`/applicants/${a.id}/hold`); refresh(); } },
                    { icon: Ban, label: 'Reject', hint: 'Reject applicant', tone: 'danger', onClick: async () => { if (window.confirm(`Reject ${a.full_name}?`)) { await api.post(`/applicants/${a.id}/reject`); refresh(); } } },
                    { icon: TagIcon, label: 'Tag', hint: 'Tag applicant', onClick: () => setTagTarget(a) },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {scheduleTarget && <ScheduleInterviewModal applicant={scheduleTarget} onClose={() => setScheduleTarget(null)} onSaved={() => { setScheduleTarget(null); refresh(); }} />}
      {completeTarget && <InterviewRoundsModal applicant={completeTarget} onClose={() => setCompleteTarget(null)} onChanged={refresh} />}
      {viewTarget && <ViewApplicantModal applicant={viewTarget} statuses={statuses} onClose={() => setViewTarget(null)} />}
      {tagTarget && <TagPickerModal applicant={tagTarget} tags={tags} onClose={() => setTagTarget(null)} onSaved={() => { setTagTarget(null); refresh(); }} />}
    </div>
  );
}

function ScheduleInterviewModal({ applicant, onClose, onSaved }: { applicant: Applicant; onClose: () => void; onSaved: () => void }) {
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [modes, setModes] = useState<Lookup[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [mode, setMode] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState<number | ''>(60);
  const [interviewerUserId, setInterviewerUserId] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get<{ data: InterviewTemplate[] }>('/hiring/interview-templates').then((r) => setTemplates(r.data.data)).catch(() => {});
    api.get<{ data: Lookup[] }>('/lookups', { params: { category: 'interview_mode' } }).then((r) => setModes(r.data.data)).catch(() => {});
    api.get<{ data: UserRow[] }>('/users').then((r) => setUsers(r.data.data)).catch(() => {});
  }, []);
  const save = async () => {
    if (!scheduledAt) { toast.error('Schedule time required'); return; }
    setSaving(true);
    try {
      await api.post(`/applicants/${applicant.id}/interviews`, {
        templateId: templateId || null, mode: mode || null, scheduledAt,
        durationMinutes: duration === '' ? null : duration,
        interviewerUserId: interviewerUserId || null, meetingUrl: meetingUrl || null,
      });
      toast.success('Interview scheduled');
      onSaved();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title="Schedule interview" subtitle={applicant.full_name} width={560}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Schedule'}</Button>
      </>}>
      <FormGrid>
        <Field label="Template">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={inp}>
            <option value="">— None —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </Field>
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={inp}>
            <option value="">Select</option>
            {modes.map((m) => <option key={m.id} value={m.code}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Scheduled at *"><input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} style={inp} /></Field>
        <Field label="Duration (min)"><input type="number" value={duration} onChange={(e) => setDuration(e.target.value === '' ? '' : Number(e.target.value))} style={inp} /></Field>
        <Field label="Interviewer">
          <select value={interviewerUserId} onChange={(e) => setInterviewerUserId(e.target.value)} style={inp}>
            <option value="">— None —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.first_name ? `${u.first_name} ${u.last_name}` : u.email}</option>)}
          </select>
        </Field>
        <Field label="Meeting URL"><input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} style={inp} placeholder="https://meet.google.com/…" /></Field>
      </FormGrid>
    </Modal>
  );
}

function InterviewRoundsModal({ applicant, onClose, onChanged }: { applicant: Applicant; onClose: () => void; onChanged: () => void }) {
  const [rounds, setRounds] = useState<Interview[]>([]);
  const [activeRound, setActiveRound] = useState<Interview | null>(null);

  const fetch = () => {
    api.get<{ data: Interview[] }>(`/applicants/${applicant.id}/interviews`)
      .then((r) => setRounds(r.data.data))
      .catch(() => setRounds([]));
  };
  useEffect(fetch, [applicant.id]);

  const share = async (id: string) => {
    try { await api.post(`/applicants/interviews/${id}/share`); toast.message('Share will be wired with email/WhatsApp/LinkedIn integration. Marked shared.'); fetch(); }
    catch { toast.error('Failed'); }
  };
  const start = async (id: string) => {
    try { await api.post(`/applicants/interviews/${id}/start`); fetch(); }
    catch { toast.error('Failed'); }
  };

  return (
    <Modal open onClose={onClose} title="Interview rounds" subtitle={applicant.full_name} width={760}
      footer={<Button onClick={() => { onChanged(); onClose(); }}>Done</Button>}>
      {rounds.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--ck-muted)' }}>No rounds scheduled yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rounds.map((r) => (
            <div key={r.id} style={{ border: '1px solid var(--ck-line)', borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--ck-ink)' }}>Round {r.round_no} {r.template_title ? `· ${r.template_title}` : ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--ck-muted)', marginTop: 3 }}>
                    {r.mode ?? '—'} · {fmtDateTime(r.scheduled_at)} {r.duration_minutes ? `(${r.duration_minutes} min)` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ck-muted)' }}>
                    Interviewer: {r.interviewer_name ?? r.interviewer_email ?? '—'}
                  </div>
                  {r.meeting_url && <div style={{ fontSize: 11.5 }}><a href={r.meeting_url} target="_blank" rel="noreferrer">{r.meeting_url}</a></div>}
                  <div style={{ fontSize: 11.5, color: 'var(--ck-muted)', marginTop: 6 }}>
                    {r.shared_at ? `Shared ${fmtDateTime(r.shared_at)}` : 'Not shared'}
                    {' · '}{r.started_at ? `Started ${fmtDateTime(r.started_at)}` : 'Not started'}
                    {' · '}{r.completed_at ? `Completed ${fmtDateTime(r.completed_at)}` : 'Pending'}
                    {r.score != null && ` · Score ${r.score}%`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <IconAction icon={Send} label="Share" hint="Share schedule" iconSize={15} onClick={() => share(r.id)} />
                  <IconAction icon={Play} label="Start" hint="Mark started" iconSize={15} disabled={!!r.started_at} onClick={() => start(r.id)} />
                  <IconAction icon={ClipboardCheck} label="Score" hint="Score / complete interview" iconSize={15} onClick={() => setActiveRound(r)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeRound && (
        <CompleteInterviewModal
          applicantId={applicant.id}
          round={activeRound}
          onClose={() => setActiveRound(null)}
          onSaved={() => { setActiveRound(null); fetch(); onChanged(); }}
        />
      )}
    </Modal>
  );
}

function CompleteInterviewModal({ applicantId, round, onClose, onSaved }: { applicantId: string; round: Interview; onClose: () => void; onSaved: () => void }) {
  void applicantId;
  const [responses, setResponses] = useState<Record<string, unknown>>(parseObj(round.responses_json));
  const [score, setScore] = useState<number | ''>(round.score ?? '');
  const [result, setResult] = useState(round.result ?? '');
  const [notes, setNotes] = useState(round.notes ?? '');
  const [saving, setSaving] = useState(false);
  const fields = asFields(round.template_fields);
  const computed = useMemo(() => computeWeightedScore(fields, responses), [fields, responses]);
  const effectiveScore = score === '' ? computed : Number(score);
  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/applicants/interviews/${round.id}/complete`, {
        responses, score: effectiveScore, result: result || null, notes: notes || null,
      });
      toast.success('Interview scored');
      onSaved();
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Round ${round.round_no} scorecard`} width={620}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </>}>
      <FormGrid>
        <Field label={`Score (${computed != null ? `auto ${computed}%` : 'manual'})`}>
          <input type="number" min={0} max={100} value={score} placeholder={computed != null ? String(computed) : ''}
            onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
        </Field>
        <Field label="Result">
          <select value={result} onChange={(e) => setResult(e.target.value)} style={inp}>
            <option value="">—</option>
            <option value="pass">Pass</option>
            <option value="hold">Hold</option>
            <option value="fail">Fail</option>
            <option value="no_show">No Show</option>
          </select>
        </Field>
        <Field label="Notes" full>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inp, height: 'auto', padding: 10 }} />
        </Field>
        {fields.length > 0 && (
          <Field label="Scorecard" full>
            <DynamicFieldsForm fields={fields} responses={responses} setResponses={setResponses} />
          </Field>
        )}
      </FormGrid>
    </Modal>
  );
}

// ─── OFFERS TAB ────────────────────────────────────────────────────────────
export function OffersTab({ listingId }: { listingId: string }) {
  const [search, setSearch] = useState('');
  const { statuses, tags } = useFunnelLookups();
  const { apps, loading, refresh } = useStageApplicants(listingId, { stages: ['offer'], search });

  const [draftTarget, setDraftTarget] = useState<Applicant | null>(null);
  const [viewTarget, setViewTarget] = useState<Applicant | null>(null);
  const [tagTarget, setTagTarget] = useState<Applicant | null>(null);

  const action = async (a: Applicant, path: string, msg: string) => {
    try { await api.post(`/applicants/${a.id}/offer/${path}`); toast.success(msg); refresh(); }
    catch { toast.error('Failed'); }
  };

  const hire = async (a: Applicant) => {
    if (!window.confirm(`Hire ${a.full_name}? They'll move to the Hire tab.`)) return;
    try { await api.post(`/applicants/${a.id}/hire`); toast.success(`${a.full_name} hired`); refresh(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div>
      <Toolbar search={search} setSearch={setSearch} />
      <div className="ck-table-wrap" style={{ border: '1px solid var(--ck-line)', borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <FunnelHead trailing={['TAGS', 'ACTIONS']} />
          <tbody>
            {loading && <tr><td colSpan={FUNNEL_COLSPAN} style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</td></tr>}
            {!loading && apps.length === 0 && (
              <tr><td colSpan={FUNNEL_COLSPAN} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                No offers yet. Click "Offer Job" on an interviewed candidate.
              </td></tr>
            )}
            {apps.map((a, i) => (
              <tr key={a.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
                <CommonCols a={a} idx={i} statuses={statuses} />
                <td style={td}><TagsCell tags={a.tags} /></td>
                <td style={tdRight}>
                  <ActionBar actions={[
                    { icon: Eye, label: 'View', hint: 'View applicant', onClick: () => setViewTarget(a) },
                    { icon: FileText, label: 'Draft', hint: 'Draft / edit offer', onClick: () => setDraftTarget(a) },
                    { icon: Send, label: 'Share', hint: a.offer_status != null ? 'Share offer' : 'Draft the offer first', disabled: a.offer_status == null, onClick: () => action(a, 'share', 'Offer marked Sent') },
                    { icon: CheckCircle2, label: 'Accept', hint: a.offer_status === 'Sent' || a.offer_status === 'Accepted' ? 'Mark offer accepted' : 'Share the offer first', tone: 'success', disabled: a.offer_status !== 'Sent', onClick: () => action(a, 'accept', 'Offer Accepted') },
                    { icon: XCircle, label: 'Decline', hint: a.offer_status === 'Sent' ? 'Mark offer declined' : 'Share the offer first', tone: 'danger', disabled: a.offer_status !== 'Sent', onClick: () => action(a, 'decline', 'Offer Declined') },
                    { icon: UserCheck, label: 'Hire', hint: a.offer_status === 'Accepted' ? 'Hire candidate' : 'Offer must be accepted first', tone: 'success', disabled: a.offer_status !== 'Accepted', onClick: () => hire(a) },
                    { icon: TagIcon, label: 'Tag', hint: 'Tag applicant', onClick: () => setTagTarget(a) },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draftTarget && <OfferDraftModal applicant={draftTarget} onClose={() => setDraftTarget(null)} onSaved={() => { setDraftTarget(null); refresh(); }} />}
      {viewTarget && <ViewApplicantModal applicant={viewTarget} statuses={statuses} onClose={() => setViewTarget(null)} />}
      {tagTarget && <TagPickerModal applicant={tagTarget} tags={tags} onClose={() => setTagTarget(null)} onSaved={() => { setTagTarget(null); refresh(); }} />}
    </div>
  );
}

function OfferDraftModal({ applicant, onClose, onSaved }: { applicant: Applicant; onClose: () => void; onSaved: () => void }) {
  const [templates, setTemplates] = useState<OfferTemplate[]>([]);
  const [existing,  setExisting]  = useState<OfferRow | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [ctc, setCtc] = useState<number | ''>('');
  const [currency, setCurrency] = useState('INR');
  const [joiningDate, setJoiningDate] = useState('');
  const [designation, setDesignation] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ data: OfferTemplate[] }>('/hiring/offer-templates').then((r) => {
      setTemplates(r.data.data);
      const def = r.data.data.find((t) => Number(t.is_default)) ?? r.data.data[0];
      setTemplateId((cur) => cur || def?.id || '');
    }).catch(() => {});
    api.get<{ data: OfferRow | null }>(`/applicants/${applicant.id}/offer`).then((r) => {
      const o = r.data.data;
      if (o) {
        setExisting(o);
        setTemplateId(o.template_id ?? '');
        setCtc(o.ctc != null ? Number(o.ctc) : '');
        setCurrency(o.ctc_currency ?? 'INR');
        setJoiningDate(o.joining_date?.slice(0, 10) ?? '');
        setDesignation(o.designation ?? '');
        setDraftBody(o.draft_body ?? '');
      }
    }).catch(() => {});
  }, [applicant.id]);

  // Render body from template + context if no draft yet
  const tpl = templates.find((t) => t.id === templateId);
  useEffect(() => {
    if (!draftBody && tpl?.body_md) {
      const ctx = {
        candidate_name: applicant.full_name,
        designation: designation || (applicant as Applicant & { current_role?: string | null }).current_role || '',
        ctc: ctc === '' ? '' : String(ctc),
        ctc_currency: currency,
        joining_date: joiningDate,
        branch: '', company: '',
      };
      setDraftBody(renderMergeTokens(tpl.body_md, ctx));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const regenerate = () => {
    if (!tpl?.body_md) return;
    const ctx = {
      candidate_name: applicant.full_name,
      designation: designation || '',
      ctc: ctc === '' ? '' : String(ctc),
      ctc_currency: currency,
      joining_date: joiningDate,
      branch: '', company: '',
    };
    setDraftBody(renderMergeTokens(tpl.body_md, ctx));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/applicants/${applicant.id}/offer`, {
        templateId: templateId || null, draftBody, ctc: ctc === '' ? null : ctc,
        ctcCurrency: currency, joiningDate: joiningDate || null, designation: designation || null,
      });
      toast.success('Offer saved');
      onSaved();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Offer letter" subtitle={applicant.full_name} width={760}
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : existing ? 'Update' : 'Save Draft'}</Button>
      </>}>
      <FormGrid>
        <Field label="Template">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={inp}>
            <option value="">— None —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Designation"><input value={designation} onChange={(e) => setDesignation(e.target.value)} style={inp} /></Field>
        <Field label="CTC"><input type="number" value={ctc} onChange={(e) => setCtc(e.target.value === '' ? '' : Number(e.target.value))} style={inp} /></Field>
        <Field label="Currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inp}>
            {['INR', 'USD', 'EUR', 'GBP', 'AED'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Joining date"><input type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} style={inp} /></Field>
        <Field label="" full>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>Letter body (markdown)</span>
            <button type="button" onClick={regenerate} style={{ background: 'none', border: 'none', color: 'var(--ck-accent)', fontSize: 11.5, cursor: 'pointer' }}>Regenerate from template</button>
          </div>
          <textarea rows={14} value={draftBody} onChange={(e) => setDraftBody(e.target.value)}
            style={{ ...inp, height: 'auto', padding: 10, fontFamily: 'var(--ck-font-mono)' }} />
        </Field>
      </FormGrid>
    </Modal>
  );
}

// ─── HIRE TAB ──────────────────────────────────────────────────────────────
export function HireTab({ listingId }: { listingId: string }) {
  const [search, setSearch] = useState('');
  const { statuses, tags } = useFunnelLookups();
  const { apps, loading, refresh } = useStageApplicants(listingId, { stages: ['hired'], search });

  const [viewTarget, setViewTarget] = useState<Applicant | null>(null);
  const [tagTarget, setTagTarget] = useState<Applicant | null>(null);

  const onboard = async (a: Applicant) => {
    if (!window.confirm(`Send ${a.full_name} to Onboarding?`)) return;
    try {
      await api.post(`/applicants/${a.id}/onboard`);
      toast.success(`${a.full_name} sent to Onboarding`);
      refresh();
    } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <Toolbar search={search} setSearch={setSearch} />
      <div className="ck-table-wrap" style={{ border: '1px solid var(--ck-line)', borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <FunnelHead trailing={['TAGS', 'ACTIONS']} />
          <tbody>
            {loading && <tr><td colSpan={FUNNEL_COLSPAN} style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</td></tr>}
            {!loading && apps.length === 0 && (
              <tr><td colSpan={FUNNEL_COLSPAN} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                No hired candidates yet.
              </td></tr>
            )}
            {apps.map((a, i) => (
              <tr key={a.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
                <CommonCols a={a} idx={i} statuses={statuses} />
                <td style={td}><TagsCell tags={a.tags} /></td>
                <td style={tdRight}>
                  <ActionBar actions={[
                    { icon: Eye, label: 'View', hint: 'View applicant', onClick: () => setViewTarget(a) },
                    { icon: UserCheck, label: 'Onboard', hint: 'Send to onboarding', tone: 'success', onClick: () => onboard(a) },
                    { icon: Ban, label: 'Reject', hint: 'Reject applicant', tone: 'danger', onClick: async () => { if (window.confirm(`Reject ${a.full_name}?`)) { await api.post(`/applicants/${a.id}/reject`); refresh(); } } },
                    { icon: TagIcon, label: 'Tag', hint: 'Tag applicant', onClick: () => setTagTarget(a) },
                  ]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {viewTarget && <ViewApplicantModal applicant={viewTarget} statuses={statuses} onClose={() => setViewTarget(null)} />}
      {tagTarget && <TagPickerModal applicant={tagTarget} tags={tags} onClose={() => setTagTarget(null)} onSaved={() => { setTagTarget(null); refresh(); }} />}
    </div>
  );
}

// ─── ACTIVITIES TAB ────────────────────────────────────────────────────────
// Activity pill colour by meaning: green = positive milestones, red = negative,
// amber = hold, blue = neutral process steps, grey = meta (tag / status change).
const ACT_POSITIVE = new Set(['approve_interview', 'accept_offer', 'hire', 'onboard']);
const ACT_NEGATIVE = new Set(['reject', 'decline_offer', 'no_show']);
const ACT_PROCESS  = new Set(['screen', 'schedule_interview', 'start_interview', 'complete_interview', 'share_schedule', 'draft_offer', 'share_offer']);
function activityPillStyle(action: string): { background: string; color: string } {
  if (ACT_POSITIVE.has(action)) return { background: 'var(--ck-success-bg)', color: 'var(--ck-success-fg)' };
  if (ACT_NEGATIVE.has(action)) return { background: 'var(--ck-danger-bg)',  color: 'var(--ck-danger-fg)' };
  if (action === 'hold')        return { background: 'var(--ck-warning-bg)', color: 'var(--ck-warning-fg)' };
  if (ACT_PROCESS.has(action))  return { background: 'var(--ck-info-bg)',    color: 'var(--ck-info-fg)' };
  return { background: 'var(--ck-line-soft)', color: 'var(--ck-ink-soft)' }; // tag, status_change, unknown
}

export function ActivitiesTab({ listingId }: { listingId: string }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.get<{ data: ActivityRow[] }>(`/job-listings/${listingId}/activities`)
      .then((r) => setRows(r.data.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [listingId]);
  return (
    <div>
      {loading && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</div>}
      {!loading && rows.length === 0 && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <ActivityIcon size={28} />
          <div>No activity yet. Actions on applicants will appear here.</div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: 12, padding: '12px 4px', borderBottom: '1px solid var(--ck-line)' }}>
            <div style={{ minWidth: 140, fontSize: 11.5, color: 'var(--ck-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtDateTime(r.created_at)}
            </div>
            <div style={{ flex: 1, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>{r.actor_name ?? r.actor_email ?? 'System'}</span>
              {' · '}
              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'capitalize', ...activityPillStyle(r.action) }}>{r.action.replace(/_/g, ' ')}</span>
              {' · '}
              <span style={{ color: 'var(--ck-ink)' }}>{r.applicant_name ?? '—'}</span>{r.app_no ? <span style={{ color: 'var(--ck-muted)' }}> ({r.app_no})</span> : null}
              {(r.from_status || r.to_status) && (
                <div style={{ fontSize: 11.5, color: 'var(--ck-muted)', marginTop: 2 }}>
                  {r.from_status ?? '—'} → {r.to_status ?? '—'}
                </div>
              )}
              {r.message && <div style={{ fontSize: 12, color: 'var(--ck-ink-soft)', marginTop: 2 }}>{r.message}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dynamic form for screening/interview field schemas ────────────────────
function DynamicFieldsForm({ fields, responses, setResponses }: {
  fields: ScreeningField[]; responses: Record<string, unknown>; setResponses: (next: Record<string, unknown>) => void;
}) {
  const set = (name: string, value: unknown) => setResponses({ ...responses, [name]: value });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
      {fields.map((f) => (
        <label key={f.name} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>
            {f.label}{f.required && <span style={{ color: 'var(--ck-danger-fg)' }}> *</span>}
            {f.weight ? <span style={{ color: 'var(--ck-muted)', fontWeight: 400 }}> · weight {f.weight}</span> : null}
          </span>
          {f.type === 'text' && (
            <input value={String(responses[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} style={inp} />
          )}
          {f.type === 'number' && (
            <input type="number" value={String(responses[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
          )}
          {f.type === 'select' && (
            <select value={String(responses[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} style={inp}>
              <option value="">—</option>
              {(f.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          )}
          {f.type === 'checkbox' && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={Boolean(responses[f.name])} onChange={(e) => set(f.name, e.target.checked)} />
              Yes
            </label>
          )}
        </label>
      ))}
    </div>
  );
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>{children}</div>;
}

function Field({ label, full, children }: { label: string; full?: boolean; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: full ? '1 / -1' : 'auto' }}>
      {label && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ck-ink-soft)' }}>{label}</span>}
      {children}
    </label>
  );
}

function parseObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string' && v) { try { const p = JSON.parse(v); return p && typeof p === 'object' ? p : {}; } catch { return {}; } }
  return {};
}
