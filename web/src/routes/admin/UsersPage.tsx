// The Users console.
//
// Replaces a generic CRUD table that knew only email / role / employee link.
// Accounts now carry a name and an Active/Inactive status, and most of them are
// not typed in at all — Concept Kitchen's staff list is mirrored on every sync
// and each new person gets an Inactive sign-in, which an admin activates here.

import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, KeyRound, UserCheck, UserX, Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { IconAction } from '../../components/ui/IconAction';
import { StatusPill } from '../../components/ui/StatusPill';
import { Avatar } from '../../components/ui/Avatar';
import { FilterSelect, SearchInput } from '../../components/filters';
import { formatRelativeTime } from '../../lib/format';
import { useAuth } from '../../stores/auth';

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: 'Active' | 'Inactive';
  phone: string | null;
  designation: string | null;
  ckUserId: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  lastLoginAt: string | null;
};

type Employee = { id: string; code: string; first_name: string; last_name: string };

const ROLE_LABELS: Record<string, string> = {
  HR_ADMIN: 'HR Admin',
  MANAGER: 'Manager',
  FINANCE: 'Finance',
  EMPLOYEE: 'Employee',
};
const ROLES = Object.keys(ROLE_LABELS);

const inp: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 12px',
  border: '1px solid var(--ck-line)', borderRadius: 8,
  fontSize: 13, background: 'var(--ck-surface)', fontFamily: 'inherit',
};

type Draft = {
  name: string; email: string; password: string; role: string;
  status: 'Active' | 'Inactive'; phone: string; designation: string; employeeId: string;
};

const EMPTY_DRAFT: Draft = {
  name: '', email: '', password: '', role: 'EMPLOYEE',
  status: 'Active', phone: '', designation: '', employeeId: '',
};

