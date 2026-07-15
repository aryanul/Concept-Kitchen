// Concept Kitchen master-data sync engine.
//
// Pulls CK's central masters and mirrors them into our own tables as an EDITABLE
// CO-OWNED mirror (see migration 0037). Rules honoured here:
//   * We dedupe / match on `ck_id`, never on name (CK has duplicate names).
//   * On UPDATE we only ever SET CK-owned columns (name, and CK-derived FK links).
//     Locally-owned columns (code, city, kind, description, custom flags) are never
//     named in an UPDATE, so a re-sync can never blank a field you edited here.
//   * Names are trimmed on ingest (CK data has trailing whitespace).
//   * A CK row that vanishes is left in place (we never delete) — its local data survives.
//
// Each domain is wrapped in its own try/catch so one failing endpoint degrades that
// domain only, not the whole run.

import { ulid } from 'ulid';
import { query } from './db';
import { ckList, type CkRow } from './ckApi';

export type DomainStat = { inserted: number; updated: number };
export type CkSyncSummary = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  stats: Record<string, DomainStat>;
  errors: string[];
};

const trim = (s: string) => s.trim();
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Insert-or-update a row keyed by ck_id in a table whose display column is `name`.
 * INSERT fills ck_id + name + any required locally-owned defaults (once).
 * UPDATE touches ONLY name — never the local columns.
 */
async function upsertByCk(
  table: string,
  ckId: number,
  name: string,
  insertExtra: Record<string, unknown> = {},
): Promise<{ id: string; created: boolean }> {
  const existing = await query<{ id: string }>(
    'SELECT id FROM `' + table + '` WHERE ck_id = ? LIMIT 1',
    [ckId],
  );
  if (existing.length) {
    await query('UPDATE `' + table + '` SET name = ? WHERE ck_id = ?', [name, ckId]);
    return { id: existing[0].id, created: false };
  }
  const id = ulid();
  const cols = ['id', 'ck_id', 'name', ...Object.keys(insertExtra)];
  const vals = [id, ckId, name, ...Object.values(insertExtra)];
  const placeholders = cols.map(() => '?').join(', ');
  await query(
    'INSERT INTO `' + table + '` (' + cols.map((c) => '`' + c + '`').join(', ') + ') VALUES (' + placeholders + ')',
    vals,
  );
  return { id, created: true };
}

// Update a single CK-derived FK link, only when we resolved a value (never nulls).
async function setLink(table: string, ckId: number, fkColumn: string, fkValue: string | null): Promise<void> {
  if (!fkValue) return;
  await query('UPDATE `' + table + '` SET `' + fkColumn + '` = ? WHERE ck_id = ?', [fkValue, ckId]);
}

async function ensureCategory(code: string, name: string): Promise<string> {
  const existing = await query<{ id: string }>('SELECT id FROM lookup_categories WHERE code = ? LIMIT 1', [code]);
  if (existing.length) return existing[0].id;
  const id = ulid();
  await query(
    'INSERT INTO lookup_categories (id, code, name, description, is_system) VALUES (?, ?, ?, ?, 1)',
    [id, code, name, 'Synced from Concept Kitchen'],
  );
  return id;
}

// Upsert one lookup value (the `lookups` table uses `label`, not `name`).
async function upsertLookup(
  categoryId: string,
  row: CkRow,
  stat: DomainStat,
): Promise<void> {
  const label = trim(row.name);
  const existing = await query<{ id: string }>('SELECT id FROM lookups WHERE ck_id = ? LIMIT 1', [row.id]);
  if (existing.length) {
    await query('UPDATE lookups SET label = ? WHERE ck_id = ?', [label, row.id]);
    stat.updated++;
    return;
  }
  // code must be unique per category; slug the label, fall back / disambiguate with ck_id.
  let code = slug(label) || `ck_${row.id}`;
  const clash = await query<{ id: string }>(
    'SELECT id FROM lookups WHERE category_id = ? AND code = ? LIMIT 1',
    [categoryId, code],
  );
  if (clash.length) code = `${code}_${row.id}`;
  await query(
    'INSERT INTO lookups (id, ck_id, category_id, code, label, is_active) VALUES (?, ?, ?, ?, ?, 1)',
    [ulid(), row.id, categoryId, code.slice(0, 60), label],
  );
  stat.inserted++;
}

const SPECIFICATIONS: Array<{ path: string; categoryCode: string; categoryName: string }> = [
  { path: '/Specification/Language',        categoryCode: 'language',         categoryName: 'Language' },
  { path: '/Specification/DocType',         categoryCode: 'doc_type',         categoryName: 'Document Type' },
  { path: '/Specification/SocialMedia',     categoryCode: 'social_media',     categoryName: 'Social Media' },
  { path: '/Specification/MaritalStatus',   categoryCode: 'marital_status',   categoryName: 'Marital Status' },
  { path: '/Specification/CastCategory',    categoryCode: 'cast_category',    categoryName: 'Caste Category' },
  { path: '/Specification/VaccinationType', categoryCode: 'vaccination_type', categoryName: 'Vaccination Type' },
  { path: '/Specification/Nationality',     categoryCode: 'nationality',      categoryName: 'Nationality' },
  { path: '/Specification/Religion',        categoryCode: 'religion',         categoryName: 'Religion' },
];

