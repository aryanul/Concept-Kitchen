import { AsyncLocalStorage } from 'node:async_hooks';
import { ulid } from 'ulid';
import { query } from './db';

type AuditPayload = unknown | null;

/**
 * Per-request marker saying "this handler already wrote its own audit entry".
 *
 * The catch-all audit middleware needs to log every mutation, but roughly forty
 * handlers already call writeAudit themselves with proper before/after payloads.
 * Rather than maintain a list of those routes — which would silently rot as
 * routes are added — each writeAudit call flags the request it happened in, and
 * the middleware only fills the gap when nothing was recorded.
 */
type AuditContext = { wrote: boolean };

export const auditContext = new AsyncLocalStorage<AuditContext>();

/** True if a handler wrote a richer audit entry during this request. */
export function auditAlreadyWritten(): boolean {
  return auditContext.getStore()?.wrote === true;
}

export async function writeAudit(
  actorId: string,
  action: string,
  resource: string,
  resourceId: string,
  beforeData: AuditPayload,
  afterData: AuditPayload,
) {
  // Set synchronously, before the first await, so the flag is visible even if
  // the caller treats this as fire-and-forget.
  const ctx = auditContext.getStore();
  if (ctx) ctx.wrote = true;

  await query(
    'INSERT INTO audit_logs (id, actor_id, action, resource, resource_id, before_data, after_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      ulid(),
      actorId,
      action,
      resource,
      resourceId,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData  ? JSON.stringify(afterData)  : null,
    ],
  );
}
