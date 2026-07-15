import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Check, X, MessageSquarePlus, Bell, Plus, Trash2,
  FileText, ShieldOff, CheckCircle2, AlertTriangle, Flag, FileDown, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MediaUpload } from '../../components/ui/MediaUpload';
import { api } from '../../lib/api';
import { useAuth } from '../../stores/auth';
import { StatusBadge, STAGE_LABELS } from './ExitListPage';

/* eslint-disable @typescript-eslint/no-explicit-any */
type ExitCase = Record<string, any>;

const STAGES = ['INITIATION', 'APPROVAL', 'CLEARANCE', 'INTERVIEW', 'SETTLEMENT', 'ACCESS_CLOSURE', 'COMPLETED'];
const TABS = [
  { key: 'INITIATION', label: 'Initiation' },
  { key: 'APPROVAL', label: 'Approval & Notice' },
  { key: 'CLEARANCE', label: 'Handover & Clearance' },
  { key: 'INTERVIEW', label: 'Exit Interview' },
  { key: 'SETTLEMENT', label: 'Final Settlement' },
  { key: 'ACCESS_CLOSURE', label: 'Access & Closure' },
];
const inr = (v: any) => `₹${(Number(v) || 0).toLocaleString('en-IN')}`;

export function ExitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ExitCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('INITIATION');

  const reload = useCallback(async () => {
    try {
      const r = await api.get<{ data: ExitCase }>(`/exits/${id}`);
      setData(r.data.data);
    } catch { toast.error('Failed to load exit case'); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { if (data?.stage && TABS.some((t) => t.key === data.stage)) setTab(data.stage); }, [data?.stage]);

  if (loading) return <div style={{ padding: 40, color: 'var(--ck-muted)' }}>Loading…</div>;
  if (!data) return <div style={{ padding: 40 }}>Exit case not found.</div>;

  const currentIdx = STAGES.indexOf(data.stage);

  return (
    <div>
      <button onClick={() => navigate('/exit-clearance')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--ck-accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 12, padding: 0 }}>
        <ArrowLeft size={15} /> All exits
      </button>

      {/* Header */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--ck-ink)' }}>{data.employee_name}</h1>
              <StatusBadge status={data.status} />
              <span style={{ fontSize: 11, fontWeight: 600, color: data.exit_type === 'TERMINATION' ? 'oklch(0.45 0.16 20)' : 'var(--ck-ink-soft)' }}>
                {data.exit_type === 'TERMINATION' ? 'Termination' : 'Resignation'}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>
              {data.code} · {data.employee_code} · {data.designation ?? '—'} · {data.department_name ?? '—'} · {data.branch_name ?? '—'}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12.5, color: 'var(--ck-muted)' }}>
            <div>Proposed LWD: <b style={{ color: 'var(--ck-ink-soft)' }}>{data.proposed_last_working_day ?? '—'}</b></div>
            <div>Notice: <b style={{ color: 'var(--ck-ink-soft)' }}>{data.notice_period_type?.replace(/_/g, ' ') ?? '—'}</b></div>
          </div>
        </div>

        {/* Stage tracker */}
        <div style={{ display: 'flex', gap: 4, marginTop: 18, flexWrap: 'wrap' }}>
          {STAGES.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '1 1 auto', minWidth: 90 }}>
              <div style={{ flex: 1 }}>
                <div style={{ height: 4, borderRadius: 2, background: i <= currentIdx ? 'var(--ck-accent)' : 'var(--ck-line)' }} />
                <div style={{ fontSize: 10.5, marginTop: 5, fontWeight: i === currentIdx ? 700 : 500, color: i <= currentIdx ? 'var(--ck-ink)' : 'var(--ck-faint)' }}>
                  {STAGE_LABELS[s]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid var(--ck-line)', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '9px 14px', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid var(--ck-accent)' : '2px solid transparent', color: tab === t.key ? 'var(--ck-ink)' : 'var(--ck-muted)', fontWeight: tab === t.key ? 700 : 500, fontSize: 13, cursor: 'pointer', marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'INITIATION' && <InitiationTab data={data} reload={reload} />}
      {tab === 'APPROVAL' && <ApprovalTab data={data} reload={reload} />}
      {tab === 'CLEARANCE' && <ClearanceTab data={data} reload={reload} />}
      {tab === 'INTERVIEW' && <InterviewTab data={data} reload={reload} />}
      {tab === 'SETTLEMENT' && <SettlementTab data={data} reload={reload} />}
      {tab === 'ACCESS_CLOSURE' && <AccessTab data={data} reload={reload} />}
    </div>
  );
}

