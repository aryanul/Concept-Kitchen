import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { api } from '../../../lib/api';

export type JpLocation = {
  branchId: string;
  locationId: string | null;
  positions: number;
  // Display-only fields (populated by parent when hydrating from server)
  branchName?: string;
  locationName?: string;
};

type Branch = { id: string; name: string; city: string | null };
type LocationMaster = { id: string; name: string; city: string | null; branch_id: string | null };

export function LocationApplicableEditor({
  value,
  onChange,
}: {
  value: JpLocation[];
  onChange: (next: JpLocation[]) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [locations, setLocations] = useState<LocationMaster[]>([]);

  const [branchId, setBranchId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [positions, setPositions] = useState(1);

  useEffect(() => {
    if (!modalOpen) return;
    api.get<{ data: Branch[] }>('/branches').then((r) => setBranches(r.data.data)).catch(() => {});
    api.get<{ data: LocationMaster[] }>('/locations').then((r) => setLocations(r.data.data)).catch(() => {});
  }, [modalOpen]);

  const branchOptions = branches;
  const locationOptions = branchId
    ? locations.filter((l) => l.branch_id === branchId || !l.branch_id)
    : locations;

  const addLocation = () => {
    if (!branchId) {
      toast.error('Branch is required');
      return;
    }
    const dup = value.find((v) => v.branchId === branchId && v.locationId === (locationId || null));
    if (dup) {
      toast.error('This branch + location combination is already added');
      return;
    }
    const branch = branches.find((b) => b.id === branchId);
    const loc = locations.find((l) => l.id === locationId);
    onChange([...value, {
      branchId, locationId: locationId || null,
      positions: Math.max(1, Number(positions) || 1),
      branchName: branch?.name, locationName: loc?.name,
    }]);
    setBranchId(''); setLocationId(''); setPositions(1);
    setModalOpen(false);
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, padding: '8px 12px', minHeight: 38, border: '1px dashed var(--ck-line)', borderRadius: 7, background: 'var(--ck-bg)', fontSize: 12.5, color: 'var(--ck-muted)' }}>
          {value.length === 0
            ? 'No locations added yet. Click + to add a branch/location with positions.'
            : `${value.length} location${value.length === 1 ? '' : 's'} configured`}
        </div>
        <button onClick={() => setModalOpen(true)} type="button"
          style={{ width: 36, height: 38, borderRadius: 7, background: '#222', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={16} />
        </button>
      </div>

      {value.length > 0 && (
        <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--ck-bg)' }}>
              <th style={th}>Branch</th>
              <th style={th}>Location</th>
              <th style={{ ...th, width: 110 }}>Positions</th>
              <th style={{ ...th, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {value.map((l, i) => (
              <tr key={`${l.branchId}-${l.locationId}-${i}`} style={{ borderBottom: '1px solid var(--ck-line)' }}>
                <td style={td}>{l.branchName ?? l.branchId}</td>
                <td style={{ ...td, color: 'var(--ck-ink-soft)' }}>{l.locationName ?? (l.locationId ? l.locationId : '—')}</td>
                <td style={{ ...td, fontWeight: 700 }}>{l.positions}</td>
                <td style={td}>
                  <button type="button" onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ck-danger-fg, #b00)' }}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Location" subtitle="Pick the branch / location and number of positions" width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={lbl}>
            <span style={lblSpan}>Branch / Company *</span>
            <select value={branchId} onChange={(e) => { setBranchId(e.target.value); setLocationId(''); }} style={inp}>
              <option value="">Select branch</option>
              {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}{b.city ? ` — ${b.city}` : ''}</option>)}
            </select>
          </label>
          <label style={lbl}>
            <span style={lblSpan}>Location (optional)</span>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} style={inp}>
              <option value="">No specific location</option>
              {locationOptions.map((l) => <option key={l.id} value={l.id}>{l.name}{l.city ? ` — ${l.city}` : ''}</option>)}
            </select>
          </label>
          <label style={lbl}>
            <span style={lblSpan}>Number of Positions *</span>
            <input type="number" min={1} value={positions} onChange={(e) => setPositions(Number(e.target.value))} style={inp} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <Button size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={addLocation}>Add</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 10px', border: '1px solid var(--ck-line)', borderRadius: 7, fontSize: 13, background: 'var(--ck-surface)' };
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
const lblSpan: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--ck-ink-soft)' };
const th: React.CSSProperties = { padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)', textAlign: 'left', border: '1px solid var(--ck-line)' };
const td: React.CSSProperties = { padding: '9px 12px', border: '1px solid var(--ck-line)' };
