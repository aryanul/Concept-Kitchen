// Cascading org-hierarchy filter bar, shared by the Hiring list pages.
//
// The client asked for the same thing on three screens (Job Profiles, Vacancy,
// Job Listing): filter by Company → Branch → Location and Department → Division →
// Designation, where each level only offers children of the level above it. Doing
// that three times independently is how the three screens drift apart, so the
// option-loading and the cascade rules live here once.
//
// Two independent chains:
//   Company  → Branch    → Location
//   Department → Division → Designation
// Picking a parent narrows its children and clears any now-invalid child value.
// A child whose parent is still blank is *locked*, not merely unfiltered: offering
// every designation in the company before a division is chosen invites filter
// combinations that contradict each other and return nothing. The locked select
// reads "All", so the unfiltered state is still legible at a glance.

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { FilterSelect } from './filterControls';
import { ClearFiltersButton } from './filterControls';

export type HierarchyValue = {
  companyId: string;
  branchId: string;
  locationId: string;
  departmentId: string;
  divisionId: string;
  designationId: string;
};

export const EMPTY_HIERARCHY: HierarchyValue = {
  companyId: '', branchId: '', locationId: '',
  departmentId: '', divisionId: '', designationId: '',
};

export type HierarchyField = keyof HierarchyValue;

type Company     = { id: string; name: string };
type Branch      = { id: string; name: string; company_id: string | null };
type LocationRow = { id: string; name: string; branch_id: string | null };
type Department  = { id: string; name: string };
type Division    = { id: string; name: string; department_id: string | null };
type Designation = { id: string; name: string; department_id: string | null; division_id: string | null };

type Masters = {
  companies: Company[]; branches: Branch[]; locations: LocationRow[];
  departments: Department[]; divisions: Division[]; designations: Designation[];
};

const EMPTY_MASTERS: Masters = {
  companies: [], branches: [], locations: [],
  departments: [], divisions: [], designations: [],
};

// These six reference tables change a few times a month at most, but every page
// that mounted this hook re-fetched all six — six round-trips of "Loading…" on
// each navigation. Cache them for the session instead: the first page to ask
// pays, everyone after it renders from memory. `masterCache` holds the promise
// rather than the value so two pages mounting at once share one set of requests.
let masterCache: Promise<Masters> | null = null;
let masterValue: Masters | null = null;

function loadMasters(): Promise<Masters> {
  if (masterCache) return masterCache;
  const get = <T,>(url: string, params?: Record<string, unknown>) =>
    api.get<{ data: T[] }>(url, { params }).then((r) => r.data.data).catch(() => [] as T[]);

  masterCache = Promise.all([
    // hiring/companies is paginated and defaults to 20 — ask for the full set so
    // the dropdown isn't silently truncated.
    get<Company>('/hiring/companies', { pageSize: 100 }),
    get<Branch>('/branches'),
    get<LocationRow>('/locations'),
    get<Department>('/departments'),
    get<Division>('/divisions'),
    get<Designation>('/designations'),
  ]).then(([companies, branches, locations, departments, divisions, designations]) => {
    masterValue = { companies, branches, locations, departments, divisions, designations };
    return masterValue;
  });
  return masterCache;
}

/**
 * Forget the cached masters — call after editing a branch/division/designation
 * so the next screen picks the change up instead of a session-old snapshot.
 */
export function invalidateHierarchyMasters(): void {
  masterCache = null;
  masterValue = null;
}

export function useHierarchyMasters(): Masters {
  // Seeded synchronously from the cache, so a revisit paints filled dropdowns
  // on the very first render rather than flashing empty selects.
  const [masters, setMasters] = useState<Masters>(() => masterValue ?? EMPTY_MASTERS);

  useEffect(() => {
    let cancelled = false;
    loadMasters().then((m) => { if (!cancelled) setMasters(m); });
    return () => { cancelled = true; };
  }, []);

  return masters;
}

