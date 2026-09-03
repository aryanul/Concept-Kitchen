import type { Request, Response, NextFunction } from 'express';
import { query } from './db';
import type { Role } from './auth';

/**
 * The permission catalogue and the middleware that enforces it.
 *
 * Access control here used to be a handful of `requireRole` calls, so most of
 * the ~250 routes were open to anyone with a valid token: an EMPLOYEE could
 * read every salary and edit every master. This replaces that with one
 * permission key per governable thing.
 *
 * The catalogue lives in code rather than in a table because a screen that
 * exists but has no permission behind it would be silently ungoverned, and
 * nothing about a database row keeps it in step with the routes it guards.
 *
 * Enforcement is central, not per-route (`permissionForRequest`). Adding a
 * guard to every existing handler would have guaranteed one was missed, and
 * every route added later would be a fresh chance to miss another. One
 * middleware derives the key from the method and the resource path, so a route
 * is governed by existing rather than by being remembered.
 */

// --------------------------------------------------------------- catalogue

export type ActionKey =
  | 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'manage' | 'run';

export type PermissionModule = {
  /** Stable key, and the first half of every permission it owns. */
  key: string;
  label: string;
  /** Sidebar area — how the admin screen groups them. */
  group: string;
  actions: ActionKey[];
  /** API resource path segments this module governs. */
  resources?: string[];
};

const ACTION_LABELS: Record<ActionKey, string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete',
  approve: 'Approve', export: 'Export', manage: 'Manage', run: 'Run',
};

/** A record that is entered, corrected, approved and removed. */
const WORKFLOW: ActionKey[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];
/** A master record: no approval step, but it can be removed. */
const MASTER: ActionKey[] = ['view', 'create', 'edit', 'delete', 'export'];
/** Read, take away. */
const REPORT: ActionKey[] = ['view', 'export'];

export const MODULES: PermissionModule[] = [
  // ----------------------------------------------------------- General
  // Every signed-in user sees the dashboard. It is a module rather than an
  // ungoverned path so the summary counts still answer to *something* — and so
  // it shows up in the coverage check below instead of silently falling through.
  { key: 'dashboard.home', label: 'Dashboard', group: 'General', actions: ['view'],
    resources: ['dashboard'] },

  // ------------------------------------------------- Phase 1 — Employment
  { key: 'employment.employees', label: 'Employee Master', group: 'Employment', actions: MASTER,
    resources: ['employees'] },
  { key: 'employment.attendance', label: 'Attendance', group: 'Employment', actions: WORKFLOW,
    resources: ['attendance', 'attendance-rules'] },
  { key: 'employment.leaves', label: 'Leaves & Approvals', group: 'Employment', actions: WORKFLOW,
    resources: ['leaves'] },
  { key: 'employment.payroll', label: 'Payroll', group: 'Employment', actions: WORKFLOW,
    resources: ['payroll', 'payroll-periods', 'payslips'] },
  { key: 'employment.compensation', label: 'Salary & Compensation', group: 'Employment', actions: WORKFLOW,
    resources: ['compensations', 'salary-grades', 'salary-master'] },
  { key: 'employment.loans', label: 'Loans & Advances', group: 'Employment', actions: WORKFLOW,
    resources: ['loans'] },
  { key: 'employment.increments', label: 'Increments & Appraisals', group: 'Employment', actions: WORKFLOW,
    resources: ['increments'] },
  { key: 'employment.tours', label: 'Tour & Travel', group: 'Employment', actions: WORKFLOW,
    resources: ['tours'] },
  { key: 'employment.incentives', label: 'Incentives & Perks', group: 'Employment', actions: WORKFLOW,
    resources: ['incentives'] },

  // ----------------------------------------------------- Phase 2 — Hiring
  { key: 'hiring.job-profiles', label: 'Job Profiles', group: 'Hiring', actions: MASTER,
    resources: ['job-profiles'] },
  { key: 'hiring.vacancies', label: 'Vacancies & Listings', group: 'Hiring', actions: WORKFLOW,
    resources: ['job-listings', 'vacancies'] },
  { key: 'hiring.applicants', label: 'Applicants & Interviews', group: 'Hiring', actions: WORKFLOW,
    resources: ['applicants', 'prospects', 'interviews', 'job-listing-applicants'] },
  { key: 'hiring.onboarding', label: 'Onboarding', group: 'Hiring', actions: WORKFLOW,
    resources: ['onboarding'] },
  { key: 'hiring.masters', label: 'Hiring Masters', group: 'Hiring', actions: MASTER,
    resources: ['hiring'] },

  // -------------------------------------------------- Phase 3 — Relieving
  { key: 'relieving.exit', label: 'Exit & Clearance', group: 'Relieving', actions: WORKFLOW,
    resources: ['exit-clearance', 'relieving', 'fnf', 'exits'] },

  // ------------------------------------------------------------- Masters
  { key: 'masters.org', label: 'Company / Branch / Location', group: 'Masters', actions: MASTER,
    resources: ['branches', 'locations', 'companies', 'settings'] },
  { key: 'masters.ddd', label: 'Department / Division / Designation', group: 'Masters', actions: MASTER,
    resources: ['departments', 'divisions', 'designations'] },
  { key: 'masters.shifts', label: 'Duty Shift Master', group: 'Masters', actions: MASTER,
    resources: ['shifts'] },
  { key: 'masters.holidays', label: 'Holiday Master', group: 'Masters', actions: MASTER,
    resources: ['holidays'] },
  { key: 'masters.skills', label: 'Skill Master', group: 'Masters', actions: MASTER,
    resources: ['skills', 'skill-heads', 'skill-types'] },
  { key: 'masters.training', label: 'Training & Templates', group: 'Masters', actions: MASTER,
    resources: ['training-modules', 'induction-templates', 'onboarding-templates',
      'document-templates', 'atm-tasks'] },
  { key: 'masters.lookups', label: 'Lookups & Tags', group: 'Masters', actions: MASTER,
    resources: ['lookups', 'tags', 'lookup-categories'] },

  // ------------------------------------------------------- Administration
  { key: 'admin.users', label: 'Users', group: 'Administration',
    actions: ['view', 'create', 'edit', 'delete'], resources: ['users'] },
  { key: 'admin.permissions', label: 'Roles & Permissions', group: 'Administration',
    actions: ['view', 'manage'], resources: ['permissions', 'roles'] },
  { key: 'admin.activity-log', label: 'Activity Log', group: 'Administration', actions: REPORT,
    resources: ['activity-logs'] },
  { key: 'admin.ck-sync', label: 'Concept Kitchen Sync', group: 'Administration',
    actions: ['view', 'run'], resources: ['ck'] },
  { key: 'admin.uploads', label: 'Files & Photos', group: 'Administration',
    actions: ['view', 'create', 'delete'], resources: ['upload', 'documents'] },
  { key: 'admin.dev', label: 'Developer Tools', group: 'Administration',
    actions: ['view', 'manage'], resources: ['dev'] },
];

