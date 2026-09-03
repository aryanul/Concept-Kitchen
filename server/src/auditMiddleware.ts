import type { Application, Request, Response, NextFunction } from 'express';
import { ulid } from 'ulid';
import { writeAudit, auditContext, auditAlreadyWritten } from './audit';

/**
 * Catch-all audit trail.
 *
 * The Activity Log only showed a handful of event types because auditing was
 * opt-in: ~40 handlers called writeAudit and the other ~200 mutating routes
 * recorded nothing, so leaves, payroll runs, applicant edits, onboarding steps
 * and most of hiring were invisible. This middleware makes auditing the default
 * — every successful mutation on /api/v1 is logged — while handlers that write
 * a richer entry (with before/after payloads) still win, via the per-request
 * flag in audit.ts.
 *
 * Deliberately fired on 'finish' and never awaited: a failure to audit must not
 * fail or slow the request that succeeded.
 */

/** Path segments that name a sub-resource rather than a top-level one. */
const NESTED_GROUPS = new Set(['hiring', 'onboarding', 'dev', 'ck', 'auth', 'reports']);

/**
 * Trailing path segments that describe *what was done* rather than what it was
 * done to — `/leaves/:id/approve` is an approval, not a generic update.
 */
const ACTION_SEGMENTS = new Set([
  'approve', 'reject', 'activate', 'deactivate', 'archive', 'restore', 'cancel',
  'close', 'reopen', 'publish', 'unpublish', 'submit', 'withdraw', 'decide',
  'run', 'disburse', 'settle', 'exit', 'send', 'resend', 'sync', 'wipe',
  'assign', 'unassign', 'allocate', 'release', 'complete', 'verify', 'convert',
  'push-to-payroll', 'finalize', 'finalise', 'lock', 'unlock', 'import', 'export',
]);

/**
 * Routes that would flood the log without saying anything useful. Logins and
 * logouts are still recorded — by the auth handlers, which know the email.
 */
const SKIP_PREFIXES = ['auth/login', 'auth/logout', 'auth/refresh', 'upload'];

/** ULIDs are 26 chars of Crockford base32; ids also arrive as UUIDs or digits. */
function looksLikeId(segment: string): boolean {
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(segment)) return true;          // ULID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment)) return true;         // UUID
  if (/^\d+$/.test(segment)) return true;                             // numeric id
  return false;
}

type Derived = { resource: string; resourceId: string | null; action: string | null };

/** Split a request path into "what was touched" and "what was done to it". */
export function deriveAuditTarget(path: string, method: string): Derived {
  const parts = path.split('/').filter(Boolean);
  const ids = parts.filter(looksLikeId);
  const names = parts.filter((p) => !looksLikeId(p));

  // A trailing verb segment names the action; anything before it names the thing.
  let action: string | null = null;
  if (names.length > 1 && ACTION_SEGMENTS.has(names[names.length - 1])) {
    action = names.pop()!.replace(/-/g, '_');
  }

  const first = names[0] ?? 'unknown';
  // /hiring/companies and /onboarding/assets are distinct resources; /employees
  // and /employees/:id/documents both belong to "employees".
  const resource = NESTED_GROUPS.has(first) && names[1] ? `${first}/${names[1]}` : first;

  if (!action) {
    action = method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update';
  }

  return { resource, resourceId: ids[0] ?? null, action };
}

export function registerAuditMiddleware(app: Application) {
  app.use('/api/v1', (req: Request, res: Response, next: NextFunction) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();

    // req.path has the '/api/v1' prefix stripped by Express
    const path = req.path;
    const normalized = path.split('/').filter(Boolean).join('/');
    if (SKIP_PREFIXES.some((p) => normalized.startsWith(p))) return next();

    const { resource, resourceId, action } = deriveAuditTarget(path, req.method);

    // A POST has no id in its URL — take the one the handler returns.
    let capturedId: string | undefined;
    const origJson = res.json.bind(res);
    (res as unknown as { json: typeof res.json }).json = function (body: unknown) {
      const data = (body as { data?: unknown })?.data;
      if (data && typeof data === 'object' && typeof (data as { id?: unknown }).id === 'string') {
        capturedId = (data as { id: string }).id;
      }
      return origJson(body);
    };

    // Run the rest of the request inside a context the handlers' own writeAudit
    // calls can flag, so a route with a detailed audit entry isn't logged twice.
    const ctx = { wrote: false };
    auditContext.run(ctx, () => {
      res.on('finish', () => {
        if (res.statusCode >= 400 || !req.user?.id) return;
        if (ctx.wrote) return; // the handler already logged something better
        writeAudit(
          req.user.id,
          action!,
          resource,
          resourceId ?? capturedId ?? ulid(),
          null,
          null
        ).catch(() => { /* auditing must never break the request */ });
      });
      next();
    });
  });
}
