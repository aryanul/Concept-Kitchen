import bcrypt from 'bcryptjs';
import type { Application } from 'express';
import { ulid } from 'ulid';
import { authRequired, type Role } from './auth';
import { query } from './db';
import { ckList } from './ckApi';
import {
  PERMISSIONS, MODULES, ROLE_DEFAULTS, defaultPermissionsFor,
  effectivePermissions, isPermissionKey,
} from './permissions';

/**
 * User administration: the Users console, the Roles & Permissions screen, and
 * the provisioning that turns Concept Kitchen's staff list into sign-ins.
 *
 * Replaces the four-route CRUD that lived in masters.ts, which had no concept
 * of a person's name, no way to switch an account off, and no link to CK.
 */

const ROLES: Role[] = ['HR_ADMIN', 'MANAGER', 'FINANCE', 'EMPLOYEE'];

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as string[]).includes(value);
}

// ---------------------------------------------------------- CK provisioning

/**
 * The address a CK person signs in with.
 *
 * CK publishes an id and a name and nothing else — no email, no password — so
 * an address has to be derived rather than fetched. It is a *login identifier*,
 * not a claim about their mailbox: if someone's real company address differs,
 * this is still what they sign in with.
 */
const STAFF_EMAIL_DOMAIN = process.env.CK_STAFF_EMAIL_DOMAIN || 'conceptkitchen.net';

function staffEmail(name: string): string {
  const slug = name.trim().toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/).filter(Boolean)
    .join('.');
  return `${slug || 'user'}@${STAFF_EMAIL_DOMAIN}`;
}

/**
 * The first derived address nobody holds.
 *
 * Two people really can share a name, and a derived address can collide with an
 * account that exists for another reason. Suffixing beats skipping the person,
 * and both beat throwing — a sync must not stop because of one namesake.
 */
export async function freeStaffEmail(name: string): Promise<string> {
  const base = staffEmail(name);
  const [local, domain] = base.split('@');
  for (let n = 1; n <= 20; n++) {
    const candidate = n === 1 ? base : `${local}.${n}@${domain}`;
    const taken = await query('SELECT 1 FROM users WHERE email = ? LIMIT 1', [candidate]);
    if (!taken.length) return candidate;
  }
  return `${local}.${ulid().slice(-6).toLowerCase()}@${domain}`;
}

/**
 * Gives a CK person a sign-in, created **Inactive**.
 *
 * The staff list is CK's, so nobody should have to re-key it — but a joiner
 * appearing in an HR feed must not silently become a working login either.
 * Inactive resolves both: the account exists, is linked by `ck_user_id` and
 * appears on the Users screen the day they join, and an admin decides whether
 * it is ever switched on.
 *
 * Deliberately conservative:
 *   * EMPLOYEE — the least this system grants. Promote individuals afterwards.
 *   * a random password nobody is ever shown. It cannot be used while the
 *     account is Inactive, and `must_change_password` means whatever an admin
 *     sets on activation is replaced at first sign-in anyway.
 *   * only ever creates. It never touches status, role or email on an account
 *     that already exists, so activating and promoting someone survives every
 *     later sync. The corollary: *deactivate* rather than delete to keep
 *     someone out — deleting takes the `ck_user_id` link with it, so the next
 *     sync sees no account and makes a fresh Inactive one.
 */
export async function provisionStaffSignIn(ckId: string, name: string): Promise<boolean> {
  const linked = await query('SELECT 1 FROM users WHERE ck_user_id = ? LIMIT 1', [ckId]);
  if (linked.length) return false;

  await query(
    `INSERT INTO users (id, name, email, password_hash, role, status, ck_user_id, must_change_password)
     VALUES (?, ?, ?, ?, 'EMPLOYEE', 'Inactive', ?, 1)`,
    [ulid(), name.trim(), await freeStaffEmail(name), await bcrypt.hash(ulid() + ulid(), 10), ckId]
  );
  return true;
}

/**
 * Mirror CK's staff list into `ck_users` and give each person an Inactive
 * sign-in. Called from the CK master sync; safe to run repeatedly.
 */
export async function syncCkUsers(): Promise<{ mirrored: number; provisioned: number }> {
  const rows = await ckList('/User');
  let mirrored = 0;
  let provisioned = 0;

  for (const u of rows) {
    const ckId = String(u.id);
    const name = u.name.trim();
    if (!name) continue;

    // Matched on ck_id, never on name — CK has duplicate names.
    const existing = await query<{ id: string; name: string }>(
      'SELECT id, name FROM ck_users WHERE ck_id = ? LIMIT 1', [ckId]
    );
    if (existing.length) {
      if (existing[0].name !== name) {
        await query('UPDATE ck_users SET name = ? WHERE id = ?', [name, existing[0].id]);
      }
    } else {
      await query('INSERT INTO ck_users (id, ck_id, name) VALUES (?, ?, ?)', [ulid(), ckId, name]);
      mirrored++;
    }

    try {
      if (await provisionStaffSignIn(ckId, name)) provisioned++;
    } catch (err) {
      // One unprovisionable person must not abort the sync — the mirror is what
      // other screens depend on.
      console.error(`[ck-sync] could not create a sign-in for ${name}:`, err);
    }
  }

  if (provisioned) {
    console.log(`[ck-sync] ${provisioned} new staff sign-in(s) created, Inactive — activate them on the Users screen`);
  }
  return { mirrored, provisioned };
}

