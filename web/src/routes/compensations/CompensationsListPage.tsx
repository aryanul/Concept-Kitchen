import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusPill } from '../../components/ui/StatusPill';

type Row = {
  id: string; code: string; record_type: string;
  employee_id: string | null; employee_code: string | null; employee_name: string | null;
  template_id: string | null; template_code: string | null;
  effective_from: string; effective_to: string | null;
  annual_ctc: number | string; status: string;
  approved_at: string | null; created_at: string;
};
type ListResp = { data: Row[]; meta: { page: number; pageSize: number; total: number } };

const STATUSES = ['Draft', 'Approved', 'Active', 'Archived'];
const RECORD_TYPES = ['Template', 'Offer', 'Joining', 'Increment', 'One-time'];

function inrFromPaise(p: number | string | null | undefined): string {
  if (p == null) return '—';
  const r = Math.round(Number(p) / 100);
  return `₹ ${r.toLocaleString('en-IN')}`;
}
function fmt(s: string | null) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return s; }
}

export function CompensationsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [recordType, setRecordType] = useState('');
  const [searchParams] = useSearchParams();
  const employeeIdParam = searchParams.get('employeeId') ?? '';
  const [employeeFilter, setEmployeeFilter] = useState(employeeIdParam);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Keep filter in sync if the URL param changes (e.g. via Employee tab link).
  useEffect(() => { setEmployeeFilter(employeeIdParam); }, [employeeIdParam]);

  useEffect(() => {
    if (!employeeFilter) { setEmployeeName(null); return; }
    api.get<{ data: { code: string; first_name: string; last_name: string } }>(`/employees/${employeeFilter}`)
      .then((r) => setEmployeeName(`${r.data.data.first_name} ${r.data.data.last_name} (${r.data.data.code})`))
      .catch(() => setEmployeeName(null));
  }, [employeeFilter]);

  useEffect(() => { setPage(1); }, [search, status, recordType, employeeFilter]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const params: Record<string, string | number> = { page, pageSize };
    if (search)         params.search     = search;
    if (status)         params.status     = status;
    if (recordType)     params.recordType = recordType;
    if (employeeFilter) params.employeeId = employeeFilter;
    api.get<ListResp>('/compensations', { params, signal: ctrl.signal })
      .then((r) => { setRows(r.data.data); setTotal(r.data.meta.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [search, status, recordType, employeeFilter, page]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  return (
    <div>
      <PageHeader
        title="Compensation Master"
        subtitle="Full salary history, templates, offers, increments. Each employee's active record drives the Employee Master CTC snapshot."
        actions={<Button icon={Plus} variant="primary" onClick={() => navigate('/compensations/new')}>New Compensation</Button>}
      />

      {employeeFilter && (
        <Card padding={12} style={{ marginBottom: 12, background: 'var(--ck-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ color: 'var(--ck-muted)' }}>Filtered to:</span>
            <strong>{employeeName ?? employeeFilter}</strong>
            <button onClick={() => { setEmployeeFilter(''); navigate('/compensations'); }}
              style={{ background: 'none', border: '1px solid var(--ck-line)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}>
              Clear
            </button>
          </div>
        </Card>
      )}

      <Card padding={0}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', gap: 12, padding: 16, borderBottom: '1px solid var(--ck-line)' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: 21, color: 'var(--ck-muted)' }}><Search size={14} /></span>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={lbl}>Search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code, employee name…"
                style={{ ...inp, paddingLeft: 30 }} />
            </label>
          </div>
          <FilterSelect label="Status" value={status} onChange={setStatus} placeholder="All statuses">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </FilterSelect>
          <FilterSelect label="Record Type" value={recordType} onChange={setRecordType} placeholder="All types">
            {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </FilterSelect>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {loading ? 'Loading…' : `${total.toLocaleString('en-IN')} record${total === 1 ? '' : 's'}`}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {['Code', 'Type', 'Employee', 'Effective From', 'Effective To', 'Annual CTC', 'Status'].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>No compensation records.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
                  <Td><Link to={`/compensations/${r.id}`} style={{ color: 'var(--ck-accent)', fontWeight: 600, textDecoration: 'none', fontFamily: 'var(--ck-font-mono)' }}>{r.code}</Link></Td>
                  <Td>{r.record_type}</Td>
                  <Td>
                    {r.employee_code
                      ? <span>{r.employee_name} <span style={{ color: 'var(--ck-muted)', fontFamily: 'var(--ck-font-mono)', fontSize: 12 }}>{r.employee_code}</span></span>
                      : <span style={{ color: 'var(--ck-muted)', fontStyle: 'italic' }}>(template)</span>}
                  </Td>
                  <Td>{fmt(r.effective_from)}</Td>
                  <Td>{r.effective_to ? fmt(r.effective_to) : '—'}</Td>
                  <Td>{inrFromPaise(r.annual_ctc)}</Td>
                  <Td><StatusPill status={r.status} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const inp: React.CSSProperties = { height: 36, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, background: 'var(--ck-surface)', fontSize: 13 };
const th: React.CSSProperties = { padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' };

function Td({ children }: { children: ReactNode }) { return <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>{children}</td>; }

function FilterSelect({ label, value, onChange, placeholder, children }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={lbl}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inp}>
        <option value="">{placeholder}</option>
        {children}
      </select>
    </label>
  );
}
