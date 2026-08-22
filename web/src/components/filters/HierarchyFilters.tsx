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
// Leaving a parent blank shows every option for the child, so the bar still works
// as a flat set of filters if you only care about one level.

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

// Fetched once per page mount and shared by every select in the bar. These are
// small reference tables, so loading them whole beats a round-trip per keystroke.
export function useHierarchyMasters(): Masters {
  const [masters, setMasters] = useState<Masters>(EMPTY_MASTERS);

  useEffect(() => {
    let cancelled = false;
    const get = <T,>(url: string, params?: Record<string, unknown>) =>
      api.get<{ data: T[] }>(url, { params }).then((r) => r.data.data).catch(() => [] as T[]);

    Promise.all([
      // hiring/companies is paginated and defaults to 20 — ask for the full set so
      // the dropdown isn't silently truncated.
      get<Company>('/hiring/companies', { pageSize: 100 }),
      get<Branch>('/branches'),
      get<LocationRow>('/locations'),
      get<Department>('/departments'),
      get<Division>('/divisions'),
      get<Designation>('/designations'),
    ]).then(([companies, branches, locations, departments, divisions, designations]) => {
      if (cancelled) return;
      setMasters({ companies, branches, locations, departments, divisions, designations });
    });

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
    () => (value.companyId ? masters.branches.filter((b) => b.company_id === value.companyId) : masters.branches),
    [masters.branches, value.companyId]
  );
  const locations = useMemo(
    () => {
      if (value.branchId) return masters.locations.filter((l) => l.branch_id === value.branchId);
      // No branch chosen but a company is — still scope locations to that company's
      // branches, otherwise the list contradicts the company filter above it.
      if (value.companyId) {
        const ids = new Set(branches.map((b) => b.id));
        return masters.locations.filter((l) => l.branch_id && ids.has(l.branch_id));
      }
      return masters.locations;
    },
    [masters.locations, branches, value.branchId, value.companyId]
  );
  const divisions = useMemo(
    () => (value.departmentId ? masters.divisions.filter((d) => d.department_id === value.departmentId) : masters.divisions),
    [masters.divisions, value.departmentId]
  );
  const designations = useMemo(
    () => masters.designations.filter((d) => {
      if (value.divisionId) return d.division_id === value.divisionId;
      if (value.departmentId) return d.department_id === value.departmentId;
      return true;
    }),
    [masters.designations, value.divisionId, value.departmentId]
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
        options={opts(branches)} placeholder="All Branches" minWidth={160} />
    ),
    locationId: (
      <FilterSelect key="location" value={value.locationId} onChange={(v) => set({ locationId: v })}
        options={opts(locations)} placeholder="All Locations" minWidth={160} />
    ),
    departmentId: (
      <FilterSelect key="department" value={value.departmentId} onChange={(v) => set({ departmentId: v })}
        options={opts(masters.departments)} placeholder="All Departments" minWidth={170} />
    ),
    divisionId: (
      <FilterSelect key="division" value={value.divisionId} onChange={(v) => set({ divisionId: v })}
        options={opts(divisions)} placeholder="All Divisions" minWidth={160} />
    ),
    designationId: (
      <FilterSelect key="designation" value={value.designationId} onChange={(v) => set({ designationId: v })}
        options={opts(designations)} placeholder="All Designations" minWidth={180} />
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
