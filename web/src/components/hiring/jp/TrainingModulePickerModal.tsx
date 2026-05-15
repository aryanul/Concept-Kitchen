import { useEffect, useState } from 'react';
import { Search, BookOpen } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { api } from '../../../lib/api';

export type TrainingModule = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  chapter_count: number | string;
  duration_hours: number | string | null;
  is_active: number;
};

// Stored in form_data as id references; we hydrate to full objects in the card view.
export type JpTrainingModuleRef = { id: string; name: string; description: string; chapters: number };

export function TrainingModulePickerModal({
  open, onClose, selectedIds, onSave,
}: {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSave: (modules: JpTrainingModuleRef[]) => void;
}) {
  const [all, setAll] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get<{ data: TrainingModule[] }>('/training-modules')
      .then((r) => setAll(r.data.data))
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
    setDraft(new Set(selectedIds));
    setSearch('');
  }, [open, selectedIds]);

  const visible = (search.trim()
    ? all.filter((m) => {
        const q = search.toLowerCase();
        return m.name.toLowerCase().includes(q)
          || m.description?.toLowerCase().includes(q)
          || m.code.toLowerCase().includes(q);
      })
    : all
  ).filter((m) => m.is_active !== 0);

  const toggle = (id: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = () => {
    const picked = all.filter((m) => draft.has(m.id)).map<JpTrainingModuleRef>((m) => ({
      id: m.id,
      name: m.name,
      description: m.description ?? '',
      chapters: Number(m.chapter_count) || 0,
    }));
    onSave(picked);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Pick Training Modules" subtitle="Choose from Training Module Master" width={620}
      footer={<>
        <Button size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="primary" onClick={save}>Save Selection ({draft.size})</Button>
      </>}>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--ck-muted)' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, description, code…"
          style={{ width: '100%', height: 38, padding: '0 12px 0 34px', border: '1px solid var(--ck-line)', borderRadius: 8, fontSize: 13, background: 'var(--ck-surface)' }} />
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--ck-line)', borderRadius: 8 }}>
        {loading && <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>Loading…</div>}
        {!loading && visible.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>
            No modules in the master yet. Go to Masters → Training Modules to add one.
          </div>
        )}
        {!loading && visible.map((m) => {
          const checked = draft.has(m.id);
          return (
            <label key={m.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '11px 14px', borderBottom: '1px solid var(--ck-line)',
              background: checked ? 'var(--ck-surface-alt)' : 'transparent', cursor: 'pointer',
            }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(m.id)} style={{ marginTop: 3 }} />
              <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--ck-line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BookOpen size={16} style={{ color: 'var(--ck-muted)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ck-ink)' }}>{m.name}</span>
                  <span style={{ fontFamily: 'var(--ck-font-mono)', fontSize: 11, color: 'var(--ck-faint)', flexShrink: 0 }}>{m.code}</span>
                </div>
                {m.description && <div style={{ fontSize: 12, color: 'var(--ck-muted)', marginTop: 3 }}>{m.description}</div>}
                <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 11, color: 'var(--ck-faint)' }}>
                  <span>{Number(m.chapter_count) || 0} chapter{Number(m.chapter_count) === 1 ? '' : 's'}</span>
                  {m.duration_hours != null && <span>{m.duration_hours}h</span>}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </Modal>
  );
}
