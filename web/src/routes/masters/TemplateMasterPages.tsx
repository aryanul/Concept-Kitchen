// Induction & Onboarding TEMPLATE masters. A template is a named bundle of
// existing master items (presentations / documents, or programs/tours/
// activities). Picked on a Job Profile and auto-populated into onboarding.
import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiErrorMessage } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { IconAction } from '../../components/ui/IconAction';
import { Modal } from '../../components/ui/Modal';
import { StatusPill } from '../../components/ui/StatusPill';
import { Pencil, Trash2 } from 'lucide-react';

type TemplateRow = {
  id: string; code: string | null; name: string; description: string | null;
  is_active: number | boolean; item_count: number | string;
};
type MasterItem = { id: string; title: string; category?: string | null; kind?: string | null };
type Section = {
  label: string;
  listEndpoint: string;   // GET selectable master items
  payloadKey: string;     // body key on POST/PATCH (e.g. presentationIds)
  responseKey: string;    // key in GET /:id detail (e.g. presentations)
  groupByKind?: boolean;  // group options under their `kind` sub-headers
};

const KIND_LABEL: Record<string, string> = { program: 'Programs', tour: 'Tours & Visits', activity: 'Activities' };

function TemplateMaster({ title, subtitle, endpoint, addLabel, sections }: {
  title: string; subtitle: string; endpoint: string; addLabel: string; sections: Section[];
}) {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [options, setOptions] = useState<Record<string, MasterItem[]>>({});
  const [saving, setSaving] = useState(false);

  const fetchRows = () => {
    setLoading(true);
    api.get<{ data: TemplateRow[] }>(endpoint)
      .then((r) => setRows(r.data.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };
  useEffect(fetchRows, [endpoint]);

  useEffect(() => {
    sections.forEach((s) => {
      api.get<{ data: MasterItem[] }>(s.listEndpoint)
        .then((r) => setOptions((o) => ({ ...o, [s.listEndpoint]: r.data.data ?? [] })))
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blankSelection = () => Object.fromEntries(sections.map((s) => [s.payloadKey, new Set<string>()]));

  const openCreate = () => {
    setEditing(null); setName(''); setDescription(''); setIsActive(true);
    setSelected(blankSelection()); setOpen(true);
  };
  const openEdit = async (row: TemplateRow) => {
    setEditing(row); setName(row.name); setDescription(row.description ?? '');
    setIsActive(Boolean(Number(row.is_active))); setSelected(blankSelection()); setOpen(true);
    try {
      const r = await api.get<{ data: Record<string, unknown> }>(`${endpoint}/${row.id}`);
      const d = r.data.data;
      setSelected(Object.fromEntries(sections.map((s) => {
        const arr = Array.isArray(d[s.responseKey]) ? (d[s.responseKey] as { id: string }[]) : [];
        return [s.payloadKey, new Set(arr.map((x) => x.id))];
      })));
    } catch { /* keep blank */ }
  };
  const toggle = (payloadKey: string, id: string) => {
    setSelected((sel) => {
      const next = new Set(sel[payloadKey] ?? []);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...sel, [payloadKey]: next };
    });
  };
  const onDelete = async (row: TemplateRow) => {
    if (!window.confirm(`Delete template "${row.name}"?`)) return;
    try { await api.delete(`${endpoint}/${row.id}`); toast.success('Deleted'); fetchRows(); }
    catch (err) { toast.error(apiErrorMessage(err, 'Delete failed')); }
  };
  const onSave = async () => {
    if (!name.trim()) { window.alert('Name is required'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: name.trim(), description: description.trim() || undefined, isActive };
      sections.forEach((s) => { payload[s.payloadKey] = Array.from(selected[s.payloadKey] ?? []); });
      if (editing) await api.patch(`${endpoint}/${editing.id}`, payload);
      else await api.post(endpoint, payload);
      setOpen(false); fetchRows();
    } catch { window.alert('Save failed'); }
    finally { setSaving(false); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => `${r.name} ${r.code ?? ''}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const totalSelected = sections.reduce((n, s) => n + (selected[s.payloadKey]?.size ?? 0), 0);

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle}
        actions={<Button icon={Plus} variant="primary" onClick={openCreate}>{addLabel}</Button>} />
      <Card padding={0}>
        <div style={{ display: 'flex', gap: 12, padding: 16, borderBottom: '1px solid var(--ck-line)', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ck-muted)', pointerEvents: 'none' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              style={{ width: '100%', height: 40, padding: '0 12px 0 36px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }} />
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ck-muted)' }}>
            {loading ? 'Loading…' : `${filtered.length} template${filtered.length === 1 ? '' : 's'}`}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--ck-bg)', textAlign: 'left' }}>
                {['Code', 'Name', 'Items', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em' }}>{h}</th>
                ))}
                <th style={{ padding: '10px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--ck-muted)', letterSpacing: '0.04em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: 'var(--ck-muted)' }}>No templates yet.</td></tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--ck-line)' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--ck-font-mono)', fontSize: 12.5 }}>{row.code ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--ck-ink-soft)' }}>{Number(row.item_count) || 0}</td>
                  <td style={{ padding: '12px 16px' }}><StatusPill status={Number(row.is_active) ? 'Active' : 'Inactive'} /></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <IconAction icon={Pencil} label="Edit" hint="Edit template" onClick={() => openEdit(row)} />
                      <IconAction icon={Trash2} label="Delete" hint="Delete template" tone="danger" onClick={() => onDelete(row)} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${title}` : `New ${title}`}
        subtitle={`${totalSelected} item${totalSelected === 1 ? '' : 's'} selected`}
        width={720}
        footer={(
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </>
        )}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ck-ink-soft)' }}>Name <span style={{ color: 'var(--ck-danger-fg)' }}>*</span></span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Induction"
              style={{ height: 40, padding: '0 12px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'end', height: 40, padding: '0 12px', border: '1px solid var(--ck-line)', borderRadius: 8 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Active</span>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1 / -1' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ck-ink-soft)' }}>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              style={{ padding: 10, border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)', resize: 'vertical' }} />
          </label>
        </div>

        {sections.map((s) => {
          const opts = options[s.listEndpoint] ?? [];
          const sel = selected[s.payloadKey] ?? new Set<string>();
          const groups = s.groupByKind
            ? ['program', 'tour', 'activity'].map((k) => ({ key: k, label: KIND_LABEL[k] ?? k, items: opts.filter((o) => o.kind === k) })).filter((g) => g.items.length)
            : [{ key: s.label, label: s.label, items: opts }];
          return (
            <div key={s.payloadKey} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ck-ink)', marginBottom: 8 }}>
                {s.label} <span style={{ color: 'var(--ck-muted)', fontWeight: 500 }}>· {sel.size} selected</span>
              </div>
              {opts.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--ck-muted)', padding: '8px 0' }}>No items in this master yet.</div>
              ) : groups.map((g) => (
                <div key={g.key} style={{ marginBottom: 10 }}>
                  {s.groupByKind && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '4px 0' }}>{g.label}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {g.items.map((o) => {
                      const on = sel.has(o.id);
                      return (
                        <label key={o.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                          border: '1px solid ' + (on ? 'var(--ck-accent)' : 'var(--ck-line)'),
                          background: on ? 'var(--ck-surface-alt)' : 'var(--ck-surface)',
                        }}>
                          <input type="checkbox" checked={on} onChange={() => toggle(s.payloadKey, o.id)} />
                          <span style={{ fontSize: 12.5, color: 'var(--ck-ink)' }}>
                            {o.title}{o.category ? <span style={{ color: 'var(--ck-muted)' }}> · {o.category}</span> : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </Modal>
    </div>
  );
}

export function InductionTemplateMasterPage() {
  return (
    <TemplateMaster
      title="Induction Template"
      subtitle="Bundle presentations and forms/documents into a reusable induction plan picked on a Job Profile."
      endpoint="/induction-templates"
      addLabel="Add Induction Template"
      sections={[
        { label: 'Presentations', listEndpoint: '/onboarding/presentations', payloadKey: 'presentationIds', responseKey: 'presentations' },
        { label: 'Forms & Documents', listEndpoint: '/onboarding/docs', payloadKey: 'docIds', responseKey: 'docs' },
      ]}
    />
  );
}

export function OnboardingTemplateMasterPage() {
  return (
    <TemplateMaster
      title="Onboarding Template"
      subtitle="Bundle programs, tours and activities into a reusable onboarding plan picked on a Job Profile."
      endpoint="/onboarding-templates"
      addLabel="Add Onboarding Template"
      sections={[
        { label: 'Programs / Tours / Activities', listEndpoint: '/onboarding/items', payloadKey: 'itemIds', responseKey: 'items', groupByKind: true },
      ]}
    />
  );
}