export type PermissionDefinition = {
  key: string; module: string; moduleLabel: string; group: string; action: ActionKey; label: string;
};

/** Every permission key that exists, flattened. */
export const PERMISSIONS: PermissionDefinition[] = MODULES.flatMap((m) =>
  m.actions.map((action) => ({
    key: `${m.key}.${action}`,
    module: m.key,
    moduleLabel: m.label,
    group: m.group,
    action,
    label: `${ACTION_LABELS[action]} ${m.label}`,
  }))
);

const PERMISSION_KEYS = new Set(PERMISSIONS.map((p) => p.key));

export function isPermissionKey(key: unknown): key is string {
  return typeof key === 'string' && PERMISSION_KEYS.has(key);
}

// ------------------------------------------------------------- role defaults

/**
 * What each role grants out of the box. These seed `role_permissions` and are
 * the fallback when that table has no rows for a role at all — an empty table
 * must not mean "nobody can do anything", which would lock every non-admin out
 * on the first deploy.
 *
 * HR_ADMIN is absent on purpose: it is granted everything in code (see
 * `effectivePermissions`) and cannot be edited down, so no combination of
 * settings can leave the system unadministrable.
 */
export const ROLE_DEFAULTS: Record<Exclude<Role, 'HR_ADMIN'>, (p: PermissionDefinition) => boolean> = {
  // Runs a team: sees their people and the hiring pipeline, approves leave and
  // tours, and stays out of payroll money and administration.
  MANAGER: (p) =>
    p.group !== 'Administration'
    && p.module !== 'employment.payroll'
    && p.module !== 'employment.compensation'
    && p.module !== 'employment.loans'
    && p.action !== 'delete',

  // Owns the money side end to end; reads the rest of employment for context
  // and does not touch hiring or administration.
  FINANCE: (p) =>
    p.group !== 'Administration' && p.group !== 'Hiring'
      ? (['employment.payroll', 'employment.compensation', 'employment.loans', 'employment.incentives']
        .includes(p.module) || p.action === 'view' || p.action === 'export')
      : false,

  // Self-service only. Everything an employee legitimately does — applying for
  // leave, filing a tour — goes through routes they may create on; nothing here
  // grants sight of anyone else's record, which is enforced per-route.
  EMPLOYEE: (p) =>
    p.module === 'dashboard.home'
    || (['employment.leaves', 'employment.tours', 'employment.attendance'].includes(p.module)
      && ['view', 'create'].includes(p.action))
    || (p.module === 'admin.uploads' && p.action !== 'delete'),
};

