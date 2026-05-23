// Compensation Master — detail / edit / view page (Phase 02).
//
// New record:  /compensations/new       → empty form, POST on save
// Existing:    /compensations/:id       → load + edit (Draft/Approved) or read-only (Active/Archived)
//
// Status transitions are exposed as separate buttons; only the ones legal
// for the current status appear.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle2, Zap, Archive as ArchiveIcon, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusPill } from '../../components/ui/StatusPill';

const RECORD_TYPES = ['Template', 'Offer', 'Joining', 'Increment', 'One-time'];

type OtherAllowance = { name: string; amount: number };
type Compensation = {
  id: string; code: string; record_type: string;
  employee_id: string | null; employee_code: string | null; employee_name: string | null;
  template_id: string | null; template_code: string | null;
  effective_from: string; effective_to: string | null;
  annual_ctc: number | string;
  basic: number | string | null;
  hra: number | string | null;
  conveyance: number | string | null;
  medical_allowance: number | string | null;
  other_allowances: OtherAllowance[] | string | null;
  variable_pay: number | string | null;
  variable_pay_pct: number | string | null;
  pf_applicable: number | boolean;
  esi_applicable: number | boolean;
  payroll_code: string | null;
  status: string;
  approved_by_user_id: string | null;
  approved_by_email: string | null;
  approved_at: string | null;
  attachment_url: string | null;
  reason_for_change: string | null;
  notes: string | null;
};

type EmployeeOpt = { id: string; code: string; first_name: string; last_name: string };
type TemplateOpt = { id: string; code: string; record_type: string };

const empty = (): Compensation => ({
  id: '', code: '', record_type: 'Joining',
  employee_id: null, employee_code: null, employee_name: null,
  template_id: null, template_code: null,
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: null,
  annual_ctc: 0,
  basic: null, hra: null, conveyance: null, medical_allowance: null,
  other_allowances: [], variable_pay: null, variable_pay_pct: null,
  pf_applicable: 0, esi_applicable: 0, payroll_code: null,
  status: 'Draft',
  approved_by_user_id: null, approved_by_email: null, approved_at: null,
  attachment_url: null, reason_for_change: null, notes: null,
});

function paiseToRupees(v: number | string | null | undefined): string {
  if (v == null || v === '') return '';
  return String(Math.round(Number(v) / 100));
}
function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('en-IN'); } catch { return s; }
}
function parseOther(v: OtherAllowance[] | string | null | undefined): OtherAllowance[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}

