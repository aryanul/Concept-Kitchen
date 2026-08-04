import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { MediaUpload } from '../../components/ui/MediaUpload';
import { api } from '../../lib/api';
import { useServerListQuery, Pagination } from '../../components/filters';

export type ExitRow = {
  id: string; code: string; exit_type: string; reason: string | null;
  stage: string; status: string;
  proposed_last_working_day: string | null; actual_last_working_day: string | null;
  notice_period_type: string | null; updated_at: string;
  employee_id: string; employee_code: string; employee_name: string;
  designation: string | null; department_name: string | null;
};

type EmployeeOpt = { id: string; code: string; first_name: string; last_name: string; status: string };

export const STAGE_LABELS: Record<string, string> = {
  INITIATION: 'Initiation', APPROVAL: 'Approval', CLEARANCE: 'Clearance',
  INTERVIEW: 'Interview', SETTLEMENT: 'Settlement', ACCESS_CLOSURE: 'Access Closure',
  COMPLETED: 'Completed',
};
export const STATUS_STYLE: Record<string, { fg: string; bg: string }> = {
  DRAFT: { fg: 'oklch(0.45 0.02 260)', bg: 'oklch(0.95 0.01 260)' },
  PENDING_APPROVAL: { fg: 'oklch(0.5 0.13 70)', bg: 'oklch(0.96 0.04 70)' },
  APPROVED: { fg: 'oklch(0.45 0.13 145)', bg: 'oklch(0.96 0.04 145)' },
  IN_PROGRESS: { fg: 'oklch(0.45 0.13 250)', bg: 'oklch(0.96 0.04 250)' },
  REJECTED: { fg: 'oklch(0.45 0.16 20)', bg: 'oklch(0.96 0.04 20)' },
  CANCELLED: { fg: 'oklch(0.45 0.02 260)', bg: 'oklch(0.95 0.01 260)' },
  COMPLETED: { fg: 'oklch(0.42 0.12 155)', bg: 'oklch(0.94 0.05 155)' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { fg: 'var(--ck-muted)', bg: 'var(--ck-line-soft)' };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: s.bg, color: s.fg, whiteSpace: 'nowrap' }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

const NOTICE_TYPES = ['FULL', 'WAIVED', 'BUYOUT', 'GARDEN_LEAVE'];

type Filters = { stage: string; status: string };

export function ExitListPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const {
    rows, loading, total, totalPages, page, setPage,
    searchInput: qInput, setSearchInput: setQInput, applySearch,
    filters, setFilter, hasActiveFilters, clearAll,
  } = useServerListQuery<ExitRow, Filters>({
    endpoint: '/exits',
    defaultFilters: { stage: '', status: '' },
    searchParamName: 'q',
    pageSize: 20,
  });
  const stage = filters.stage;
  const status = filters.status;

  const th: React.CSSProperties = {
    padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ck-faint)',
    textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--ck-line)', whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = { padding: '11px 16px', borderBottom: '1px solid var(--ck-line-soft)', fontSize: 13, color: 'var(--ck-ink)' };

  return (
    <div>
      <PageHeader
        title="Relieving"
        subtitle="Manage employee exits from initiation through final settlement and access closure."
        actions={<Button variant="primary" icon={Plus} onClick={() => setShowModal(true)}>Initiate Exit</Button>}
      />

      <Card padding={12} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--ck-faint)', pointerEvents: 'none' }} />
            <input
              value={qInput} onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              placeholder="Search employee, code…"
              style={{ height: 34, padding: '0 10px 0 32px', width: 260, borderRadius: 7, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
            />
          </div>
          <select value={stage} onChange={(e) => setFilter('stage', e.target.value)}
            style={{ height: 34, padding: '0 10px', borderRadius: 7, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            <option value="">All stages</option>
            {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={status} onChange={(e) => setFilter('status', e.target.value)}
            style={{ height: 34, padding: '0 10px', borderRadius: 7, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
            <option value="">All statuses</option>
            {Object.keys(STATUS_STYLE).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          {hasActiveFilters && (
            <button onClick={clearAll}
              style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 7, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', color: 'var(--ck-muted)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>
              <X size={13} /> Clear
            </button>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>{loading ? 'Loading…' : `${total.toLocaleString('en-IN')} result${total === 1 ? '' : 's'}`}</div>
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Case</th><th style={th}>Employee</th><th style={th}>Department</th>
                <th style={th}>Type</th><th style={th}>Stage</th><th style={th}>Status</th><th style={th}>Last Working Day</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: '40px', color: 'var(--ck-muted)' }}>
                  {hasActiveFilters ? 'No exit cases match the current filters.' : 'No exit cases yet. Click "Initiate Exit" to start one.'}
                </td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/exit-clearance/${r.id}`)} style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ck-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...td, fontFamily: 'var(--ck-font-mono)', fontSize: 12 }}>{r.code}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.employee_name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{r.employee_code} · {r.designation ?? '—'}</div>
                  </td>
                  <td style={{ ...td, color: 'var(--ck-ink-soft)' }}>{r.department_name ?? '—'}</td>
                  <td style={{ ...td }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: r.exit_type === 'TERMINATION' ? 'oklch(0.45 0.16 20)' : 'var(--ck-ink-soft)' }}>
                      {r.exit_type === 'TERMINATION' ? 'Termination' : 'Resignation'}
                    </span>
                  </td>
                  <td style={{ ...td, color: 'var(--ck-ink-soft)' }}>{STAGE_LABELS[r.stage] ?? r.stage}</td>
                  <td style={td}><StatusBadge status={r.status} /></td>
                  <td style={{ ...td, color: 'var(--ck-muted)', whiteSpace: 'nowrap' }}>
                    {r.actual_last_working_day ?? r.proposed_last_working_day ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={20} onPageChange={setPage} />
      </Card>

      {showModal && <InitiateModal onClose={() => setShowModal(false)} onCreated={(id) => navigate(`/exit-clearance/${id}`)} />}
    </div>
  );
}

function InitiateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [exitType, setExitType] = useState('RESIGNATION');
  const [reason, setReason] = useState('');
  const [proposedLwd, setProposedLwd] = useState('');
  const [noticeType, setNoticeType] = useState('FULL');
  const [docUrl, setDocUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ data: EmployeeOpt[] }>('/employees?pageSize=500')
      .then((r) => setEmployees(r.data.data.filter((e) => e.status !== 'EXITED')))
      .catch(() => {});
  }, []);

  async function submit() {
    if (!employeeId) { toast.error('Select an employee'); return; }
    setSaving(true);
    try {
      const r = await api.post<{ data: { id: string } }>('/exits', {
        employeeId, exitType, reason: reason || null,
        proposedLastWorkingDay: proposedLwd || null, noticePeriodType: noticeType,
        resignationDocUrl: docUrl || null,
      });
      toast.success('Exit case created');
      onCreated(r.data.data.id);
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      toast.error(e.response?.status === 409 ? 'This employee already has an active exit case' : e.response?.data?.error?.message ?? 'Failed to create');
    } finally { setSaving(false); }
  }

  const field: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--ck-line)', background: 'var(--ck-bg)', fontSize: 13, fontFamily: 'inherit', outline: 'none' };
  const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--ck-faint)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 5, display: 'block' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--ck-surface)', borderRadius: 14, padding: 24, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--ck-shadow-lg, 0 20px 60px rgba(0,0,0,0.2))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'oklch(0.96 0.04 20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LogOut size={18} style={{ color: 'oklch(0.45 0.16 20)' }} />
          </div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--ck-ink)' }}>Initiate Exit</h2>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={label}>Employee *</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
              <option value="">Select employee…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.code})</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Exit Type *</label>
              <select value={exitType} onChange={(e) => setExitType(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
                <option value="RESIGNATION">Resignation</option>
                <option value="TERMINATION">Termination</option>
              </select>
            </div>
            <div>
              <label style={label}>Notice Period</label>
              <select value={noticeType} onChange={(e) => setNoticeType(e.target.value)} style={{ ...field, cursor: 'pointer' }}>
                {NOTICE_TYPES.map((n) => <option key={n} value={n}>{n.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>Reason</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Better opportunity" style={field} />
            </div>
            <div>
              <label style={label}>Proposed Last Working Day</label>
              <input type="date" value={proposedLwd} onChange={(e) => setProposedLwd(e.target.value)} style={field} />
            </div>
          </div>
          <div>
            <label style={label}>Resignation Letter / Separation Notice</label>
            <MediaUpload mode="file" value={docUrl} onChange={setDocUrl} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create Exit Case'}</Button>
        </div>
      </div>
    </div>
  );
}