export function defaultPermissionsFor(role: Role): string[] {
  if (role === 'HR_ADMIN') return PERMISSIONS.map((p) => p.key);
  const predicate = ROLE_DEFAULTS[role as Exclude<Role, 'HR_ADMIN'>];
  return predicate ? PERMISSIONS.filter(predicate).map((p) => p.key) : [];
}

// -------------------------------------------------------- effective set

/**
 * What one user may actually do: the role's grants, plus their explicit allows,
 * minus their explicit denies. A deny always wins — that is what makes "this
 * one person must not touch Payroll" expressible without inventing a role.
 */
export async function effectivePermissions(userId: string, role: Role): Promise<Set<string>> {
  if (role === 'HR_ADMIN') return new Set(PERMISSIONS.map((p) => p.key));

  const [roleRows, userRows] = await Promise.all([
    query<{ permissionKey: string }>(
      'SELECT permission_key AS permissionKey FROM role_permissions WHERE role = ?', [role]
    ),
    query<{ permissionKey: string; effect: string }>(
      'SELECT permission_key AS permissionKey, effect FROM user_permissions WHERE user_id = ?', [userId]
    ),
  ]);

  // No rows for this role at all means the table was never seeded, not that the
  // role grants nothing — fall back to the code defaults rather than locking out.
  const granted = new Set(
    roleRows.length ? roleRows.map((r) => r.permissionKey) : defaultPermissionsFor(role)
  );
  for (const row of userRows) {
    if (row.effect === 'deny') granted.delete(row.permissionKey);
    else granted.add(row.permissionKey);
  }
  // A stored key that no longer exists in the catalogue (a screen was renamed)
  // must not linger as an unenforceable grant.
  return new Set([...granted].filter((k) => PERMISSION_KEYS.has(k)));
}

// --------------------------------------------------- request -> permission

/** Resource path segment -> the module that governs it. Built from the catalogue. */
const RESOURCE_TO_MODULE = new Map<string, string>();
for (const m of MODULES) for (const r of m.resources ?? []) RESOURCE_TO_MODULE.set(r, m.key);

/**
 * Paths deliberately left ungoverned: they carry no business data, or they are
 * what a signed-in user needs before any permission can be evaluated. Listed
 * explicitly so "no rule matched" can never be the reason something is open.
 */
const UNGOVERNED = new Set(['healthz', 'auth', 'me', '']);

/** Trailing segments that mean something more specific than the HTTP method. */
const SUFFIX_ACTIONS: Record<string, ActionKey> = {
  approve: 'approve', reject: 'approve', decide: 'approve',
  run: 'run', sync: 'run', close: 'edit', archive: 'edit',
  export: 'export', wipe: 'manage',
};

/**
 * Paths whose first segment understates what they return.
 *
 * `/dashboard/activity` is the org-wide audit trail rendered on the home page —
 * the same data the Activity Log screen shows — so it must answer to the same
 * permission, not to "may see the dashboard". Checked before the resource map.
 */
const PATH_OVERRIDES: Array<{ prefix: string; permission: string }> = [
  { prefix: 'dashboard/activity', permission: 'admin.activity-log.view' },
];

/**
 * The permission a request needs, or null if the path is ungoverned.
 *
 * Deriving it from the route rather than declaring it on each handler is what
 * makes coverage automatic: a new endpoint under an existing resource is
 * governed the moment it exists.
 */