export function CompensationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<Compensation>(empty);
  // Other allowances kept as a structured array; the API takes JSON.
  const [allowances, setAllowances] = useState<OtherAllowance[]>([]);
  // Editable in Draft, Approved. View-only in Active/Archived.
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [templates, setTemplates] = useState<TemplateOpt[]>([]);

  useEffect(() => {
    // Load options once. Employees + Templates picker; approver list is server-side.
    Promise.all([
      api.get<{ data: EmployeeOpt[] }>('/employees', { params: { page: 1, pageSize: 1000 } }),
      api.get<{ data: TemplateOpt[] }>('/compensations', { params: { recordType: 'Template', pageSize: 200 } }),
    ]).then(([e, t]) => {
      setEmployees(e.data.data ?? []);
      setTemplates(t.data.data ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) {
      const f = empty();
      setForm(f); setAllowances([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get<{ data: Compensation }>(`/compensations/${id}`)
      .then((r) => {
        const c = r.data.data;
        setForm(c);
        setAllowances(parseOther(c.other_allowances));
      })
      .catch(() => toast.error('Failed to load compensation'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const editable = isNew || form.status === 'Draft' || form.status === 'Approved';

  const set = <K extends keyof Compensation>(k: K, v: Compensation[K]) => setForm({ ...form, [k]: v });

  const annual = Number(form.annual_ctc) || 0;
  const grossMonthly = useMemo(() => Math.round(annual / 100 / 12), [annual]);

  const buildPayload = () => {
    return {
      recordType: form.record_type,
      employeeId: form.record_type === 'Template' ? null : (form.employee_id || null),
      templateId: form.template_id || null,
      effectiveFrom: form.effective_from,
      effectiveTo: form.effective_to,
      annualCtc: paiseToRupees(form.annual_ctc),
      basic: paiseToRupees(form.basic),
      hra: paiseToRupees(form.hra),
      conveyance: paiseToRupees(form.conveyance),
      medicalAllowance: paiseToRupees(form.medical_allowance),
      otherAllowances: allowances.filter((a) => a.name && a.amount).map((a) => ({ name: a.name, amount: Math.round(Number(a.amount) * 100) })),
      variablePay: paiseToRupees(form.variable_pay),
      variablePayPct: form.variable_pay_pct,
      pfApplicable: !!form.pf_applicable,
      esiApplicable: !!form.esi_applicable,
      payrollCode: form.payroll_code,
      attachmentUrl: form.attachment_url,
      reasonForChange: form.reason_for_change,
      notes: form.notes,
    };
  };

  const onSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        const r = await api.post<{ data: { id: string; code: string } }>('/compensations', buildPayload());
        toast.success(`Created ${r.data.data.code}`);
        navigate(`/compensations/${r.data.data.id}`, { replace: true });
      } else {
        await api.patch(`/compensations/${id}`, buildPayload());
        toast.success('Saved');
        const r = await api.get<{ data: Compensation }>(`/compensations/${id}`);
        setForm(r.data.data); setAllowances(parseOther(r.data.data.other_allowances));
      }
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Save failed';
      toast.error(m);
    } finally { setSaving(false); }
  };

  const transition = async (path: 'approve' | 'activate' | 'archive') => {
    if (!id || isNew) return;
    try {
      await api.post(`/compensations/${id}/${path}`);
      toast.success(`Marked ${path}d`.replace('archived', 'archived'));
      const r = await api.get<{ data: Compensation }>(`/compensations/${id}`);
      setForm(r.data.data); setAllowances(parseOther(r.data.data.other_allowances));
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Transition failed';
      toast.error(m, { duration: 8000 });
    }
  };

  const onDelete = async () => {
    if (!id || isNew) return;
    if (!window.confirm('Delete this draft compensation? This cannot be undone.')) return;
    try {
      await api.delete(`/compensations/${id}`);
      toast.success('Deleted');
      navigate('/compensations');
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Delete failed';
      toast.error(m);
    }
  };

  if (loading) {
    return <div><PageHeader title="Compensation" subtitle="Loading…" /><Card padding={48}><div style={{ textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</div></Card></div>;
  }

  const status = form.status;
  return (
    <div>
      <PageHeader
        title={isNew ? 'New Compensation' : `Compensation ${form.code}`}
        subtitle={isNew ? 'Draft a new salary record — components, applicability, and approval.' : undefined}
        actions={<>
          <Button icon={ArrowLeft} variant="ghost" onClick={() => navigate('/compensations')}>Back to list</Button>
          {editable && <Button icon={Save} variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create Draft' : 'Save'}</Button>}
          {!isNew && status === 'Draft'    && <Button icon={CheckCircle2} onClick={() => transition('approve')}>Approve</Button>}
          {!isNew && status === 'Approved' && form.employee_id && <Button icon={Zap} variant="primary" onClick={() => transition('activate')}>Activate (sync to employee)</Button>}
          {!isNew && (status === 'Approved' || status === 'Active' || status === 'Draft') && <Button icon={ArchiveIcon} onClick={() => transition('archive')}>Archive</Button>}
          {!isNew && status === 'Draft'    && <Button icon={Trash2} variant="danger" onClick={onDelete}>Delete</Button>}
        </>}
      />

      {/* Identity band */}
      <Card padding={20}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          <KV label="Code">
            {isNew ? <span style={{ color: 'var(--ck-muted)', fontStyle: 'italic' }}>(auto on save)</span>
              : <span style={{ fontFamily: 'var(--ck-font-mono)' }}>{form.code}</span>}
          </KV>
          <KV label="Status"><StatusPill status={status} /></KV>
          <KV label="Record Type">{form.record_type}</KV>
          <KV label="Employee">
            {form.employee_code
              ? <Link to={`/employees/${form.employee_id}`} style={{ color: 'var(--ck-accent)', fontWeight: 600, textDecoration: 'none' }}>{form.employee_name} ({form.employee_code})</Link>
              : <span style={{ color: 'var(--ck-muted)', fontStyle: 'italic' }}>—</span>}
          </KV>
          <KV label="Annual CTC">
            <span style={{ fontWeight: 700 }}>₹ {Math.round(annual / 100).toLocaleString('en-IN')}</span>
            <span style={{ fontSize: 11, color: 'var(--ck-muted)', marginLeft: 6 }}>(₹ {grossMonthly.toLocaleString('en-IN')}/mo gross)</span>
          </KV>
        </div>
      </Card>

      {/* Header form */}
      <Card padding={24} style={{ marginTop: 16 }}>
        <Section title="Header">
          <Grid3>
            <Field label="Record Type *">
              <select value={form.record_type} onChange={(e) => set('record_type', e.target.value)} style={inp} disabled={!editable}>
                {RECORD_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Employee">
              {form.record_type === 'Template' ? (
                <ReadOnly>(Not applicable for Templates)</ReadOnly>
              ) : (
                <select value={form.employee_id ?? ''} onChange={(e) => set('employee_id', e.target.value || null)} style={inp} disabled={!editable}>
                  <option value="">— Select —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.code})</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Template (optional)">
              <select value={form.template_id ?? ''} onChange={(e) => set('template_id', e.target.value || null)} style={inp} disabled={!editable}>
                <option value="">— None —</option>
                {templates.filter((t) => t.id !== form.id).map((t) => (
                  <option key={t.id} value={t.id}>{t.code}</option>
                ))}
              </select>
            </Field>
            <Field label="Effective From *">
              <input type="date" value={form.effective_from?.slice(0, 10) ?? ''} onChange={(e) => set('effective_from', e.target.value)} style={inp} disabled={!editable} />
            </Field>
            <Field label="Effective To">
              <input type="date" value={form.effective_to?.slice(0, 10) ?? ''} onChange={(e) => set('effective_to', e.target.value || null)} style={inp} disabled={!editable} />
            </Field>
            <Field label="Payroll Code">
              <input value={form.payroll_code ?? ''} onChange={(e) => set('payroll_code', e.target.value || null)} placeholder="PR-EMP-0123" style={inp} disabled={!editable} />
            </Field>
          </Grid3>
        </Section>

        <Section title="Salary Components (₹ per year)">
          <Grid3>
            <Field label="Annual CTC *">
              <RupeesInput value={form.annual_ctc} editing={editable} onChange={(v) => set('annual_ctc', v == null ? 0 : Math.round(v * 100))} placeholder="600000" />
            </Field>
            <Field label="Basic">
              <RupeesInput value={form.basic} editing={editable} onChange={(v) => set('basic', v == null ? null : Math.round(v * 100))} placeholder="240000" />
            </Field>
            <Field label="HRA">
              <RupeesInput value={form.hra} editing={editable} onChange={(v) => set('hra', v == null ? null : Math.round(v * 100))} placeholder="96000" />
            </Field>
            <Field label="Conveyance">
              <RupeesInput value={form.conveyance} editing={editable} onChange={(v) => set('conveyance', v == null ? null : Math.round(v * 100))} placeholder="19200" />
            </Field>
            <Field label="Medical Allowance">
              <RupeesInput value={form.medical_allowance} editing={editable} onChange={(v) => set('medical_allowance', v == null ? null : Math.round(v * 100))} placeholder="15000" />
            </Field>
            <Field label="Variable Pay (% of CTC)">
              {editable ? (
                <input type="number" step="0.01" value={form.variable_pay_pct ?? ''} onChange={(e) => set('variable_pay_pct', e.target.value === '' ? null : Number(e.target.value))} placeholder="10" style={inp} />
              ) : (
                <ReadOnly>{form.variable_pay_pct != null ? `${form.variable_pay_pct}%` : '—'}</ReadOnly>
              )}
            </Field>
          </Grid3>
        </Section>

        <Section
          title="Other Allowances"
          right={editable ? <button onClick={() => setAllowances([...allowances, { name: '', amount: 0 }])} style={ghostBtn}><Plus size={14} style={{ marginRight: 4 }} /> Add</button> : null}>
          {allowances.length === 0 ? (
            <Muted>No other allowances configured.</Muted>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allowances.map((a, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 40px', gap: 10, alignItems: 'center' }}>
                  <input value={a.name} onChange={(e) => { const next = [...allowances]; next[i] = { ...a, name: e.target.value }; setAllowances(next); }}
                    placeholder="Special / LTA / Telephone" style={inp} disabled={!editable} />
                  <input type="number" value={a.amount || ''} onChange={(e) => { const next = [...allowances]; next[i] = { ...a, amount: Number(e.target.value) }; setAllowances(next); }}
                    placeholder="₹ per year" style={inp} disabled={!editable} />
                  {editable && (
                    <button onClick={() => setAllowances(allowances.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: '1px solid var(--ck-line)', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: 'var(--ck-ink-soft)' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Statutory">
          <Grid3>
            <CheckboxField label="PF Applicable" checked={!!form.pf_applicable} editing={editable} onChange={(b) => set('pf_applicable', b ? 1 : 0)} />
            <CheckboxField label="ESI Applicable" checked={!!form.esi_applicable} editing={editable} onChange={(b) => set('esi_applicable', b ? 1 : 0)} />
            <div />
          </Grid3>
        </Section>

        <Section title="Approval & Audit">
          <Grid3>
            <Field label="Approved By">
              <ReadOnly>{form.approved_by_email ?? '—'}</ReadOnly>
            </Field>
            <Field label="Approved On">
              <ReadOnly>{fmtDateTime(form.approved_at)}</ReadOnly>
            </Field>
            <div />
          </Grid3>
        </Section>

        <Section title="Attachments & Notes">
          <Field label="Attachment URL">
            <input value={form.attachment_url ?? ''} onChange={(e) => set('attachment_url', e.target.value || null)} placeholder="https://…/offer_letter.pdf" style={inp} disabled={!editable} />
          </Field>
          <Field label="Reason for Change">
            <input value={form.reason_for_change ?? ''} onChange={(e) => set('reason_for_change', e.target.value || null)} placeholder="Joining Offer / Annual Increment / …" style={inp} disabled={!editable} />
          </Field>
          <Field label="Notes">
            <textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} rows={3}
              style={{ ...inp, height: 'auto', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }} disabled={!editable} />
          </Field>
        </Section>
      </Card>
    </div>
  );
}

// ─── Small UI primitives (local to this file) ──────────────────────────────
const inp: React.CSSProperties = {
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
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
        {right}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}
function Grid3({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </label>
  );
}
function ReadOnly({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13.5, padding: '8px 10px', background: 'var(--ck-bg)', borderRadius: 7, color: 'var(--ck-ink)', minHeight: 36, display: 'flex', alignItems: 'center' }}>{children}</div>;
}
function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: 'var(--ck-muted)', fontStyle: 'italic' }}>{children}</div>;
}
function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ck-ink)' }}>{children}</div>
    </div>
  );
}
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
// Rupees-on-the-wire input that converts to/from paise on the way in/out.
function RupeesInput({ value, editing, onChange, placeholder }: {
  value: number | string | null | undefined; editing: boolean;
  onChange: (rupees: number | null) => void; placeholder?: string;
}) {
  if (!editing) {
    if (value == null) return <ReadOnly>—</ReadOnly>;
    return <ReadOnly>₹ {Math.round(Number(value) / 100).toLocaleString('en-IN')}</ReadOnly>;
  }
  const rupees = value == null || value === '' ? '' : Math.round(Number(value) / 100);
  return (
    <input type="number" value={rupees} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      style={inp} />
  );
}
