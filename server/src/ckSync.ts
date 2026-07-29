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
//
// Performance: the DB is TiDB Serverless (remote, ~250ms per round-trip), so the
// engine avoids per-row round-trips wherever possible: each table's existing mirror
// is preloaded in ONE SELECT, UPDATEs are skipped when the value is already current
// (on a routine re-sync that is nearly all of them), and the writes that remain run
// with bounded concurrency (pool limit is 10). This took a full sync from ~4 min to
// a few seconds.

import { ulid } from 'ulid';
import { query } from './db';
import { ckList, ckDepartments, ckDivisions, ckDesignations, type CkRow } from './ckApi';

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

// Stay under db.ts's connectionLimit (10) so a sync never starves other requests.
const CONCURRENCY = 8;

function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Run fn over items with at most `limit` in flight at once. */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

// In-memory snapshot of one CK-linked row, used to decide insert vs update vs no-op.
type MirrorRow = { id: string; name: string; links: Record<string, string | null> };

/** Load a table's CK-linked rows (id, name, and any FK link columns) in one query. */
async function loadMirror(table: string, linkCols: string[] = []): Promise<Map<number, MirrorRow>> {
  const cols = ['id', 'ck_id', 'name', ...linkCols].map((c) => '`' + c + '`').join(', ');
  const rows = await query<Record<string, unknown>>(
    'SELECT ' + cols + ' FROM `' + table + '` WHERE ck_id IS NOT NULL',
  );
  const map = new Map<number, MirrorRow>();
  for (const r of rows) {
    map.set(Number(r.ck_id), {
      id: String(r.id),
      name: String(r.name ?? ''),
      links: Object.fromEntries(linkCols.map((c) => [c, r[c] == null ? null : String(r[c])])),
    });
  }
  return map;
}

/**
 * Insert-or-update a row keyed by ck_id against a preloaded mirror.
 * INSERT fills ck_id + name + any required locally-owned defaults (once).
 * UPDATE touches ONLY name — never the local columns — and is skipped entirely
 * when the name is already current.
 */
async function upsertByCk(
  table: string,
  mirror: Map<number, MirrorRow>,
  ckId: number,
  name: string,
  insertExtra: Record<string, unknown> = {},
): Promise<{ id: string; created: boolean }> {
  const existing = mirror.get(ckId);
  if (existing) {
    if (existing.name !== name) {
      await query('UPDATE `' + table + '` SET name = ? WHERE ck_id = ?', [name, ckId]);
      existing.name = name;
    }
    return { id: existing.id, created: false };
  }
  const id = ulid();
  // Reserve in the mirror BEFORE awaiting so a concurrent duplicate can't double-insert.
  mirror.set(ckId, { id, name, links: {} });
  const cols = ['id', 'ck_id', 'name', ...Object.keys(insertExtra)];
  const vals = [id, ckId, name, ...Object.values(insertExtra)];
  const placeholders = cols.map(() => '?').join(', ');
  await query(
    'INSERT INTO `' + table + '` (' + cols.map((c) => '`' + c + '`').join(', ') + ') VALUES (' + placeholders + ')',
    vals,
  );
  return { id, created: true };
}

