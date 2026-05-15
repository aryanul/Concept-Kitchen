import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { api } from '../../../lib/api';

export type AtmCatalogueRow = {
  id: string;
  code: string;
  task: string;
  description: string | null;
  category: string | null;
  is_active: number;
};

// Stored shape in form_data.atmTasks
export type JpAtmTask = { id: string; task: string; description: string };

export function AtmTaskPickerModal({
  open, onClose, selectedIds, onSave,
}: {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSave: (tasks: JpAtmTask[]) => void;
}) {
  const [all, setAll] = useState<AtmCatalogueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [draft, setDraft] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get<{ data: AtmCatalogueRow[] }>('/atm-tasks')
      .then((r) => setAll(r.data.data))
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
    setDraft(new Set(selectedIds));
    setSearch(''); setCategoryFilter('');
  }, [open, selectedIds]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of all) if (t.category) set.add(t.category);
    return Array.from(set);
  }, [all]);

  const visible = useMemo(() => {
    let list = all.filter((t) => t.is_active !== 0);
    if (categoryFilter) list = list.filter((t) => t.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        t.task.toLowerCase().includes(q)
        || t.description?.toLowerCase().includes(q)
        || t.code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [all, search, categoryFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, AtmCatalogueRow[]> = {};
    for (const t of visible) {
      const cat = t.category ?? 'Other';
      (groups[cat] ??= []).push(t);
    }
    return groups;
  }, [visible]);

  const toggle = (id: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = () => {
    const picked = all.filter((t) => draft.has(t.id)).map<JpAtmTask>((t) => ({
      id: t.id, task: t.task, description: t.description ?? '',
    }));
    onSave(picked);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}
      title="Pick Auto Tasks"
      subtitle="Select tasks from the hard-coded ATM catalogue"
      width={640}
      footer={<>
        <Button size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="primary" onClick={save}>Save Selection ({draft.size})</Button>
      </>}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ck-muted)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search task, description, code…"
            style={{ width: '100%', height: 38, padding: '0 12px 0 34px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }} />
        </div>
        {categories.length > 1 && (
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ height: 38, padding: '0 30px 0 12px', border: '1px solid var(--ck-line)', borderRadius: 8, background: 'var(--ck-surface)', fontSize: 13, minWidth: 140 }}>
            <option value="">All stages</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--ck-line)', borderRadius: 8 }}>
        {loading && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>Loading…</div>}
        {!loading && visible.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>No tasks match the filter.</div>
        )}
        {!loading && Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div style={{ padding: '8px 12px', background: 'var(--ck-bg)', fontSize: 11, fontWeight: 700, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--ck-line)', position: 'sticky', top: 0 }}>
              {category} <span style={{ color: 'var(--ck-faint)', fontWeight: 500 }}>({items.length})</span>
            </div>
            {items.map((t) => {
              const checked = draft.has(t.id);
              return (
                <label key={t.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderBottom: '1px solid var(--ck-line)',
                  background: checked ? 'var(--ck-surface-alt)' : 'transparent', cursor: 'pointer',
                }}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(t.id)} style={{ marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ck-ink)' }}>{t.task}</span>
                      <span style={{ fontFamily: 'var(--ck-font-mono)', fontSize: 10.5, color: 'var(--ck-faint)', flexShrink: 0 }}>{t.code}</span>
                    </div>
                    {t.description && <div style={{ fontSize: 12, color: 'var(--ck-muted)', marginTop: 3 }}>{t.description}</div>}
                  </div>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}
