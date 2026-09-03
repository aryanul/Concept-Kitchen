// Roles & Permissions.
//
// One grid: modules down the side, actions across. Ticking a box grants that
// role the permission; the server enforces it centrally on every route, so this
// screen is the whole of access control rather than a display of it.

import { useEffect, useMemo, useState } from 'react';
import { Save, ShieldCheck, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';

type ActionKey = string;
type Module = { key: string; label: string; group: string; actions: ActionKey[] };
type Catalogue = {
  modules: Module[];
  roles: string[];
  rolePermissions: Record<string, string[]>;
  immutableRoles: string[];
};

const ROLE_LABELS: Record<string, string> = {
  HR_ADMIN: 'HR Admin',
  MANAGER: 'Manager',
  FINANCE: 'Finance',
  EMPLOYEE: 'Employee',
};

const ACTION_LABELS: Record<string, string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete',
  approve: 'Approve', export: 'Export', manage: 'Manage', run: 'Run',
};

/** Column order for the grid; a module only shows the ones it actually defines. */
const ACTION_ORDER = ['view', 'create', 'edit', 'delete', 'approve', 'run', 'manage', 'export'];

export function RolesPermissionsPage() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [role, setRole] = useState<string>('MANAGER');
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get<{ data: Catalogue }>('/permissions')
      .then((r) => {
        setCatalogue(r.data.data);
        setGranted(new Set(r.data.data.rolePermissions[role] ?? []));
      })
      .catch(() => toast.error('Could not load the permission catalogue'))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  // Switching role re-seeds the grid from what that role currently holds.
  useEffect(() => {
    if (catalogue) setGranted(new Set(catalogue.rolePermissions[role] ?? []));
  }, [role, catalogue]);

  const readOnly = catalogue?.immutableRoles.includes(role) ?? false;

  const groups = useMemo(() => {
    const out = new Map<string, Module[]>();
    for (const m of catalogue?.modules ?? []) {
      const list = out.get(m.group) ?? [];
      list.push(m);
      out.set(m.group, list);
    }
    return [...out.entries()];
  }, [catalogue]);

  const toggle = (key: string) => {
    if (readOnly) return;
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  /** Tick or clear a whole module row — the way people actually think about this. */
  const toggleModule = (m: Module) => {
    if (readOnly) return;
    const keys = m.actions.map((a) => `${m.key}.${a}`);
    const allOn = keys.every((k) => granted.has(k));
    setGranted((prev) => {
      const next = new Set(prev);
      for (const k of keys) { if (allOn) next.delete(k); else next.add(k); }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/roles/${role}/permissions`, { permissions: [...granted] });
      toast.success(`${ROLE_LABELS[role] ?? role} permissions saved`);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save permissions'));
    } finally { setSaving(false); }
  };

  const dirty = useMemo(() => {
    const current = new Set(catalogue?.rolePermissions[role] ?? []);
    if (current.size !== granted.size) return true;
    for (const k of granted) if (!current.has(k)) return true;
    return false;
  }, [catalogue, role, granted]);

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="What each role may do. Enforced on every API route, not just in the interface."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button icon={RotateCcw} onClick={load} disabled={!dirty || readOnly}>Discard</Button>
            <Button icon={Save} variant="primary" onClick={save} disabled={saving || !dirty || readOnly}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
      />

      <Card padding={0}>
        <div style={{ display: 'flex', gap: 8, padding: 16, borderBottom: '1px solid var(--ck-line)', alignItems: 'center', flexWrap: 'wrap' }}>
          {(catalogue?.roles ?? []).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              style={{
                height: 34, padding: '0 14px', borderRadius: 8, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: role === r ? 600 : 500,
                border: `1px solid ${role === r ? 'var(--ck-ink)' : 'var(--ck-line)'}`,
                background: role === r ? 'var(--ck-ink)' : 'var(--ck-surface)',
                color: role === r ? '#fff' : 'var(--ck-ink-soft)',
              }}
            >
              {ROLE_LABELS[r] ?? r}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {loading ? 'Loading…' : `${granted.size} permission${granted.size === 1 ? '' : 's'} granted`}
          </div>
        </div>

        {readOnly && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 16px', borderBottom: '1px solid var(--ck-line)',
            background: 'var(--ck-bg)', fontSize: 12.5, color: 'var(--ck-ink-soft)',
          }}>
            <ShieldCheck size={15} style={{ color: 'var(--ck-accent)', flexShrink: 0 }} />
            HR Admin always holds every permission. It cannot be edited down — otherwise a
            single mistake here could leave the system with nobody able to administer it.
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)' }}>
                <th style={{ ...th, textAlign: 'left', minWidth: 260 }}>Module</th>
                {ACTION_ORDER.map((a) => (
                  <th key={a} style={{ ...th, width: 84 }}>{ACTION_LABELS[a] ?? a}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(([group, modules]) => (
                <>
                  <tr key={group}>
                    <td colSpan={ACTION_ORDER.length + 1} style={{
                      padding: '9px 16px', background: 'var(--ck-line-soft)',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: 'var(--ck-muted)',
                    }}>
                      {group}
                    </td>
                  </tr>
                  {modules.map((m) => (
                    <tr key={m.key} style={{ borderTop: '1px solid var(--ck-line)' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <button
                          type="button"
                          onClick={() => toggleModule(m)}
                          disabled={readOnly}
                          title={readOnly ? undefined : 'Toggle every action on this module'}
                          style={{
                            border: 'none', background: 'none', padding: 0,
                            font: 'inherit', color: 'var(--ck-ink)', fontWeight: 600,
                            cursor: readOnly ? 'default' : 'pointer', textAlign: 'left',
                          }}
                        >
                          {m.label}
                        </button>
                      </td>
                      {ACTION_ORDER.map((a) => {
                        const has = m.actions.includes(a);
                        const key = `${m.key}.${a}`;
                        return (
                          <td key={a} style={{ padding: '10px 16px', textAlign: 'center' }}>
                            {has ? (
                              <input
                                type="checkbox"
                                checked={readOnly || granted.has(key)}
                                disabled={readOnly}
                                onChange={() => toggle(key)}
                                aria-label={`${ACTION_LABELS[a] ?? a} ${m.label}`}
                              />
                            ) : (
                              // Not every module has every action — an empty cell
                              // says "not applicable", an unticked box would say
                              // "denied", and those are different things.
                              <span style={{ color: 'var(--ck-faint)' }}>–</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '10px 16px', fontSize: 11.5, fontWeight: 600,
  color: 'var(--ck-muted)', letterSpacing: '0.04em', textAlign: 'center',
};
