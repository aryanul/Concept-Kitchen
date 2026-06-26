import { useEffect, useState } from 'react';
import { Search, Eye, Pencil, Plus, SlidersHorizontal } from 'lucide-react';
import { IconAction } from '../../components/ui/IconAction';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { JobProfileForm, type StepData } from './JobProfileForm';
import { JobProfileDrawer } from '../../components/hiring/JobProfileDrawer';
import { DesignationPickerModal, type Designation } from '../../components/hiring/jp/DesignationPickerModal';
import type { JpLocation } from '../../components/hiring/jp/LocationApplicableEditor';

type JobProfile = {
  id: string; jp_no: string; title: string; alternate_title: string | null;
  division: string | null; designation: string | null; jp_status: string;
  description: string | null; requirements: string | null; status: string;
  department_id: string; department_name: string;
  open_vacancies: number | string; created_at: string;
  form_data?: StepData | string | null;
};
type JpLocationRow = {
  id: string; branch_id: string; location_id: string | null; positions: number;
  branch_name: string; location_name: string | null;
};
type JpShiftRow = {
  id: string; shift_id: string; shift_code: string; shift_name: string;
  start_time: string; end_time: string;
};
type JpInterviewTemplateRow = {
  id: string; interview_template_id: string; title: string; description: string | null;
};
type JobProfileDetail = JobProfile & {
  designation_id?: string | null;
  designation_name?: string | null;
  division_name?: string | null;
  location_applicable?: string | null;
  work_shift?: string | null;
  reporting_dept_id?: string | null;
  reporting_department_name?: string | null;
  reporting_division?: string | null;
  reporting_designation?: string | null;
  locations?: JpLocationRow[];
  shifts?: JpShiftRow[];
  interview_templates?: JpInterviewTemplateRow[];
};
type Dept = { id: string; name: string };
type Meta = { page: number; pageSize: number; total: number };
type Resp = { data: JobProfile[]; meta: Meta };

const JP_STATUS_STYLE: Record<string, React.CSSProperties> = {
  'Pending':       { background: '#fff',  color: '#666', border: '1.5px solid #ccc', fontWeight: 500 },
  'Partially Done':{ background: '#888',  color: '#fff', border: '1.5px solid #888', fontWeight: 600 },
  'Done':          { background: '#222',  color: '#fff', border: '1.5px solid #222', fontWeight: 700 },
};

type Mode = 'list' | 'create' | 'edit';

