import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Clock, MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusPill } from '../../components/ui/StatusPill';

type ShiftBreak = {
  id?: string;
  name: string;
  start_offset_min: number;
  duration_min: number;
  is_paid: number | boolean;
  is_mandatory: number | boolean;
};

type Shift = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  company: string | null;
  branch_id: string | null;
  branch_name: string | null;
  location: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  start_time: string;
  end_time: string;
  total_hours: number | string;
  kind: string;
  break_min: number;
  grace_arrival_min: number;
  grace_exit_min: number;
  ot_after_min: number;
  ot_multiplier: number | string;
  breaks: ShiftBreak[];
};

type Branch = { id: string; code: string; name: string; city: string };

type FormState = {
  code: string;
  name: string;
  description: string;
  company: string;
  branchId: string;
  location: string;
  status: 'ACTIVE' | 'INACTIVE';
  startTime: string;
  endTime: string;
  totalHours: string;
  kind: string;
  graceArrivalMin: string;
  graceExitMin: string;
  otAfterMin: string;
  otMultiplier: string;
  breaks: ShiftBreak[];
};

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  description: '',
  company: '',
  branchId: '',
  location: '',
  status: 'ACTIVE',
  startTime: '09:00',
  endTime: '18:00',
  totalHours: '8',
  kind: 'Day Shift',
  graceArrivalMin: '10',
  graceExitMin: '10',
  otAfterMin: '0',
  otMultiplier: '1',
  breaks: [],
};

const inp: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 10px',
  border: '1px solid var(--ck-line)', borderRadius: 8,
  fontSize: 13, background: 'var(--ck-surface)',
};

const inpReadonly: React.CSSProperties = { ...inp, background: 'var(--ck-bg)', color: 'var(--ck-ink-soft)' };

