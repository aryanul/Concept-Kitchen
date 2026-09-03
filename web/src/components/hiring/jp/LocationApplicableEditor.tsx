import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { IconAction } from '../../ui/IconAction';
import {
  CompanyBranchLocationFields, RemoveRowButton, useScopeNames,
  EMPTY_SCOPE, type OrgScope,
} from '../../org/CompanyBranchLocation';

export type JpLocation = {
  branchId: string;
  locationId: string | null;
  positions: number;
  // Display-only fields (populated by parent when hydrating from server)
  branchName?: string;
  locationName?: string;
  companyName?: string;
};

export function LocationApplicableEditor({
  value,
  onChange,
}: {
  value: JpLocation[];
  onChange: (next: JpLocation[]) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [scope, setScope] = useState<OrgScope>(EMPTY_SCOPE);
  const [positions, setPositions] = useState(1);
  const names = useScopeNames();

  const addLocation = () => {
    if (!scope.companyId) {
      toast.error('Company is required');
      return;
    }
    if (!scope.branchId) {
      toast.error('Branch is required');
      return;
    }
    const locationId = scope.locationId || null;
    const dup = value.find((v) => v.branchId === scope.branchId && v.locationId === locationId);
    if (dup) {
      toast.error('This company + branch + location combination is already added');
      return;
    }
    onChange([...value, {
      branchId: scope.branchId,
      locationId,
      positions: Math.max(1, Number(positions) || 1),
      // Company is not stored on the row — a branch belongs to exactly one
      // company, so it is always derivable and can never drift out of sync.
      companyName: names.companyName(scope.companyId),
      branchName: names.branchName(scope.branchId),
      locationName: locationId ? names.locationName(locationId) : undefined,
    }]);
    setScope(EMPTY_SCOPE); setPositions(1);
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
        <IconAction icon={Plus} label="Add" hint="Add a branch/location with positions" iconSize={16} onClick={() => setModalOpen(true)} />
      </div>

      {value.length > 0 && (
        <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--ck-bg)' }}>
              <th style={th}>Company</th>
              <th style={th}>Branch</th>
              <th style={th}>Location</th>
              <th style={{ ...th, width: 110 }}>Positions</th>
              <th style={{ ...th, width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {value.map((l, i) => (
              <tr key={`${l.branchId}-${l.locationId}-${i}`} style={{ borderBottom: '1px solid var(--ck-line)' }}>
                {/* Rows hydrated from the server carry no companyName, so fall
                    back to resolving it through the branch. */}
                <td style={td}>{l.companyName ?? names.companyOfBranch(l.branchId)}</td>
                <td style={td}>{l.branchName ?? names.branchName(l.branchId)}</td>
                <td style={{ ...td, color: 'var(--ck-ink-soft)' }}>
                  {l.locationName ?? (l.locationId ? names.locationName(l.locationId) : '—')}
                </td>
                <td style={{ ...td, fontWeight: 700 }}>{l.positions}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <RemoveRowButton onClick={() => remove(i)} hint="Remove this location" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Location" subtitle="Pick the company / branch / location and number of positions" width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CompanyBranchLocationFields value={scope} onChange={setScope} />
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
