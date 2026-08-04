import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { IconAction } from '../../ui/IconAction';
import { api } from '../../../lib/api';

export type ShiftOption = {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
};

export function WorkShiftsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [allShifts, setAllShifts] = useState<ShiftOption[]>([]);
  const [draft, setDraft] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<{ data: ShiftOption[] }>('/shifts', { params: { pageSize: 1000 } }).then((r) => setAllShifts(r.data.data)).catch(() => {});
  }, []);

  const openModal = () => {
    setDraft(new Set(value));
    setModalOpen(true);
  };

  const toggleDraft = (id: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveModal = () => {
    onChange(Array.from(draft));
    setModalOpen(false);
  };

  const remove = (id: string) => onChange(value.filter((x) => x !== id));
  const selectedShifts = value.map((id) => allShifts.find((s) => s.id === id)).filter(Boolean) as ShiftOption[];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, padding: '8px 12px', minHeight: 38, border: '1px dashed var(--ck-line)', borderRadius: 7, background: 'var(--ck-bg)', fontSize: 12.5, color: 'var(--ck-muted)' }}>
          {value.length === 0
            ? 'No shifts selected. Click + to pick one or more shifts from Shift Master.'
            : `${value.length} shift${value.length === 1 ? '' : 's'} selected`}
        </div>
        <IconAction icon={Plus} label="Add" hint="Add shifts from Shift Master" iconSize={16} onClick={openModal} />
      </div>

      {selectedShifts.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {selectedShifts.map((s) => (
            <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: '#222', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
              {s.name} <span style={{ color: '#aaa', fontWeight: 400, fontSize: 11 }}>({s.start_time}–{s.end_time})</span>
              <IconAction icon={X} label="Remove" hint={`Remove ${s.name}`} iconOnly tone="danger" variant="plain" iconSize={12} onClick={() => remove(s.id)} />
            </span>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Pick Work Shifts" subtitle="Select one or more shifts applicable to this Job Profile" width={520}
        footer={<>
          <Button size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button size="sm" variant="primary" onClick={saveModal}>Save Selection</Button>
        </>}>
        {allShifts.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--ck-muted)', fontSize: 13 }}>
            No shifts in the Shift Master yet. Add them under Masters → Shift Master.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allShifts.map((s) => {
              const checked = draft.has(s.id);
              return (
                <label key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${checked ? '#222' : 'var(--ck-line)'}`,
                  background: checked ? 'var(--ck-surface-alt)' : 'var(--ck-surface)',
                }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleDraft(s.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ck-ink)' }}>{s.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ck-muted)', marginTop: 2 }}>
                      {s.start_time} – {s.end_time} · {s.code}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}
