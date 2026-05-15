import { useEffect, useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { api } from '../../../lib/api';

export type Skill = {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  description: string | null;
  is_active: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  // Currently-selected skill NAMES (we store names in form_data for stability)
  selected: string[];
  onSave: (names: string[]) => void;
  // Optional pre-filter to specific categories (e.g. ['Soft Skills','Hard Skills','Education'])
  allowCategories?: string[];
  title?: string;
  subtitle?: string;
};

export function SkillPickerModal({
  open, onClose, selected, onSave,
  allowCategories, title = 'Pick Skills', subtitle = 'Choose from Skill Master',
}: Props) {
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [draft, setDraft] = useState<Set<string>>(new Set());

  // Inline "add new skill" form
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSkills = () => {
    setLoading(true);
    api.get<{ data: Skill[] }>('/skills')
      .then((r) => setAllSkills(r.data.data))
      .catch(() => setAllSkills([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    fetchSkills();
    setDraft(new Set(selected));
    setSearch(''); setCategoryFilter(''); setAddOpen(false);
    setNewName(''); setNewCategory('');
  }, [open, selected]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSkills) if (s.category) set.add(s.category);
    let list = Array.from(set).sort();
    if (allowCategories) list = list.filter((c) => allowCategories.includes(c));
    return list;
  }, [allSkills, allowCategories]);

  const visible = useMemo(() => {
    let list = allSkills.filter((s) => s.is_active !== 0);
    if (allowCategories && allowCategories.length > 0) {
      list = list.filter((s) => s.category && allowCategories.includes(s.category));
    }
    if (categoryFilter) list = list.filter((s) => s.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q)
        || s.category?.toLowerCase().includes(q)
        || s.code?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allSkills, search, categoryFilter, allowCategories]);

  // Group visible by category
  const grouped = useMemo(() => {
    const groups: Record<string, Skill[]> = {};
    for (const s of visible) {
      const cat = s.category ?? 'Uncategorized';
      (groups[cat] ??= []).push(s);
    }
    return groups;
  }, [visible]);

  const toggle = (name: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const addNewSkill = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.post('/skills', {
        name: newName.trim(),
        category: newCategory.trim() || undefined,
        isActive: true,
      });
      toast.success('Skill added to master');
      // refresh list + auto-select
      const fresh = await api.get<{ data: Skill[] }>('/skills');
      setAllSkills(fresh.data.data);
      setDraft((prev) => new Set([...prev, newName.trim()]));
      setNewName(''); setNewCategory(''); setAddOpen(false);
    } catch {
      toast.error('Failed to add skill (name may already exist)');
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} width={680}
      footer={<>
        <Button size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="primary" onClick={() => { onSave(Array.from(draft)); onClose(); }}>
          Save Selection ({draft.size})
        </Button>
      </>}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ck-muted)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skill, category, code…"
            style={{ width: '100%', height: 38, padding: '0 12px 0 34px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }} />
        </div>
        {categories.length > 1 && (
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ height: 38, padding: '0 30px 0 12px', border: '1px solid var(--ck-line)', borderRadius: 8, background: 'var(--ck-surface)', fontSize: 13, minWidth: 160 }}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <Button size="sm" icon={Plus} onClick={() => setAddOpen((o) => !o)}>New</Button>
      </div>

      {addOpen && (
        <div style={{ padding: 12, background: 'var(--ck-bg)', border: '1px solid var(--ck-line)', borderRadius: 8, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ck-ink)' }}>Add new skill to master</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Skill name *"
              style={{ ...inp, flex: 1 }} />
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ ...inp, flex: 1 }}>
              <option value="">Pick category</option>
              {(allowCategories ?? categories).map((c) => <option key={c} value={c}>{c}</option>)}
              {!allowCategories && <option value="__new__" disabled>— or type one below —</option>}
            </select>
          </div>
          {!allowCategories && newCategory === '__new__' && (
            <input value={newCategory === '__new__' ? '' : newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category name"
              style={inp} />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <Button size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" disabled={saving || !newName.trim()} onClick={addNewSkill}>
              {saving ? 'Adding…' : 'Add to Master'}
            </Button>
          </div>
        </div>
      )}

      <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--ck-line)', borderRadius: 8 }}>
        {loading && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>Loading…</div>}
        {!loading && visible.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>
            No skills found. Use "New" to add one.
          </div>
        )}
        {!loading && Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div style={{ padding: '8px 12px', background: 'var(--ck-bg)', fontSize: 11, fontWeight: 700, color: 'var(--ck-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--ck-line)', position: 'sticky', top: 0 }}>
              {category} <span style={{ color: 'var(--ck-faint)', fontWeight: 500 }}>({items.length})</span>
            </div>
            {items.map((s) => {
              const checked = draft.has(s.name);
              return (
                <label key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderBottom: '1px solid var(--ck-line)',
                  background: checked ? 'var(--ck-surface-alt)' : 'transparent', cursor: 'pointer',
                }}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(s.name)} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--ck-ink)' }}>{s.name}</span>
                  {s.code && <span style={{ fontFamily: 'var(--ck-font-mono)', fontSize: 10.5, color: 'var(--ck-faint)' }}>{s.code}</span>}
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}

const inp: React.CSSProperties = { height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };
