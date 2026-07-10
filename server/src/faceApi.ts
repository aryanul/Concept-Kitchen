// Thin wrapper around the external Face Recognition API (FastAPI service).
// Base URL + optional key come from env; when FACE_API_URL is unset the
// caller gets a clear "not configured" signal rather than a network crash.
//
// Node 20 globals (fetch / FormData / Blob) are used — no extra deps.

const BASE = (process.env.FACE_API_URL || '').replace(/\/$/, '');
const KEY = process.env.FACE_API_KEY || '';

export function faceApiConfigured(): boolean {
  return Boolean(BASE);
}

export class FaceApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'FaceApiError';
    this.status = status;
  }
}

export type FaceOut = { id: number; person_id: string; image_path: string };
export type PersonDetail = {
  id: string;
  name: string;
  meta: Record<string, unknown> | null;
  faces: FaceOut[];
};

// Only the API key is attached here; never set Content-Type for multipart —
// fetch derives the boundary from the FormData body automatically.
function authHeaders(): Record<string, string> {
  return KEY ? { 'x-api-key': KEY } : {};
}

async function ensureOk(res: Response, context: string): Promise<void> {
  if (res.ok) return;
  let detail = '';
  try { detail = await res.text(); } catch { /* ignore */ }
  throw new FaceApiError(res.status, `Face API ${context} failed (${res.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`);
}

function fileBlob(buffer: Buffer, mimetype: string): Blob {
  // Uint8Array copy so the Blob owns a plain ArrayBuffer (not Node's pooled one).
  return new Blob([new Uint8Array(buffer)], { type: mimetype || 'application/octet-stream' });
}

export async function getPerson(personId: string): Promise<PersonDetail | null> {
  const res = await fetch(`${BASE}/persons/${encodeURIComponent(personId)}`, { headers: authHeaders() });
  if (res.status === 404) return null;
  await ensureOk(res, 'get person');
  return res.json() as Promise<PersonDetail>;
}

async function createPerson(
  personId: string, name: string, meta: unknown,
  buffer: Buffer, filename: string, mimetype: string,
): Promise<PersonDetail> {
  const form = new FormData();
  form.append('id', personId);
  form.append('name', name);
  if (meta != null) form.append('meta', typeof meta === 'string' ? meta : JSON.stringify(meta));
  form.append('file', fileBlob(buffer, mimetype), filename || 'face.jpg');
  const res = await fetch(`${BASE}/persons`, { method: 'POST', headers: authHeaders(), body: form });
  await ensureOk(res, 'create person');
  return res.json() as Promise<PersonDetail>;
}

async function addFace(
  personId: string, buffer: Buffer, filename: string, mimetype: string,
): Promise<FaceOut> {
  const form = new FormData();
  form.append('file', fileBlob(buffer, mimetype), filename || 'face.jpg');
  const res = await fetch(`${BASE}/persons/${encodeURIComponent(personId)}/faces`, {
    method: 'POST', headers: authHeaders(), body: form,
  });
  await ensureOk(res, 'add face');
  return res.json() as Promise<FaceOut>;
}

export async function deletePerson(personId: string): Promise<void> {
  const res = await fetch(`${BASE}/persons/${encodeURIComponent(personId)}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (res.status === 404) return; // already gone — treat as success
  await ensureOk(res, 'delete person');
}

/**
 * Upsert a face for a person: create the person on first enrollment, otherwise
 * append another face. Returns the person's current detail plus whether it was
 * newly created.
 */
export async function enrollFace(input: {
  personId: string; name: string; meta?: unknown;
  buffer: Buffer; filename: string; mimetype: string;
}): Promise<{ person: PersonDetail; created: boolean }> {
  const { personId, name, meta, buffer, filename, mimetype } = input;
  const existing = await getPerson(personId);
  if (!existing) {
    const person = await createPerson(personId, name, meta, buffer, filename, mimetype);
    return { person, created: true };
  }
  await addFace(personId, buffer, filename, mimetype);
  const refreshed = await getPerson(personId);
  return { person: refreshed ?? existing, created: false };
}
