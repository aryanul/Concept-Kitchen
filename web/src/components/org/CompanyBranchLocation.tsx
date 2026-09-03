// One place for the Company → Branch → Location cascade.
//
// Every screen that scopes something to part of the org (job-profile locations,
// duty shifts, holidays) needs the same three fields with the same rules:
// Company stands alone, Branch offers only that company's branches, Location
// only that branch's locations, and a child is locked until its parent is set.
// Reimplementing that per screen is how they drift, so it lives here once.

import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useHierarchyMasters } from '../filters';

export type OrgScope = {
  companyId: string;
  branchId: string;
  locationId: string;
};

export const EMPTY_SCOPE: OrgScope = { companyId: '', branchId: '', locationId: '' };

type Props = {
  value: OrgScope;
  onChange: (next: OrgScope) => void;
  /** Location is optional on most screens; set true to mark it required in the label. */
  requireLocation?: boolean;
  /** Render as a single row instead of stacked labels. */
  inline?: boolean;
  disabled?: boolean;
};

/**
 * Resolves scope ids to display names. Kept next to the picker so the grid that
 * lists saved scopes and the picker that creates them can never disagree.
 */
export function useScopeNames() {
  const masters = useHierarchyMasters();
  return useMemo(() => {
    const companies = new Map(masters.companies.map((c) => [c.id, c.name]));
    const branches = new Map(masters.branches.map((b) => [b.id, b]));
    const locations = new Map(masters.locations.map((l) => [l.id, l.name]));
    return {
      companyName: (id: string | null | undefined) => (id ? companies.get(id) ?? '—' : '—'),
      branchName: (id: string | null | undefined) => (id ? branches.get(id)?.name ?? '—' : '—'),
      locationName: (id: string | null | undefined) => (id ? locations.get(id) ?? '—' : '—'),
      /** Company is derivable from the branch, so callers need not store it. */
      companyOfBranch: (branchId: string | null | undefined) => {
        const company = branchId ? branches.get(branchId)?.company_id : null;
        return company ? companies.get(company) ?? '—' : '—';
      },
      companyIdOfBranch: (branchId: string | null | undefined) =>
        (branchId ? branches.get(branchId)?.company_id ?? '' : ''),
    };
  }, [masters]);
}

export function CompanyBranchLocationFields({
  value, onChange, requireLocation = false, inline = false, disabled = false,
}: Props) {
  const masters = useHierarchyMasters();

  const branches = useMemo(
    () => masters.branches.filter((b) => b.company_id === value.companyId),
    [masters.branches, value.companyId]
  );
  const locations = useMemo(
    () => masters.locations.filter((l) => l.branch_id === value.branchId),
    [masters.locations, value.branchId]
  );

  // Changing a parent invalidates its children — clear them in the same update
  // so a stale branch can never be saved against a different company.
  const setCompany = (companyId: string) => onChange({ companyId, branchId: '', locationId: '' });
  const setBranch = (branchId: string) => onChange({ ...value, branchId, locationId: '' });
  const setLocation = (locationId: string) => onChange({ ...value, locationId });

  const wrap: React.CSSProperties = inline
    ? { display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }
    : { display: 'flex', flexDirection: 'column', gap: 12 };

  return (
    <div style={wrap}>
      <label style={lbl}>
        <span style={lblSpan}>Company *</span>
        <select
          value={value.companyId}
          onChange={(e) => setCompany(e.target.value)}
          disabled={disabled}
          style={inp}
        >
          <option value="">Select company</option>
          {masters.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <label style={lbl}>
        <span style={lblSpan}>Branch *</span>
        <select
          value={value.branchId}
          onChange={(e) => setBranch(e.target.value)}
          disabled={disabled || !value.companyId}
          title={!value.companyId ? 'Select a Company first' : undefined}
          style={{ ...inp, ...(disabled || !value.companyId ? lockedInp : null) }}
        >
          <option value="">{value.companyId ? 'Select branch' : 'Select company first'}</option>
          {value.companyId && branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>

      <label style={lbl}>
        <span style={lblSpan}>Location {requireLocation ? '*' : '(optional)'}</span>
        <select
          value={value.locationId}
          onChange={(e) => setLocation(e.target.value)}
          disabled={disabled || !value.branchId}
          title={!value.branchId ? 'Select a Branch first' : undefined}
          style={{ ...inp, ...(disabled || !value.branchId ? lockedInp : null) }}
        >
          <option value="">
            {!value.branchId ? 'Select branch first' : requireLocation ? 'Select location' : 'All locations'}
          </option>
          {value.branchId && locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

/**
 * The small trailing remove control used by every scope grid — the client asked
 * for it to sit at the end of the row and stay out of the way, so it is an icon
 * with a hover hint rather than a full-width button.
 */
export function RemoveRowButton({ onClick, hint = 'Remove this row' }: { onClick: () => void; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-label={hint}
      style={{
        width: 24, height: 24, borderRadius: 6, padding: 0,
        border: '1px solid var(--ck-line)', background: 'var(--ck-surface)',
        color: 'var(--ck-danger-fg)', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Trash2 size={13} strokeWidth={1.9} />
    </button>
  );
}

const inp: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 10px',
  border: '1px solid var(--ck-line)', borderRadius: 7,
  fontSize: 13, background: 'var(--ck-surface)', fontFamily: 'inherit',
};
const lockedInp: React.CSSProperties = {
  background: 'var(--ck-line-soft)', color: 'var(--ck-muted)', cursor: 'not-allowed',
};
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 150px' };
const lblSpan: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--ck-ink-soft)' };
