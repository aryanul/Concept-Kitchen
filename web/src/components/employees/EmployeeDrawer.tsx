import { useEffect, useState } from 'react';
import { Mail, Phone, Building2, Briefcase, Calendar, CreditCard, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Drawer } from '../ui/Drawer';
import { Avatar } from '../ui/Avatar';
import { StatusPill } from '../ui/StatusPill';
import { inrPaiseToRupeesShort, formatDate } from '../../lib/format';
import { Button } from '../ui/Button';
import { EditEmployeeModal } from './EditEmployeeModal';

type Employee = {
  id: string; code: string; first_name: string; last_name: string;
  designation: string; status: string; joining_date: string;
  email: string; phone: string; ctc: number | string;
  bank_name: string | null; bank_account: string | null; ifsc: string | null;
  pan: string | null; aadhaar: string | null; pf: string | null; esic: string | null; uan: string | null;
  branch_id: string; branch_code: string; branch_name: string;
  department_id: string; department_name: string;
  grade_id: string; grade_code: string;
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active', PROBATION: 'Probation', ON_LEAVE: 'On Leave', EXITED: 'Exited',
};

const TABS = ['Overview', 'Salary', 'Leaves', 'Attendance', 'Loans'];

function mask(s: string | null, keep = 4): string {
  if (!s) return '—';
  if (s.length <= keep) return s;
  return '•'.repeat(s.length - keep) + s.slice(-keep);
}

type RefData = {
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  grades: { id: string; code: string; kind: string }[];
};

export function EmployeeDrawer({ employeeId, onClose, onChanged, branches, departments, grades }: {
  employeeId: string | null;
  onClose: () => void;
  onChanged: () => void;
} & RefData) {
  const [emp, setEmp] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!employeeId) { setEmp(null); return; }
    setLoading(true);
    setTab('Overview');
    api.get<{ data: Employee }>(`/employees/${employeeId}`)
      .then((r) => setEmp(r.data.data))
      .catch(() => setEmp(null))
      .finally(() => setLoading(false));
  }, [employeeId]);

  const exitEmployee = async () => {
    if (!emp) return;
    try {
      await api.delete(`/employees/${emp.id}`);
      toast.success('Employee marked exited');
      onChanged();
      onClose();
    } catch { toast.error('Failed to mark exited'); }
  };

  return (
    <Drawer open={!!employeeId} onClose={onClose} width={720}>
      {loading && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>Loading…</div>
      )}
      {!loading && emp && (
        <>
          {/* Header band */}
          <div style={{ padding: '32px 32px 0', background: 'var(--ck-bg)', borderBottom: '1px solid var(--ck-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingRight: 40, marginBottom: 20 }}>
              <Avatar name={`${emp.first_name} ${emp.last_name}`} hue={340} size={72} />
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--ck-ink)' }}>
                  {emp.first_name} {emp.last_name}
                </h2>
                <div style={{ fontSize: 14, color: 'var(--ck-muted)', marginBottom: 8 }}>
                  {emp.designation} · <span style={{ fontFamily: 'var(--ck-font-mono)', fontSize: 12 }}>{emp.code}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusPill status={STATUS_LABELS[emp.status] ?? emp.status} />
                  <span style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>{emp.branch_name}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--ck-muted)' }}>{emp.department_name}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--ck-muted)' }}>Annual CTC</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ck-ink)' }}>
                  {inrPaiseToRupeesShort(emp.ctc)}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                  <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>Edit</Button>
                  {emp.status !== 'EXITED' && (
                    <Button size="sm" variant="danger" onClick={exitEmployee}>Mark Exited</Button>
                  )}
                </div>
              </div>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4 }}>
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  style={{
                    padding: '9px 16px', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                    fontSize: 13.5, fontWeight: 600,
                    background: tab === t ? 'var(--ck-surface)' : 'transparent',
                    color: tab === t ? 'var(--ck-ink)' : 'var(--ck-muted)',
                    borderBottom: tab === t ? '2px solid var(--ck-accent)' : '2px solid transparent',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Tab body */}
          <div style={{ padding: 32 }}>
            {tab === 'Overview' && <OverviewTab emp={emp} />}
            {tab !== 'Overview' && (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-ink)', marginBottom: 6 }}>{tab}</div>
                <div>This tab will show {tab.toLowerCase()} data in an upcoming step.</div>
              </div>
            )}
          </div>
          <EditEmployeeModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            employee={emp}
            onUpdated={() => {
              setEditOpen(false);
              api.get<{ data: Employee }>(`/employees/${emp.id}`)
                .then((r) => setEmp(r.data.data))
                .catch(() => {});
              onChanged();
            }}
            branches={branches}
            departments={departments}
            grades={grades}
          />
        </>
      )}
    </Drawer>
  );
}

function OverviewTab({ emp }: { emp: Employee }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Section title="Job details">
        <Grid>
          <Field icon={Briefcase}  label="Designation"  value={emp.designation} />
          <Field icon={Building2}  label="Department"   value={emp.department_name} />
          <Field icon={Building2}  label="Branch"       value={emp.branch_name} />
          <Field icon={Hash}       label="Grade"        value={emp.grade_code} />
          <Field icon={Calendar}   label="Joining date" value={formatDate(emp.joining_date)} />
        </Grid>
      </Section>

      <Section title="Contact">
        <Grid>
          <Field icon={Mail}  label="Email" value={emp.email} />
          <Field icon={Phone} label="Phone" value={emp.phone} />
        </Grid>
      </Section>

      <Section title="Bank details">
        <Grid>
          <Field icon={CreditCard} label="Bank"    value={emp.bank_name ?? '—'} />
          <Field icon={CreditCard} label="Account" value={emp.bank_account ? mask(emp.bank_account) : '—'} />
          <Field icon={CreditCard} label="IFSC"    value={emp.ifsc ?? '—'} />
        </Grid>
      </Section>

      <Section title="Statutory IDs">
        <Grid>
          <Field icon={Hash} label="PAN"     value={emp.pan     ? mask(emp.pan, 4)     : '—'} />
          <Field icon={Hash} label="Aadhaar" value={emp.aadhaar ? mask(emp.aadhaar, 4) : '—'} />
          <Field icon={Hash} label="PF"      value={emp.pf      ?? '—'} />
          <Field icon={Hash} label="ESIC"    value={emp.esic    ?? '—'} />
          <Field icon={Hash} label="UAN"     value={emp.uan     ?? '—'} />
        </Grid>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

function Field({ icon: Cmp, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--ck-bg)', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Cmp size={13} style={{ color: 'var(--ck-muted)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ck-ink)', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}