export async function ckSyncAll(): Promise<CkSyncSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date().toISOString();
  const stats: Record<string, DomainStat> = {};
  const errors: string[] = [];
  const stat = (key: string): DomainStat => (stats[key] ??= { inserted: 0, updated: 0 });
  const bump = (key: string, created: boolean) => {
    const s = stat(key);
    if (created) s.inserted++; else s.updated++;
  };

  // 1. Companies → hiring_companies (lc_no is required & unique; seed a placeholder)
  const companyMap = new Map<number, string>();
  try {
    for (const c of await ckList('/Company')) {
      const { id, created } = await upsertByCk('hiring_companies', c.id, trim(c.name), { lc_no: `CKC${c.id}` });
      companyMap.set(c.id, id);
      bump('companies', created);
    }
  } catch (e) { errors.push(`companies: ${msg(e)}`); }

  // 2. Branches (flat list) → branches (code/city/kind required; seed placeholders)
  const branchMap = new Map<number, string>();
  const branchInsert = (ckId: number) => ({ code: `CKB${ckId}`, city: '', kind: '' });
  try {
    for (const b of await ckList('/Branch')) {
      const { id, created } = await upsertByCk('branches', b.id, trim(b.name), branchInsert(b.id));
      branchMap.set(b.id, id);
      bump('branches', created);
    }
  } catch (e) { errors.push(`branches: ${msg(e)}`); }

  // 2b. Branch → Company links (/Branch/ByCompany/{companyId})
  try {
    for (const [companyCk, companyId] of companyMap) {
      for (const b of await ckList(`/Branch/ByCompany/${companyCk}`)) {
        if (!branchMap.has(b.id)) {
          const { id, created } = await upsertByCk('branches', b.id, trim(b.name), branchInsert(b.id));
          branchMap.set(b.id, id);
          bump('branches', created);
        }
        await setLink('branches', b.id, 'company_id', companyId);
      }
    }
  } catch (e) { errors.push(`branch-company: ${msg(e)}`); }

  // 3. Locations — no flat list; crawl /Location/ByBranch/{branchId}
  try {
    for (const [branchCk, branchId] of branchMap) {
      for (const l of await ckList(`/Location/ByBranch/${branchCk}`)) {
        const { created } = await upsertByCk('locations', l.id, trim(l.name), { branch_id: branchId });
        await setLink('locations', l.id, 'branch_id', branchId);
        bump('locations', created);
      }
    }
  } catch (e) { errors.push(`locations: ${msg(e)}`); }

  // 4. Departments → departments
  try {
    for (const d of await ckList('/Department')) {
      const { created } = await upsertByCk('departments', d.id, trim(d.name));
      bump('departments', created);
    }
  } catch (e) { errors.push(`departments: ${msg(e)}`); }

  // 5. Divisions → divisions. The flat /Division already contains every division
  // (verified: ids 1..32 incl. the department-scoped ones), and our divisions table
  // has no department_id column, so /Division/ByDepartmentId is intentionally not crawled.
  try {
    for (const d of await ckList('/Division')) {
      const { created } = await upsertByCk('divisions', d.id, trim(d.name));
      bump('divisions', created);
    }
  } catch (e) { errors.push(`divisions: ${msg(e)}`); }

  // 6. Designations → designations. Flat list imports the base set. CK's
  // designation→division link (/Designation/ByDivisionId/{id}) is currently empty and
  // its contract is unconfirmed (pending Vishal), so division_id is left for a later pass.
  try {
    for (const g of await ckList('/Designation')) {
      const { created } = await upsertByCk('designations', g.id, trim(g.name));
      bump('designations', created);
    }
  } catch (e) { errors.push(`designations: ${msg(e)}`); }

  // 7. Specifications → 8 lookup categories
  for (const spec of SPECIFICATIONS) {
    try {
      const categoryId = await ensureCategory(spec.categoryCode, spec.categoryName);
      const s = stat(`lookups:${spec.categoryCode}`);
      for (const row of await ckList(spec.path)) {
        await upsertLookup(categoryId, row, s);
      }
    } catch (e) { errors.push(`spec ${spec.categoryCode}: ${msg(e)}`); }
  }

  // 8. Skills — import the actual skills (SkillMaster) into `skills`. CK's grouping
  // (SkillHead→SkillType→SkillMaster via /SkillType/ByHeadId + /SkillMaster/ByTypeId)
  // returns empty today; skill_head/skill_type columns exist to receive it once CK
  // populates those links (pending Vishal). Names only for now.
  try {
    for (const m of await ckList('/SkillMaster')) {
      const { created } = await upsertByCk('skills', m.id, trim(m.name));
      bump('skills', created);
    }
  } catch (e) { errors.push(`skills: ${msg(e)}`); }

  const finishedAtMs = Date.now();
  return {
    ok: errors.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    stats,
    errors,
  };
}
