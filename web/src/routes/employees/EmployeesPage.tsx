import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Pencil } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { IconAction } from '../../components/ui/IconAction';

type Employee = {
  id: string; code: string; first_name: string; last_name: string;
  designation: string; status: string; joining_date: string; email: string; phone: string;
  ctc: number | string;
  branch_id: string; branch_code: string; branch_name: string;
  department_id: string; department_name: string;
  grade_id: string; grade_code: string;
  company_id: string | null; company_name: string | null;
  division_id: string | null; division_name: string | null;
  location_id: string | null; location_name: string | null;
};
type Branch = { id: string; code: string; name: string; city: string; kind: string; company_id: string | null; company_name: string | null };
type Department = { id: string; name: string };
type Division = { id: string; name: string };
type Company = { id: string; name: string; lc_no: string };
type Location = { id: string; name: string; branch_id: string | null };
type ListResp = { data: Employee[]; meta: { page: number; pageSize: number; total: number } };
type RefResp<T> = { data: T[] };

export function EmployeesPage() {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [designation, setDesignation] = useState('');
  const [code, setCode] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 14;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<RefResp<Branch>>('/branches'),
      api.get<RefResp<Department>>('/departments'),
      api.get<RefResp<Division>>('/divisions'),
      api.get<{ data: Company[] }>('/hiring/companies', { params: { pageSize: 1000 } }),
      api.get<RefResp<Location>>('/locations'),
    ]).then(([b, d, dv, c, l]) => {
      setBranches(b.data.data);
      setDepartments(d.data.data);
      setDivisions(dv.data.data);
      setCompanies(c.data.data);
      setLocations(l.data.data);
    }).catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [companyId, branchId, locationId, departmentId, divisionId, designation, code]);

  // Narrow the Branch + Location dropdowns based on Company / Branch selection so
  // the picker stays internally consistent (e.g. picking Company A only shows A's branches).
  const visibleBranches = useMemo(() =>
    companyId ? branches.filter((b) => b.company_id === companyId) : branches,
    [branches, companyId]);
  const visibleLocations = useMemo(() => {
    const branchPool = branchId
      ? new Set([branchId])
      : new Set(visibleBranches.map((b) => b.id));
    return locations.filter((l) => l.branch_id && branchPool.has(l.branch_id));
  }, [locations, branchId, visibleBranches]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const params: Record<string, string | number> = { page, pageSize };
    if (companyId)    params.companyId    = companyId;
    if (branchId)     params.branchId     = branchId;
    if (locationId)   params.locationId   = locationId;
    if (departmentId) params.departmentId = departmentId;
    if (divisionId)   params.divisionId   = divisionId;
    if (designation)  params.designation  = designation;
    if (code)         params.code         = code;
    api.get<ListResp>('/employees', { params, signal: ctrl.signal })
      .then((r) => { setEmployees(r.data.data); setTotal(r.data.meta.total); })
      .catch((e: unknown) => { if ((e as { name?: string }).name !== 'CanceledError') setError('Failed to load employees.'); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [companyId, branchId, locationId, departmentId, divisionId, designation, code, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader
        title="Employee Master"
        subtitle="Employee records are created when a vacancy is filled. Use this list to view and edit existing employees."
      />

      <Card padding={0}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 12, padding: 16, borderBottom: '1px solid var(--ck-line)' }}>
          <FilterSelect label="Company" value={companyId} onChange={(v) => { setCompanyId(v); setBranchId(''); setLocationId(''); }} placeholder="All companies">
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Branch" value={branchId} onChange={(v) => { setBranchId(v); setLocationId(''); }} placeholder="All branches">
            {visibleBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Location" value={locationId} onChange={setLocationId} placeholder="All locations">
            {visibleLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Department" value={departmentId} onChange={setDepartmentId} placeholder="All departments">
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </FilterSelect>
          <FilterSelect label="Division" value={divisionId} onChange={setDivisionId} placeholder="All divisions">
            {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </FilterSelect>
          <FilterText label="Designation" value={designation} onChange={setDesignation} placeholder="e.g. Supervisor" />
          <FilterText label="Employee Code" value={code} onChange={setCode} placeholder="e.g. CK-EMP-001" />
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {loading ? 'Loading…' : `${total.toLocaleString('en-IN')} result${total === 1 ? '' : 's'}`}
          </div>
        </div>

        {error ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-danger-fg)' }}>{error}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                  {['Department', 'Division', 'Designation', 'Employee Code', 'Employee Name', 'Company', 'Branch', 'Location', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loading && employees.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>No employees found.</td></tr>
                )}
                {employees.map((e) => (
                  <Row key={e.id} emp={e}
                    onView={() => navigate(`/employees/${e.id}`)}
                    onEdit={() => navigate(`/employees/${e.id}?mode=edit`)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--ck-line)', fontSize: 12.5 }}>
          <div style={{ color: 'var(--ck-muted)' }}>Page {page} of {totalPages} · {total.toLocaleString('en-IN')} total</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <Button size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Row({ emp, onView, onEdit }: { emp: Employee; onView: () => void; onEdit: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <tr
      style={{ borderTop: '1px solid var(--ck-line)', background: hover ? 'var(--ck-surface-alt)' : 'transparent', transition: 'background 100ms' }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Td>{emp.department_name || '—'}</Td>
      <Td>{emp.division_name || '—'}</Td>
      <Td>{emp.designation || '—'}</Td>
      <Td><span style={{ fontFamily: 'var(--ck-font-mono)', fontSize: 12.5, color: 'var(--ck-ink-soft)' }}>{emp.code}</span></Td>
      <Td>
        <Link to={`/employees/${emp.id}`}
          style={{ color: 'var(--ck-accent)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
          {emp.first_name} {emp.last_name}
        </Link>
      </Td>
      <Td>{emp.company_name || '—'}</Td>
      <Td>{emp.branch_name || '—'}</Td>
      <Td>{emp.location_name || '—'}</Td>
      <Td>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconAction icon={Eye} label="View" hint="View employee profile" onClick={onView} />
          <IconAction icon={Pencil} label="Edit" hint="Edit employee details" onClick={onEdit} />
        </div>
      </Td>
    </tr>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>{children}</td>;
}

function FilterSelect({ label, value, onChange, placeholder, children }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ height: 36, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, background: 'var(--ck-surface)', fontSize: 13, color: value ? 'var(--ck-ink)' : 'var(--ck-muted)' }}>
        <option value="">{placeholder}</option>
        {children}
      </select>
    </label>
  );
}

function FilterText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ height: 36, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, background: 'var(--ck-surface)', fontSize: 13 }} />
    </label>
  );
}