// Update a single CK-derived FK link, only when we resolved a value (never nulls)
// and only when it actually changed.
async function setLink(
  table: string,
  mirror: Map<number, MirrorRow>,
  ckId: number,
  fkColumn: string,
  fkValue: string | null,
): Promise<void> {
  if (!fkValue) return;
  const existing = mirror.get(ckId);
  if (existing && existing.links[fkColumn] === fkValue) return;
  await query('UPDATE `' + table + '` SET `' + fkColumn + '` = ? WHERE ck_id = ?', [fkValue, ckId]);
  if (existing) existing.links[fkColumn] = fkValue;
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

// Preloaded state for the whole `lookups` table (it uses `label`, not `name`).
type LookupMirror = {
  byCk: Map<number, { id: string; label: string }>;
  codes: Set<string>; // `${categoryId}:${code}` across ALL rows, for uniqueness checks
};

async function loadLookupMirror(): Promise<LookupMirror> {
  const rows = await query<{ id: string; ck_id: number | null; category_id: string; code: string; label: string }>(
    'SELECT id, ck_id, category_id, code, label FROM lookups',
  );
  const byCk = new Map<number, { id: string; label: string }>();
  const codes = new Set<string>();
  for (const r of rows) {
    codes.add(`${r.category_id}:${r.code}`);
    if (r.ck_id != null) byCk.set(Number(r.ck_id), { id: r.id, label: r.label ?? '' });
  }
  return { byCk, codes };
}

// Upsert one lookup value against the preloaded mirror; no-op when the label is current.
async function upsertLookup(
  categoryId: string,
  row: CkRow,
  stat: DomainStat,
  mirror: LookupMirror,
): Promise<void> {
  const label = trim(row.name);
  const existing = mirror.byCk.get(row.id);
  if (existing) {
    if (existing.label !== label) {
      await query('UPDATE lookups SET label = ? WHERE ck_id = ?', [label, row.id]);
      existing.label = label;
    }
    stat.updated++;
    return;
  }
  // code must be unique per category; slug the label, fall back / disambiguate with ck_id.
  let code = slug(label) || `ck_${row.id}`;
  if (mirror.codes.has(`${categoryId}:${code}`)) code = `${code}_${row.id}`;
  code = code.slice(0, 60);
  const id = ulid();
  // Reserve synchronously before awaiting so concurrent inserts can't collide.
  mirror.codes.add(`${categoryId}:${code}`);
  mirror.byCk.set(row.id, { id, label });
  await query(
    'INSERT INTO lookups (id, ck_id, category_id, code, label, is_active) VALUES (?, ?, ?, ?, ?, 1)',
    [id, row.id, categoryId, code, label],
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
    const rows = await ckList('/Company');
    const mirror = await loadMirror('hiring_companies');
    await mapLimit(rows, CONCURRENCY, async (c) => {
      const { id, created } = await upsertByCk('hiring_companies', mirror, c.id, trim(c.name), { lc_no: `CKC${c.id}` });
      companyMap.set(c.id, id);
      bump('companies', created);
    });
  } catch (e) { errors.push(`companies: ${msg(e)}`); }

  // 2. Branches (flat list) → branches (code/city/kind required; seed placeholders)
  const branchMap = new Map<number, string>();
  const branchInsert = (ckId: number) => ({ code: `CKB${ckId}`, city: '', kind: '' });
  let branchMirror = new Map<number, MirrorRow>();
  try {
    const rows = await ckList('/Branch');
    branchMirror = await loadMirror('branches', ['company_id']);
    await mapLimit(rows, CONCURRENCY, async (b) => {
      const { id, created } = await upsertByCk('branches', branchMirror, b.id, trim(b.name), branchInsert(b.id));
      branchMap.set(b.id, id);
      bump('branches', created);
    });
  } catch (e) { errors.push(`branches: ${msg(e)}`); }

  // 2b. Branch → Company links (/Branch/ByCompany/{companyId})
  try {
    for (const [companyCk, companyId] of companyMap) {
      const rows = await ckList(`/Branch/ByCompany/${companyCk}`);
      await mapLimit(rows, CONCURRENCY, async (b) => {
        if (!branchMap.has(b.id)) {
          const { id, created } = await upsertByCk('branches', branchMirror, b.id, trim(b.name), branchInsert(b.id));
          branchMap.set(b.id, id);
          bump('branches', created);
        }
        await setLink('branches', branchMirror, b.id, 'company_id', companyId);
      });
    }
  } catch (e) { errors.push(`branch-company: ${msg(e)}`); }

  // 3. Locations — no flat list; crawl /Location/ByBranch/{branchId}
  try {
    const mirror = await loadMirror('locations', ['branch_id']);
    for (const [branchCk, branchId] of branchMap) {
      const rows = await ckList(`/Location/ByBranch/${branchCk}`);
      await mapLimit(rows, CONCURRENCY, async (l) => {
        const { created } = await upsertByCk('locations', mirror, l.id, trim(l.name), { branch_id: branchId });
        await setLink('locations', mirror, l.id, 'branch_id', branchId);
        bump('locations', created);
      });
    }
  } catch (e) { errors.push(`locations: ${msg(e)}`); }

  // 4-6. DDD (department → division → designation).
  //
  // CK's flat DDD endpoints now carry the parent links on every row
  // (division.departmentCode, designation.divisionCode + departmentCode), so the whole
  // hierarchy arrives in three calls — the per-parent crawls (/Division/ByDepartmentId,
  // /Designation/ByDivisionId) return the same rows and are not needed.
  //
  // Order matters: each level's local ids are needed to resolve the next level's FK.
  // CK's `isActive` seeds is_active on INSERT only — it is a locally-editable column, so a
  // re-sync must never overwrite what someone toggled here. (`departments` is a name-only
  // table with no is_active column, so its flag is dropped.)
  const resolve = (map: Map<number, string>, ckId: number | null) =>
    (ckId == null ? null : map.get(ckId) ?? null);

  // 4. Departments → departments
  const departmentMap = new Map<number, string>();
  try {
    const rows = await ckDepartments();
    const mirror = await loadMirror('departments');
    await mapLimit(rows, CONCURRENCY, async (d) => {
      const { id, created } = await upsertByCk('departments', mirror, d.id, trim(d.name));
      departmentMap.set(d.id, id);
      bump('departments', created);
    });
  } catch (e) { errors.push(`departments: ${msg(e)}`); }

  // 5. Divisions → divisions (+ department_id, new in migration 0040)
  const divisionMap = new Map<number, string>();
  try {
    const rows = await ckDivisions();
    const mirror = await loadMirror('divisions', ['department_id']);
    await mapLimit(rows, CONCURRENCY, async (d) => {
      const { id, created } = await upsertByCk('divisions', mirror, d.id, trim(d.name), {
        is_active: d.isActive ? 1 : 0,
      });
      divisionMap.set(d.id, id);
      await setLink('divisions', mirror, d.id, 'department_id', resolve(departmentMap, d.departmentId));
      bump('divisions', created);
    });
  } catch (e) { errors.push(`divisions: ${msg(e)}`); }

  // 6. Designations → designations (+ division_id and department_id)
  try {
    const rows = await ckDesignations();
    const mirror = await loadMirror('designations', ['division_id', 'department_id']);
    await mapLimit(rows, CONCURRENCY, async (g) => {
      const { created } = await upsertByCk('designations', mirror, g.id, trim(g.name), {
        is_active: g.isActive ? 1 : 0,
      });
      await setLink('designations', mirror, g.id, 'division_id', resolve(divisionMap, g.divisionId));
      await setLink('designations', mirror, g.id, 'department_id', resolve(departmentMap, g.departmentId));
      bump('designations', created);
    });
  } catch (e) { errors.push(`designations: ${msg(e)}`); }

  // 7. Specifications → 8 lookup categories (one shared preload of the lookups table)
  try {
    const lookupMirror = await loadLookupMirror();
    for (const spec of SPECIFICATIONS) {
      try {
        const categoryId = await ensureCategory(spec.categoryCode, spec.categoryName);
        const s = stat(`lookups:${spec.categoryCode}`);
        const rows = await ckList(spec.path);
        await mapLimit(rows, CONCURRENCY, async (row) => {
          await upsertLookup(categoryId, row, s, lookupMirror);
        });
      } catch (e) { errors.push(`spec ${spec.categoryCode}: ${msg(e)}`); }
    }
  } catch (e) { errors.push(`specs: ${msg(e)}`); }

  // 8. Skills — import the actual skills (SkillMaster) into `skills`. CK's grouping
  // (SkillHead→SkillType→SkillMaster via /SkillType/ByHeadId + /SkillMaster/ByTypeId)
  // returns empty today; skill_head/skill_type columns exist to receive it once CK
  // populates those links (pending Vishal). Names only for now.
  try {
    const rows = await ckList('/SkillMaster');
    const mirror = await loadMirror('skills');
    await mapLimit(rows, CONCURRENCY, async (m) => {
      const { created } = await upsertByCk('skills', mirror, m.id, trim(m.name));
      bump('skills', created);
    });
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