type Props = {
  value: HierarchyValue;
  onChange: (next: HierarchyValue) => void;
  masters: Masters;
  /** Which selects to render, in order. Defaults to the full six-level bar. */
  fields?: HierarchyField[];
};

const ALL_FIELDS: HierarchyField[] = [
  'companyId', 'branchId', 'locationId', 'departmentId', 'divisionId', 'designationId',
];

export function HierarchyFilters({ value, onChange, masters, fields = ALL_FIELDS }: Props) {
  const branches = useMemo(
    () => (value.companyId ? masters.branches.filter((b) => b.company_id === value.companyId) : []),
    [masters.branches, value.companyId]
  );
  const locations = useMemo(
    () => (value.branchId ? masters.locations.filter((l) => l.branch_id === value.branchId) : []),
    [masters.locations, value.branchId]
  );
  const divisions = useMemo(
    () => (value.departmentId ? masters.divisions.filter((d) => d.department_id === value.departmentId) : []),
    [masters.divisions, value.departmentId]
  );
  const designations = useMemo(
    () => (value.divisionId ? masters.designations.filter((d) => d.division_id === value.divisionId) : []),
    [masters.designations, value.divisionId]
  );

  // Changing a parent invalidates its descendants — clear them in the same update
  // so the caller never issues a request with a contradictory pair of filters.
  const set = (patch: Partial<HierarchyValue>) => {
    const next = { ...value, ...patch };
    if (patch.companyId !== undefined)    { next.branchId = ''; next.locationId = ''; }
    if (patch.branchId !== undefined)     { next.locationId = ''; }
    if (patch.departmentId !== undefined) { next.divisionId = ''; next.designationId = ''; }
    if (patch.divisionId !== undefined)   { next.designationId = ''; }
    onChange(next);
  };

  const opts = <T extends { id: string; name: string }>(rows: T[]) =>
    rows.map((r) => ({ label: r.name, value: r.id }));

  const controls: Record<HierarchyField, React.ReactNode> = {
    companyId: (
      <FilterSelect key="company" value={value.companyId} onChange={(v) => set({ companyId: v })}
        options={opts(masters.companies)} placeholder="All Companies" minWidth={170} />
    ),
    branchId: (
      <FilterSelect key="branch" value={value.branchId} onChange={(v) => set({ branchId: v })}
        options={opts(branches)} placeholder="All Branches" minWidth={160}
        disabled={!value.companyId} disabledPlaceholder="All"
        title={!value.companyId ? 'Select a Company first' : undefined} />
    ),
    locationId: (
      <FilterSelect key="location" value={value.locationId} onChange={(v) => set({ locationId: v })}
        options={opts(locations)} placeholder="All Locations" minWidth={160}
        disabled={!value.branchId} disabledPlaceholder="All"
        title={!value.branchId ? 'Select a Branch first' : undefined} />
    ),
    departmentId: (
      <FilterSelect key="department" value={value.departmentId} onChange={(v) => set({ departmentId: v })}
        options={opts(masters.departments)} placeholder="All Departments" minWidth={170} />
    ),
    divisionId: (
      <FilterSelect key="division" value={value.divisionId} onChange={(v) => set({ divisionId: v })}
        options={opts(divisions)} placeholder="All Divisions" minWidth={160}
        disabled={!value.departmentId} disabledPlaceholder="All"
        title={!value.departmentId ? 'Select a Department first' : undefined} />
    ),
    designationId: (
      <FilterSelect key="designation" value={value.designationId} onChange={(v) => set({ designationId: v })}
        options={opts(designations)} placeholder="All Designations" minWidth={180}
        disabled={!value.divisionId} disabledPlaceholder="All"
        title={!value.divisionId ? 'Select a Division first' : undefined} />
    ),
  };

  const dirty = fields.some((f) => value[f] !== '');

  return (
    <>
      {fields.map((f) => controls[f])}
      <ClearFiltersButton
        visible={dirty}
        onClick={() => onChange({ ...value, ...Object.fromEntries(fields.map((f) => [f, ''])) })}
      />
    </>
  );
}
