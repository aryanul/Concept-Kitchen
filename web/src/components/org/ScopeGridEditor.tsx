// A repeatable Company / Branch / Location grid.
//
// Duty shifts and holidays are not one-plant-one-rule: a 07:00–15:00 shift can
// run at four sites across two companies, and a regional holiday applies to a
// named list of branches. Both screens used to allow exactly one branch, so the
// real-world case could not be entered at all. This editor is the shared answer:
// fill in one company/branch/location set, press Add, repeat.

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  CompanyBranchLocationFields, RemoveRowButton, useScopeNames,
  EMPTY_SCOPE, type OrgScope,
} from './CompanyBranchLocation';

/** As returned by the API — ids plus resolved names for display. */
export type ScopeRow = {
  id?: string;
  company_id: string | null;
  branch_id: string;
  location_id: string | null;
  company_name?: string | null;
  branch_name?: string | null;
  location_name?: string | null;
};

/** What we POST/PATCH back. */
export function toScopePayload(rows: ScopeRow[]) {
  return rows.map((r) => ({
    companyId: r.company_id,
    branchId: r.branch_id,
    locationId: r.location_id,
  }));
}

export function ScopeGridEditor({
  value, onChange, label = 'Applicable at',
}: {
  value: ScopeRow[];
  onChange: (next: ScopeRow[]) => void;
  label?: string;
}) {
  const [draft, setDraft] = useState<OrgScope>(EMPTY_SCOPE);
  const names = useScopeNames();

  const add = () => {
    if (!draft.companyId) { toast.error('Company is required'); return; }
    if (!draft.branchId) { toast.error('Branch is required'); return; }
    const locationId = draft.locationId || null;
    const dup = value.some((r) => r.branch_id === draft.branchId && (r.location_id ?? null) === locationId);
    if (dup) { toast.error('That company / branch / location set is already added'); return; }
    onChange([...value, {
      company_id: draft.companyId,
      branch_id: draft.branchId,
      location_id: locationId,
      company_name: names.companyName(draft.companyId),
      branch_name: names.branchName(draft.branchId),
      location_name: locationId ? names.locationName(locationId) : null,
    }]);
    setDraft(EMPTY_SCOPE); // ready for the next set
  };

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ck-ink-soft)', marginBottom: 8 }}>
        {label}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 380px', minWidth: 280 }}>
          <CompanyBranchLocationFields value={draft} onChange={setDraft} inline />
        </div>
        <Button size="sm" icon={Plus} variant="primary" onClick={add}>Add</Button>
      </div>

      {value.length === 0 ? (
        <div style={{
          marginTop: 10, padding: '10px 12px', border: '1px dashed var(--ck-line)',
          borderRadius: 7, background: 'var(--ck-bg)', fontSize: 12.5, color: 'var(--ck-muted)',
        }}>
          Not restricted — applies everywhere. Add a set above to limit it.
        </div>
      ) : (
        <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--ck-bg)' }}>
              <th style={th}>Company</th>
              <th style={th}>Branch</th>
              <th style={th}>Location</th>
              <th style={{ ...th, width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {value.map((r, i) => (
              <tr key={r.id ?? `${r.branch_id}-${r.location_id}-${i}`} style={{ borderBottom: '1px solid var(--ck-line)' }}>
                <td style={td}>{r.company_name ?? names.companyOfBranch(r.branch_id)}</td>
                <td style={td}>{r.branch_name ?? names.branchName(r.branch_id)}</td>
                <td style={{ ...td, color: 'var(--ck-ink-soft)' }}>
                  {r.location_name ?? (r.location_id ? names.locationName(r.location_id) : 'All locations')}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <RemoveRowButton onClick={() => onChange(value.filter((_, j) => j !== i))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * List cells for a multi-scope row.
 *
 * Spelling out four branch names in a table cell wrecks the column widths and
 * is unreadable at a glance, so the list shows a count and the full set moves
 * behind a click. Renders plain text when there is nothing to expand.
 */
export function ScopeCountCell({
  scopes, onOpen, singular, plural,
}: {
  scopes: ScopeRow[];
  onOpen: () => void;
  singular: string;
  plural: string;
}) {
  if (scopes.length === 0) return <span style={{ color: 'var(--ck-muted)' }}>All</span>;
  return (
    <button
      type="button"
      onClick={onOpen}
      title="View the full list"
      style={{
        padding: '3px 10px', borderRadius: 999, cursor: 'pointer',
        border: '1px solid var(--ck-line)', background: 'var(--ck-line-soft)',
        color: 'var(--ck-ink)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
      }}
    >
      {scopes.length} {scopes.length === 1 ? singular : plural}
    </button>
  );
}

/** Read-only expansion of a scope set — view only, editing happens in the form. */
export function ScopeDetailModal({
  open, onClose, title, scopes,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  scopes: ScopeRow[];
}) {
  const names = useScopeNames();
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle="Read-only — edit from the row's Edit action" width={560}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: 'var(--ck-bg)' }}>
            <th style={th}>Company</th>
            <th style={th}>Branch</th>
            <th style={th}>Location</th>
          </tr>
        </thead>
        <tbody>
          {scopes.map((r, i) => (
            <tr key={r.id ?? i} style={{ borderBottom: '1px solid var(--ck-line)' }}>
              <td style={td}>{r.company_name ?? names.companyOfBranch(r.branch_id)}</td>
              <td style={td}>{r.branch_name ?? names.branchName(r.branch_id)}</td>
              <td style={{ ...td, color: 'var(--ck-ink-soft)' }}>
                {r.location_name ?? (r.location_id ? names.locationName(r.location_id) : 'All locations')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

const th: React.CSSProperties = {
  padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--ck-muted)',
  textAlign: 'left', border: '1px solid var(--ck-line)',
};
const td: React.CSSProperties = { padding: '9px 12px', border: '1px solid var(--ck-line)' };