export function UsersPage() {
  const signedInAs = useAuth((s) => s.user?.id);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const [pwTarget, setPwTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchRows = () => {
    setLoading(true);
    api.get<{ data: UserRow[] }>('/users')
      .then((r) => setRows(r.data.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(fetchRows, []);

  useEffect(() => {
    api.get<{ data: Employee[] }>('/employees', { params: { page: 1, pageSize: 1000 } })
      .then((r) => setEmployees(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setEmployees([]));
  }, []);

  const openCreate = () => { setEditing(null); setDraft(EMPTY_DRAFT); setCreating(true); };
  const openEdit = (row: UserRow) => {
    setCreating(false);
    setEditing(row);
    setDraft({
      name: row.name ?? '', email: row.email, password: '',
      role: row.role, status: row.status,
      phone: row.phone ?? '', designation: row.designation ?? '',
      employeeId: row.employeeId ?? '',
    });
  };
  const closeForm = () => { setEditing(null); setCreating(false); setDraft(EMPTY_DRAFT); };

  const onSave = async () => {
    if (!draft.email.trim()) { toast.error('Email is required'); return; }
    if (creating && draft.password.length < 6) {
      toast.error('Set a password of at least 6 characters'); return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim() || null,
        email: draft.email.trim(),
        role: draft.role,
        status: draft.status,
        phone: draft.phone.trim() || null,
        designation: draft.designation.trim() || null,
        employeeId: draft.employeeId || null,
      };
      if (editing) {
        await api.patch(`/users/${editing.id}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/users', { ...payload, password: draft.password });
        toast.success('User created — they must change the password at first sign-in');
      }
      closeForm();
      fetchRows();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save user'));
    } finally { setSaving(false); }
  };

  /** One-click activate / deactivate — the common action on this screen. */
  const toggleStatus = async (row: UserRow) => {
    const next = row.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.patch(`/users/${row.id}`, { status: next });
      toast.success(next === 'Active' ? `${row.name ?? row.email} activated` : `${row.name ?? row.email} deactivated`);
      fetchRows();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not change the account status'));
    }
  };

  const onDelete = async (row: UserRow) => {
    // Deleting a CK-provisioned account is usually the wrong move: the link
    // goes with it and the next sync recreates the account from scratch.
    const warning = row.ckUserId
      ? '\n\nThis account came from Concept Kitchen. Deleting it drops the link, and the next sync will create a fresh Inactive account for the same person. Deactivating is usually what you want.'
      : '';
    if (!window.confirm(`Delete the account for ${row.name ?? row.email}?${warning}`)) return;
    try {
      await api.delete(`/users/${row.id}`);
      toast.success('User deleted');
      fetchRows();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Delete failed'));
    }
  };

  const resetPassword = async () => {
    if (!pwTarget) return;
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    try {
      await api.post(`/users/${pwTarget.id}/password`, { password: newPassword });
      toast.success('Password reset — they must change it at next sign-in');
      setPwTarget(null); setNewPassword('');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not reset the password'));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter && r.role !== roleFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (!q) return true;
      return `${r.name ?? ''} ${r.email} ${r.designation ?? ''}`.toLowerCase().includes(q);
    });
  }, [rows, search, roleFilter, statusFilter]);

  const counts = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => r.status === 'Active').length,
    pending: rows.filter((r) => r.status === 'Inactive' && r.ckUserId).length,
  }), [rows]);

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Sign-ins, roles and account status. Concept Kitchen staff appear here automatically."
        actions={<Button icon={Plus} variant="primary" onClick={openCreate}>Add User</Button>}
      />

      {counts.pending > 0 && (
        <Card padding={14} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ck-ink-soft)' }}>
            <Link2 size={16} style={{ color: 'var(--ck-accent)', flexShrink: 0 }} />
            <span>
              <strong style={{ color: 'var(--ck-ink)' }}>{counts.pending}</strong> account
              {counts.pending === 1 ? '' : 's'} provisioned from Concept Kitchen
              {counts.pending === 1 ? ' is' : ' are'} waiting to be activated. They cannot sign in until you switch them on.
            </span>
            <span style={{ marginLeft: 'auto' }}>
              <Button size="sm" onClick={() => setStatusFilter('Inactive')}>Show them</Button>
            </span>
          </div>
        </Card>
      )}

      <Card padding={0}>
        <div style={{ display: 'flex', gap: 10, padding: 16, borderBottom: '1px solid var(--ck-line)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or designation…" width={260} showButton={false} />
          <FilterSelect label="Role" value={roleFilter} onChange={setRoleFilter} placeholder="All roles"
            options={ROLES.map((r) => ({ label: ROLE_LABELS[r], value: r }))} />
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} placeholder="All statuses"
            options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]} />
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {loading ? 'Loading…' : `${filtered.length} of ${counts.total} · ${counts.active} active`}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {['User', 'Role', 'Status', 'Source', 'Last sign-in'].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>
                  No users match these filters.
                </td></tr>
              )}
              {filtered.map((row) => {
                const isSelf = row.id === signedInAs;
                return (
                  <tr key={row.id} style={{ borderTop: '1px solid var(--ck-line)', opacity: row.status === 'Active' ? 1 : 0.62 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={row.name || row.email} size={32} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--ck-ink)' }}>
                            {row.name || row.email.split('@')[0]}
                            {isSelf && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--ck-muted)', fontWeight: 500 }}>(you)</span>}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--ck-muted)' }}>{row.email}</div>
                          {row.designation && (
                            <div style={{ fontSize: 11, color: 'var(--ck-faint)' }}>{row.designation}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{ROLE_LABELS[row.role] ?? row.role}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusPill status={row.status} />
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--ck-muted)', fontSize: 12.5 }}>
                      {row.ckUserId ? 'Concept Kitchen' : 'Created here'}
                      {row.employeeCode && <div style={{ fontSize: 11 }}>Employee {row.employeeCode}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--ck-muted)', fontSize: 12.5 }}>
                      {row.lastLoginAt ? formatRelativeTime(row.lastLoginAt) : 'Never'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <IconAction
                          icon={row.status === 'Active' ? UserX : UserCheck}
                          label={row.status === 'Active' ? 'Deactivate' : 'Activate'}
                          hint={row.status === 'Active' ? 'Block this account from signing in' : 'Let this account sign in'}
                          onClick={() => toggleStatus(row)}
                        />
                        <IconAction icon={KeyRound} label="Password" hint="Set a new password"
                          onClick={() => { setPwTarget(row); setNewPassword(''); }} />
                        <IconAction icon={Pencil} label="Edit" hint="Edit this user" onClick={() => openEdit(row)} />
                        <IconAction icon={Trash2} label="Delete" hint="Delete this user" tone="danger"
                          onClick={() => onDelete(row)} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={creating || !!editing}
        onClose={closeForm}
        title={editing ? 'Edit User' : 'Add User'}
        subtitle={editing?.ckUserId ? 'Provisioned from Concept Kitchen' : undefined}
        width={560}
        footer={(
          <>
            <Button onClick={closeForm}>Cancel</Button>
            <Button variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </>
        )}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Name"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inp} /></Field>
          <Field label="Email *"><input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} style={inp} /></Field>
          {creating && (
            <Field label="Password *" span>
              <input type="text" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder="At least 6 characters" style={inp} />
              <span style={hintStyle}>They will be asked to change it at first sign-in.</span>
            </Field>
          )}
          <Field label="Role *">
            <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} style={inp}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as 'Active' | 'Inactive' })} style={inp}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </Field>
          <Field label="Phone"><input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} style={inp} /></Field>
          <Field label="Designation"><input value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} style={inp} /></Field>
          <Field label="Linked employee" span>
            <select value={draft.employeeId} onChange={(e) => setDraft({ ...draft, employeeId: e.target.value })} style={inp}>
              <option value="">Not linked</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.code})</option>
              ))}
            </select>
            <span style={hintStyle}>Links the sign-in to an Employee Master record for self-service screens.</span>
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!pwTarget}
        onClose={() => setPwTarget(null)}
        title="Set a new password"
        subtitle={pwTarget ? (pwTarget.name ?? pwTarget.email) : ''}
        width={440}
        footer={(
          <>
            <Button onClick={() => setPwTarget(null)}>Cancel</Button>
            <Button variant="primary" onClick={resetPassword}>Set password</Button>
          </>
        )}
      >
        <Field label="New password">
          <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters" style={inp} autoFocus />
          <span style={hintStyle}>
            Shown in plain text so you can pass it on. They must change it at their next sign-in.
          </span>
        </Field>
      </Modal>
    </div>
  );
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: span ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ck-ink-soft)' }}>{label}</span>
      {children}
    </label>
  );
}

const th: React.CSSProperties = {
  padding: '10px 16px', fontSize: 11.5, fontWeight: 600,
  color: 'var(--ck-muted)', letterSpacing: '0.04em',
};
const hintStyle: React.CSSProperties = { fontSize: 11.5, color: 'var(--ck-muted)' };