export function permissionForRequest(method: string, path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  const resource = parts[0] ?? '';
  if (UNGOVERNED.has(resource)) return null;

  const joined = parts.join('/');
  const override = PATH_OVERRIDES.find((o) => joined === o.prefix || joined.startsWith(`${o.prefix}/`));
  if (override) return override.permission;

  const moduleKey = RESOURCE_TO_MODULE.get(resource);
  if (!moduleKey) return null;

  const suffix = parts[parts.length - 1] ?? '';
  const suffixAction = SUFFIX_ACTIONS[suffix];
  const action: ActionKey = suffixAction
    ?? (method === 'GET' ? 'view'
      : method === 'POST' ? 'create'
        : method === 'DELETE' ? 'delete'
          : 'edit');

  // A module that does not define the derived action falls back rather than
  // demanding a key nobody can ever hold: a write against a report-shaped
  // module has no 'create', so reading is the strongest thing it can require.
  const candidates = action === 'view'
    ? [`${moduleKey}.view`]
    : [`${moduleKey}.${action}`, `${moduleKey}.run`, `${moduleKey}.manage`, `${moduleKey}.edit`, `${moduleKey}.view`];
  return candidates.find((k) => PERMISSION_KEYS.has(k)) ?? `${moduleKey}.view`;
}

/**
 * Guards a request against the caller's effective permissions.
 *
 * Registered once, before the route modules. `req.user` is set by
 * `authRequired` on each route, which has not run yet at this point, so the
 * token is read here too — a request with no token falls through and the
 * route's own `authRequired` answers 401. That keeps the two answers ("not
 * signed in" vs "not allowed") distinct.
 */
export function permissionGuard(
  resolveUser: (req: Request) => { id: string; role: Role } | null
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = permissionForRequest(req.method, req.path);
    if (!key) return next();

    const user = resolveUser(req);
    if (!user) return next(); // no token — let authRequired answer 401

    try {
      const allowed = await effectivePermissions(user.id, user.role);
      if (allowed.has(key)) return next();
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `You do not have permission to ${key.split('.').pop()} ${describeModule(key)}.`,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

function describeModule(permissionKey: string): string {
  const moduleKey = permissionKey.split('.').slice(0, -1).join('.');
  return MODULES.find((m) => m.key === moduleKey)?.label ?? moduleKey;
}

/**
 * Report any API resource that no module claims.
 *
 * `permissionForRequest` returns null for an unmapped resource, and null means
 * *open to every signed-in user* — which is how `/dashboard`, `/exits`,
 * `/lookup-categories`, `/settings` and `/job-listing-applicants` ended up
 * ungoverned after the first pass: they simply were not on the list, and
 * nothing said so. Silence is the wrong default for an access-control gap, so
 * this shouts at boot instead of waiting for someone to notice.
 *
 * `routes` is the set of first path segments the app actually registers.
 */
export function auditCoverage(routes: Iterable<string>): string[] {
  const gaps = [...new Set(routes)]
    .filter((r) => r && !UNGOVERNED.has(r) && !RESOURCE_TO_MODULE.has(r))
    .sort();
  if (gaps.length) {
    console.warn(
      `[permissions] ${gaps.length} API resource(s) are governed by NOTHING and are open to `
      + `every signed-in user: ${gaps.join(', ')}. Add each to a module's \`resources\` in `
      + 'permissions.ts, or to UNGOVERNED if that is deliberate.'
    );
  }
  return gaps;
}

/**
 * Seed `role_permissions` from the code defaults for any role that has no rows.
 * Runs at boot so a fresh database is governed immediately, and never touches a
 * role an admin has already customised.
 */
export async function seedRolePermissions(): Promise<void> {
  const roles: Role[] = ['MANAGER', 'FINANCE', 'EMPLOYEE'];
  for (const role of roles) {
    const rows = await query<{ permissionKey: string }>(
      'SELECT permission_key AS permissionKey FROM role_permissions WHERE role = ?', [role]
    );
    const defaults = defaultPermissionsFor(role);

    // First boot for this role — lay down the full defaults.
    if (rows.length === 0) {
      for (const key of defaults) {
        await query(
          'INSERT IGNORE INTO role_permissions (role, permission_key) VALUES (?, ?)',
          [role, key]
        );
      }
      continue;
    }

    // Already customised. Only grant defaults belonging to a module the role has
    // *no* rows for at all — i.e. a module added since this database was seeded.
    // Anything within a module an admin has already touched is left exactly as
    // they left it, so a deliberate untick is never quietly restored.
    const held = new Set(rows.map((r) => r.permissionKey));
    const modulesTouched = new Set([...held].map((k) => k.split('.').slice(0, -1).join('.')));
    for (const key of defaults) {
      if (held.has(key)) continue;
      const moduleKey = key.split('.').slice(0, -1).join('.');
      if (modulesTouched.has(moduleKey)) continue; // admin owns this module now
      await query(
        'INSERT IGNORE INTO role_permissions (role, permission_key) VALUES (?, ?)',
        [role, key]
      );
      console.log(`[permissions] granted new module permission ${key} to ${role}`);
    }
  }
}