export function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ACTIVE' | 'INACTIVE'>('');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const [editing, setEditing] = useState<Shift | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [breakDraft, setBreakDraft] = useState<ShiftBreak>({ name: '', start_offset_min: 0, duration_min: 30, is_paid: 0, is_mandatory: 0 });

  const [rotationOpen, setRotationOpen] = useState(false);
  const [rotation, setRotation] = useState<string[]>([]);

  const fetchShifts = () => {
    setLoading(true);
    api
      .get<{ data: Shift[] }>('/shifts')
      .then((r) => setShifts(r.data.data))
      .catch(() => toast.error('Failed to load shifts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchShifts();
    api.get<{ data: Branch[] }>('/branches').then((r) => setBranches(r.data.data ?? [])).catch(() => setBranches([]));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shifts.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.branch_name ?? '').toLowerCase().includes(q) ||
        (s.location ?? '').toLowerCase().includes(q) ||
        (s.company ?? '').toLowerCase().includes(q)
      );
    });
  }, [shifts, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setCreating(true);
  };

  const openEdit = (s: Shift) => {
    setCreating(false);
    setEditing(s);
    setForm({
      code: s.code,
      name: s.name,
      description: s.description ?? '',
      company: s.company ?? '',
      branchId: s.branch_id ?? '',
      location: s.location ?? '',
      status: s.status,
      startTime: s.start_time,
      endTime: s.end_time,
      totalHours: String(s.total_hours ?? 8),
      kind: s.kind,
      graceArrivalMin: String(s.grace_arrival_min ?? 0),
      graceExitMin: String(s.grace_exit_min ?? 0),
      otAfterMin: String(s.ot_after_min ?? 0),
      otMultiplier: String(s.ot_multiplier ?? 1),
      breaks: (s.breaks ?? []).map((b) => ({
        name: b.name,
        start_offset_min: Number(b.start_offset_min) || 0,
        duration_min: Number(b.duration_min) || 0,
        is_paid: Number(b.is_paid) ? 1 : 0,
        is_mandatory: Number(b.is_mandatory) ? 1 : 0,
      })),
    });
  };

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_FORM);
  };

  const onSave = async () => {
    if (!form.name.trim()) { toast.error('Shift Name is required'); return; }
    if (!form.startTime || !form.endTime) { toast.error('Start/End time is required'); return; }
    setSaving(true);
    try {
      const breakMinTotal = form.breaks.reduce((sum, b) => sum + (Number(b.duration_min) || 0), 0);
      const payload = {
        code: form.code || undefined,
        name: form.name,
        description: form.description || null,
        company: form.company || null,
        branchId: form.branchId || null,
        location: form.location || null,
        status: form.status,
        startTime: form.startTime,
        endTime: form.endTime,
        totalHours: Number(form.totalHours) || 8,
        kind: form.kind,
        breakMin: breakMinTotal,
        graceArrivalMin: Number(form.graceArrivalMin) || 0,
        graceExitMin: Number(form.graceExitMin) || 0,
        otAfterMin: Number(form.otAfterMin) || 0,
        otMultiplier: Number(form.otMultiplier) || 1,
        breaks: form.breaks.map((b) => ({
          name: b.name,
          startOffsetMin: Number(b.start_offset_min) || 0,
          durationMin: Number(b.duration_min) || 0,
          isPaid: Boolean(Number(b.is_paid)),
          isMandatory: Boolean(Number(b.is_mandatory)),
        })),
      };
      if (editing) {
        await api.patch(`/shifts/${editing.id}`, payload);
        toast.success('Shift updated');
      } else {
        await api.post('/shifts', payload);
        toast.success('Shift created');
      }
      closeForm();
      fetchShifts();
    } catch {
      toast.error('Failed to save shift');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (s: Shift) => {
    if (!window.confirm(`Delete shift "${s.name}"?`)) return;
    try {
      await api.delete(`/shifts/${s.id}`);
      toast.success('Shift deleted');
      fetchShifts();
    } catch { toast.error('Failed to delete shift'); }
  };

  const openAddBreak = () => {
    setBreakDraft({ name: '', start_offset_min: 0, duration_min: 30, is_paid: 0, is_mandatory: 0 });
    setBreakModalOpen(true);
  };

  const saveBreak = () => {
    if (!breakDraft.name.trim()) { toast.error('Break name is required'); return; }
    setForm((prev) => ({ ...prev, breaks: [...prev.breaks, { ...breakDraft }] }));
    setBreakModalOpen(false);
  };

  const removeBreak = (idx: number) => {
    setForm((prev) => ({ ...prev, breaks: prev.breaks.filter((_, i) => i !== idx) }));
  };

  const formOpen = creating || !!editing;

  return (
    <div>
      <PageHeader
        title="Duty Shift Master"
        subtitle="Manage work shifts, timings, breaks, and compliance rules for your organization"
        actions={<Button icon={Plus} variant="primary" onClick={openCreate}>Create Shift</Button>}
      />

      <Card padding={0}>
        <div style={{ display: 'flex', gap: 12, padding: 16, borderBottom: '1px solid var(--ck-line)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ck-muted)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Employees by Designation, Department…"
              style={{ width: '100%', height: 40, padding: '0 12px 0 36px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | 'ACTIVE' | 'INACTIVE')}
            style={{ height: 40, padding: '0 12px', border: '1px solid var(--ck-line)', borderRadius: 8, background: 'var(--ck-surface)', fontSize: 13, minWidth: 140, color: statusFilter ? 'var(--ck-ink)' : 'var(--ck-muted)' }}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div style={{ padding: '14px 22px 4px', fontSize: 14, fontWeight: 600, color: 'var(--ck-ink)' }}>
          Shift Configuration
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                {['SHIFT DETAILS', 'COMPANY', 'LOCATION', 'TIMING', 'STATUS', 'ACTIONS'].map((h) => (
                  <th
                    key={h}
                    style={{ padding: '12px 22px', fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.06em', borderTop: '1px solid var(--ck-line)', borderBottom: '1px solid var(--ck-line)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 56, textAlign: 'center', color: 'var(--ck-muted)' }}>
                    No shifts match this filter.
                  </td>
                </tr>
              )}
              {pageRows.map((s) => {
                const totalHours = Number(s.total_hours) || hoursBetween(s.start_time, s.end_time);
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--ck-line)' }}>
                    <td style={{ padding: '16px 22px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.status === 'ACTIVE' ? '#7da27d' : '#c0c0c0', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ck-ink)' }}>{s.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ck-muted)', fontFamily: 'var(--ck-font-mono)', marginTop: 2 }}>{s.code}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 22px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CompanyGlyph />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ck-ink)' }}>{s.company || 'Concept Kitchen'}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{s.location || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 22px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ck-ink-soft)', fontSize: 13 }}>
                        <MapPin size={14} /> {s.branch_name || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '16px 22px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={14} style={{ color: 'var(--ck-muted)' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ck-ink)', fontFamily: 'var(--ck-font-mono)' }}>{s.start_time} - {s.end_time}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>Total: {totalHours} hours</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 22px', verticalAlign: 'middle' }}>
                      <StatusPill status={s.status === 'ACTIVE' ? 'Active' : 'Inactive'} />
                    </td>
                    <td style={{ padding: '16px 22px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" aria-label="Edit" onClick={() => openEdit(s)} style={iconBtn}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" aria-label="Delete" onClick={() => onDelete(s)} style={iconBtn}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', fontSize: 12.5, color: 'var(--ck-muted)' }}>
          <span>
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} results
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <PagerButton disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</PagerButton>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((n) => (
              <PagerButton key={n} active={n === safePage} onClick={() => setPage(n)}>{n}</PagerButton>
            ))}
            <PagerButton disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</PagerButton>
          </div>
        </div>
      </Card>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit Shift Form' : 'Create New Shift'}
        width={760}
        footer={(
          <>
            <Button onClick={closeForm}>Cancel</Button>
            <Button variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Shift')}</Button>
          </>
        )}
      >
        <Section title="Basic Shift Information">
          <Grid2>
            <Field label="Shift Code">
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="D1" style={inp} />
            </Field>
            <Field label="Shift Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Day Shift" style={inp} />
            </Field>
          </Grid2>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Standard 9-6 office shift with flexible break timings"
              rows={3}
              style={{ ...inp, height: 'auto', padding: 10, resize: 'vertical' }}
            />
          </Field>
          <Grid2>
            <Field label="Company">
              <select value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={inp}>
                <option value="">Select Company</option>
                <option value="Concept Kitchen">Concept Kitchen</option>
              </select>
            </Field>
            <Field label="Branch">
              <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} style={inp}>
                <option value="">Select Branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          </Grid2>
          <Grid2>
            <Field label="Location">
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Production Floor A" style={inp} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'INACTIVE' })} style={inp}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
          </Grid2>
        </Section>

        <Section title="Timing & Hours">
          <Grid3>
            <Field label="Start Time">
              <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} style={inp} />
            </Field>
            <Field label="End Time">
              <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} style={inp} />
            </Field>
            <Field label="Total Hours">
              <input
                type="number"
                step="0.25"
                value={form.totalHours}
                onChange={(e) => setForm({ ...form, totalHours: e.target.value })}
                style={inpReadonly}
              />
            </Field>
          </Grid3>
        </Section>

        <Section
          title="Breaks"
          right={<Button size="sm" icon={Plus} onClick={openAddBreak}>Add Break</Button>}
        >
          {form.breaks.length === 0 && (
            <div style={{ padding: '14px 0', fontSize: 12.5, color: 'var(--ck-muted)' }}>No breaks configured.</div>
          )}
          {form.breaks.map((b, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: idx === 0 ? 'none' : '1px solid var(--ck-line)' }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ck-ink)' }}>{b.name}</div>
              <div style={{ fontSize: 12, color: 'var(--ck-muted)' }}>{b.duration_min} mins</div>
              <Chip>{Number(b.is_paid) ? 'Paid' : 'Unpaid'}</Chip>
              {Number(b.is_mandatory) ? <Chip>Mandatory</Chip> : null}
              <button type="button" aria-label="Remove break" onClick={() => removeBreak(idx)} style={iconBtn}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </Section>

        <Grid2>
          <Field label="Grace Period (Arrival) - Minutes">
            <input type="number" value={form.graceArrivalMin} onChange={(e) => setForm({ ...form, graceArrivalMin: e.target.value })} style={inp} />
          </Field>
          <Field label="Grace Period (Exit) - Minutes">
            <input type="number" value={form.graceExitMin} onChange={(e) => setForm({ ...form, graceExitMin: e.target.value })} style={inp} />
          </Field>
        </Grid2>

        <Section title="Overtime Rules">
          <Grid2>
            <Field label="OT triggers after (minutes past end)">
              <input type="number" value={form.otAfterMin} onChange={(e) => setForm({ ...form, otAfterMin: e.target.value })} style={inp} />
            </Field>
            <Field label="OT Multiplier">
              <input type="number" step="0.25" value={form.otMultiplier} onChange={(e) => setForm({ ...form, otMultiplier: e.target.value })} style={inp} />
            </Field>
          </Grid2>
        </Section>

        <Section title="Rotation Pattern" right={<Button size="sm" onClick={() => setRotationOpen(true)}>Configure</Button>}>
          <div style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {rotation.length === 0 ? 'No rotation set.' : rotation.join(' → ')}
          </div>
        </Section>
      </Modal>

      <Modal
        open={breakModalOpen}
        onClose={() => setBreakModalOpen(false)}
        title="Add Break"
        width={420}
        footer={(
          <>
            <Button onClick={() => setBreakModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveBreak}>Add Break</Button>
          </>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Break Name">
            <input
              value={breakDraft.name}
              onChange={(e) => setBreakDraft({ ...breakDraft, name: e.target.value })}
              placeholder="e.g. Lunch Break"
              style={inp}
            />
          </Field>
          <Grid2>
            <Field label="Start Offset (Minutes)">
              <input
                type="number"
                value={breakDraft.start_offset_min}
                onChange={(e) => setBreakDraft({ ...breakDraft, start_offset_min: Number(e.target.value) || 0 })}
                style={inp}
              />
            </Field>
            <Field label="Duration (Minutes)">
              <input
                type="number"
                value={breakDraft.duration_min}
                onChange={(e) => setBreakDraft({ ...breakDraft, duration_min: Number(e.target.value) || 0 })}
                style={inp}
              />
            </Field>
          </Grid2>
          <div style={{ display: 'flex', gap: 18 }}>
            <CheckboxRow
              label="Paid Break"
              checked={!!Number(breakDraft.is_paid)}
              onChange={(v) => setBreakDraft({ ...breakDraft, is_paid: v ? 1 : 0 })}
            />
            <CheckboxRow
              label="Mandatory"
              checked={!!Number(breakDraft.is_mandatory)}
              onChange={(v) => setBreakDraft({ ...breakDraft, is_mandatory: v ? 1 : 0 })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={rotationOpen}
        onClose={() => setRotationOpen(false)}
        title="Rotation Pattern"
        width={360}
        footer={(
          <>
            <Button onClick={() => setRotationOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setRotationOpen(false)}>Save</Button>
          </>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Morning', 'Evening', 'Night', 'Off'].map((slot) => {
            const active = rotation.includes(slot);
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setRotation((prev) => (prev.includes(slot) ? prev.filter((p) => p !== slot) : [...prev, slot]))}
                style={{
                  height: 38, borderRadius: 8, border: '1px solid var(--ck-line)',
                  background: active ? 'var(--ck-line-soft)' : 'var(--ck-surface)',
                  color: 'var(--ck-ink)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--ck-line)', borderRadius: 10, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ck-ink)' }}>{title}</div>
        {right}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ck-ink-soft)' }}>{label}</span>
      {children}
    </label>
  );
}

function Grid2({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

function Grid3({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>{children}</div>;
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--ck-line-soft)', color: 'var(--ck-ink-soft)', fontSize: 11, fontWeight: 600, border: '1px solid var(--ck-line)' }}>{children}</span>
  );
}

function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ck-ink)' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function PagerButton({ children, onClick, disabled, active }: { children: ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 30, padding: '0 12px',
        border: '1px solid var(--ck-line)',
        background: active ? 'var(--ck-ink)' : 'var(--ck-surface)',
        color: active ? '#fff' : 'var(--ck-ink-soft)',
        borderRadius: 8, fontSize: 12.5, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

const iconBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid var(--ck-line)', background: 'var(--ck-surface)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--ck-muted)', cursor: 'pointer',
};

function CompanyGlyph() {
  return (
    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ck-muted)' }}>C</span>
    </div>
  );
}
