import { ulid } from 'ulid';
import { query } from './db';

/**
 * Company / branch / location applicability sets.
 *
 * Duty shifts and holidays both answer "where does this apply?" with a *list*
 * of company/branch/location combinations rather than a single branch (see
 * migration 0044). The write path is identical for both, so it lives here
 * instead of being copied into masters.ts and index.ts.
 */

export type ScopeInput = {
  companyId?: string | null;
  branchId?: string | null;
  locationId?: string | null;
};

export type ScopeTable = 'shift_scopes' | 'holiday_scopes';
export type ScopeFk = 'shift_id' | 'holiday_id';

/**
 * Swap the whole set. Reconciling row by row buys nothing (these are a handful
 * of rows) and gets the add/remove/reorder cases subtly wrong.
 */
export async function replaceScopes(
  table: ScopeTable,
  fkColumn: ScopeFk,
  parentId: string,
  scopes: ScopeInput[]
): Promise<void> {
  await query(`DELETE FROM ${table} WHERE ${fkColumn} = ?`, [parentId]);
  let order = 0;
  const seen = new Set<string>();
  for (const s of scopes) {
    const branchId = typeof s?.branchId === 'string' ? s.branchId.trim() : '';
    if (!branchId) continue; // branch is the anchor — a scope without one means nothing
    const locationId =
      typeof s?.locationId === 'string' && s.locationId.trim() ? s.locationId.trim() : null;
    // The UI blocks duplicates, but a replayed request should not be able to
    // insert the same mapping twice.
    const key = `${branchId}|${locationId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const companyId =
      typeof s?.companyId === 'string' && s.companyId.trim() ? s.companyId.trim() : null;
    await query(
      `INSERT INTO ${table} (id, ${fkColumn}, company_id, branch_id, location_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ulid(), parentId, companyId, branchId, locationId, order++]
    );
  }
}
