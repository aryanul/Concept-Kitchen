import { useEffect, useState } from 'react';
import { Search, Plus, Briefcase, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { api } from '../../../lib/api';

export type Designation = {
  id: string;
  code: string | null;
  name: string;
  department_id: string | null;
  division_id: string | null;
  department_name: string | null;
  division_name: string | null;
  parent_designation_name: string | null;
  hierarchy_level: number;
};

type Dept = { id: string; name: string };
type Division = { id: string; code: string | null; name: string; department_id: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onPicked: (designation: Designation) => void;
};

export function DesignationPickerModal({ open, onClose, onPicked }: Props) {
  const [tab, setTab] = useState<'pick' | 'create'>('pick');
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Create-new form state
  const [depts, setDepts] = useState<Dept[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDesignations = () => {
    setLoading(true);
    api.get<{ data: Designation[] }>('/designations')
      .then((r) => setDesignations(r.data.data))
      .catch(() => setDesignations([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    fetchDesignations();
    api.get<{ data: Dept[] }>('/departments').then((r) => setDepts(r.data.data)).catch(() => {});
    api.get<{ data: Division[] }>('/divisions').then((r) => setDivisions(r.data.data)).catch(() => {});
  }, [open]);

  // Division dropdown narrows to the picked department, so the two filters can't
  // contradict each other. Divisions with no department stay visible (unlinked rows
  // would otherwise be unreachable once a department is picked).
  const divisionChoices = deptFilter
    ? divisions.filter((d) => !d.department_id || d.department_id === deptFilter)
    : divisions;

  const q = search.trim().toLowerCase();
  const filtered = designations.filter((d) => {
    if (deptFilter && d.department_id !== deptFilter) return false;
    if (divisionFilter && d.division_id !== divisionFilter) return false;
    if (!q) return true;
    return d.name.toLowerCase().includes(q)
      || d.department_name?.toLowerCase().includes(q)
      || d.division_name?.toLowerCase().includes(q)
      || d.code?.toLowerCase().includes(q);
  });

  const filtersOn = Boolean(q || deptFilter || divisionFilter);
  const clearFilters = () => { setSearch(''); setDeptFilter(''); setDivisionFilter(''); };

  // Changing department invalidates a division from another department.
  const onDeptFilterChange = (value: string) => {
    setDeptFilter(value);
    if (value && divisionFilter) {
      const current = divisions.find((d) => d.id === divisionFilter);
      if (current?.department_id && current.department_id !== value) setDivisionFilter('');
    }
  };

  const createDesignation = async () => {
    if (!name.trim() || !departmentId) {
      toast.error('Name and Department are required');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post<{ data: { id: string; code: string } }>('/designations', {
        name: name.trim(),
        departmentId,
        divisionId: divisionId || undefined,
      });
      toast.success('Designation created');
      const dept = depts.find((d) => d.id === departmentId);
      const division = divisions.find((d) => d.id === divisionId);
      onPicked({
        id: r.data.data.id,
        code: r.data.data.code,
        name: name.trim(),
        department_id: departmentId,
        division_id: divisionId || null,
        department_name: dept?.name ?? null,
        division_name: division?.name ?? null,
        parent_designation_name: null,
        hierarchy_level: 0,
      });
      setName(''); setDepartmentId(''); setDivisionId('');
    } catch {
      toast.error('Failed to create designation');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Pick a Designation" subtitle="Job Profile will be created against this designation" width={720}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--ck-line)' }}>
        <button onClick={() => setTab('pick')} style={tabStyle(tab === 'pick')}>
          <Briefcase size={14} style={{ marginRight: 6 }} /> Choose from master
        </button>
        <button onClick={() => setTab('create')} style={tabStyle(tab === 'create')}>
          <Plus size={14} style={{ marginRight: 6 }} /> Create new
        </button>
      </div>

      {tab === 'pick' ? (
        <>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ck-muted)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, department, division, code…"
              style={{ width: '100%', height: 38, padding: '0 12px 0 34px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }} />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <Filter size={14} style={{ color: 'var(--ck-muted)', flexShrink: 0 }} />
            <select value={deptFilter} onChange={(e) => onDeptFilterChange(e.target.value)} style={filterSelect}>
              <option value="">All departments</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value)} style={filterSelect}>
              <option value="">All divisions</option>
              {divisionChoices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <span style={{ fontSize: 11.5, color: 'var(--ck-muted)', marginLeft: 'auto' }}>
              {filtered.length} of {designations.length}
            </span>
            {filtersOn && (
              <button onClick={clearFilters}
                style={{ background: 'transparent', border: 'none', padding: '0 2px', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-accent)' }}>
                Clear
              </button>
            )}
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--ck-line)', borderRadius: 8 }}>
            {loading && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>Loading…</div>}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>
                {filtersOn
                  ? 'No designations match this search / filter.'
                  : 'No designations found. Use "Create new" tab to add one.'}
              </div>
            )}
            {!loading && filtered.map((d) => (
              <button key={d.id} onClick={() => onPicked(d)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                  padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--ck-line)',
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ck-ink)' }}>{d.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ck-muted)', marginTop: 2 }}>
                    {[d.department_name, d.division_name].filter(Boolean).join(' · ') || 'No department'}
                  </div>
                </div>
                {d.code && <span style={{ fontFamily: 'var(--ck-font-mono)', fontSize: 11, color: 'var(--ck-muted)' }}>{d.code}</span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Designation Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Senior Manager" style={inp} />
          </Field>
          <Field label="Department *">
            <select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setDivisionId(''); }} style={inp}>
              <option value="">Select department</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Division (optional)">
            <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)} style={inp}>
              <option value="">Select division</option>
              {(departmentId ? divisions.filter((d) => !d.department_id || d.department_id === departmentId) : divisions)
                .map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <Button size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" variant="primary" disabled={saving || !name.trim() || !departmentId} onClick={createDesignation}>
              {saving ? 'Creating…' : 'Create & Continue'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };

const filterSelect: React.CSSProperties = {
  height: 32, maxWidth: 220, padding: '0 8px', border: '1px solid var(--ck-line)',
  borderRadius: 7, fontSize: 12.5, background: 'var(--ck-surface)', color: 'var(--ck-ink)', cursor: 'pointer',
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '8px 14px', background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid var(--ck-ink)' : '2px solid transparent',
    color: active ? 'var(--ck-ink)' : 'var(--ck-muted)',
    cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 500,
    marginBottom: -1,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ck-ink-soft)' }}>{label}</span>
      {children}
    </label>
  );
}
