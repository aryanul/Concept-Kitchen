// Thin wrapper around Concept Kitchen's central master-data API.
// Base URL + auth key come from env (CK_API_URL / CK_API_KEY); auth is a single
// `AuthKey` header. Every endpoint returns a flat array of { id:number, name:string }.
// Uses Node 20 global fetch — no extra deps (mirrors faceApi.ts).

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
 * GET a CK list endpoint and return its rows.
 *
 * CK's relationship endpoints (e.g. /Location/ByBranch/{id}) sometimes return an
 * empty body when a parent has no children — we treat that, and a 404, as an
 * empty list rather than an error so a childless parent never aborts a sync.
 */
export async function ckList(path: string): Promise<CkRow[]> {
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
  return (json as Array<Record<string, unknown>>)
    .filter((r) => r && r.id != null && typeof r.name === 'string')
    .map((r) => ({ id: Number(r.id), name: String(r.name) }));
}