// ----------------------------------------------------------------- routes

const USER_COLUMNS = `u.id, u.name, u.email, u.role, u.status, u.phone, u.designation,
                      u.ck_user_id AS ckUserId, u.must_change_password AS mustChangePassword,
                      u.employee_id AS employeeId, u.last_login_at AS lastLoginAt,
                      u.created_at AS createdAt,
                      e.code AS employeeCode, e.first_name AS employeeFirstName,
                      e.last_name AS employeeLastName`;

export function registerUserRoutes(app: Application) {
  /** The catalogue, plus what each role currently grants. Drives the admin screen. */
  app.get('/api/v1/permissions', authRequired, async (_req, res, next) => {
    try {
      const rows = await query<{ role: string; permissionKey: string }>(
        'SELECT role, permission_key AS permissionKey FROM role_permissions'
      );
      const byRole: Record<string, string[]> = {};
      for (const r of rows) (byRole[r.role] ??= []).push(r.permissionKey);
      // A role with no stored rows falls back to the code defaults, matching
      // what effectivePermissions() actually enforces.
      for (const role of ROLES) {
        if (!byRole[role]) byRole[role] = defaultPermissionsFor(role);
      }
      res.json({
        data: {
          modules: MODULES,
          permissions: PERMISSIONS,
          roles: ROLES,
          rolePermissions: byRole,
          // HR_ADMIN holds everything in code and cannot be edited down, so the
          // UI must render it read-only rather than pretend it is adjustable.
          immutableRoles: ['HR_ADMIN'],
        },
      });
    } catch (err) { next(err); }
  });

  /** Replace one role's grants wholesale. */
  app.put('/api/v1/roles/:role/permissions', authRequired, async (req, res, next) => {
    try {
      const role = req.params.role;
      if (!isRole(role)) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'Unknown role' } });
      }
      if (role === 'HR_ADMIN') {
        return res.status(400).json({
          error: {
            code: 'VALIDATION',
            message: 'HR Admin always holds every permission — editing it would leave the system unadministrable.',
          },
        });
      }
      const keys: unknown = req.body?.permissions;
      if (!Array.isArray(keys)) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'permissions must be an array' } });
      }
      const valid = keys.filter(isPermissionKey);
      await query('DELETE FROM role_permissions WHERE role = ?', [role]);
      for (const key of valid) {
        await query('INSERT IGNORE INTO role_permissions (role, permission_key) VALUES (?, ?)', [role, key]);
      }
      res.json({ data: { role, permissions: valid } });
    } catch (err) { next(err); }
  });

  /** What the *signed-in* user may do — the frontend hides what it cannot use. */
  app.get('/api/v1/me/permissions', authRequired, async (req, res, next) => {
    try {
      const allowed = await effectivePermissions(req.user!.id, req.user!.role);
      res.json({ data: { permissions: [...allowed] } });
    } catch (err) { next(err); }
  });

  app.get('/api/v1/users', authRequired, async (_req, res, next) => {
    try {
      const rows = await query(
        `SELECT ${USER_COLUMNS}
           FROM users u
           LEFT JOIN employees e ON e.id = u.employee_id
          ORDER BY u.status ASC, u.name ASC, u.email ASC`
      );
      res.json({ data: rows });
    } catch (err) { next(err); }
  });

  app.get('/api/v1/users/:id', authRequired, async (req, res, next) => {
    try {
      const rows = await query(
        `SELECT ${USER_COLUMNS}
           FROM users u
           LEFT JOIN employees e ON e.id = u.employee_id
          WHERE u.id = ? LIMIT 1`,
        [req.params.id]
      );
      const user = rows[0] as Record<string, unknown> | undefined;
      if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      const overrides = await query<{ permissionKey: string; effect: string }>(
        'SELECT permission_key AS permissionKey, effect FROM user_permissions WHERE user_id = ?',
        [req.params.id]
      );
      const effective = await effectivePermissions(req.params.id, user.role as Role);
      res.json({ data: { ...user, overrides, effective: [...effective] } });
    } catch (err) { next(err); }
  });

  app.post('/api/v1/users', authRequired, async (req, res, next) => {
    try {
      const { name, email, password, role, status, phone, designation, employeeId } = req.body ?? {};
      if (!email || !password || !isRole(role)) {
        return res.status(400).json({
          error: { code: 'VALIDATION', message: 'email, password and a valid role are required' },
        });
      }
      const taken = await query('SELECT 1 FROM users WHERE email = ? LIMIT 1', [email]);
      if (taken.length) {
        return res.status(409).json({ error: { code: 'IN_USE', message: 'That email already has an account.' } });
      }
      const id = ulid();
      await query(
        `INSERT INTO users (id, name, email, password_hash, role, status, phone, designation, employee_id, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          typeof name === 'string' && name.trim() ? name.trim() : String(email).split('@')[0],
          email,
          await bcrypt.hash(String(password), 10),
          role,
          status === 'Inactive' ? 'Inactive' : 'Active',
          phone || null,
          designation || null,
          employeeId || null,
        ]
      );
      res.status(201).json({ data: { id } });
    } catch (err) { next(err); }
  });

  app.patch('/api/v1/users/:id', authRequired, async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const sets: string[] = [];
      const values: unknown[] = [];

      const assign = (column: string, value: unknown) => { sets.push(`${column} = ?`); values.push(value); };

      if (typeof body.name === 'string') assign('name', body.name.trim() || null);
      if (typeof body.email === 'string' && body.email.trim()) {
        const clash = await query('SELECT 1 FROM users WHERE email = ? AND id <> ? LIMIT 1', [body.email, req.params.id]);
        if (clash.length) {
          return res.status(409).json({ error: { code: 'IN_USE', message: 'That email already has an account.' } });
        }
        assign('email', body.email.trim());
      }
      if (isRole(body.role)) {
        // Demoting the last active HR Admin would leave nobody able to
        // administer the system — including the person making the change.
        if (body.role !== 'HR_ADMIN' && await isLastActiveAdmin(req.params.id)) {
          return res.status(400).json({
            error: { code: 'VALIDATION', message: 'This is the last active HR Admin — promote someone else first.' },
          });
        }
        assign('role', body.role);
      }
      if (body.status === 'Active' || body.status === 'Inactive') {
        if (body.status === 'Inactive' && await isLastActiveAdmin(req.params.id)) {
          return res.status(400).json({
            error: { code: 'VALIDATION', message: 'This is the last active HR Admin — activate another one first.' },
          });
        }
        assign('status', body.status);
      }
      if (body.phone !== undefined) assign('phone', body.phone || null);
      if (body.designation !== undefined) assign('designation', body.designation || null);
      if (body.employeeId !== undefined) assign('employee_id', body.employeeId || null);

      if (sets.length) {
        values.push(req.params.id);
        await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
      }

      // Per-person overrides arrive as a full replacement set.
      if (Array.isArray(body.overrides)) {
        await query('DELETE FROM user_permissions WHERE user_id = ?', [req.params.id]);
        for (const raw of body.overrides as Array<{ permissionKey?: unknown; effect?: unknown }>) {
          if (!isPermissionKey(raw?.permissionKey)) continue;
          const effect = raw.effect === 'deny' ? 'deny' : 'allow';
          await query(
            'INSERT IGNORE INTO user_permissions (user_id, permission_key, effect) VALUES (?, ?, ?)',
            [req.params.id, raw.permissionKey, effect]
          );
        }
      }

      if (!sets.length && !Array.isArray(body.overrides)) {
        return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
      }
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  /** Admin password reset. The user is forced to replace it at next sign-in. */
  app.post('/api/v1/users/:id/password', authRequired, async (req, res, next) => {
    try {
      const password = req.body?.password;
      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({
          error: { code: 'VALIDATION', message: 'Password must be at least 6 characters.' },
        });
      }
      await query(
        'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
        [await bcrypt.hash(password, 10), req.params.id]
      );
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  app.delete('/api/v1/users/:id', authRequired, async (req, res, next) => {
    try {
      if (req.params.id === req.user!.id) {
        return res.status(400).json({
          error: { code: 'VALIDATION', message: 'You cannot delete the account you are signed in with.' },
        });
      }
      if (await isLastActiveAdmin(req.params.id)) {
        return res.status(400).json({
          error: { code: 'VALIDATION', message: 'This is the last active HR Admin — promote someone else first.' },
        });
      }
      await query('DELETE FROM users WHERE id = ?', [req.params.id]);
      res.json({ data: { id: req.params.id } });
    } catch (err) { next(err); }
  });

  /** CK staff who have no sign-in yet — the Users screen offers them for import. */
  app.get('/api/v1/users/importable/ck', authRequired, async (_req, res, next) => {
    try {
      const rows = await query(
        `SELECT c.ck_id AS ckId, c.name
           FROM ck_users c
           LEFT JOIN users u ON u.ck_user_id = c.ck_id
          WHERE u.id IS NULL
          ORDER BY c.name`
      );
      res.json({ data: rows });
    } catch (err) { next(err); }
  });
}

/**
 * True if switching this account off (or down) would leave no active HR Admin.
 * Checked before every demote, deactivate and delete.
 */
async function isLastActiveAdmin(userId: string): Promise<boolean> {
  const [row] = await query<{ role: Role; status: string }>(
    'SELECT role, status FROM users WHERE id = ? LIMIT 1', [userId]
  );
  if (!row || row.role !== 'HR_ADMIN' || row.status !== 'Active') return false;
  const [others] = await query<{ c: number }>(
    "SELECT COUNT(*) AS c FROM users WHERE role = 'HR_ADMIN' AND status = 'Active' AND id <> ?",
    [userId]
  );
  return Number(others?.c ?? 0) === 0;
}