export function JobProfilePage() {
  const [mode,      setMode]      = useState<Mode>('list');
  const [editTarget, setEditTarget] = useState<JobProfile | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedDesignation, setPickedDesignation] = useState<Designation | null>(null);
  const [profiles,  setProfiles]  = useState<JobProfile[]>([]);
  const [depts,     setDepts]     = useState<Dept[]>([]);
  const [meta,      setMeta]      = useState<Meta>({ page: 1, pageSize: 5, total: 0 });
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [page,      setPage]      = useState(1);

  const fetchProfiles = () => {
    setLoading(true);
    const params: Record<string, unknown> = { page, pageSize: 5 };
    if (search) params.search = search;
    if (deptFilter) params.departmentId = deptFilter;
    api.get<Resp>('/job-profiles', { params })
      .then((r) => { setProfiles(r.data.data); setMeta(r.data.meta); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProfiles(); }, [search, deptFilter, page]);
  useEffect(() => { setPage(1); }, [search, deptFilter]);
  useEffect(() => {
    api.get<{ data: Dept[] }>('/departments').then((r) => setDepts(r.data.data)).catch(() => {});
  }, []);

  const handleSaved = () => { setMode('list'); setEditTarget(null); setPickedDesignation(null); fetchProfiles(); };
  const handleCancel = () => { setMode('list'); setEditTarget(null); setPickedDesignation(null); };

  const createInitialData: Partial<StepData> | undefined = pickedDesignation
    ? {
        designationId: pickedDesignation.id,
        departmentId: pickedDesignation.department_id ?? '',
        division: pickedDesignation.division_name ?? '',
        designation: pickedDesignation.name,
        jobTitle: pickedDesignation.name,
      }
    : undefined;
  const editInitialData = buildInitialData(editTarget);

  const startEdit = (id: string) => {
    setMode('edit');
    setEditLoading(true);
    api
      .get<{ data: JobProfileDetail }>(`/job-profiles/${id}`)
      .then((r) => setEditTarget(r.data.data))
      .catch(() => setEditTarget(null))
      .finally(() => setEditLoading(false));
  };

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div>
      <PageHeader title="Hiring Management" subtitle="Manage Hiring and Designation Requisition"
        actions={
          mode === 'list'
            ? <Button icon={Plus} variant="primary" onClick={() => setPickerOpen(true)}>+ Add Designation</Button>
            : null
        } />

      {/* Search + filter bar — always visible */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 520 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ck-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Employees by Designation, Department...."
            style={{ width: '100%', height: 38, padding: '0 12px 0 36px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }} />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
          style={{ height: 38, padding: '0 30px 0 12px', border: '1px solid var(--ck-line)', borderRadius: 8, background: 'var(--ck-surface)', fontSize: 13, minWidth: 180 }}>
          <option value="">All Department</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <Button variant="ghost" icon={SlidersHorizontal}>Filters</Button>
      </div>

      <Card padding={0}>
        {/* Section label */}
        <div style={{ padding: '10px 16px 6px', fontSize: 12, fontWeight: 700, color: 'var(--ck-ink)', borderBottom: mode !== 'list' ? '1px solid var(--ck-line)' : 'none' }}>
          Designation Directory
        </div>

        {/* Form view */}
        {mode !== 'list' && (
          editLoading ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading profile…</div>
          ) : (
            <JobProfileForm
              editId={editTarget?.id ?? null}
              initialData={mode === 'create' ? createInitialData : editInitialData}
              depts={depts}
              onSaved={handleSaved}
              onCancel={handleCancel}
            />
          )
        )}

        {/* Table view */}
        {mode === 'list' && (
          <>
            <div className="ck-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                    {['JP NO.', 'DEPARTMENT', 'DIVISION', 'DESIGNATION', 'JP STATUS', 'ACTIONS'].map((h) => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!loading && profiles.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                      No designations yet. Click "+ Add Designation" to create the first one.
                    </td></tr>
                  )}
                  {profiles.map((p) => {
                    const pillStyle = JP_STATUS_STYLE[p.jp_status] ?? JP_STATUS_STYLE['Pending'];
                    return (
                      <tr key={p.id} style={{ borderTop: '1px solid var(--ck-line)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-surface-alt)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--ck-ink)', fontFamily: 'var(--ck-font-mono)', fontSize: 12.5 }}>{p.jp_no ?? '—'}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--ck-ink)' }}>{p.department_name}</td>
                        <td style={{ padding: '14px 16px', color: 'var(--ck-ink-soft)' }}>{p.division ?? '—'}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--ck-ink)' }}>{p.designation ?? p.title}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ ...pillStyle, padding: '5px 16px', borderRadius: 6, fontSize: 12.5, display: 'inline-block' }}>{p.jp_status}</span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <IconAction icon={Eye} label="View" hint="View job profile" onClick={() => setViewId(p.id)} />
                            <IconAction icon={Pencil} label="Edit" hint="Edit job profile" onClick={() => startEdit(p.id)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--ck-line)', fontSize: 12.5 }}>
              <div style={{ color: 'var(--ck-muted)' }}>
                {loading ? 'Loading…' : `Showing ${Math.min((page - 1) * meta.pageSize + 1, meta.total)} to ${Math.min(page * meta.pageSize, meta.total)} of ${meta.total} results`}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((n) => (
                  <button key={n} onClick={() => setPage(n)}
                    style={{ width: 32, height: 32, borderRadius: 6,
                      border: `1px solid ${page === n ? 'var(--ck-ink)' : 'var(--ck-line)'}`,
                      background: page === n ? 'var(--ck-ink)' : 'transparent',
                      color: page === n ? '#fff' : 'var(--ck-ink)',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{n}
                  </button>
                ))}
                <Button size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <JobProfileDrawer
        profileId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(id) => {
          setViewId(null);
          startEdit(id);
        }}
      />

      <DesignationPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPicked={(d) => {
          setPickedDesignation(d);
          setPickerOpen(false);
          setMode('create');
        }}
      />
    </div>
  );
}

// Default categories that align with the Skill Master seed; used to migrate
// pre-Module-5 form_data rows that only had { label, notes }.
const DEPT_ALIGNMENT_DEFAULTS: { label: string; category: string }[] = [
  { label: 'Department Functions',          category: 'Department Functions' },
  { label: 'Documents Used',                category: 'Documents' },
  { label: 'Tools & Software Used',         category: 'Tools & Software' },
  { label: 'Cross-Department Interaction',  category: 'Cross-Department Interaction' },
];

function normalizeDeptAlignments(raw: unknown): { label: string; category: string; selections: string[] }[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEPT_ALIGNMENT_DEFAULTS.map((d) => ({ ...d, selections: [] }));
  }
  return raw.map((row: Record<string, unknown>, i) => {
    const fallback = DEPT_ALIGNMENT_DEFAULTS[i] ?? { label: `Section ${i + 1}`, category: 'Department Functions' };
    return {
      label: typeof row?.label === 'string' ? row.label : fallback.label,
      category: typeof row?.category === 'string' ? row.category : fallback.category,
      selections: Array.isArray(row?.selections)
        ? row.selections.filter((s) => typeof s === 'string') as string[]
        : [],
    };
  });
}

function parseFormData(raw: JobProfile['form_data']): Partial<StepData> | undefined {
  let parsed: Record<string, unknown> | null = null;
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { return undefined; }
  } else {
    parsed = raw as unknown as Record<string, unknown>;
  }
  if (!parsed) return undefined;
  // Migrate pre-Module-5 deptAlignments shape ({label, notes}) to {label, category, selections}.
  if ('deptAlignments' in parsed) {
    parsed.deptAlignments = normalizeDeptAlignments(parsed.deptAlignments);
  }
  return parsed as Partial<StepData>;
}

function buildInitialData(profile: JobProfile | null): Partial<StepData> | undefined {
  if (!profile) return undefined;
  const detail = profile as JobProfileDetail;

  // Hydrate child-row data (always from server, authoritative)
  const locations: JpLocation[] = (detail.locations ?? []).map((l) => ({
    branchId: l.branch_id,
    locationId: l.location_id,
    positions: Number(l.positions) || 1,
    branchName: l.branch_name,
    locationName: l.location_name ?? undefined,
  }));
  const workShifts: string[] = (detail.shifts ?? []).map((s) => s.shift_id);
  const interviewTemplateIds: string[] = (detail.interview_templates ?? []).map((t) => t.interview_template_id);

  const fromForm = parseFormData(profile.form_data);
  if (fromForm) {
    return {
      ...fromForm,
      // Always trust server-side child rows over stale form_data snapshot
      locations,
      workShifts,
      interviewTemplateIds,
      // Server may have updated dept/div/desig if the designation was re-linked
      designationId: detail.designation_id ?? fromForm.designationId ?? '',
      departmentId: profile.department_id ?? fromForm.departmentId ?? '',
      division: profile.division ?? fromForm.division ?? '',
      designation: profile.designation ?? fromForm.designation ?? '',
    };
  }
  return {
    jobTitle: profile.title ?? '',
    alternateTitle: profile.alternate_title ?? '',
    designationId: detail.designation_id ?? '',
    departmentId: profile.department_id ?? '',
    division: profile.division ?? '',
    designation: profile.designation ?? '',
    locations,
    workShifts,
    interviewTemplateIds,
    reportingDept: detail.reporting_dept_id ?? '',
    reportingDivision: detail.reporting_division ?? '',
    reportingDesignation: detail.reporting_designation ?? '',
  };
}