// Shared helpers ------------------------------------------------------------
type TabProps = { data: ExitCase; reload: () => Promise<void> };

async function call(fn: () => Promise<any>, ok: string, reload: () => Promise<void>) {
  try { await fn(); toast.success(ok); await reload(); }
  catch (err) {
    const e = err as { response?: { data?: { error?: { message?: string } } } };
    toast.error(e.response?.data?.error?.message ?? 'Action failed');
  }
}

const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 12 };
const fieldLabel: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--ck-faint)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 5, display: 'block' };
const input: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', fontSize: 13, fontFamily: 'inherit', outline: 'none' };
const smallSelect: React.CSSProperties = { height: 32, padding: '0 8px', borderRadius: 7, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer' };

function StatusPill({ status }: { status: string }) {
  const done = ['CLEARED', 'RETURNED', 'REVOKED', 'COMPLETED', 'APPROVED'].includes(status);
  const na = status === 'NA' || status === 'SKIPPED';
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: done ? 'oklch(0.95 0.05 150)' : na ? 'var(--ck-line-soft)' : 'oklch(0.96 0.04 70)', color: done ? 'oklch(0.42 0.13 150)' : na ? 'var(--ck-muted)' : 'oklch(0.5 0.12 70)' }}>{status.replace(/_/g, ' ')}</span>;
}

