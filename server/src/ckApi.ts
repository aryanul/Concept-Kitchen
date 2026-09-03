// Thin wrapper around Concept Kitchen's central master-data API.
// Base URL + auth key come from env (CK_API_URL / CK_API_KEY); auth is a single
// `AuthKey` header. Uses Node 20 global fetch — no extra deps (mirrors faceApi.ts).
//
// Three response shapes are in play:
//   * Most endpoints (/Company, /Branch, /Location/ByBranch, /Specification/*)
//     return a flat array of { id:number, name:string } — `ckList`.
//   * The DDD endpoints (/Department, /Division, /Designation) return domain-named
//     fields instead (departmentCode/departmentName/…) and carry the parent links
//     (division→department, designation→division+department) plus isActive —
//     `ckDepartments` / `ckDivisions` / `ckDesignations`.
//   * The Skill endpoints (/SkillHead, /SkillType, /SkillMaster) use their own
//     id/name field naming (headId/headName, typeId/typeName, skillsId/skillsName)
//     plus a parent link (headId on SkillType, typeId on SkillMaster) and a raw
//     imageId — `ckSkillHeads` / `ckSkillTypes` / `ckSkillMasters`.
// The DDD and Skill readers accept the legacy { id, name } shape too, so a CK
// rollback or a partially-migrated endpoint still imports (just without links).

const BASE = (process.env.CK_API_URL || '').replace(/\/$/, '');
const KEY = process.env.CK_API_KEY || '';

export function ckApiConfigured(): boolean {
  return Boolean(BASE);
}

export class CkApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'CkApiError';
    this.status = status;
  }
}

export type CkRow = { id: number; name: string };

function authHeaders(): Record<string, string> {
  return KEY ? { AuthKey: KEY } : {};
}

/**
 * GET a CK list endpoint and return its raw rows, untyped.
 *
 * CK's relationship endpoints (e.g. /Location/ByBranch/{id}) sometimes return an
 * empty body when a parent has no children — we treat that, and a 404, as an
 * empty list rather than an error so a childless parent never aborts a sync.
 */
async function ckFetchArray(path: string): Promise<Array<Record<string, unknown>>> {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 404) return [];
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new CkApiError(res.status, `CK API ${path} failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  const text = await res.text();
  if (!text.trim()) return []; // empty body = no children
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new CkApiError(res.status, `CK API ${path} returned non-JSON`);
  }
  if (!Array.isArray(json)) return [];
  return (json as Array<Record<string, unknown>>).filter((r): r is Record<string, unknown> => Boolean(r));
}

/** GET a CK endpoint that returns the plain { id, name } shape. */
export async function ckList(path: string): Promise<CkRow[]> {
  const rows = await ckFetchArray(path);
  return rows
    .filter((r) => r.id != null && typeof r.name === 'string')
    .map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

// --- DDD (Department / Division / Designation) -----------------------------

export type CkDepartment = { id: number; name: string; isActive: boolean };
export type CkDivision = CkDepartment & { departmentId: number | null };
export type CkDesignation = CkDepartment & { divisionId: number | null; departmentId: number | null };

/** First key present with a non-null value, so old and new field names both work. */
function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (row[k] != null) return row[k];
  return null;
}

/** A CK foreign key: positive int, or null (CK uses both null and 0 for "unset"). */
function ref(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Shared id/name/isActive extraction; returns null for rows missing an id or name. */
function ddd(row: Record<string, unknown>, codeKey: string, nameKey: string): CkDepartment | null {
  const id = ref(pick(row, codeKey, 'id'));
  const rawName = pick(row, nameKey, 'name');
  if (id == null || typeof rawName !== 'string') return null;
  return { id, name: rawName, isActive: row.isActive !== false };
}

export async function ckDepartments(path = '/Department'): Promise<CkDepartment[]> {
  const rows = await ckFetchArray(path);
  return rows
    .map((r) => ddd(r, 'departmentCode', 'departmentName'))
    .filter((r): r is CkDepartment => r !== null);
}

export async function ckDivisions(path = '/Division'): Promise<CkDivision[]> {
  const rows = await ckFetchArray(path);
  return rows.flatMap((r) => {
    const base = ddd(r, 'divisionCode', 'divisionName');
    return base ? [{ ...base, departmentId: ref(r.departmentCode) }] : [];
  });
}

export async function ckDesignations(path = '/Designation'): Promise<CkDesignation[]> {
  const rows = await ckFetchArray(path);
  return rows.flatMap((r) => {
    const base = ddd(r, 'designationCode', 'designationName');
    return base
      ? [{ ...base, divisionId: ref(r.divisionCode), departmentId: ref(r.departmentCode) }]
      : [];
  });
}

// --- Skill hierarchy (SkillHead / SkillType / SkillMaster) -----------------

export type CkSkillHead = { id: number; name: string; isActive: boolean; imageId: number | null };
export type CkSkillType = CkSkillHead & { headId: number | null };
export type CkSkillMaster = CkSkillHead & { typeId: number | null; description: string | null };

/** Shared id/name/isActive/imageId extraction for the Skill* endpoints (id/name field, not xxxCode/xxxName). */
function skillBase(row: Record<string, unknown>, idKey: string, nameKey: string): CkSkillHead | null {
  const id = ref(pick(row, idKey, 'id'));
  const rawName = pick(row, nameKey, 'name');
  if (id == null || typeof rawName !== 'string') return null;
  return {
    id,
    name: rawName,
    isActive: row.isActive !== false,
    imageId: ref(row.imageId),
  };
}

export async function ckSkillHeads(path = '/SkillHead'): Promise<CkSkillHead[]> {
  const rows = await ckFetchArray(path);
  return rows.flatMap((r) => {
    const base = skillBase(r, 'headId', 'headName');
    return base ? [base] : [];
  });
}

export async function ckSkillTypes(path = '/SkillType'): Promise<CkSkillType[]> {
  const rows = await ckFetchArray(path);
  return rows.flatMap((r) => {
    const base = skillBase(r, 'typeId', 'typeName');
    return base ? [{ ...base, headId: ref(r.headId) }] : [];
  });
}

export async function ckSkillMasters(path = '/SkillMaster'): Promise<CkSkillMaster[]> {
  const rows = await ckFetchArray(path);
  return rows.flatMap((r) => {
    const base = skillBase(r, 'skillsId', 'skillsName');
    return base
      ? [{ ...base, typeId: ref(r.typeId), description: typeof r.description === 'string' ? r.description : null }]
      : [];
  });
}

// --- Specifications (lookup value sets) ------------------------------------

/**
 * CK's /Specification/* endpoints do NOT return the { id, name } shape the
 * header comment above claims — they return
 * { specId, typeId, specName, isActive, … }.
 *
 * Reading them with `ckList` matched nothing, so EVERY specification category
 * (language, doc type, social media, marital status, caste, vaccination,
 * nationality, religion) imported zero rows and the corresponding dropdowns in
 * onboarding and the Employee Master came up empty. Verified against the live
 * API: /Specification/CastCategory returns 4 rows in the specId/specName shape.
 *
 * The legacy { id, name } shape is still accepted so a CK rollback keeps working.
 */
export async function ckSpecifications(path: string): Promise<CkRow[]> {
  const rows = await ckFetchArray(path);
  return rows.flatMap((r) => {
    const id = ref(pick(r, 'specId', 'id'));
    const rawName = pick(r, 'specName', 'name');
    if (id == null || typeof rawName !== 'string' || !rawName.trim()) return [];
    // Retired values would otherwise keep showing up in every dropdown.
    if (r.isActive === false) return [];
    return [{ id, name: rawName.trim() }];
  });
}
