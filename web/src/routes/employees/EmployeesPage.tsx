import { useEffect, useState, type ReactNode } from 'react';
import { Search, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { StatusPill } from '../../components/ui/StatusPill';

type Employee = {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  designation: string;
  status: 'ACTIVE' | 'PROBATION' | 'ON_LEAVE' | 'EXITED';
  joining_date: string;
  email: string;
  phone: string;
  ctc: number | string;
  branch_id: string;
  branch_code: string;
  branch_name: string;
  department_id: string;
  department_name: string;
  grade_id: string;
  grade_code: string;
};

type Branch = { id: string; code: string; name: string; city: string; kind: string };
type Department = { id: string; name: string };

type ListResp = { data: Employee[]; meta: { page: number; pageSize: number; total: number } };
type RefResp<T> = { data: T[] };

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  PROBATION: 'Probation',
  ON_LEAVE: 'On Leave',
  EXITED: 'Exited',
};

export function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 14;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<RefResp<Branch>>('/branches'),
      api.get<RefResp<Department>>('/departments'),
    ])
      .then(([b, d]) => {
        setBranches(b.data.data);
        setDepartments(d.data.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, branchId, departmentId, status]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const params: Record<string, string | number> = { page, pageSize };
    if (search) params.search = search;
    if (branchId) params.branchId = branchId;
    if (departmentId) params.departmentId = departmentId;
    if (status) params.status = status;
    api
      .get<ListResp>('/employees', { params, signal: ctrl.signal })
      .then((r) => {
        setEmployees(r.data.data);
        setTotal(r.data.meta.total);
      })
      .catch((e: unknown) => {
        const err = e as { name?: string };
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          setError('Failed to load employees.');
        }
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [search, branchId, departmentId, status, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader
        title="Employee Master"
        subtitle="Browse and manage employees across all branches."
        actions={
          <Button icon={Plus} variant="primary" disabled>
            Add Employee
          </Button>
        }
      />

      <Card padding={0}>
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: 16,
            borderBottom: '1px solid var(--ck-line)',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', width: 320 }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 12,
                top: 12,
                color: 'var(--ck-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, email…"
              style={{
                width: '100%',
                height: 40,
                padding: '0 12px 0 36px',
                border: '1px solid var(--ck-line)',
                borderRadius: 8,
                fontSize: 13,
                background: 'var(--ck-surface)',
              }}
            />
          </div>
          <FilterSelect value={branchId} onChange={setBranchId} placeholder="All branches">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={departmentId}
            onChange={setDepartmentId}
            placeholder="All departments"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect value={status} onChange={setStatus} placeholder="All status">
            <option value="ACTIVE">Active</option>
            <option value="PROBATION">Probation</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="EXITED">Exited</option>
          </FilterSelect>
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>
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
                  <Th>Employee</Th>
                  <Th>Designation</Th>
                  <Th>Department</Th>
                  <Th>Branch</Th>
                  <Th>Grade</Th>
                  <Th>Joined</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {!loading && employees.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                      No employees found. Adjust your filters.
                    </td>
                  </tr>
                )}
                {employees.map((e, i) => (
                  <Row key={e.id} emp={e} hue={(i * 47 + 12) % 360} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderTop: '1px solid var(--ck-line)',
            fontSize: 12.5,
          }}
        >
          <div style={{ color: 'var(--ck-muted)' }}>
            Page {page} of {totalPages} · {total.toLocaleString('en-IN')} total
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Row({ emp, hue }: { emp: Employee; hue: number }) {
  const [hover, setHover] = useState(false);
  return (
    <tr
      style={{
        borderTop: '1px solid var(--ck-line)',
        background: hover ? 'var(--ck-surface-alt)' : 'transparent',
        transition: 'background 100ms',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={`${emp.first_name} ${emp.last_name}`} hue={hue} size={36} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>
              {emp.first_name} {emp.last_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ck-muted)' }}>
              {emp.code} · {emp.email}
            </div>
          </div>
        </div>
      </Td>
      <Td>{emp.designation}</Td>
      <Td>{emp.department_name}</Td>
      <Td>{emp.branch_name}</Td>
      <Td>{emp.grade_code}</Td>
      <Td>{formatDate(emp.joining_date)}</Td>
      <Td>
        <StatusPill status={STATUS_LABELS[emp.status] ?? emp.status} />
      </Td>
    </tr>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        padding: '10px 16px',
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--ck-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>{children}</td>;
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        height: 40,
        padding: '0 12px',
        border: '1px solid var(--ck-line)',
        borderRadius: 8,
        background: 'var(--ck-surface)',
        fontSize: 13,
        color: value ? 'var(--ck-ink)' : 'var(--ck-muted)',
        minWidth: 180,
      }}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function formatDate(s: string) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return s;
  }
}