// 1. Initiation -------------------------------------------------------------
function InitiationTab({ data, reload }: TabProps) {
  const [reason, setReason] = useState(data.reason ?? '');
  const [detail, setDetail] = useState(data.reason_detail ?? '');
  const [proposedLwd, setProposedLwd] = useState(data.proposed_last_working_day?.slice(0, 10) ?? '');
  const [actualLwd, setActualLwd] = useState(data.actual_last_working_day?.slice(0, 10) ?? '');
  const [notice, setNotice] = useState(data.notice_period_type ?? 'FULL');
  const [docUrl, setDocUrl] = useState(data.resignation_doc_url ?? '');
  const readOnly = ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(data.status);

  return (
    <Card>
      <div style={sectionTitle}>Exit Details</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><label style={fieldLabel}>Reason</label><input value={reason} onChange={(e) => setReason(e.target.value)} style={input} disabled={readOnly} /></div>
        <div><label style={fieldLabel}>Notice Period Type</label>
          <select value={notice} onChange={(e) => setNotice(e.target.value)} style={{ ...input, cursor: 'pointer' }} disabled={readOnly}>
            {['FULL', 'WAIVED', 'BUYOUT', 'GARDEN_LEAVE'].map((n) => <option key={n} value={n}>{n.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div><label style={fieldLabel}>Proposed Last Working Day</label><input type="date" value={proposedLwd} onChange={(e) => setProposedLwd(e.target.value)} style={input} disabled={readOnly} /></div>
        <div><label style={fieldLabel}>Actual Last Working Day</label><input type="date" value={actualLwd} onChange={(e) => setActualLwd(e.target.value)} style={input} disabled={readOnly} /></div>
        <div style={{ gridColumn: '1 / -1' }}><label style={fieldLabel}>Detailed Reason / Notes</label>
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} style={{ ...input, height: 'auto', padding: 10, resize: 'vertical' }} disabled={readOnly} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}><label style={fieldLabel}>Resignation Letter / Separation Notice</label>
          <MediaUpload mode="file" value={docUrl} onChange={setDocUrl} readOnly={readOnly} />
        </div>
      </div>

      {!readOnly && (
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Button variant="secondary" onClick={() => call(() => api.patch(`/exits/${data.id}`, {
            reason, reasonDetail: detail, proposedLastWorkingDay: proposedLwd || null,
            actualLastWorkingDay: actualLwd || null, noticePeriodType: notice, resignationDocUrl: docUrl || null,
          }), 'Saved', reload)}>Save Details</Button>
          {data.status === 'DRAFT' && (
            <Button variant="primary" icon={Send} onClick={() => call(() => api.post(`/exits/${data.id}/submit`), 'Submitted for approval', reload)}>
              Submit for Approval
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// 2. Approval ---------------------------------------------------------------
function ApprovalTab({ data, reload }: TabProps) {
  const role = useAuth((s) => s.user?.role);
  const canAct = role === 'HR_ADMIN' || role === 'MANAGER';
  const [note, setNote] = useState('');
  const act = (action: string) => call(() => api.post(`/exits/${data.id}/approvals`, { action, note: note || null }), `Recorded ${action.toLowerCase()}`, reload).then(() => setNote(''));
  const decided = ['APPROVED', 'REJECTED', 'COMPLETED', 'IN_PROGRESS'].includes(data.status);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      <Card>
        <div style={sectionTitle}>Approval Actions</div>
        {data.status === 'DRAFT' ? (
          <div style={{ fontSize: 13, color: 'var(--ck-muted)' }}>Submit the case from the Initiation tab first.</div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 12.5 }}>
              <div>Manager: <b style={{ color: data.manager_approved_at ? 'oklch(0.42 0.13 150)' : 'var(--ck-muted)' }}>{data.manager_approved_at ? 'Acknowledged' : 'Pending'}</b></div>
              <div>HR: <b style={{ color: data.hr_approved_at ? 'oklch(0.42 0.13 150)' : 'var(--ck-muted)' }}>{data.hr_approved_at ? 'Approved' : 'Pending'}</b></div>
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)…" rows={2} style={{ ...input, height: 'auto', padding: 10, resize: 'vertical', marginBottom: 12 }} disabled={!canAct} />
            {canAct ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {role === 'MANAGER' && !decided && <Button variant="secondary" icon={Check} onClick={() => act('ACKNOWLEDGE')}>Acknowledge</Button>}
                {!decided && <Button variant="primary" icon={Check} onClick={() => act('APPROVE')}>Approve</Button>}
                {!decided && <Button variant="danger" icon={X} onClick={() => act('REJECT')}>Reject</Button>}
                <Button variant="secondary" icon={MessageSquarePlus} onClick={() => act('NOTE')}>Add Note</Button>
                <Button variant="ghost" icon={Bell} onClick={() => act('REMINDER')}>Send Reminder</Button>
              </div>
            ) : <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>Only Managers / HR can act on approvals.</div>}
          </>
        )}
      </Card>

      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ck-line)', ...sectionTitle, marginBottom: 0 }}>Approval Log</div>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {(data.approvals ?? []).length === 0 ? (
            <div style={{ padding: 18, fontSize: 12.5, color: 'var(--ck-muted)' }}>No actions yet.</div>
          ) : data.approvals.map((a: any) => (
            <div key={a.id} style={{ padding: '10px 18px', borderBottom: '1px solid var(--ck-line-soft)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)' }}>{a.action.replace(/_/g, ' ')} <span style={{ fontWeight: 400, color: 'var(--ck-faint)' }}>· {a.actor_role ?? ''}</span></div>
              {a.note && <div style={{ fontSize: 12, color: 'var(--ck-muted)', marginTop: 2 }}>{a.note}</div>}
              <div style={{ fontSize: 11, color: 'var(--ck-faint)', marginTop: 2 }}>{new Date(a.created_at).toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// 3. Clearance --------------------------------------------------------------
function ClearanceTab({ data, reload }: TabProps) {
  const items: any[] = data.clearance ?? [];
  const groups: Array<{ kind: string; title: string; statuses: string[] }> = [
    { kind: 'NDC', title: 'Departmental No-Dues (NDC)', statuses: ['PENDING', 'IN_PROGRESS', 'CLEARED', 'NA'] },
    { kind: 'ASSET', title: 'Asset Return', statuses: ['PENDING', 'RETURNED', 'NA'] },
    { kind: 'HANDOVER', title: 'Work / Knowledge Handover', statuses: ['PENDING', 'IN_PROGRESS', 'CLEARED', 'NA'] },
  ];
  const [newAsset, setNewAsset] = useState('');
  const [newHandover, setNewHandover] = useState('');

  const setStatus = (itemId: string, status: string) => call(() => api.patch(`/exits/clearance/${itemId}`, { status }), 'Updated', reload);
  const del = (itemId: string) => call(() => api.delete(`/exits/clearance/${itemId}`), 'Removed', reload);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {groups.map((g) => {
        const rows = items.filter((i) => i.kind === g.kind);
        return (
          <Card key={g.kind} padding={0}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ck-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...sectionTitle, marginBottom: 0 }}>{g.title}</span>
              <span style={{ fontSize: 12, color: 'var(--ck-muted)' }}>{rows.filter((r) => ['CLEARED', 'RETURNED', 'NA'].includes(r.status)).length}/{rows.length} done</span>
            </div>
            {rows.map((r) => (
              <div key={r.id} style={{ padding: '10px 18px', borderBottom: '1px solid var(--ck-line-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--ck-ink)' }}>{r.department ?? r.asset_name ?? r.label ?? '—'}</div>
                <StatusPill status={r.status} />
                <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} style={smallSelect}>
                  {g.statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                {g.kind !== 'NDC' && <button onClick={() => del(r.id)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-faint)' }}><Trash2 size={15} /></button>}
              </div>
            ))}
            {g.kind === 'ASSET' && (
              <div style={{ padding: '10px 18px', display: 'flex', gap: 8 }}>
                <input value={newAsset} onChange={(e) => setNewAsset(e.target.value)} placeholder="Asset name (e.g. Laptop, ID Card)" style={{ ...input, height: 34 }} />
                <Button size="sm" variant="secondary" icon={Plus} onClick={() => newAsset && call(() => api.post(`/exits/${data.id}/clearance`, { kind: 'ASSET', assetName: newAsset }), 'Added', reload).then(() => setNewAsset(''))}>Add</Button>
              </div>
            )}
            {g.kind === 'HANDOVER' && (
              <div style={{ padding: '10px 18px', display: 'flex', gap: 8 }}>
                <input value={newHandover} onChange={(e) => setNewHandover(e.target.value)} placeholder="Handover item / task description" style={{ ...input, height: 34 }} />
                <Button size="sm" variant="secondary" icon={Plus} onClick={() => newHandover && call(() => api.post(`/exits/${data.id}/clearance`, { kind: 'HANDOVER', label: newHandover }), 'Added', reload).then(() => setNewHandover(''))}>Add</Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// 4. Interview --------------------------------------------------------------
const EXIT_QUESTIONS = [
  'Primary reason for leaving?',
  'What did you like most about working here?',
  'What could the company improve?',
  'Would you recommend us as an employer?',
];
function InterviewTab({ data, reload }: TabProps) {
  const iv = data.interview ?? {};
  let parsed: Array<{ q: string; a: string }> = EXIT_QUESTIONS.map((q) => ({ q, a: '' }));
  try { if (iv.questionnaire) { const j = JSON.parse(iv.questionnaire); if (Array.isArray(j)) parsed = EXIT_QUESTIONS.map((q) => ({ q, a: j.find((x: any) => x.q === q)?.a ?? '' })); } } catch { /* keep defaults */ }
  const [answers, setAnswers] = useState(parsed);
  const [scheduledAt, setScheduledAt] = useState(iv.scheduled_at?.slice(0, 16) ?? '');
  const [hrNotes, setHrNotes] = useState(iv.hr_notes ?? '');
  const [grievance, setGrievance] = useState(!!iv.grievance_flag);
  const [sentiment, setSentiment] = useState(iv.overall_sentiment ?? '');

  const save = (status?: string) => call(() => api.patch(`/exits/${data.id}/interview`, {
    scheduledAt: scheduledAt ? scheduledAt.replace('T', ' ') + ':00' : null,
    questionnaire: answers, hrNotes, grievanceFlag: grievance,
    overallSentiment: sentiment || null, status: status ?? iv.status,
    conductedAt: status === 'COMPLETED' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : undefined,
  }), 'Saved', reload);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={sectionTitle}>Exit Interview & Feedback</div>
        <StatusPill status={iv.status ?? 'PENDING'} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div><label style={fieldLabel}>Schedule</label><input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} style={input} /></div>
        <div><label style={fieldLabel}>Overall Sentiment</label>
          <select value={sentiment} onChange={(e) => setSentiment(e.target.value)} style={{ ...input, cursor: 'pointer' }}>
            <option value="">—</option><option value="POSITIVE">Positive</option><option value="NEUTRAL">Neutral</option><option value="NEGATIVE">Negative</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        {answers.map((qa, i) => (
          <div key={qa.q}>
            <label style={fieldLabel}>{qa.q}</label>
            <textarea value={qa.a} onChange={(e) => setAnswers((prev) => prev.map((p, j) => j === i ? { ...p, a: e.target.value } : p))} rows={2} style={{ ...input, height: 'auto', padding: 10, resize: 'vertical' }} />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={fieldLabel}>HR Notes</label>
        <textarea value={hrNotes} onChange={(e) => setHrNotes(e.target.value)} rows={2} style={{ ...input, height: 'auto', padding: 10, resize: 'vertical' }} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: grievance ? 'oklch(0.45 0.16 20)' : 'var(--ck-ink-soft)', cursor: 'pointer', marginBottom: 18 }}>
        <input type="checkbox" checked={grievance} onChange={(e) => setGrievance(e.target.checked)} />
        <Flag size={14} /> Flag a grievance for HR follow-up
      </label>

      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" onClick={() => save()}>Save</Button>
        <Button variant="primary" icon={CheckCircle2} onClick={() => save('COMPLETED')}>Mark Completed</Button>
      </div>
    </Card>
  );
}

// 5. Settlement -------------------------------------------------------------
function SettlementTab({ data, reload }: TabProps) {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'HR_ADMIN' || role === 'FINANCE';
  const s = data.settlement ?? {};
  const lines: any[] = s.lines ?? [];
  const earnings = lines.filter((l) => l.kind === 'EARNING');
  const deductions = lines.filter((l) => l.kind === 'DEDUCTION');
  const [newLabel, setNewLabel] = useState(''); const [newKind, setNewKind] = useState('EARNING'); const [newAmt, setNewAmt] = useState('');

  const patchLine = (lineId: string, amount: string) => call(() => api.patch(`/exits/settlement/lines/${lineId}`, { amount: Number(amount) || 0 }), 'Updated', reload);
  const delLine = (lineId: string) => call(() => api.delete(`/exits/settlement/lines/${lineId}`), 'Removed', reload);

  const DOCS = [
    { type: 'SETTLEMENT_SHEET', label: 'Final Settlement Sheet' },
    { type: 'RELIEVING_LETTER', label: 'Relieving Letter' },
    { type: 'EXPERIENCE_CERTIFICATE', label: 'Experience Certificate' },
    { type: 'REFERENCE_LETTER', label: 'Reference Letter (optional)' },
  ];
  const docs: any[] = data.documents ?? [];

  const LineTable = ({ title, rows }: { title: string; rows: any[] }) => (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ck-ink-soft)', marginBottom: 6 }}>{title}</div>
      {rows.map((l) => (
        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--ck-line-soft)' }}>
          <div style={{ flex: 1, fontSize: 12.5 }}>{l.label}</div>
          <input type="number" defaultValue={Number(l.amount)} disabled={!canEdit} onBlur={(e) => canEdit && patchLine(l.id, e.target.value)} style={{ width: 120, height: 30, padding: '0 8px', borderRadius: 6, border: '1px solid var(--ck-line)', fontSize: 12.5, textAlign: 'right', fontFamily: 'inherit' }} />
          {canEdit && <button onClick={() => delLine(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-faint)' }}><Trash2 size={14} /></button>}
        </div>
      ))}
      {rows.length === 0 && <div style={{ fontSize: 12, color: 'var(--ck-muted)', padding: '4px 0' }}>None</div>}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={sectionTitle}>Final Settlement (FNF)</div>
          <StatusPill status={s.status ?? 'DRAFT'} />
        </div>

        {lines.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ck-muted)', marginBottom: 14 }}>
            No settlement lines yet. {canEdit && 'Prefill the standard components from payroll, then adjust amounts.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <LineTable title="Earnings" rows={earnings} />
            <LineTable title="Deductions" rows={deductions} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '14px 0 0', borderTop: '2px solid var(--ck-line)' }}>
          <div style={{ display: 'flex', gap: 20, fontSize: 12.5 }}>
            <span>Gross: <b>{inr(s.gross_earnings)}</b></span>
            <span>Deductions: <b>{inr(s.total_deductions)}</b></span>
            <span style={{ fontSize: 14 }}>Net Payable: <b style={{ color: 'oklch(0.42 0.13 150)' }}>{inr(s.net_payable)}</b></span>
          </div>
        </div>

        {canEdit && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {lines.length === 0 && <Button variant="secondary" onClick={() => call(() => api.post(`/exits/${data.id}/settlement/prefill`), 'Prefilled', reload)}>Prefill from Payroll</Button>}
            {lines.length > 0 && <>
              <select value={newKind} onChange={(e) => setNewKind(e.target.value)} style={smallSelect}><option value="EARNING">Earning</option><option value="DEDUCTION">Deduction</option></select>
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Line label" style={{ ...input, height: 32, width: 180 }} />
              <input type="number" value={newAmt} onChange={(e) => setNewAmt(e.target.value)} placeholder="Amount" style={{ ...input, height: 32, width: 110 }} />
              <Button size="sm" variant="secondary" icon={Plus} onClick={() => newLabel && call(() => api.post(`/exits/${data.id}/settlement/lines`, { kind: newKind, label: newLabel, amount: Number(newAmt) || 0 }), 'Added', reload).then(() => { setNewLabel(''); setNewAmt(''); })}>Add Line</Button>
              {s.status !== 'APPROVED' && <Button size="sm" variant="primary" icon={Check} onClick={() => call(() => api.post(`/exits/${data.id}/settlement/approve`), 'Settlement approved', reload)}>Approve Settlement</Button>}
            </>}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ ...sectionTitle, marginBottom: 0 }}>Documents</div>
          <a href="/settings/documents" style={{ fontSize: 12, color: 'var(--ck-accent)', fontWeight: 600 }}>Configure templates →</a>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ck-muted)', marginBottom: 12 }}>
          Generate a PDF from the configured template, or upload your own. Letterhead, body text and signatory are set in Settings → Document Templates.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {DOCS.map((d) => {
            const existing = docs.find((x) => x.doc_type === d.type);
            return (
              <div key={d.type} style={{ border: '1px solid var(--ck-line)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>
                  <FileText size={14} style={{ color: 'var(--ck-accent)' }} /> {d.label}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {existing?.url && (
                    <a href={existing.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--ck-accent)', fontWeight: 600 }}>
                      <Download size={13} /> View
                    </a>
                  )}
                  {canEdit && (
                    <Button size="sm" variant={existing ? 'secondary' : 'primary'} icon={FileDown}
                      onClick={() => call(() => api.post(`/exits/${data.id}/documents/generate`, { docType: d.type }), `${d.label} generated`, reload)}>
                      {existing ? 'Regenerate' : 'Generate'}
                    </Button>
                  )}
                  {!existing && !canEdit && <span style={{ fontSize: 12, color: 'var(--ck-muted)' }}>Not issued</span>}
                </div>
                {canEdit && (
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--ck-faint)' }}>or upload signed copy:</span>
                    <MediaUpload mode="file" value="" onChange={(url) => call(() => api.post(`/exits/${data.id}/documents`, { docType: d.type, title: d.label, url }), 'Document saved', reload)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// 6. Access closure ---------------------------------------------------------
function AccessTab({ data, reload }: TabProps) {
  const role = useAuth((s) => s.user?.role);
  const items: any[] = data.access ?? [];
  const [newSys, setNewSys] = useState('');
  const revokedCount = items.filter((i) => ['REVOKED', 'NA'].includes(i.status)).length;
  const allDone = items.length > 0 && revokedCount === items.length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ck-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...sectionTitle, marginBottom: 0 }}>Access Closure</span>
          <span style={{ fontSize: 12, color: 'var(--ck-muted)' }}>{revokedCount}/{items.length} closed</span>
        </div>
        {items.map((it) => (
          <div key={it.id} style={{ padding: '10px 18px', borderBottom: '1px solid var(--ck-line-soft)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldOff size={15} style={{ color: it.status === 'REVOKED' ? 'oklch(0.42 0.13 150)' : 'var(--ck-faint)' }} />
            <div style={{ flex: 1, fontSize: 13 }}>{it.system_name}</div>
            <StatusPill status={it.status} />
            <select value={it.status} onChange={(e) => call(() => api.patch(`/exits/access/${it.id}`, { status: e.target.value }), 'Updated', reload)} style={smallSelect}>
              {['PENDING', 'REVOKED', 'NA'].map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
        ))}
        <div style={{ padding: '10px 18px', display: 'flex', gap: 8 }}>
          <input value={newSys} onChange={(e) => setNewSys(e.target.value)} placeholder="System / access to revoke" style={{ ...input, height: 34 }} />
          <Button size="sm" variant="secondary" icon={Plus} onClick={() => newSys && call(() => api.post(`/exits/${data.id}/access`, { systemName: newSys }), 'Added', reload).then(() => setNewSys(''))}>Add</Button>
        </div>
      </Card>

      <Card>
        <div style={sectionTitle}>Finalize Exit</div>
        {data.status === 'COMPLETED' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'oklch(0.42 0.13 150)' }}>
            <CheckCircle2 size={16} /> This exit is complete — the employee is marked EXITED.
          </div>
        ) : (
          <>
            {!allDone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'oklch(0.5 0.12 70)', marginBottom: 12 }}>
                <AlertTriangle size={15} /> Close all access items before finalizing (recommended).
              </div>
            )}
            <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', marginBottom: 12 }}>
              Completing sets the employee status to <b>EXITED</b> with their last working day as the exit date. This cannot be undone from here.
            </div>
            {role === 'HR_ADMIN' ? (
              <Button variant="danger" icon={CheckCircle2} onClick={() => call(() => api.post(`/exits/${data.id}/complete`), 'Exit finalized — employee marked EXITED', reload)}>
                Complete Exit
              </Button>
            ) : <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>Only HR Admins can finalize an exit.</div>}
          </>
        )}
      </Card>
    </div>
  );
}
