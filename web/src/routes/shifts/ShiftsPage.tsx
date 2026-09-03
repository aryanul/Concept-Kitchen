import { useEffect, useState, type ReactNode } from 'react';
import { Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusPill } from '../../components/ui/StatusPill';
import { IconAction } from '../../components/ui/IconAction';
import { useServerListQuery, Pagination, SearchInput, FilterSelect, ClearFiltersButton, SortableTh } from '../../components/filters';
import {
  ScopeGridEditor, ScopeCountCell, ScopeDetailModal, toScopePayload, type ScopeRow,
} from '../../components/org/ScopeGridEditor';

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
  /** The company/branch/location sets this shift runs at (migration 0044). */
  scopes: ScopeRow[];
};

type Branch = { id: string; code: string; name: string; city: string };

type FormState = {
  code: string;
  name: string;
  description: string;
  scopes: ScopeRow[];
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
  scopes: [],
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

type Filters = { branchId: string; status: string; kind: string };
type SortKey = 'code' | 'name' | 'branch_name';

/**
 * Count of distinct values in a scope set — a shift mapped to three branches of
 * one company is "1 company / 3 branches", not "3 companies".
 */
function distinctBy(rows: ScopeRow[], key: (r: ScopeRow) => string): ScopeRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = key(r);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function ShiftsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);

  const [editing, setEditing] = useState<Shift | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [breakDraft, setBreakDraft] = useState<ShiftBreak>({ name: '', start_offset_min: 0, duration_min: 30, is_paid: 0, is_mandatory: 0 });

  const [rotationOpen, setRotationOpen] = useState(false);
  const [rotation, setRotation] = useState<string[]>([]);

  /** The shift whose full scope list is being read; null when the modal is shut. */
  const [scopeView, setScopeView] = useState<Shift | null>(null);

  const {
    rows: pageRows, loading, total, totalPages, page, setPage,
    searchInput, setSearchInput, applySearch,
    filters, setFilter, sortBy, sortDir, toggleSort,
    hasActiveFilters, clearAll, refetch,
  } = useServerListQuery<Shift, Filters>({
    endpoint: '/shifts',
    defaultFilters: { branchId: '', status: '', kind: '' },
    defaultSort: { sortBy: 'code', sortDir: 'asc' },
    pageSize: 5,
  });

  const fetchShifts = refetch;

  useEffect(() => {
    api.get<{ data: Branch[] }>('/branches').then((r) => setBranches(r.data.data ?? [])).catch(() => setBranches([]));
  }, []);

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
      scopes: s.scopes ?? [],
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
        scopes: toScopePayload(form.scopes),
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
    } catch (err) { toast.error(apiErrorMessage(err, 'Failed to delete shift')); }
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
        <div style={{ display: 'flex', gap: 12, padding: 16, borderBottom: '1px solid var(--ck-line)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <SearchInput value={searchInput} onChange={setSearchInput} onSubmit={applySearch} placeholder="Search shift name, code, or branch…" width={280} />
          <FilterSelect label="Branch" value={filters.branchId} onChange={(v) => setFilter('branchId', v)} placeholder="All branches"
            options={branches.map((b) => ({ label: b.name, value: b.id }))} />
          <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter('status', v)} placeholder="All statuses"
            options={[{ label: 'Active', value: 'ACTIVE' }, { label: 'Inactive', value: 'INACTIVE' }]} />
          <ClearFiltersButton onClick={clearAll} visible={hasActiveFilters} />
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>{loading ? 'Loading…' : `${total.toLocaleString('en-IN')} result${total === 1 ? '' : 's'}`}</div>
        </div>

        <div style={{ padding: '14px 22px 4px', fontSize: 14, fontWeight: 600, color: 'var(--ck-ink)' }}>
          Shift Configuration
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <SortableTh<SortKey> label="SHIFT DETAILS" sortKey="name" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort}
                  style={{ padding: '12px 22px', fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.06em', textTransform: 'none', borderTop: '1px solid var(--ck-line)', borderBottom: '1px solid var(--ck-line)', background: 'transparent' }} />
                {['COMPANIES', 'BRANCHES', 'LOCATIONS', 'TIMING', 'STATUS', 'ACTIONS'].map((h) => (
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
                    No shifts match the current filters.
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
                    {/* A shift can map to a dozen sites. Spelling every name out
                        destroyed the column widths, so each cell is a count that
                        opens the full read-only list. */}
                    <td style={{ padding: '16px 22px', verticalAlign: 'middle' }}>
                      <ScopeCountCell
                        scopes={distinctBy(s.scopes ?? [], (r) => r.company_id ?? r.company_name ?? '')}
                        onOpen={() => setScopeView(s)}
                        singular="company" plural="companies"
                      />
                    </td>
                    <td style={{ padding: '16px 22px', verticalAlign: 'middle' }}>
                      <ScopeCountCell
                        scopes={distinctBy(s.scopes ?? [], (r) => r.branch_id)}
                        onOpen={() => setScopeView(s)}
                        singular="branch" plural="branches"
                      />
                    </td>
                    <td style={{ padding: '16px 22px', verticalAlign: 'middle' }}>
                      <ScopeCountCell
                        scopes={(s.scopes ?? []).filter((r) => r.location_id)}
                        onOpen={() => setScopeView(s)}
                        singular="location" plural="locations"
                      />
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
                      <div style={{ display: 'flex', gap: 6 }}>
                        <IconAction icon={Pencil} label="Edit" hint="Edit shift" onClick={() => openEdit(s)} />
                        <IconAction icon={Trash2} label="Delete" hint="Delete shift" tone="danger" onClick={() => onDelete(s)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} total={total} pageSize={5} onPageChange={setPage} />
      </Card>

      <ScopeDetailModal
        open={!!scopeView}
        onClose={() => setScopeView(null)}
        title={scopeView ? `${scopeView.name} — applicable at` : ''}
        scopes={scopeView?.scopes ?? []}
      />

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
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'INACTIVE' })} style={{ ...inp, maxWidth: 240 }}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Field>
        </Section>

        {/* A shift is rarely tied to one site — add as many company/branch/location
            sets as it actually runs at. */}
        <Section title="Applicable Company / Branch / Location">
          <ScopeGridEditor
            value={form.scopes}
            onChange={(scopes) => setForm({ ...form, scopes })}
            label="Add each company / branch / location this shift runs at"
          />
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
              <IconAction icon={Trash2} label="Remove" hint="Remove break" tone="danger" onClick={() => removeBreak(idx)} />
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

