import './env';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { ulid } from 'ulid';
import { query } from './db';
import { signAccessToken, authRequired, requireRole, type Role } from './auth';
import { registerMasterRoutes } from './masters';
import { registerRelievingRoutes } from './relieving';
import { registerDocumentRoutes } from './documents';
import { uploadToCloudinary } from './upload';
import { writeAudit } from './audit';
import { enrollFace, deletePerson, faceApiConfigured, FaceApiError } from './faceApi';
import { ckApiConfigured } from './ckApi';
import { ckSyncAll } from './ckSync';
import { initCkSchedule, maybeSyncOnLogin, isSyncing, tryBeginSync, endSync } from './ckSchedule';

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const app = express();

const port = Number(process.env.PORT) || 4000;
const webOrigins = (process.env.WEB_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || webOrigins.includes(origin.replace(/\/$/, ''))) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '8mb' })); // headroom for base64 photo data URLs in request bodies

// Master routes registered AFTER global middleware so req.body / CORS headers are available
registerMasterRoutes(app);
registerRelievingRoutes(app);
registerDocumentRoutes(app);


app.get('/api/v1/healthz', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// --- Concept Kitchen master-data sync ---
// Mirrors CK's central masters into our tables (see ckSync.ts). Sync mutates
// masters, so it is HR_ADMIN-only; status is readable by any authed user so the
// Settings page can show coverage counts.

app.get('/api/v1/ck/status', authRequired, async (_req, res, next) => {
  try {
    const tables = [
      'hiring_companies', 'branches', 'locations', 'departments',
      'divisions', 'designations', 'skill_heads', 'skill_types', 'skills', 'lookups',
    ];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const rows = await query<{ n: number | string }>(
        'SELECT COUNT(*) AS n FROM `' + t + '` WHERE ck_id IS NOT NULL'
      );
      counts[t] = Number(rows[0]?.n ?? 0);
    }
    res.json({ data: { configured: ckApiConfigured(), counts } });
  } catch (err) {
    next(err);
  }
});

// Lightweight, in-memory sync-state probe (no DB) — polled by the UI to show a
// non-blocking "syncing master data" loader for manual AND auto (login/midnight) syncs.
app.get('/api/v1/ck/sync-state', authRequired, (_req, res) => {
  res.json({ data: { syncing: isSyncing() } });
});

app.post('/api/v1/ck/sync', authRequired, requireRole('HR_ADMIN'), async (req, res, next) => {
  try {
    if (!ckApiConfigured()) {
      return res.status(503).json({
        error: { code: 'NOT_CONFIGURED', message: 'CK_API_URL is not set on the server' },
      });
    }
    // Share the one lock with the auto-syncs so a manual run can't overlap a login/
    // midnight run (and vice versa); the UI surfaces this as "already running".
    if (!tryBeginSync()) {
      return res.status(409).json({
        error: { code: 'SYNC_IN_PROGRESS', message: 'A master data sync is already running. Please wait for it to finish.' },
      });
    }
    try {
      const summary = await ckSyncAll();
      writeAudit(req.user!.id, 'run', 'ck-sync', ulid(), null, { ...summary, trigger: 'manual' }).catch(() => {});
      res.json({ data: summary });
    } finally {
      endSync();
    }
  } catch (err) {
    next(err);
  }
});

// --- Auth ---

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  employee_id: string | null;
};

app.post('/api/v1/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: { code: 'VALIDATION', message: 'email and password are required' },
      });
    }
    const rows = await query<UserRow>(
      'SELECT id, email, password_hash, role, employee_id FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    const user = rows[0];
    // Generic 401 message — don't leak whether the email exists.
    const reject = () =>
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
    if (!user) return reject();
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return reject();

    const token = signAccessToken({
      id: user.id,
      role: user.role,
      employeeId: user.employee_id,
    });

    // Fire-and-forget — don't let audit failure block the login response
    writeAudit(user.id, 'login', 'auth', user.id, null, { email: user.email }).catch(() => {});

    // Fire-and-forget — refresh CK masters at most once per IST half-day window.
    // Never blocks or slows the login response (see ckSchedule.ts).
    maybeSyncOnLogin(user.id);

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          employeeId: user.employee_id,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/v1/auth/logout', authRequired, async (req, res, next) => {
  try {
    await writeAudit(req.user!.id, 'logout', 'auth', req.user!.id, null, null);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/auth/me', authRequired, async (req, res, next) => {
  try {
    const rows = await query<Omit<UserRow, 'password_hash'>>(
      'SELECT id, email, role, employee_id FROM users WHERE id = ? LIMIT 1',
      [req.user!.id]
    );
    const user = rows[0];
    if (!user) {
      return res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'User no longer exists' } });
    }
    res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          employeeId: user.employee_id,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- Reference data (for filter dropdowns) ---

app.get('/api/v1/branches', authRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT b.id, b.ck_id, b.code, b.name, b.city, b.kind, b.company_id,
              c.name AS company_name, c.lc_no AS company_lc_no
       FROM branches b
       LEFT JOIN hiring_companies c ON c.id = b.company_id
       ORDER BY b.code`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/departments', authRequired, async (_req, res, next) => {
  try {
    const rows = await query('SELECT id, ck_id, name FROM departments ORDER BY name');
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/salary-grades', authRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT g.id, g.code, g.kind, g.min_gross, g.max_gross,
              COUNT(e.id) AS employee_count
       FROM salary_grades g
       LEFT JOIN employees e ON e.grade_id = g.id
       GROUP BY g.id
       ORDER BY g.code`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/shifts', authRequired, async (_req, res, next) => {
  try {
    const rows = await query<{
      id: string; code: string; name: string; description: string | null;
      company: string | null; branch_id: string | null; branch_name: string | null;
      location: string | null; status: string;
      start_time: string; end_time: string; total_hours: string | number;
      kind: string; break_min: number;
      grace_arrival_min: number; grace_exit_min: number;
      ot_after_min: number; ot_multiplier: string | number;
    }>(
      `SELECT s.id, s.code, s.name, s.description,
              s.company, s.branch_id, b.name AS branch_name,
              s.location, s.status,
              s.start_time, s.end_time, s.total_hours,
              s.kind, s.break_min,
              s.grace_arrival_min, s.grace_exit_min,
              s.ot_after_min, s.ot_multiplier
         FROM shifts s
         LEFT JOIN branches b ON b.id = s.branch_id
        ORDER BY s.code`
    );
    const ids = rows.map((r) => r.id);
    let breaks: Array<{ id: string; shift_id: string; name: string; start_offset_min: number; duration_min: number; is_paid: number; is_mandatory: number; sort_order: number }> = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      breaks = await query(
        `SELECT id, shift_id, name, start_offset_min, duration_min, is_paid, is_mandatory, sort_order
           FROM shift_breaks
          WHERE shift_id IN (${placeholders})
          ORDER BY sort_order, start_offset_min`,
        ids
      );
    }
    const breaksByShift = new Map<string, typeof breaks>();
    for (const br of breaks) {
      const list = breaksByShift.get(br.shift_id) ?? [];
      list.push(br);
      breaksByShift.set(br.shift_id, list);
    }
    const data = rows.map((r) => ({ ...r, breaks: breaksByShift.get(r.id) ?? [] }));
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/holidays', authRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT h.id, h.date, h.name, h.kind,
              GROUP_CONCAT(b.name ORDER BY b.code SEPARATOR ', ') AS branch_names
       FROM holidays h
       LEFT JOIN holiday_branches hb ON hb.holiday_id = h.id
       LEFT JOIN branches b ON b.id = hb.branch_id
       GROUP BY h.id
       ORDER BY h.date`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/dashboard/summary', authRequired, async (_req, res, next) => {
  try {
    const [counts] = await query<{
      total_employees: number;
      active_employees: number;
      on_leave: number;
      branches: number;
      departments: number;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM employees) AS total_employees,
         (SELECT COUNT(*) FROM employees WHERE status='ACTIVE') AS active_employees,
         (SELECT COUNT(*) FROM employees WHERE status='ON_LEAVE') AS on_leave,
         (SELECT COUNT(*) FROM branches) AS branches,
         (SELECT COUNT(*) FROM departments) AS departments`
    );
    const [holidaysAhead] = await query<{ c: number }>(
      'SELECT COUNT(*) AS c FROM holidays WHERE date >= CURDATE()'
    );
    res.json({
      data: {
        totalEmployees: Number(counts?.total_employees ?? 0),
        activeEmployees: Number(counts?.active_employees ?? 0),
        onLeave: Number(counts?.on_leave ?? 0),
        branches: Number(counts?.branches ?? 0),
        departments: Number(counts?.departments ?? 0),
        upcomingHolidays: Number(holidaysAhead?.c ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/dashboard/activity', authRequired, async (_req, res, next) => {
  try {
    const rows = await query<{
      id: string;
      action: string;
      resource: string;
      resource_id: string;
      at: string;
      actor_name: string | null;
      actor_email: string | null;
    }>(
      `SELECT al.id, al.action, al.resource, al.resource_id, al.at,
              CONCAT(e.first_name, ' ', e.last_name) AS actor_name,
              u.email AS actor_email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_id
       LEFT JOIN employees e ON e.id = u.employee_id
       ORDER BY al.at DESC
       LIMIT 15`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// --- File upload ---

app.post('/api/v1/upload', authRequired, multerUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'No file provided' } });
    }
    const resourceType: 'image' | 'raw' = req.body.type === 'image' ? 'image' : 'raw';
    const result = await uploadToCloudinary(req.file.buffer, resourceType);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/activity-logs', authRequired, async (req, res, next) => {
  try {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { action, resource, q, dateFrom, dateTo, sortBy, sortDir } =
      req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (action) {
      const acts = action.split(',').map((s) => s.trim()).filter(Boolean);
      if (acts.length) {
        conditions.push(`al.action IN (${acts.map(() => '?').join(',')})`);
        params.push(...acts);
      }
    }
    if (resource) {
      const res_ = resource.split(',').map((s) => s.trim()).filter(Boolean);
      if (res_.length) {
        conditions.push(`al.resource IN (${res_.map(() => '?').join(',')})`);
        params.push(...res_);
      }
    }
    if (q) {
      conditions.push(
        `(CONCAT(IFNULL(e.first_name,''),' ',IFNULL(e.last_name,'')) LIKE ? OR u.email LIKE ?)`
      );
      params.push(`%${q}%`, `%${q}%`);
    }
    if (dateFrom) { conditions.push(`al.at >= ?`); params.push(dateFrom); }
    if (dateTo)   { conditions.push(`al.at < DATE_ADD(?, INTERVAL 1 DAY)`); params.push(dateTo); }

    const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const SORT_EXPRS: Record<string, string> = {
      at:       'al.at',
      action:   'al.action',
      resource: 'al.resource',
      actor:    'IFNULL(CONCAT(e.first_name,\' \',e.last_name), u.email)',
    };
    const sortExpr = SORT_EXPRS[sortBy] ?? 'al.at';
    const direction = sortDir === 'asc' ? 'ASC' : 'DESC';

    const [countRows, logs] = await Promise.all([
      query<{ total: string }>(
        `SELECT COUNT(*) AS total
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.actor_id
         LEFT JOIN employees e ON e.id = u.employee_id
         ${WHERE}`,
        params
      ),
      query<{
        id: string; action: string; resource: string; resource_id: string;
        at: string; actor_name: string | null; actor_email: string | null;
      }>(
        `SELECT al.id, al.action, al.resource, al.resource_id, al.at,
                CONCAT(e.first_name, ' ', e.last_name) AS actor_name,
                u.email AS actor_email
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.actor_id
         LEFT JOIN employees e ON e.id = u.employee_id
         ${WHERE}
         ORDER BY ${sortExpr} ${direction}
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    res.json({
      data: { logs, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// --- Employees ---

type EmployeeListRow = {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  designation: string;
  status: string;
  joining_date: string;
  email: string;
  phone: string;
  ctc: string | number;
  branch_id: string;
  branch_code: string;
  branch_name: string;
  department_id: string;
  department_name: string;
  grade_id: string;
  grade_code: string;
};

const ALLOWED_STATUSES = new Set(['ACTIVE', 'PROBATION', 'ON_LEAVE', 'EXITED']);

app.get('/api/v1/employees', authRequired, async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    const designation = typeof req.query.designation === 'string' ? req.query.designation.trim() : '';
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
    const locationId = typeof req.query.locationId === 'string' ? req.query.locationId : undefined;
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;
    const divisionId = typeof req.query.divisionId === 'string' ? req.query.divisionId : undefined;
    const status = typeof req.query.status === 'string' && ALLOWED_STATUSES.has(req.query.status)
      ? req.query.status
      : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const params: unknown[] = [];
    if (search) {
      where.push(
        '(e.first_name LIKE ? OR e.last_name LIKE ? OR e.code LIKE ? OR e.email LIKE ?)'
      );
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (code) {
      where.push('e.code LIKE ?');
      params.push(`%${code}%`);
    }
    if (designation) {
      where.push('e.designation LIKE ?');
      params.push(`%${designation}%`);
    }
    if (companyId) {
      where.push('e.company_id = ?');
      params.push(companyId);
    }
    if (branchId) {
      where.push('e.branch_id = ?');
      params.push(branchId);
    }
    if (locationId) {
      where.push('EXISTS (SELECT 1 FROM locations lx WHERE lx.branch_id = e.branch_id AND lx.id = ?)');
      params.push(locationId);
    }
    if (departmentId) {
      where.push('e.department_id = ?');
      params.push(departmentId);
    }
    if (divisionId) {
      where.push('e.division_id = ?');
      params.push(divisionId);
    }
    if (status) {
      where.push('e.status = ?');
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query<EmployeeListRow & {
      company_id: string | null; company_name: string | null;
      division_id: string | null; division_name: string | null;
      location_id: string | null; location_name: string | null;
    }>(
      `SELECT
         e.id, e.code, e.first_name, e.last_name, e.designation, e.status,
         e.joining_date, e.email, e.phone, e.ctc,
         b.id AS branch_id, b.code AS branch_code, b.name AS branch_name,
         d.id AS department_id, d.name AS department_name,
         g.id AS grade_id, g.code AS grade_code,
         c.id AS company_id, c.name AS company_name,
         dv.id AS division_id, dv.name AS division_name,
         (SELECT id   FROM locations WHERE branch_id = e.branch_id AND is_active = 1 ORDER BY name LIMIT 1) AS location_id,
         (SELECT name FROM locations WHERE branch_id = e.branch_id AND is_active = 1 ORDER BY name LIMIT 1) AS location_name
       FROM employees e
       JOIN branches b ON b.id = e.branch_id
       JOIN departments d ON d.id = e.department_id
       JOIN salary_grades g ON g.id = e.grade_id
       LEFT JOIN hiring_companies c ON c.id = e.company_id
       LEFT JOIN divisions dv ON dv.id = e.division_id
       ${whereSql}
       ORDER BY e.code
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const countRows = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM employees e ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total ?? 0);

    res.json({ data: rows, meta: { page, pageSize, total } });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/employees/:id', authRequired, async (req, res, next) => {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT
         e.*,
         b.code AS branch_code, b.name AS branch_name,
         d.name AS department_name,
         g.code AS grade_code,
         c.name AS company_name,
         dv.name AS division_name,
         pn.number AS office_contact_phone_number,
         jp.jp_no AS jp_no,
         jp.title AS jp_title,
         jp.alternate_title AS jp_alternate_title,
         jp.description AS jp_description,
         jp.requirements AS jp_requirements,
         jp.division AS jp_division,
         jp.designation AS jp_designation,
         jp.location_applicable AS jp_location_applicable,
         jp.work_shift AS jp_work_shift,
         (SELECT id   FROM locations WHERE branch_id = e.branch_id AND is_active = 1 ORDER BY name LIMIT 1) AS location_id,
         (SELECT name FROM locations WHERE branch_id = e.branch_id AND is_active = 1 ORDER BY name LIMIT 1) AS location_name
       FROM employees e
       JOIN branches b ON b.id = e.branch_id
       JOIN departments d ON d.id = e.department_id
       JOIN salary_grades g ON g.id = e.grade_id
       LEFT JOIN hiring_companies c ON c.id = e.company_id
       LEFT JOIN divisions dv ON dv.id = e.division_id
       LEFT JOIN phone_number_pool pn ON pn.id = e.office_contact_phone_id
       LEFT JOIN job_profiles jp ON jp.id = e.job_profile_id
       WHERE e.id = ?`,
      [req.params.id]
    );
    const emp = rows[0];
    if (!emp) {
      return res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
    }
    // Fetch side-table data + derived summaries for all Info-through-Other tabs in parallel.
    const id = req.params.id;
    const currentYear = new Date().getFullYear();
    const [
      emergencyContacts, dependents, documents, education, workExperience, skills,
      lastAttendance, leaveByType, openLeaveCount,
      lastIncrement, pendingIncrementCount,
      advancesOutstanding, loansOutstanding, lastAdvance, lastLoanPayment,
      assetsSummary,
    ] = await Promise.all([
      query('SELECT * FROM employee_emergency_contacts WHERE employee_id = ? ORDER BY sort_order, created_at', [id]),
      query('SELECT * FROM employee_dependents          WHERE employee_id = ? ORDER BY sort_order, created_at', [id]),
      query('SELECT * FROM employee_documents           WHERE employee_id = ? ORDER BY sort_order, created_at', [id]),
      query('SELECT * FROM employee_education           WHERE employee_id = ? ORDER BY sort_order, created_at', [id]),
      query('SELECT * FROM employee_work_experience     WHERE employee_id = ? ORDER BY sort_order, created_at', [id]),
      query(
        `SELECT es.id, es.skill_id, es.rating, es.notes, es.sort_order,
                s.code AS skill_code, s.name AS skill_name, s.category AS skill_category
         FROM employee_skills es
         JOIN skills s ON s.id = es.skill_id
         WHERE es.employee_id = ?
         ORDER BY es.sort_order, es.created_at`,
        [id]
      ),
      // Attendance & Leaves tab summaries.
      query(
        `SELECT date, in_at, out_at, source, is_late
         FROM attendance WHERE employee_id = ?
         ORDER BY date DESC, in_at DESC LIMIT 1`,
        [id]
      ),
      query(
        `SELECT type,
                COALESCE(opening,  0) AS opening,
                COALESCE(consumed, 0) AS consumed,
                COALESCE(closing,  0) AS closing
         FROM leave_balances WHERE employee_id = ? AND year = ?`,
        [id, currentYear]
      ),
      query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM leaves WHERE employee_id = ? AND status = 'PENDING'`,
        [id]
      ),
      // Increment tab.
      query(
        `SELECT effective, hike_pct, current_ctc, proposed_ctc, rating
         FROM increments
         WHERE employee_id = ? AND effective IS NOT NULL
         ORDER BY effective DESC LIMIT 1`,
        [id]
      ),
      query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM increments WHERE employee_id = ? AND stage <> 'done'`,
        [id]
      ),
      // Ledger tab — paise → rupees converted client-side via inrPaiseToRupeesShort.
      query<{ total: number | null }>(
        `SELECT COALESCE(SUM(outstanding), 0) AS total FROM loans WHERE employee_id = ? AND kind = 'ADVANCE' AND status = 'ACTIVE'`,
        [id]
      ),
      query<{ total: number | null }>(
        `SELECT COALESCE(SUM(outstanding), 0) AS total FROM loans WHERE employee_id = ? AND kind = 'LOAN'    AND status = 'ACTIVE'`,
        [id]
      ),
      query(
        `SELECT kind, principal, outstanding, started_at FROM loans
         WHERE employee_id = ? AND kind = 'ADVANCE'
         ORDER BY started_at DESC LIMIT 1`,
        [id]
      ),
      query(
        `SELECT lp.amount, lp.paid_at, l.kind
         FROM loan_payments lp
         JOIN loans l ON l.id = lp.loan_id
         WHERE l.employee_id = ?
         ORDER BY lp.paid_at DESC LIMIT 1`,
        [id]
      ),
      // Other tab — assets summary.
      query<{ count: number; last_at: string | null }>(
        `SELECT COUNT(*) AS count, MAX(updated_at) AS last_at
         FROM assets WHERE current_employee_id = ?`,
        [id]
      ),
    ]);

    res.json({
      data: {
        ...emp,
        emergency_contacts: emergencyContacts,
        dependents,
        documents,
        education,
        work_experience: workExperience,
        skills,
        attendance_summary: {
          last_attendance: (lastAttendance as unknown[])[0] ?? null,
          leave_by_type: leaveByType,
          open_leave_requests: Number((openLeaveCount as { n?: number }[])[0]?.n ?? 0),
        },
        increment_summary: {
          last: (lastIncrement as unknown[])[0] ?? null,
          pending_count: Number((pendingIncrementCount as { n?: number }[])[0]?.n ?? 0),
        },
        ledger_summary: {
          advances_outstanding: Number((advancesOutstanding as { total?: number }[])[0]?.total ?? 0),
          loans_outstanding: Number((loansOutstanding as { total?: number }[])[0]?.total ?? 0),
          last_advance: (lastAdvance as unknown[])[0] ?? null,
          last_payment: (lastLoanPayment as unknown[])[0] ?? null,
        },
        assets_summary: {
          count: Number((assetsSummary as { count?: number }[])[0]?.count ?? 0),
          last_at: (assetsSummary as { last_at?: string | null }[])[0]?.last_at ?? null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// --- Attendance ---
app.get('/api/v1/attendance', authRequired, async (req, res, next) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);

    const where: string[] = ['a.date = ?'];
    const params: unknown[] = [date];
    if (branchId) { where.push('e.branch_id = ?'); params.push(branchId); }
    if (status)   { where.push('a.source = ?');    params.push(status); }
    if (search)   { where.push('(e.first_name LIKE ? OR e.last_name LIKE ? OR e.code LIKE ?)'); const l = `%${search}%`; params.push(l,l,l); }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const rows = await query(
      `SELECT a.id, a.date, a.in_at, a.out_at, a.total_min, a.ot_min, a.source, a.is_late, a.notes,
              e.id AS employee_id, e.code, e.first_name, e.last_name, e.designation,
              b.name AS branch_name
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       JOIN branches b ON b.id = e.branch_id
       ${whereSql} ORDER BY e.code LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    const [cnt] = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM attendance a JOIN employees e ON e.id = a.employee_id ${whereSql}`, params
    );
    res.json({ data: rows, meta: { page, pageSize, total: Number(cnt?.total ?? 0) } });
  } catch (err) { next(err); }
});

// --- Leaves ---
app.get('/api/v1/leaves', authRequired, async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const type   = typeof req.query.type   === 'string' ? req.query.type   : undefined;
    const page   = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);

    const where: string[] = [];
    const params: unknown[] = [];
    if (status) { where.push('l.status = ?'); params.push(status); }
    if (type)   { where.push('l.type = ?');   params.push(type); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query(
      `SELECT l.id, l.type, l.from_date, l.to_date, l.days, l.reason, l.status, l.created_at,
              e.id AS employee_id, e.code, e.first_name, e.last_name, e.designation
       FROM leaves l
       JOIN employees e ON e.id = l.employee_id
       ${whereSql} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    const [cnt] = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM leaves l ${whereSql}`, params);
    res.json({ data: rows, meta: { page, pageSize, total: Number(cnt?.total ?? 0) } });
  } catch (err) { next(err); }
});

// --- Payroll ---
app.get('/api/v1/payroll/periods', authRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT p.id, p.month, p.year, p.status, p.run_at, p.approved_at, p.disbursed_at,
              COUNT(i.id) AS employee_count,
              COALESCE(SUM(i.gross), 0) AS total_gross,
              COALESCE(SUM(i.net), 0)   AS total_net
       FROM payroll_periods p
       LEFT JOIN payroll_items i ON i.period_id = p.id
       GROUP BY p.id ORDER BY p.year DESC, p.month DESC`
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

app.get('/api/v1/payroll/periods/:id/items', authRequired, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
    const rows = await query(
      `SELECT i.id, i.days_paid, i.gross, i.deductions, i.loan_recovery, i.net, i.status,
              e.id AS employee_id, e.code, e.first_name, e.last_name, e.designation
       FROM payroll_items i
       JOIN employees e ON e.id = i.employee_id
       WHERE i.period_id = ? ORDER BY e.code LIMIT ? OFFSET ?`,
      [req.params.id, pageSize, (page - 1) * pageSize]
    );
    const [cnt] = await query<{ total: number }>('SELECT COUNT(*) AS total FROM payroll_items WHERE period_id = ?', [req.params.id]);
    res.json({ data: rows, meta: { page, pageSize, total: Number(cnt?.total ?? 0) } });
  } catch (err) { next(err); }
});

// --- Loans ---
app.get('/api/v1/loans', authRequired, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
    const rows = await query(
      `SELECT l.id, l.kind, l.principal, l.outstanding, l.emi, l.tenure_months, l.remaining, l.status, l.purpose, l.started_at,
              e.id AS employee_id, e.code, e.first_name, e.last_name, e.designation
       FROM loans l
       JOIN employees e ON e.id = l.employee_id
       ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
      [pageSize, (page - 1) * pageSize]
    );
    const [cnt] = await query<{ total: number }>('SELECT COUNT(*) AS total FROM loans');
    const [stats] = await query<{ total_principal: number; total_outstanding: number; active: number }>(
      `SELECT COALESCE(SUM(principal),0) AS total_principal, COALESCE(SUM(outstanding),0) AS total_outstanding, SUM(status='ACTIVE') AS active FROM loans`
    );
    res.json({ data: rows, meta: { page, pageSize, total: Number(cnt?.total ?? 0) }, stats });
  } catch (err) { next(err); }
});

// --- Increments ---
app.get('/api/v1/increments', authRequired, async (req, res, next) => {
  try {
    const stage = typeof req.query.stage === 'string' ? req.query.stage : undefined;
    const where = stage ? 'WHERE i.stage = ?' : '';
    const params = stage ? [stage] : [];
    const rows = await query(
      `SELECT i.id, i.cycle_year, i.current_ctc, i.proposed_ctc, i.hike_pct, i.rating, i.stage, i.effective, i.remarks, i.created_at,
              e.id AS employee_id, e.code, e.first_name, e.last_name, e.designation
       FROM increments i
       JOIN employees e ON e.id = i.employee_id
       ${where} ORDER BY i.created_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// --- Tours ---
app.get('/api/v1/tours', authRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT t.id, t.code, t.from_city, t.to_city, t.from_date, t.to_date, t.advance, t.expense, t.status,
              e.id AS employee_id, e.code AS emp_code, e.first_name, e.last_name, e.designation
       FROM tours t
       JOIN employees e ON e.id = t.employee_id
       ORDER BY t.created_at DESC`
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// --- Incentives ---
app.get('/api/v1/incentives', authRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT i.id, i.kind, i.month, i.year, i.amount, i.status, i.pushed, i.pushed_at, i.created_at,
              e.id AS employee_id, e.code, e.first_name, e.last_name, e.designation
       FROM incentives i
       JOIN employees e ON e.id = i.employee_id
       ORDER BY i.created_at DESC`
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// ─── HIRING (Phase 2) ───────────────────────────────────────────────────────

// Job Profiles
app.get('/api/v1/job-profiles', authRequired, async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const deptId = typeof req.query.departmentId === 'string' ? req.query.departmentId : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
    const where: string[] = []; const params: unknown[] = [];
    if (search) {
      where.push('(jp.designation LIKE ? OR jp.title LIKE ? OR d.name LIKE ? OR jp.division LIKE ?)');
      const l = `%${search}%`; params.push(l, l, l, l);
    }
    if (deptId) { where.push('jp.department_id = ?'); params.push(deptId); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(
            `SELECT jp.id, jp.jp_no, jp.title, jp.division, jp.designation, jp.jp_status,
              jp.description, jp.requirements, jp.status, jp.created_at, jp.form_data,
              d.id AS department_id, d.name AS department_name,
              (SELECT COUNT(*) FROM job_listings jl WHERE jl.job_profile_id = jp.id AND jl.status IN ('Open','Published')) AS open_vacancies
       FROM job_profiles jp
       JOIN departments d ON d.id = jp.department_id
       ${whereSql} ORDER BY jp.jp_no LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    const [cnt] = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM job_profiles jp JOIN departments d ON d.id = jp.department_id ${whereSql}`, params
    );
    res.json({ data: rows, meta: { page, pageSize, total: Number(cnt?.total ?? 0) } });
  } catch (err) { next(err); }
});

app.get('/api/v1/job-profiles/:id', authRequired, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT jp.id, jp.jp_no, jp.title, jp.alternate_title, jp.department_id, jp.designation_id,
              jp.division, jp.designation, jp.jp_status, jp.description, jp.requirements, jp.status,
              jp.created_at, jp.location_applicable, jp.work_shift,
              jp.reporting_dept_id, jp.reporting_division, jp.reporting_designation, jp.form_data,
              d.name AS department_name,
              dg.name AS designation_name, dg.code AS designation_code,
              divs.name AS division_name,
              rd.name AS reporting_department_name
       FROM job_profiles jp
       JOIN departments d ON d.id = jp.department_id
       LEFT JOIN designations dg ON dg.id = jp.designation_id
       LEFT JOIN divisions divs ON divs.id = dg.division_id
       LEFT JOIN departments rd ON rd.id = jp.reporting_dept_id
       WHERE jp.id = ?
       LIMIT 1`,
      [req.params.id]
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job profile not found' } });
    const locations = await query(
      `SELECT jpl.id, jpl.branch_id, jpl.location_id, jpl.positions,
              b.name AS branch_name, b.city AS branch_city,
              l.name AS location_name
       FROM job_profile_locations jpl
       JOIN branches b ON b.id = jpl.branch_id
       LEFT JOIN locations l ON l.id = jpl.location_id
       WHERE jpl.job_profile_id = ?
       ORDER BY jpl.sort_order, jpl.created_at`,
      [req.params.id]
    );
    const shifts = await query(
      `SELECT jps.id, jps.shift_id, s.code AS shift_code, s.name AS shift_name,
              s.start_time, s.end_time
       FROM job_profile_shifts jps
       JOIN shifts s ON s.id = jps.shift_id
       WHERE jps.job_profile_id = ?
       ORDER BY jps.sort_order, jps.created_at`,
      [req.params.id]
    );
    const interview_templates = await query(
      `SELECT jpit.id, jpit.interview_template_id, t.title, t.description, t.image_url
       FROM job_profile_interview_templates jpit
       JOIN interview_templates t ON t.id = jpit.interview_template_id
       WHERE jpit.job_profile_id = ?
       ORDER BY jpit.sort_order, jpit.created_at`,
      [req.params.id]
    );
    res.json({ data: { ...row, locations, shifts, interview_templates } });
  } catch (err) { next(err); }
});

type JpLocationInput = { branchId?: unknown; locationId?: unknown; positions?: unknown };

async function resolveDesignation(designationId: unknown): Promise<{ name: string; departmentId: string | null; divisionName: string | null } | null> {
  if (typeof designationId !== 'string' || !designationId) return null;
  const rows = await query<{ name: string; department_id: string | null; division_name: string | null }>(
    `SELECT dg.name, dg.department_id, divs.name AS division_name
     FROM designations dg
     LEFT JOIN divisions divs ON divs.id = dg.division_id
     WHERE dg.id = ?
     LIMIT 1`,
    [designationId]
  );
  const row = rows[0];
  if (!row) return null;
  return { name: row.name, departmentId: row.department_id, divisionName: row.division_name };
}

async function replaceJpLocations(jobProfileId: string, locations: JpLocationInput[]): Promise<void> {
  await query('DELETE FROM job_profile_locations WHERE job_profile_id = ?', [jobProfileId]);
  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    if (typeof loc?.branchId !== 'string' || !loc.branchId) continue;
    await query(
      'INSERT INTO job_profile_locations (id, job_profile_id, branch_id, location_id, positions, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [ulid(), jobProfileId, loc.branchId,
       typeof loc.locationId === 'string' && loc.locationId ? loc.locationId : null,
       Math.max(1, Number(loc.positions) || 1), i]
    );
  }
}

async function replaceJpShifts(jobProfileId: string, shiftIds: unknown[]): Promise<void> {
  await query('DELETE FROM job_profile_shifts WHERE job_profile_id = ?', [jobProfileId]);
  for (let i = 0; i < shiftIds.length; i++) {
    const sid = shiftIds[i];
    if (typeof sid !== 'string' || !sid) continue;
    await query(
      'INSERT INTO job_profile_shifts (id, job_profile_id, shift_id, sort_order) VALUES (?, ?, ?, ?)',
      [ulid(), jobProfileId, sid, i]
    );
  }
}

async function replaceJpInterviewTemplates(jobProfileId: string, templateIds: unknown[]): Promise<void> {
  await query('DELETE FROM job_profile_interview_templates WHERE job_profile_id = ?', [jobProfileId]);
  for (let i = 0; i < templateIds.length; i++) {
    const tid = templateIds[i];
    if (typeof tid !== 'string' || !tid) continue;
    await query(
      'INSERT INTO job_profile_interview_templates (id, job_profile_id, interview_template_id, sort_order) VALUES (?, ?, ?, ?)',
      [ulid(), jobProfileId, tid, i]
    );
  }
}

app.post('/api/v1/job-profiles', authRequired, async (req, res, next) => {
  try {
    const { title, alternateTitle, departmentId, division, designation, designationId,
      description, requirements, jpStatus = 'Pending',
      locationApplicable, workShift, reportingDeptId, reportingDivision, reportingDesignation,
      formData, locations, shifts } = req.body ?? {};

    // Resolve from designation row if linked — that's the source of truth for dept/div/desig.
    const resolved = await resolveDesignation(designationId);
    const finalDepartmentId = resolved?.departmentId ?? departmentId;
    const finalDivision = resolved?.divisionName ?? division;
    const finalDesignation = resolved?.name ?? designation;
    const finalTitle = title || finalDesignation || '';

    if (!finalDepartmentId || (!finalDesignation && !finalTitle)) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'departmentId and designation required' } });
    }
    const [maxRow] = await query<{ n: number | string | null }>("SELECT COALESCE(MAX(CAST(SUBSTRING(jp_no, 3) AS UNSIGNED)), 0) AS n FROM job_profiles WHERE jp_no IS NOT NULL");
    const jpNo = `JP${String(Number(maxRow?.n ?? 0) + 1).padStart(3, '0')}`;
    const id = ulid();
    await query(
      `INSERT INTO job_profiles
        (id, jp_no, title, alternate_title, department_id, designation_id, division, designation, jp_status,
         description, requirements, location_applicable, work_shift,
         reporting_dept_id, reporting_division, reporting_designation, form_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, jpNo, finalTitle, alternateTitle || null, finalDepartmentId,
       resolved ? designationId : null,
       finalDivision || null, finalDesignation || '', jpStatus,
       description || null, requirements || null, locationApplicable || null,
       workShift || null, reportingDeptId || null, reportingDivision || null,
       reportingDesignation || null, formData ? JSON.stringify(formData) : null]
    );
    if (Array.isArray(locations)) await replaceJpLocations(id, locations);
    if (Array.isArray(shifts))    await replaceJpShifts(id, shifts);
    if (Array.isArray(req.body?.interviewTemplateIds)) await replaceJpInterviewTemplates(id, req.body.interviewTemplateIds);
    res.status(201).json({ data: { id, jp_no: jpNo } });
  } catch (err) { next(err); }
});

app.patch('/api/v1/job-profiles/:id', authRequired, async (req, res, next) => {
  try {
    const { title, alternateTitle, designation, division, designationId, description, requirements,
      status, jpStatus, locationApplicable, workShift,
      reportingDeptId, reportingDivision, reportingDesignation, formData,
      locations, shifts } = req.body ?? {};

    const resolved = await resolveDesignation(designationId);

    const sets: string[] = []; const vals: unknown[] = [];
    if (resolved) {
      sets.push('designation_id = ?', 'department_id = ?', 'division = ?', 'designation = ?');
      vals.push(designationId, resolved.departmentId, resolved.divisionName, resolved.name);
    } else if (designationId === null) {
      sets.push('designation_id = ?');
      vals.push(null);
    }
    if (title                !== undefined) { sets.push('title = ?');                  vals.push(title); }
    if (alternateTitle       !== undefined) { sets.push('alternate_title = ?');        vals.push(alternateTitle); }
    if (!resolved && designation !== undefined) { sets.push('designation = ?');        vals.push(designation); }
    if (!resolved && division    !== undefined) { sets.push('division = ?');           vals.push(division); }
    if (description          !== undefined) { sets.push('description = ?');            vals.push(description); }
    if (requirements         !== undefined) { sets.push('requirements = ?');           vals.push(requirements); }
    if (status               !== undefined) { sets.push('status = ?');                 vals.push(status); }
    if (jpStatus             !== undefined) { sets.push('jp_status = ?');              vals.push(jpStatus); }
    if (locationApplicable   !== undefined) { sets.push('location_applicable = ?');   vals.push(locationApplicable); }
    if (workShift            !== undefined) { sets.push('work_shift = ?');             vals.push(workShift); }
    if (reportingDeptId      !== undefined) { sets.push('reporting_dept_id = ?');      vals.push(reportingDeptId); }
    if (reportingDivision    !== undefined) { sets.push('reporting_division = ?');     vals.push(reportingDivision); }
    if (reportingDesignation !== undefined) { sets.push('reporting_designation = ?'); vals.push(reportingDesignation); }
    if (formData             !== undefined) { sets.push('form_data = ?');              vals.push(JSON.stringify(formData)); }
    if (sets.length) {
      vals.push(req.params.id);
      await query(`UPDATE job_profiles SET ${sets.join(', ')} WHERE id = ?`, vals);
    }
    if (Array.isArray(locations)) await replaceJpLocations(req.params.id, locations);
    if (Array.isArray(shifts))    await replaceJpShifts(req.params.id, shifts);
    if (Array.isArray(req.body?.interviewTemplateIds)) await replaceJpInterviewTemplates(req.params.id, req.body.interviewTemplateIds);
    if (!sets.length && !Array.isArray(locations) && !Array.isArray(shifts) && !Array.isArray(req.body?.interviewTemplateIds)) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'No fields to update' } });
    }
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

// Step 9 — Employees & Alumni for a given Job Profile
// Matches employees whose `designation` string equals the JP's designation.
// Returns both active and exited (alumni) employees with branch/location/dept.
app.get('/api/v1/job-profiles/:id/employees', authRequired, async (req, res, next) => {
  try {
    const jpRows = await query<{ designation: string | null }>(
      'SELECT designation FROM job_profiles WHERE id = ? LIMIT 1', [req.params.id]
    );
    const jp = jpRows[0];
    if (!jp) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job profile not found' } });
    if (!jp.designation) {
      return res.json({ data: { active: [], alumni: [] } });
    }
    const rows = await query<{
      id: string; code: string; first_name: string; last_name: string;
      designation: string; status: string; joining_date: string;
      email: string | null; phone: string | null;
      branch_id: string; branch_name: string; branch_city: string | null;
      department_name: string;
    }>(
      `SELECT e.id, e.code, e.first_name, e.last_name, e.designation, e.status,
              e.joining_date, e.email, e.phone,
              b.id AS branch_id, b.name AS branch_name, b.city AS branch_city,
              d.name AS department_name
       FROM employees e
       JOIN branches b ON b.id = e.branch_id
       JOIN departments d ON d.id = e.department_id
       WHERE e.designation = ?
       ORDER BY e.status, e.code`,
      [jp.designation]
    );
    const active = rows.filter((r) => r.status !== 'EXITED');
    const alumni = rows.filter((r) => r.status === 'EXITED');
    res.json({ data: { active, alumni } });
  } catch (err) { next(err); }
});

// ────────────────────────────────────────────────────────────────────────────
// Vacancies (derived view over job_profile_locations) and Job Listings.
//
// The Vacancy tab is read-only: every (job_profile × branch × location) row
// in `job_profile_locations` produces one Vacancy row, with `positions` taken
// from JP. To turn a Vacancy into a concrete tracked listing the user clicks
// "Create Job Listing", which writes a row into `job_listings`.
//
// The legacy `vacancies` table is retained but no longer the source of truth
// for the Vacancy tab — it still backs the pre-Phase-3 applicant pipeline
// until applicants are fully migrated to reference `job_listing_id`.
// ────────────────────────────────────────────────────────────────────────────

// GET /vacancies — derived from job_profile_locations.
app.get('/api/v1/vacancies', authRequired, async (req, res, next) => {
  try {
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : '';
    const branchId     = typeof req.query.branchId === 'string'     ? req.query.branchId     : '';
    const search       = typeof req.query.search === 'string'       ? req.query.search.trim(): '';
    const filters: string[] = [];
    const params:  unknown[] = [];
    if (departmentId) { filters.push('jp.department_id = ?'); params.push(departmentId); }
    if (branchId)     { filters.push('jpl.branch_id = ?');    params.push(branchId);     }
    if (search) {
      filters.push('(jp.title LIKE ? OR jp.designation LIKE ? OR d.name LIKE ? OR b.name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await query(
      `SELECT jpl.id                          AS id,
              jpl.job_profile_id              AS job_profile_id,
              jpl.branch_id                   AS branch_id,
              jpl.location_id                 AS location_id,
              jpl.positions                   AS positions,
              jp.title                        AS job_title,
              jp.designation                  AS designation,
              jp.designation_id               AS designation_id,
              jp.division                     AS division,
              jp.department_id                AS department_id,
              d.name                          AS department_name,
              b.name                          AS branch_name,
              b.city                          AS branch_city,
              l.name                          AS location_name,
              l.city                          AS location_city,
              'Concept Kitchen'               AS company_name,
              (SELECT COUNT(*) FROM job_listings jl
                WHERE jl.job_profile_id = jpl.job_profile_id
                  AND jl.branch_id      = jpl.branch_id
                  AND (jl.location_id <=> jpl.location_id))
                                              AS listing_count
       FROM job_profile_locations jpl
       JOIN job_profiles jp ON jp.id = jpl.job_profile_id
       JOIN branches b      ON b.id  = jpl.branch_id
       LEFT JOIN locations l ON l.id = jpl.location_id
       JOIN departments d   ON d.id  = jp.department_id
       ${where}
       ORDER BY d.name, b.name, l.name`,
      params
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// ── Job Listings ──────────────────────────────────────────────────────────

async function nextListingNo(): Promise<{ no: string; sr: number }> {
  const [r] = await query<{ n: number | string | null }>(
    "SELECT COALESCE(MAX(sr_no), 0) AS n FROM job_listings"
  );
  const sr = Number(r?.n ?? 0) + 1;
  return { no: `JL-${String(sr).padStart(4, '0')}`, sr };
}

// GET /job-listings — list with derived applicant counts.
app.get('/api/v1/job-listings', authRequired, async (req, res, next) => {
  try {
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : '';
    const status       = typeof req.query.status === 'string'       ? req.query.status       : '';
    const search       = typeof req.query.search === 'string'       ? req.query.search.trim(): '';
    const filters: string[] = [];
    const params:  unknown[] = [];
    if (departmentId) { filters.push('jp.department_id = ?'); params.push(departmentId); }
    if (status)       { filters.push('jl.status = ?');         params.push(status); }
    if (search) {
      filters.push('(jp.title LIKE ? OR jp.designation LIKE ? OR jl.listing_no LIKE ? OR b.name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await query(
      `SELECT jl.id, jl.listing_no, jl.sr_no, jl.positions, jl.filled, jl.company_name,
              jl.status, jl.hiring_status, jl.published_at, jl.deadline_at, jl.notes,
              jl.created_at, jl.updated_at,
              jl.job_profile_id, jl.branch_id, jl.location_id, jl.recruiter_user_id,
              jp.title AS job_title, jp.designation, jp.division, jp.department_id,
              d.name AS department_name,
              b.name AS branch_name, b.city AS branch_city,
              l.name AS location_name, l.city AS location_city,
              u.email AS recruiter_email,
              ru.first_name AS recruiter_first_name, ru.last_name AS recruiter_last_name,
              (SELECT COUNT(*) FROM applicants a WHERE a.job_listing_id = jl.id) AS applicant_count
       FROM job_listings jl
       JOIN job_profiles jp ON jp.id = jl.job_profile_id
       JOIN branches b      ON b.id  = jl.branch_id
       LEFT JOIN locations l ON l.id = jl.location_id
       JOIN departments d   ON d.id  = jp.department_id
       LEFT JOIN users u     ON u.id = jl.recruiter_user_id
       LEFT JOIN employees ru ON ru.id = u.employee_id
       ${where}
       ORDER BY jl.sr_no DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /job-listings/:id — single listing with all header data needed by detail page.
app.get('/api/v1/job-listings/:id', authRequired, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT jl.id, jl.listing_no, jl.sr_no, jl.positions, jl.filled, jl.company_name,
              jl.status, jl.hiring_status, jl.published_at, jl.deadline_at, jl.notes,
              jl.created_at, jl.updated_at,
              jl.job_profile_id, jl.branch_id, jl.location_id, jl.recruiter_user_id,
              jp.title AS job_title, jp.designation, jp.division, jp.department_id,
              d.name AS department_name,
              b.name AS branch_name, b.city AS branch_city,
              l.name AS location_name, l.city AS location_city,
              u.email AS recruiter_email,
              ru.first_name AS recruiter_first_name, ru.last_name AS recruiter_last_name,
              (SELECT COUNT(*) FROM applicants a WHERE a.job_listing_id = jl.id) AS applicant_count
       FROM job_listings jl
       JOIN job_profiles jp ON jp.id = jl.job_profile_id
       JOIN branches b      ON b.id  = jl.branch_id
       LEFT JOIN locations l ON l.id = jl.location_id
       JOIN departments d   ON d.id  = jp.department_id
       LEFT JOIN users u     ON u.id = jl.recruiter_user_id
       LEFT JOIN employees ru ON ru.id = u.employee_id
       WHERE jl.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Listing not found' } });
    res.json({ data: (rows as unknown[])[0] });
  } catch (err) { next(err); }
});

// POST /job-listings — create from a Vacancy slot (jobProfileId + branchId + locationId).
app.post('/api/v1/job-listings', authRequired, async (req, res, next) => {
  try {
    const {
      jobProfileId, branchId, locationId,
      positions,
      companyName = 'Concept Kitchen',
      status = 'Open',
      hiringStatus = 'Applications Invited',
      recruiterUserId, publishedAt, deadlineAt, notes,
    } = req.body ?? {};
    if (!jobProfileId || !branchId || !positions) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'jobProfileId, branchId, positions required' } });
    }
    const { no, sr } = await nextListingNo();
    const id = ulid();
    await query(
      `INSERT INTO job_listings
        (id, listing_no, sr_no, job_profile_id, branch_id, location_id,
         positions, company_name, status, hiring_status, recruiter_user_id,
         published_at, deadline_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, no, sr, jobProfileId, branchId, locationId || null,
        Math.max(1, Number(positions) || 1),
        companyName, status, hiringStatus, recruiterUserId || null,
        publishedAt ? new Date(publishedAt) : null,
        deadlineAt  ? new Date(deadlineAt)  : null,
        notes || null,
      ]
    );
    res.status(201).json({ data: { id, listing_no: no, sr_no: sr } });
  } catch (err) { next(err); }
});

app.patch('/api/v1/job-listings/:id', authRequired, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const sets: string[] = []; const vals: unknown[] = [];
    const pushIf = (col: string, val: unknown) => {
      if (val !== undefined) { sets.push(`${col} = ?`); vals.push(val); }
    };
    pushIf('positions',         body.positions !== undefined ? Math.max(1, Number(body.positions) || 1) : undefined);
    pushIf('filled',            body.filled !== undefined ? Math.max(0, Number(body.filled) || 0) : undefined);
    pushIf('company_name',      body.companyName);
    pushIf('status',            body.status);
    pushIf('hiring_status',     body.hiringStatus);
    pushIf('recruiter_user_id', body.recruiterUserId === '' ? null : body.recruiterUserId);
    pushIf('published_at',      body.publishedAt === null || body.publishedAt === '' ? null : (body.publishedAt ? new Date(body.publishedAt) : undefined));
    pushIf('deadline_at',       body.deadlineAt  === null || body.deadlineAt  === '' ? null : (body.deadlineAt  ? new Date(body.deadlineAt)  : undefined));
    pushIf('notes',             body.notes);
    if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No fields' } });
    vals.push(req.params.id);
    await query(`UPDATE job_listings SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

app.delete('/api/v1/job-listings/:id', authRequired, async (req, res, next) => {
  try {
    await query('DELETE FROM job_listings WHERE id = ?', [req.params.id]);
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

// ── Applicants scoped to a Job Listing ─────────────────────────────────────

async function nextAppNo(): Promise<string> {
  const [r] = await query<{ n: number | string | null }>(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(app_no, 5) AS UNSIGNED)), 0) AS n FROM applicants WHERE app_no IS NOT NULL"
  );
  return `APP-${String(Number(r?.n ?? 0) + 1).padStart(4, '0')}`;
}

async function loadApplicantTags(applicantIds: string[]): Promise<Map<string, Array<{ id: string; name: string; color: string | null }>>> {
  const result = new Map<string, Array<{ id: string; name: string; color: string | null }>>();
  if (!applicantIds.length) return result;
  const placeholders = applicantIds.map(() => '?').join(',');
  const rows = await query<{ applicant_id: string; id: string; name: string; color: string | null }>(
    `SELECT at.applicant_id, t.id, t.name, t.color
     FROM applicant_tags at JOIN tags t ON t.id = at.tag_id
     WHERE at.applicant_id IN (${placeholders})`,
    applicantIds
  );
  for (const r of rows) {
    const list = result.get(r.applicant_id) ?? [];
    list.push({ id: r.id, name: r.name, color: r.color });
    result.set(r.applicant_id, list);
  }
  return result;
}

app.get('/api/v1/job-listings/:id/applicants', authRequired, async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const stage  = typeof req.query.stage === 'string'  ? req.query.stage  : '';
    const stages = typeof req.query.stages === 'string' ? req.query.stages.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const filters: string[] = ['a.job_listing_id = ?'];
    const params: unknown[] = [req.params.id];
    if (status) { filters.push('a.status = ?'); params.push(status); }
    if (stage)  { filters.push('a.stage = ?');  params.push(stage); }
    if (stages.length) {
      filters.push(`a.stage IN (${stages.map(() => '?').join(',')})`);
      params.push(...stages);
    }
    if (search) {
      filters.push('(a.full_name LIKE ? OR a.email LIKE ? OR a.app_no LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const rows = await query<{ id: string } & Record<string, unknown>>(
      `SELECT a.id, a.app_no, a.full_name, a.email, a.phone, a.image_url,
              a.current_company, a.\`current_role\`, a.location,
              a.experience_years, a.salary_min, a.salary_max, a.salary_currency,
              a.education_level, a.institution, a.match_ratio,
              a.match_score, a.screen_score, a.interview_score,
              a.source, a.status, a.stage, a.notes, a.applied_at, a.updated_at,
              o.status AS offer_status
       FROM applicants a
       LEFT JOIN applicant_offers o ON o.applicant_id = a.id
       WHERE ${filters.join(' AND ')}
       ORDER BY a.applied_at DESC`,
      params
    );
    const tagMap = await loadApplicantTags(rows.map((r) => r.id));
    const data = rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
    res.json({ data });
  } catch (err) { next(err); }
});

app.post('/api/v1/job-listings/:id/applicants', authRequired, async (req, res, next) => {
  try {
    const {
      fullName, email, phone, imageUrl,
      currentCompany, currentRole, location,
      experienceYears, salaryMin, salaryMax, salaryCurrency,
      educationLevel, institution, matchRatio,
      source, status, notes, tags,
    } = req.body ?? {};
    if (!fullName || !email) return res.status(400).json({ error: { code: 'VALIDATION', message: 'fullName and email required' } });
    const id = ulid();
    const appNo = await nextAppNo();
    await query(
      `INSERT INTO applicants
        (id, app_no, vacancy_id, job_listing_id, full_name, email, phone, image_url,
         current_company, \`current_role\`, location,
         experience_years, salary_min, salary_max, salary_currency,
         education_level, institution, match_ratio,
         source, status, notes)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, appNo, req.params.id, fullName, email, phone || null, imageUrl || null,
        currentCompany || null, currentRole || null, location || null,
        experienceYears != null && experienceYears !== '' ? Number(experienceYears) : null,
        salaryMin != null && salaryMin !== '' ? Number(salaryMin) : null,
        salaryMax != null && salaryMax !== '' ? Number(salaryMax) : null,
        salaryCurrency || null,
        educationLevel || null, institution || null,
        matchRatio != null && matchRatio !== '' ? Number(matchRatio) : null,
        source || null, status || 'Screening', notes || null,
      ]
    );
    if (Array.isArray(tags)) {
      for (const tagId of tags as string[]) {
        if (typeof tagId === 'string' && tagId) {
          await query('INSERT IGNORE INTO applicant_tags (applicant_id, tag_id) VALUES (?, ?)', [id, tagId]);
        }
      }
    }
    res.status(201).json({ data: { id, app_no: appNo } });
  } catch (err) { next(err); }
});

// Patch the extended applicant fields (status, scores, tags, profile).
app.patch('/api/v1/job-listing-applicants/:id', authRequired, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const sets: string[] = []; const vals: unknown[] = [];
    const map: Array<[string, string, (v: unknown) => unknown]> = [
      ['fullName',         'full_name',        (v) => v],
      ['email',            'email',            (v) => v],
      ['phone',            'phone',            (v) => v],
      ['imageUrl',         'image_url',        (v) => v],
      ['currentCompany',   'current_company',  (v) => v],
      ['currentRole',      '`current_role`',   (v) => v],
      ['location',         'location',         (v) => v],
      ['experienceYears',  'experience_years', (v) => (v == null || v === '' ? null : Number(v))],
      ['salaryMin',        'salary_min',       (v) => (v == null || v === '' ? null : Number(v))],
      ['salaryMax',        'salary_max',       (v) => (v == null || v === '' ? null : Number(v))],
      ['salaryCurrency',   'salary_currency',  (v) => v],
      ['educationLevel',   'education_level',  (v) => v],
      ['institution',      'institution',      (v) => v],
      ['matchRatio',       'match_ratio',      (v) => (v == null || v === '' ? null : Number(v))],
      ['screenScore',      'screen_score',     (v) => (v == null || v === '' ? null : Number(v))],
      ['interviewScore',   'interview_score',  (v) => (v == null || v === '' ? null : Number(v))],
      ['source',           'source',           (v) => v],
      ['status',           'status',           (v) => v],
      ['notes',            'notes',            (v) => v],
    ];
    for (const [key, col, transform] of map) {
      if (body[key] !== undefined) {
        sets.push(`${col} = ?`);
        vals.push(transform(body[key]));
      }
    }
    if (sets.length) {
      // Snapshot prior state if status is changing — used for the activity log.
      let prev: { stage: string | null; status: string | null } | null = null;
      if (body.status !== undefined) {
        prev = await getApplicantStageStatus(req.params.id);
      }
      vals.push(req.params.id);
      await query(`UPDATE applicants SET ${sets.join(', ')} WHERE id = ?`, vals);
      if (prev && body.status !== prev.status) {
        await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'status_change', {
          fromStatus: prev.status, toStatus: String(body.status),
        });
      }
    }
    if (Array.isArray(body.tags)) {
      await query('DELETE FROM applicant_tags WHERE applicant_id = ?', [req.params.id]);
      for (const tagId of body.tags as string[]) {
        if (typeof tagId === 'string' && tagId) {
          await query('INSERT IGNORE INTO applicant_tags (applicant_id, tag_id) VALUES (?, ?)', [req.params.id, tagId]);
        }
      }
      await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'tag', {
        meta: { tagIds: body.tags },
      });
    }
    if (!sets.length && !Array.isArray(body.tags)) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'No fields' } });
    }
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

app.delete('/api/v1/job-listing-applicants/:id', authRequired, async (req, res, next) => {
  try {
    await query('DELETE FROM applicants WHERE id = ?', [req.params.id]);
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

// Hired applicants for onboarding
app.get('/api/v1/applicants/hired', authRequired, async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    // Applicants may come from either the legacy vacancy flow (vacancy_id) or the
    // newer Job Listing flow (job_listing_id). LEFT JOIN both and COALESCE so
    // either source resolves to a branch + job profile.
    const where = search
      ? `WHERE (a.stage='hired' OR a.status='Hired') AND (a.full_name LIKE ? OR a.email LIKE ?)`
      : `WHERE (a.stage='hired' OR a.status='Hired')`;
    const params = search ? [`%${search}%`, `%${search}%`] : [];
    const rows = await query(
      `SELECT a.id, a.app_no, a.image_url, a.full_name, a.email, a.phone,
              a.current_company, a.\`current_role\`, a.location,
              a.experience_years, a.salary_min, a.salary_max, a.salary_currency,
              a.education_level, a.institution, a.match_ratio,
              a.match_score, a.screen_score, a.interview_score,
              a.source, a.applied_at, a.updated_at, a.status AS applicant_status,
              COALESCE(v.company_name, jl.company_name) AS company_name,
              COALESCE(vb.name, jlb.name) AS branch_name,
              COALESCE(vjp.designation, jljp.designation) AS designation,
              COALESCE(vjp.title, jljp.title) AS job_title,
              o.ctc AS offer_ctc, o.ctc_currency AS offer_currency,
              o.joining_date AS offer_joining_date,
              o.designation AS offer_designation,
              IFNULL(ao.status, 'pending') AS onboarding_status,
              ao.promoted_employee_id
       FROM applicants a
       LEFT JOIN vacancies v       ON v.id  = a.vacancy_id
       LEFT JOIN branches vb       ON vb.id = v.branch_id
       LEFT JOIN job_profiles vjp  ON vjp.id = v.job_profile_id
       LEFT JOIN job_listings jl   ON jl.id = a.job_listing_id
       LEFT JOIN branches jlb      ON jlb.id = jl.branch_id
       LEFT JOIN job_profiles jljp ON jljp.id = jl.job_profile_id
       LEFT JOIN applicant_offers o ON o.applicant_id = a.id
       LEFT JOIN applicant_onboarding ao ON ao.applicant_id = a.id
       ${where} ORDER BY a.updated_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// Get onboarding session
app.get('/api/v1/applicants/:id/onboarding', authRequired, async (req, res, next) => {
  try {
    const rows = await query<Record<string, unknown>>('SELECT * FROM applicant_onboarding WHERE applicant_id = ?', [req.params.id]);
    res.json({ data: rows[0] ?? null });
  } catch (err) { next(err); }
});

// Create / update onboarding session
app.post('/api/v1/applicants/:id/onboarding', authRequired, async (req, res, next) => {
  try {
    const { giveaways, emailAssigned, phoneAssigned, inductionNotes, onboardingNotes, trainingNotes, status } = req.body ?? {};
    const existing = await query<{ id: string }>('SELECT id FROM applicant_onboarding WHERE applicant_id = ?', [req.params.id]);
    if (existing.length) {
      const sets: string[] = []; const vals: unknown[] = [];
      if (giveaways !== undefined)       { sets.push('giveaways = ?');          vals.push(JSON.stringify(giveaways)); }
      if (emailAssigned !== undefined)   { sets.push('email_assigned = ?');     vals.push(emailAssigned); }
      if (phoneAssigned !== undefined)   { sets.push('phone_assigned = ?');     vals.push(phoneAssigned); }
      if (inductionNotes !== undefined)  { sets.push('induction_notes = ?');    vals.push(inductionNotes); }
      if (onboardingNotes !== undefined) { sets.push('onboarding_notes = ?');   vals.push(onboardingNotes); }
      if (trainingNotes !== undefined)   { sets.push('training_notes = ?');     vals.push(trainingNotes); }
      if (status !== undefined)          { sets.push('status = ?');             vals.push(status); }
      if (sets.length) { vals.push(existing[0].id); await query(`UPDATE applicant_onboarding SET ${sets.join(', ')} WHERE id = ?`, vals); }
      res.json({ data: { id: existing[0].id } });
    } else {
      const id = ulid();
      await query(
        'INSERT INTO applicant_onboarding (id, applicant_id, giveaways, email_assigned, phone_assigned, induction_notes, onboarding_notes, training_notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, req.params.id, giveaways ? JSON.stringify(giveaways) : null, emailAssigned || null, phoneAssigned || null, inductionNotes || null, onboardingNotes || null, trainingNotes || null, status || 'pending']
      );
      res.status(201).json({ data: { id } });
    }
  } catch (err) { next(err); }
});

// Prospects (talent pool)
app.get('/api/v1/prospects', authRequired, async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
    const where = search ? 'WHERE name LIKE ? OR email LIKE ? OR company LIKE ? OR `current_role` LIKE ?' : '';
    const params: unknown[] = search ? [`%${search}%`,`%${search}%`,`%${search}%`,`%${search}%`] : [];
    const rows = await query(
      `SELECT * FROM prospects ${where} ORDER BY match_ratio DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    const [cnt] = await query<{ total: number }>(`SELECT COUNT(*) AS total FROM prospects ${where}`, params);
    res.json({ data: rows, meta: { page, pageSize, total: Number(cnt?.total ?? 0) } });
  } catch (err) { next(err); }
});

app.post('/api/v1/prospects', authRequired, async (req, res, next) => {
  try {
    const { name, email, phone, platform, experienceYears, currentRole, company, location, salaryRange, education, institution, matchRatio, engagementSignal, applicationStatus } = req.body ?? {};
    if (!name || !email) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name and email required' } });
    const id = ulid();
    await query(
      'INSERT INTO prospects (id, name, email, phone, platform, experience_years, `current_role`, company, location, salary_range, education, institution, match_ratio, engagement_signal, application_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, email, phone || null, platform || 'LinkedIn', experienceYears || null, currentRole || null, company || null, location || null, salaryRange || null, education || null, institution || null, matchRatio || null, engagementSignal || 'Job Seeking', applicationStatus || 'Not Applied']
    );
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

// Bulk import for "Nest Connect" — accepts an array of prospect rows.
// Skips rows whose email already exists (case-insensitive).
app.post('/api/v1/prospects/import', authRequired, async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows as Array<Record<string, unknown>> : null;
    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'rows[] required' } });
    }
    const existing = await query<{ email: string }>('SELECT email FROM prospects');
    const seen = new Set(existing.map((r) => r.email.toLowerCase()));
    let inserted = 0, skipped = 0;
    for (const r of rows) {
      const name  = typeof r.name === 'string' ? r.name.trim() : '';
      const email = typeof r.email === 'string' ? r.email.trim() : '';
      if (!name || !email) { skipped++; continue; }
      if (seen.has(email.toLowerCase())) { skipped++; continue; }
      seen.add(email.toLowerCase());
      await query(
        'INSERT INTO prospects (id, name, email, phone, platform, experience_years, `current_role`, company, location, salary_range, education, institution, match_ratio, engagement_signal, application_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          ulid(), name, email,
          typeof r.phone === 'string' ? r.phone : null,
          typeof r.platform === 'string' && r.platform ? r.platform : 'LinkedIn',
          r.experienceYears != null && r.experienceYears !== '' ? Number(r.experienceYears) : null,
          typeof r.currentRole === 'string' ? r.currentRole : null,
          typeof r.company === 'string' ? r.company : null,
          typeof r.location === 'string' ? r.location : null,
          typeof r.salaryRange === 'string' ? r.salaryRange : null,
          typeof r.education === 'string' ? r.education : null,
          typeof r.institution === 'string' ? r.institution : null,
          r.matchRatio != null && r.matchRatio !== '' ? Number(r.matchRatio) : null,
          typeof r.engagementSignal === 'string' && r.engagementSignal ? r.engagementSignal : 'Job Seeking',
          typeof r.applicationStatus === 'string' && r.applicationStatus ? r.applicationStatus : 'Not Applied',
        ]
      );
      inserted++;
    }
    res.status(201).json({ data: { inserted, skipped, total: rows.length } });
  } catch (err) { next(err); }
});

// Hiring companies (Step 9 - Employees & Alumni)
app.get('/api/v1/hiring/companies', authRequired, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
    const rows = await query('SELECT * FROM hiring_companies ORDER BY lc_no LIMIT ? OFFSET ?', [pageSize, (page - 1) * pageSize]);
    const [cnt] = await query<{ total: number }>('SELECT COUNT(*) AS total FROM hiring_companies');
    res.json({ data: rows, meta: { page, pageSize, total: Number(cnt?.total ?? 0) } });
  } catch (err) { next(err); }
});

app.post('/api/v1/hiring/companies', authRequired, async (req, res, next) => {
  try {
    const { name, branch, city, location } = req.body ?? {};
    if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
    const [maxRow] = await query<{ n: number | string | null }>("SELECT COALESCE(MAX(CAST(SUBSTRING(lc_no, 3) AS UNSIGNED)), 0) AS n FROM hiring_companies");
    const lcNo = `LC${String(Number(maxRow?.n ?? 0) + 1).padStart(3, '0')}`;
    const id = ulid();
    await query('INSERT INTO hiring_companies (id, lc_no, name, branch, city, location) VALUES (?, ?, ?, ?, ?, ?)',
      [id, lcNo, name, branch || null, city || null, location || null]);
    res.status(201).json({ data: { id, lc_no: lcNo } });
  } catch (err) { next(err); }
});

// Interview templates (Step 11)
app.get('/api/v1/hiring/interview-templates', authRequired, async (_req, res, next) => {
  try {
    const rows = await query('SELECT * FROM interview_templates ORDER BY created_at');
    res.json({ data: rows });
  } catch (err) { next(err); }
});

app.post('/api/v1/hiring/interview-templates', authRequired, async (req, res, next) => {
  try {
    const { title, description, fieldsJson, imageUrl, isDefault } = req.body ?? {};
    if (!title) return res.status(400).json({ error: { code: 'VALIDATION', message: 'title required' } });
    const id = ulid();
    const fjs = fieldsJson == null ? null : typeof fieldsJson === 'string' ? fieldsJson : JSON.stringify(fieldsJson);
    await query(
      'INSERT INTO interview_templates (id, title, description, fields_json, image_url, is_default) VALUES (?, ?, ?, ?, ?, ?)',
      [id, title, description || null, fjs, imageUrl || null, isDefault === true || isDefault === 1 || isDefault === '1' ? 1 : 0]
    );
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

// Giveaway templates
app.get('/api/v1/onboarding/giveaways', authRequired, async (_req, res, next) => {
  try {
    const rows = await query('SELECT * FROM onboarding_giveaway_templates ORDER BY name');
    res.json({ data: rows });
  } catch (err) { next(err); }
});

app.post('/api/v1/onboarding/giveaways', authRequired, async (req, res, next) => {
  try {
    const { name, category, occasion, thumbnailUrl, description, isDefault, isActive } = req.body ?? {};
    if (!name) return res.status(400).json({ error: { code: 'VALIDATION', message: 'name required' } });
    const id = ulid();
    await query(
      `INSERT INTO onboarding_giveaway_templates (id, name, category, occasion, thumbnail_url, description, is_default, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, category || null, occasion || null, thumbnailUrl || null, description || null,
       isDefault === true || isDefault === 1 || isDefault === '1' ? 1 : 0,
       isActive === false || isActive === 0 || isActive === '0' ? 0 : 1]
    );
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

// ───────────────────────────────────────────────────────────────────────────
// Applicant onboarding — child tables (giveaways, ERP, assets, presentations,
// docs, items, trainings). The parent /applicants/:id/onboarding endpoint
// returns the AO row; these endpoints work against the AO row id.
// ───────────────────────────────────────────────────────────────────────────

async function ensureOnboardingRow(applicantId: string): Promise<string> {
  const existing = await query<{ id: string }>(
    'SELECT id FROM applicant_onboarding WHERE applicant_id = ?',
    [applicantId]
  );
  if (existing[0]?.id) return existing[0].id;
  const id = ulid();
  await query(
    'INSERT INTO applicant_onboarding (id, applicant_id, status) VALUES (?, ?, ?)',
    [id, applicantId, 'pending']
  );
  // Seed induction/onboarding/training items from the linked Job Profile so any
  // path that first creates the onboarding row gets the JP-defined content.
  await seedOnboardingFromJobProfile(applicantId, id);
  return id;
}

// Onboarding activity log helper. Best-effort — failure here must not block
// the underlying action.
async function writeOnboardingActivity(
  aoId: string,
  applicantId: string,
  actorUserId: string | null,
  action: string,
  opts: { section?: string; message?: string | null; meta?: unknown } = {}
): Promise<void> {
  try {
    await query(
      `INSERT INTO onboarding_activities
         (id, ao_id, applicant_id, actor_user_id, action, section, message, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ulid(), aoId, applicantId, actorUserId, action,
        opts.section ?? null,
        opts.message ?? null,
        opts.meta != null ? JSON.stringify(opts.meta) : null,
      ]
    );
  } catch (e) {
    console.error('[onboarding-activity] failed to log', action, e);
  }
}

// Resolve applicantId from a child row's ao_id (used by activity helpers that
// only have the child row's parent link).
async function applicantForAo(aoId: string): Promise<string | null> {
  const rows = await query<{ applicant_id: string }>('SELECT applicant_id FROM applicant_onboarding WHERE id = ?', [aoId]);
  return rows[0]?.applicant_id ?? null;
}

// Aggregated read used by the detail page (header + all children).
app.get('/api/v1/applicants/:id/onboarding/full', authRequired, async (req, res, next) => {
  try {
    const applicantId = req.params.id;
    const ao = await query<Record<string, unknown>>(
      'SELECT * FROM applicant_onboarding WHERE applicant_id = ?',
      [applicantId]
    );
    const parent = ao[0] ?? null;
    if (!parent) return res.json({ data: { parent: null } });
    const aoId = parent.id as string;
    const [giveaways, erp, assets, presentations, docs, items, trainings] = await Promise.all([
      query(
        `SELECT g.*, t.name AS template_name, t.thumbnail_url AS template_thumbnail
         FROM applicant_giveaways g
         LEFT JOIN onboarding_giveaway_templates t ON t.id = g.giveaway_template_id
         WHERE g.ao_id = ?`,
        [aoId]
      ),
      query(
        `SELECT m.id AS erp_module_id, m.code, m.name, m.description, m.icon,
                e.id AS link_id, e.status, e.activated_at
         FROM applicant_erp_modules e
         JOIN erp_modules m ON m.id = e.erp_module_id
         WHERE e.ao_id = ? ORDER BY m.sort_order, m.name`,
        [aoId]
      ),
      query(
        `SELECT a.*, ast.asset_tag, ast.name AS asset_name, ast.serial_no, c.name AS category_name
         FROM applicant_asset_allocations a
         JOIN assets ast ON ast.id = a.asset_id
         LEFT JOIN asset_categories c ON c.id = ast.category_id
         WHERE a.ao_id = ?`,
        [aoId]
      ),
      query(
        `SELECT ap.*, p.title, p.category, p.sub_category, p.thumbnail_url, p.file_url
         FROM applicant_presentations ap
         JOIN presentations p ON p.id = ap.presentation_id
         WHERE ap.ao_id = ?`,
        [aoId]
      ),
      query(
        `SELECT ad.*, d.title, d.category, d.sub_category, d.thumbnail_url, d.file_url, d.requires_signature
         FROM applicant_documents ad
         JOIN onboarding_docs d ON d.id = ad.doc_id
         WHERE ad.ao_id = ?`,
        [aoId]
      ),
      query(
        `SELECT ai.*, i.kind, i.title, i.category, i.sub_category, i.thumbnail_url
         FROM applicant_onboarding_items ai
         JOIN onboarding_items i ON i.id = ai.item_id
         WHERE ai.ao_id = ?`,
        [aoId]
      ),
      query(
        `SELECT at.*, tm.code, tm.name, tm.description, tm.cover_image_url, tm.duration_hours, tm.chapter_count
         FROM applicant_trainings at
         JOIN training_modules tm ON tm.id = at.training_module_id
         WHERE at.ao_id = ?`,
        [aoId]
      ),
    ]);
    // Personal Info-tab side tables (Phase 2.G).
    const [emergencyContacts, dependents] = await Promise.all([
      query('SELECT * FROM applicant_emergency_contacts WHERE ao_id = ? ORDER BY sort_order, created_at', [aoId]),
      query('SELECT * FROM applicant_dependents          WHERE ao_id = ? ORDER BY sort_order, created_at', [aoId]),
    ]);
    res.json({
      data: {
        parent, giveaways, erp, assets, presentations, docs, items, trainings,
        emergency_contacts: emergencyContacts,
        dependents,
      },
    });
  } catch (err) { next(err); }
});

// Update header fields (DOB, blood group, buddy, branch/dept/etc.)
app.patch('/api/v1/applicants/:id/onboarding/header', authRequired, async (req, res, next) => {
  try {
    const aoId = await ensureOnboardingRow(req.params.id);
    const body = req.body ?? {};
    const sectionFromKeys = (keys: string[]): string => {
      if (keys.some((k) => k === 'idCardPrintedAt' || k === 'idCardTemplateId')) return 'id_card';
      if (keys.includes('faceMappedAt')) return 'face';
      if (keys.includes('biometricMappedAt')) return 'biometric';
      if (keys.includes('inductionBuddyEmployeeId')) return 'buddy';
      if (keys.some((k) => k === 'emailAssigned' || k === 'phoneAssigned' || k === 'setupEmailAccount')) return 'email_phone';
      return 'header';
    };
    const map: Array<[string, string]> = [
      ['dob', 'dob'],
      ['bloodGroup', 'blood_group'],
      ['divisionId', 'division_id'],
      ['departmentId', 'department_id'],
      ['designationId', 'designation_id'],
      ['branchId', 'branch_id'],
      ['locationId', 'location_id'],
      ['setupEmailAccount', 'setup_email_account'],
      ['inductionBuddyEmployeeId', 'induction_buddy_employee_id'],
      ['idCardTemplateId', 'id_card_template_id'],
      ['idCardPrintedAt', 'id_card_printed_at'],
      ['faceMappedAt', 'face_mapped_at'],
      ['biometricMappedAt', 'biometric_mapped_at'],
      ['emailAssigned', 'email_assigned'],
      ['phoneAssigned', 'phone_assigned'],
      ['inductionNotes', 'induction_notes'],
      ['onboardingNotes', 'onboarding_notes'],
      ['trainingNotes', 'training_notes'],
      ['status', 'status'],
      // Personal / contact / addresses (Phase 2.G) — feed straight into employees
      // when the applicant is promoted on Close & Archive.
      ['gender',                     'gender'],
      ['maritalStatus',              'marital_status'],
      ['nationality',                'nationality'],
      ['religion',                   'religion'],
      ['languagesKnown',             'languages_known'],
      ['casteCategory',              'caste_category'],
      ['alternatePhone',             'alternate_phone'],
      ['alternatePhoneCountryCode',  'alternate_phone_country_code'],
      ['probationFrom',              'probation_from'],
      ['probationTo',                'probation_to'],
      ['employmentType',             'employment_type'],
      ['workMode',                   'work_mode'],
      ['presentAddress',             'present_address'],
      ['permanentAddress',           'permanent_address'],
      ['pan',                        'pan'],
      ['aadhaar',                    'aadhaar'],
    ];
    const jsonCols = new Set(['languages_known', 'present_address', 'permanent_address']);
    const sets: string[] = []; const vals: unknown[] = [];
    for (const [key, col] of map) {
      if (body[key] !== undefined) {
        sets.push(`${col} = ?`);
        const raw = body[key];
        if (key === 'setupEmailAccount') {
          vals.push(raw ? 1 : 0);
        } else if (jsonCols.has(col)) {
          // mysql2 doesn't auto-stringify objects/arrays for JSON columns.
          vals.push(raw == null ? null : (typeof raw === 'string' ? raw : JSON.stringify(raw)));
        } else {
          vals.push(raw === '' ? null : raw);
        }
      }
    }
    if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
    vals.push(aoId);
    await query(`UPDATE applicant_onboarding SET ${sets.join(', ')} WHERE id = ?`, vals);
    const keys = Object.keys(body).filter((k) => map.some((m) => m[0] === k));
    await writeOnboardingActivity(aoId, req.params.id, req.user?.id ?? null, 'update_header', {
      section: sectionFromKeys(keys), meta: Object.fromEntries(keys.map((k) => [k, body[k]])),
    });
    res.json({ data: { id: aoId } });
  } catch (err) { next(err); }
});

// ── Face enrollment (external Face Recognition API) ──────────────────────────
// Registers the applicant's face against the recognition service and stamps
// face_mapped_at so the onboarding "Face Detection" tile flips to Mapped. The
// applicant_id doubles as the face-API person id (stable + unique).
app.post('/api/v1/applicants/:id/face/enroll', authRequired, multerUpload.single('file'), async (req, res, next) => {
  try {
    if (!faceApiConfigured()) {
      return res.status(503).json({ error: { code: 'FACE_API_UNCONFIGURED', message: 'Face Recognition API is not configured (set FACE_API_URL).' } });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No image file provided' } });
    const applicantId = req.params.id;
    const aoId = await ensureOnboardingRow(applicantId);
    const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : applicantId;
    const stampedAt = new Date().toISOString();
    const { person, created } = await enrollFace({
      personId: applicantId,
      name,
      meta: { source: 'onboarding', aoId },
      buffer: file.buffer,
      filename: file.originalname || 'face.jpg',
      mimetype: file.mimetype,
    });
    await query('UPDATE applicant_onboarding SET face_mapped_at = ? WHERE id = ?', [stampedAt, aoId]);
    await writeOnboardingActivity(aoId, applicantId, req.user?.id ?? null, 'update_header', {
      section: 'face', meta: { action: created ? 'enrolled' : 'face_added', faceCount: person.faces?.length ?? null },
    });
    res.status(201).json({ data: { faceMappedAt: stampedAt, created, faceCount: person.faces?.length ?? null } });
  } catch (err) {
    if (err instanceof FaceApiError) {
      return res.status(502).json({ error: { code: 'FACE_API_ERROR', message: err.message } });
    }
    next(err);
  }
});

// Un-enroll: remove the person (and their faces) from the recognition service
// and clear the stamp. Remote cleanup is best-effort — a failing face API must
// not block clearing the local status.
app.delete('/api/v1/applicants/:id/face', authRequired, async (req, res, next) => {
  try {
    const applicantId = req.params.id;
    const aoId = await ensureOnboardingRow(applicantId);
    if (faceApiConfigured()) {
      try { await deletePerson(applicantId); }
      catch (err) { if (!(err instanceof FaceApiError)) throw err; }
    }
    await query('UPDATE applicant_onboarding SET face_mapped_at = NULL WHERE id = ?', [aoId]);
    await writeOnboardingActivity(aoId, applicantId, req.user?.id ?? null, 'update_header', {
      section: 'face', meta: { action: 'unenrolled' },
    });
    res.json({ data: { id: aoId } });
  } catch (err) { next(err); }
});

// Emergency contacts + dependents captured during onboarding (Phase 2.G).
// Bulk-replace: client PUTs the full array, we wipe and re-insert.
type ApplicantEmergencyContactInput = {
  id?: string; name?: string; relation?: string | null;
  phone?: string | null; phone_country_code?: string | null;
  address?: string | null; sort_order?: number;
};
app.put('/api/v1/applicants/:id/onboarding/emergency-contacts', authRequired, async (req, res, next) => {
  try {
    const aoId = await ensureOnboardingRow(req.params.id);
    const items: ApplicantEmergencyContactInput[] = Array.isArray(req.body?.items) ? req.body.items : [];
    await query('DELETE FROM applicant_emergency_contacts WHERE ao_id = ?', [aoId]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it?.name) continue;
      await query(
        `INSERT INTO applicant_emergency_contacts (id, ao_id, name, relation, phone, phone_country_code, address, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ulid(), aoId, it.name, it.relation ?? null, it.phone ?? null,
         it.phone_country_code ?? null, it.address ?? null, it.sort_order ?? i]
      );
    }
    const rows = await query('SELECT * FROM applicant_emergency_contacts WHERE ao_id = ? ORDER BY sort_order, created_at', [aoId]);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

type ApplicantDependentInput = {
  id?: string; relation?: string; name?: string;
  phone?: string | null; phone_country_code?: string | null;
  email?: string | null; dob?: string | null; sort_order?: number;
};
app.put('/api/v1/applicants/:id/onboarding/dependents', authRequired, async (req, res, next) => {
  try {
    const aoId = await ensureOnboardingRow(req.params.id);
    const items: ApplicantDependentInput[] = Array.isArray(req.body?.items) ? req.body.items : [];
    await query('DELETE FROM applicant_dependents WHERE ao_id = ?', [aoId]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it?.relation || !it?.name) continue;
      await query(
        `INSERT INTO applicant_dependents (id, ao_id, relation, name, phone, phone_country_code, email, dob, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ulid(), aoId, it.relation, it.name, it.phone ?? null,
         it.phone_country_code ?? null, it.email ?? null,
         it.dob ? it.dob : null, it.sort_order ?? i]
      );
    }
    const rows = await query('SELECT * FROM applicant_dependents WHERE ao_id = ? ORDER BY sort_order, created_at', [aoId]);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// Giveaways (child)
app.post('/api/v1/applicants/:id/onboarding/giveaways', authRequired, async (req, res, next) => {
  try {
    const aoId = await ensureOnboardingRow(req.params.id);
    const { giveawayTemplateId, customName, status } = req.body ?? {};
    if (!giveawayTemplateId && !customName) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'giveawayTemplateId or customName required' } });
    }
    const id = ulid();
    await query(
      'INSERT INTO applicant_giveaways (id, ao_id, giveaway_template_id, custom_name, status, given_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, aoId, giveawayTemplateId || null, customName || null, status || 'planned', status === 'given' ? new Date() : null]
    );
    await writeOnboardingActivity(aoId, req.params.id, req.user?.id ?? null, 'add_giveaway', {
      section: 'giveaway', meta: { linkId: id, giveawayTemplateId, customName },
    });
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

app.patch('/api/v1/applicants/onboarding/giveaways/:linkId', authRequired, async (req, res, next) => {
  try {
    const { status } = req.body ?? {};
    if (!status) return res.status(400).json({ error: { code: 'VALIDATION', message: 'status required' } });
    const link = await query<{ ao_id: string }>('SELECT ao_id FROM applicant_giveaways WHERE id = ?', [req.params.linkId]);
    await query(
      'UPDATE applicant_giveaways SET status = ?, given_at = ? WHERE id = ?',
      [status, status === 'given' ? new Date() : null, req.params.linkId]
    );
    if (link[0]) {
      const applicantId = await applicantForAo(link[0].ao_id);
      if (applicantId) {
        await writeOnboardingActivity(link[0].ao_id, applicantId, req.user?.id ?? null, 'giveaway_status', {
          section: 'giveaway', meta: { linkId: req.params.linkId, status },
        });
      }
    }
    res.json({ data: { id: req.params.linkId } });
  } catch (err) { next(err); }
});

app.delete('/api/v1/applicants/onboarding/giveaways/:linkId', authRequired, async (req, res, next) => {
  try {
    const link = await query<{ ao_id: string }>('SELECT ao_id FROM applicant_giveaways WHERE id = ?', [req.params.linkId]);
    await query('DELETE FROM applicant_giveaways WHERE id = ?', [req.params.linkId]);
    if (link[0]) {
      const applicantId = await applicantForAo(link[0].ao_id);
      if (applicantId) {
        await writeOnboardingActivity(link[0].ao_id, applicantId, req.user?.id ?? null, 'remove_giveaway', {
          section: 'giveaway', meta: { linkId: req.params.linkId },
        });
      }
    }
    res.json({ data: { id: req.params.linkId } });
  } catch (err) { next(err); }
});

// ERP modules (child) — replaceAll endpoint to sync the grid
app.put('/api/v1/applicants/:id/onboarding/erp-modules', authRequired, async (req, res, next) => {
  try {
    const aoId = await ensureOnboardingRow(req.params.id);
    const modules = Array.isArray(req.body?.modules) ? req.body.modules as Array<{ erpModuleId: string; status?: string }> : [];
    await query('DELETE FROM applicant_erp_modules WHERE ao_id = ?', [aoId]);
    for (const m of modules) {
      if (!m?.erpModuleId) continue;
      await query(
        'INSERT INTO applicant_erp_modules (id, ao_id, erp_module_id, status, activated_at, blocked_at) VALUES (?, ?, ?, ?, ?, ?)',
        [ulid(), aoId, m.erpModuleId, m.status || 'inactive',
         m.status === 'active' ? new Date() : null,
         m.status === 'blocked' ? new Date() : null]
      );
    }
    await writeOnboardingActivity(aoId, req.params.id, req.user?.id ?? null, 'sync_erp_modules', {
      section: 'erp', meta: { count: modules.length },
    });
    res.json({ data: { id: aoId, count: modules.length } });
  } catch (err) { next(err); }
});

// Patch a single ERP module activation row
app.patch('/api/v1/applicants/onboarding/erp-modules/:linkId', authRequired, async (req, res, next) => {
  try {
    const { status } = req.body ?? {};
    if (!status) return res.status(400).json({ error: { code: 'VALIDATION', message: 'status required' } });
    const link = await query<{ ao_id: string }>('SELECT ao_id FROM applicant_erp_modules WHERE id = ?', [req.params.linkId]);
    await query(
      'UPDATE applicant_erp_modules SET status = ?, activated_at = ?, blocked_at = ? WHERE id = ?',
      [status,
       status === 'active' ? new Date() : null,
       status === 'blocked' ? new Date() : null,
       req.params.linkId]
    );
    if (link[0]) {
      const applicantId = await applicantForAo(link[0].ao_id);
      if (applicantId) {
        await writeOnboardingActivity(link[0].ao_id, applicantId, req.user?.id ?? null, 'erp_module_status', {
          section: 'erp', meta: { linkId: req.params.linkId, status },
        });
      }
    }
    res.json({ data: { id: req.params.linkId } });
  } catch (err) { next(err); }
});

// Asset allocations
app.post('/api/v1/applicants/:id/onboarding/assets', authRequired, async (req, res, next) => {
  try {
    const aoId = await ensureOnboardingRow(req.params.id);
    const { assetId, notes } = req.body ?? {};
    if (!assetId) return res.status(400).json({ error: { code: 'VALIDATION', message: 'assetId required' } });
    const id = ulid();
    await query(
      'INSERT INTO applicant_asset_allocations (id, ao_id, asset_id, notes) VALUES (?, ?, ?, ?)',
      [id, aoId, assetId, notes || null]
    );
    // Mark asset as allocated
    await query("UPDATE assets SET status = 'allocated' WHERE id = ?", [assetId]);
    await writeOnboardingActivity(aoId, req.params.id, req.user?.id ?? null, 'allocate_asset', {
      section: 'asset', meta: { linkId: id, assetId },
    });
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

app.delete('/api/v1/applicants/onboarding/assets/:linkId', authRequired, async (req, res, next) => {
  try {
    const rows = await query<{ asset_id: string; ao_id: string }>(
      'SELECT asset_id, ao_id FROM applicant_asset_allocations WHERE id = ?',
      [req.params.linkId]
    );
    await query('DELETE FROM applicant_asset_allocations WHERE id = ?', [req.params.linkId]);
    if (rows[0]?.asset_id) {
      await query("UPDATE assets SET status = 'available' WHERE id = ?", [rows[0].asset_id]);
      const applicantId = await applicantForAo(rows[0].ao_id);
      if (applicantId) {
        await writeOnboardingActivity(rows[0].ao_id, applicantId, req.user?.id ?? null, 'return_asset', {
          section: 'asset', meta: { linkId: req.params.linkId, assetId: rows[0].asset_id },
        });
      }
    }
    res.json({ data: { id: req.params.linkId } });
  } catch (err) { next(err); }
});

// Helper: log + write activity for a generic child link (presentations, docs, items, trainings).
async function logChild(
  table: string,
  linkId: string,
  actorUserId: string | null,
  action: string,
  section: string,
  meta?: unknown
): Promise<void> {
  const link = await query<{ ao_id: string }>(`SELECT ao_id FROM ${table} WHERE id = ?`, [linkId]);
  if (!link[0]) return;
  const applicantId = await applicantForAo(link[0].ao_id);
  if (!applicantId) return;
  await writeOnboardingActivity(link[0].ao_id, applicantId, actorUserId, action, { section, meta });
}

// Presentations
app.post('/api/v1/applicants/:id/onboarding/presentations', authRequired, async (req, res, next) => {
  try {
    const aoId = await ensureOnboardingRow(req.params.id);
    const { presentationId } = req.body ?? {};
    if (!presentationId) return res.status(400).json({ error: { code: 'VALIDATION', message: 'presentationId required' } });
    const id = ulid();
    await query('INSERT IGNORE INTO applicant_presentations (id, ao_id, presentation_id) VALUES (?, ?, ?)', [id, aoId, presentationId]);
    await writeOnboardingActivity(aoId, req.params.id, req.user?.id ?? null, 'add_presentation', { section: 'presentation', meta: { linkId: id, presentationId } });
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

app.patch('/api/v1/applicants/onboarding/presentations/:linkId', authRequired, async (req, res, next) => {
  try {
    const { status } = req.body ?? {};
    if (!status) return res.status(400).json({ error: { code: 'VALIDATION', message: 'status required' } });
    await query('UPDATE applicant_presentations SET status = ?, viewed_at = ? WHERE id = ?',
      [status, status === 'done' ? new Date() : null, req.params.linkId]);
    await logChild('applicant_presentations', req.params.linkId, req.user?.id ?? null, 'presentation_status', 'presentation', { linkId: req.params.linkId, status });
    res.json({ data: { id: req.params.linkId } });
  } catch (err) { next(err); }
});

app.delete('/api/v1/applicants/onboarding/presentations/:linkId', authRequired, async (req, res, next) => {
  try {
    await logChild('applicant_presentations', req.params.linkId, req.user?.id ?? null, 'remove_presentation', 'presentation', { linkId: req.params.linkId });
    await query('DELETE FROM applicant_presentations WHERE id = ?', [req.params.linkId]);
    res.json({ data: { id: req.params.linkId } });
  } catch (err) { next(err); }
});

// Documents
app.post('/api/v1/applicants/:id/onboarding/docs', authRequired, async (req, res, next) => {
  try {
    const aoId = await ensureOnboardingRow(req.params.id);
    const { docId } = req.body ?? {};
    if (!docId) return res.status(400).json({ error: { code: 'VALIDATION', message: 'docId required' } });
    const id = ulid();
    await query('INSERT IGNORE INTO applicant_documents (id, ao_id, doc_id) VALUES (?, ?, ?)', [id, aoId, docId]);
    await writeOnboardingActivity(aoId, req.params.id, req.user?.id ?? null, 'add_document', { section: 'doc', meta: { linkId: id, docId } });
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

app.patch('/api/v1/applicants/onboarding/docs/:linkId', authRequired, async (req, res, next) => {
  try {
    const { status, signedUrl } = req.body ?? {};
    const sets: string[] = []; const vals: unknown[] = [];
    if (status !== undefined) { sets.push('status = ?'); vals.push(status); }
    if (status === 'signed') { sets.push('signed_at = ?'); vals.push(new Date()); }
    if (signedUrl !== undefined) { sets.push('signed_url = ?'); vals.push(signedUrl); }
    if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
    vals.push(req.params.linkId);
    await query(`UPDATE applicant_documents SET ${sets.join(', ')} WHERE id = ?`, vals);
    await logChild('applicant_documents', req.params.linkId, req.user?.id ?? null, 'doc_status', 'doc', { linkId: req.params.linkId, status, signedUrl });
    res.json({ data: { id: req.params.linkId } });
  } catch (err) { next(err); }
});

app.delete('/api/v1/applicants/onboarding/docs/:linkId', authRequired, async (req, res, next) => {
  try {
    await logChild('applicant_documents', req.params.linkId, req.user?.id ?? null, 'remove_document', 'doc', { linkId: req.params.linkId });
    await query('DELETE FROM applicant_documents WHERE id = ?', [req.params.linkId]);
    res.json({ data: { id: req.params.linkId } });
  } catch (err) { next(err); }
});

// Onboarding items (programs / tours / activities)
app.post('/api/v1/applicants/:id/onboarding/items', authRequired, async (req, res, next) => {
  try {
    const aoId = await ensureOnboardingRow(req.params.id);
    const { itemId, scheduledAt } = req.body ?? {};
    if (!itemId) return res.status(400).json({ error: { code: 'VALIDATION', message: 'itemId required' } });
    const id = ulid();
    await query('INSERT IGNORE INTO applicant_onboarding_items (id, ao_id, item_id, scheduled_at) VALUES (?, ?, ?, ?)',
      [id, aoId, itemId, scheduledAt || null]);
    await writeOnboardingActivity(aoId, req.params.id, req.user?.id ?? null, 'add_item', { section: 'item', meta: { linkId: id, itemId } });
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

app.patch('/api/v1/applicants/onboarding/items/:linkId', authRequired, async (req, res, next) => {
  try {
    const { status, scheduledAt, notes } = req.body ?? {};
    const sets: string[] = []; const vals: unknown[] = [];
    if (status !== undefined) { sets.push('status = ?'); vals.push(status); }
    if (status === 'done') { sets.push('completed_at = ?'); vals.push(new Date()); }
    if (scheduledAt !== undefined) { sets.push('scheduled_at = ?'); vals.push(scheduledAt || null); }
    if (notes !== undefined) { sets.push('notes = ?'); vals.push(notes || null); }
    if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
    vals.push(req.params.linkId);
    await query(`UPDATE applicant_onboarding_items SET ${sets.join(', ')} WHERE id = ?`, vals);
    await logChild('applicant_onboarding_items', req.params.linkId, req.user?.id ?? null, 'item_status', 'item', { linkId: req.params.linkId, status, scheduledAt });
    res.json({ data: { id: req.params.linkId } });
  } catch (err) { next(err); }
});

app.delete('/api/v1/applicants/onboarding/items/:linkId', authRequired, async (req, res, next) => {
  try {
    await logChild('applicant_onboarding_items', req.params.linkId, req.user?.id ?? null, 'remove_item', 'item', { linkId: req.params.linkId });
    await query('DELETE FROM applicant_onboarding_items WHERE id = ?', [req.params.linkId]);
    res.json({ data: { id: req.params.linkId } });
  } catch (err) { next(err); }
});

// Trainings
app.post('/api/v1/applicants/:id/onboarding/trainings', authRequired, async (req, res, next) => {
  try {
    const aoId = await ensureOnboardingRow(req.params.id);
    const { trainingModuleId, dueAt } = req.body ?? {};
    if (!trainingModuleId) return res.status(400).json({ error: { code: 'VALIDATION', message: 'trainingModuleId required' } });
    const id = ulid();
    await query('INSERT IGNORE INTO applicant_trainings (id, ao_id, training_module_id, due_at) VALUES (?, ?, ?, ?)',
      [id, aoId, trainingModuleId, dueAt || null]);
    await writeOnboardingActivity(aoId, req.params.id, req.user?.id ?? null, 'add_training', { section: 'training', meta: { linkId: id, trainingModuleId } });
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

app.patch('/api/v1/applicants/onboarding/trainings/:linkId', authRequired, async (req, res, next) => {
  try {
    const { status, dueAt, notes } = req.body ?? {};
    const sets: string[] = []; const vals: unknown[] = [];
    if (status !== undefined) {
      sets.push('status = ?'); vals.push(status);
      if (status === 'ongoing') { sets.push('started_at = ?'); vals.push(new Date()); }
      if (status === 'done')    { sets.push('completed_at = ?'); vals.push(new Date()); }
    }
    if (dueAt !== undefined) { sets.push('due_at = ?'); vals.push(dueAt || null); }
    if (notes !== undefined) { sets.push('notes = ?'); vals.push(notes || null); }
    if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
    vals.push(req.params.linkId);
    await query(`UPDATE applicant_trainings SET ${sets.join(', ')} WHERE id = ?`, vals);
    await logChild('applicant_trainings', req.params.linkId, req.user?.id ?? null, 'training_status', 'training', { linkId: req.params.linkId, status });
    res.json({ data: { id: req.params.linkId } });
  } catch (err) { next(err); }
});

app.delete('/api/v1/applicants/onboarding/trainings/:linkId', authRequired, async (req, res, next) => {
  try {
    await logChild('applicant_trainings', req.params.linkId, req.user?.id ?? null, 'remove_training', 'training', { linkId: req.params.linkId });
    await query('DELETE FROM applicant_trainings WHERE id = ?', [req.params.linkId]);
    res.json({ data: { id: req.params.linkId } });
  } catch (err) { next(err); }
});

// Close & Archive — sets onboarding_status='onboarded', stamps closed_at,
// and (when `createEmployee=true` and all required data is available) creates
// the corresponding employees row, links it via promoted_employee_id, and
// flips any allocated assets' current_employee_id.
//
// The frontend Close & Archive button passes gradeId (HR picks one) and an
// optional overrides object; everything else is derived from the onboarding
// header, the offer, and the applicant record.
app.post('/api/v1/applicants/:id/onboarding/close', authRequired, async (req, res, next) => {
  try {
    const aoId = await ensureOnboardingRow(req.params.id);
    const body = req.body ?? {};
    const createEmployee = body.createEmployee !== false; // default true
    const gradeId = typeof body.gradeId === 'string' && body.gradeId ? body.gradeId : null;

    // Pull everything we need for promotion in one shot.
    // We also pull data for the Info-tab columns so the new employee lands
    // fully populated instead of forcing HR to retype known data.
    const ctx = await query<{
      ao_id: string; promoted_employee_id: string | null;
      branch_id: string | null; department_id: string | null;
      designation_id: string | null; designation_name: string | null;
      designation_division_id: string | null;
      ao_division_id: string | null;
      branch_company_id: string | null;
      dob: string | null; blood_group: string | null;
      biometric_mapped_at: string | null;
      email_assigned: string | null; phone_assigned: string | null;
      assigned_phone_pool_id: string | null;
      full_name: string; applicant_email: string; applicant_phone: string | null;
      applicant_image_url: string | null;
      offer_ctc: string | null; offer_joining: string | null; offer_designation: string | null;
      jp_designation: string | null;
      job_profile_id: string | null;
      // Phase 2.G — onboarding-captured personal fields.
      gender: string | null; marital_status: string | null;
      nationality: string | null; religion: string | null;
      languages_known: unknown;
      caste_category: string | null;
      alternate_phone: string | null; alternate_phone_country_code: string | null;
      probation_from: string | null; probation_to: string | null;
      employment_type: string | null; work_mode: string | null;
      present_address: unknown; permanent_address: unknown;
      ao_pan: string | null; ao_aadhaar: string | null;
    }>(
      `SELECT ao.id AS ao_id, ao.promoted_employee_id,
              ao.branch_id, ao.department_id, ao.designation_id,
              d.name AS designation_name,
              d.division_id AS designation_division_id,
              ao.division_id AS ao_division_id,
              b.company_id AS branch_company_id,
              ao.dob, ao.blood_group, ao.biometric_mapped_at,
              ao.email_assigned, ao.phone_assigned,
              pn.id AS assigned_phone_pool_id,
              a.full_name, a.email AS applicant_email, a.phone AS applicant_phone,
              a.image_url AS applicant_image_url,
              o.ctc AS offer_ctc, o.joining_date AS offer_joining, o.designation AS offer_designation,
              COALESCE(jljp.designation, vjp.designation) AS jp_designation,
              COALESCE(jljp.id, vjp.id) AS job_profile_id,
              ao.gender, ao.marital_status, ao.nationality, ao.religion,
              ao.languages_known, ao.caste_category,
              ao.alternate_phone, ao.alternate_phone_country_code,
              ao.probation_from, ao.probation_to,
              ao.employment_type, ao.work_mode,
              ao.present_address, ao.permanent_address,
              ao.pan AS ao_pan, ao.aadhaar AS ao_aadhaar
       FROM applicant_onboarding ao
       JOIN applicants a ON a.id = ao.applicant_id
       LEFT JOIN designations d ON d.id = ao.designation_id
       LEFT JOIN applicant_offers o ON o.applicant_id = ao.applicant_id
       LEFT JOIN vacancies v ON v.id = a.vacancy_id
       LEFT JOIN job_profiles vjp ON vjp.id = v.job_profile_id
       LEFT JOIN job_listings jl ON jl.id = a.job_listing_id
       LEFT JOIN job_profiles jljp ON jljp.id = jl.job_profile_id
       LEFT JOIN branches b ON b.id = ao.branch_id
       LEFT JOIN phone_number_pool pn ON pn.number = ao.phone_assigned
       WHERE ao.id = ?`,
      [aoId]
    );
    const row = ctx[0];

    let employeeId: string | null = row?.promoted_employee_id ?? null;
    let employeeCode: string | null = null;
    let warning: string | null = null;

    if (createEmployee && !employeeId && row) {
      // Validate required employees columns: branch_id, department_id, grade_id,
      // joining_date, ctc, designation, first_name, last_name, email, phone.
      const designation = row.offer_designation || row.designation_name || row.jp_designation;
      const joiningDate = row.offer_joining;
      const ctc = row.offer_ctc != null ? Number(row.offer_ctc) : null;
      const email = row.email_assigned || row.applicant_email;
      const phone = row.phone_assigned || row.applicant_phone;

      // Proper first / middle / last split. "Rohan K. Patel" → first=Rohan,
      // middle=K., last=Patel. "Rohan Patel" → first=Rohan, last=Patel.
      const parts = (row.full_name || '').trim().split(/\s+/).filter(Boolean);
      const first = parts[0] || '';
      const last  = parts.length >= 2 ? parts[parts.length - 1] : first;
      const middle = parts.length >= 3 ? parts.slice(1, -1).join(' ') : null;
      const displayName = (row.full_name || '').trim() || null;

      // Division: prefer the explicit ao.division_id, else derive from
      // the chosen designation's division.
      const divisionId = row.ao_division_id || row.designation_division_id || null;
      const companyId  = row.branch_company_id || null;

      const missing: string[] = [];
      if (!row.branch_id)     missing.push('branch');
      if (!row.department_id) missing.push('department');
      if (!gradeId)           missing.push('gradeId');
      if (!designation)       missing.push('designation');
      if (!joiningDate)       missing.push('joining_date (offer)');
      if (ctc == null)        missing.push('ctc (offer)');
      if (!email)             missing.push('email');
      if (!phone)             missing.push('phone');
      if (!first)             missing.push('first_name');

      // Pre-flight: employees.email is UNIQUE. If the email we're about to
      // use already exists on another employee, INSERT will throw mid-flow
      // and leave the onboarding marked archived with no employee created.
      // Catching it here lets us return a clear, actionable warning instead.
      let conflictMsg: string | null = null;
      if (!missing.length && email) {
        const dup = await query<{ id: string; code: string }>(
          'SELECT id, code FROM employees WHERE email = ? LIMIT 1',
          [email]
        );
        if (dup[0]) {
          conflictMsg = `Email "${email}" is already used by employee ${dup[0].code}. Assign a different Official Email in the Email & Phone section (or relieve the existing employee first) before closing.`;
        }
      }

      if (missing.length) {
        warning = `Employee row not created — missing: ${missing.join(', ')}. Onboarding closed without promotion.`;
      } else if (conflictMsg) {
        warning = conflictMsg;
      } else {
        employeeId = ulid();
        // Match the manual-create format so the Employee Master list shows
        // a consistent CK-EMP-NNNN scheme regardless of which path created
        // the row. The MAX(...) lookup uses SUBSTRING(code, 8) to read the
        // numeric tail of existing codes (also handles legacy EMP123456).
        const [emaxRow] = await query<{ n: number | string | null }>(
          "SELECT COALESCE(MAX(CAST(SUBSTRING(code, 8) AS UNSIGNED)), 0) AS n FROM employees WHERE code LIKE 'CK-EMP-%'"
        );
        employeeCode = `CK-EMP-${String(Number(emaxRow?.n ?? 0) + 1).padStart(4, '0')}`;
        try {
          // JSON columns come back from mysql2 either as parsed objects (newer
          // driver) or as strings — normalise to a serialised string for INSERT
          // so the column actually accepts the value.
          const toJsonParam = (v: unknown): string | null => {
            if (v == null) return null;
            return typeof v === 'string' ? v : JSON.stringify(v);
          };
          await query(
            `INSERT INTO employees
               (id, code, first_name, middle_name, last_name, display_name,
                designation, status, joining_date, email, phone,
                personal_phone_country_code, personal_email,
                branch_id, company_id, department_id, division_id, grade_id, ctc,
                job_profile_id,
                dob, blood_group, photo_url,
                office_contact_phone_id,
                biometric_mapped,
                gender, marital_status, nationality, religion,
                languages_known, caste_category,
                alternate_phone, alternate_phone_country_code,
                probation_from, probation_to,
                present_address, permanent_address,
                pan, aadhaar,
                employment_type, work_mode)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PROBATION', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              employeeId, employeeCode,
              first, middle, last, displayName,
              designation!, joiningDate, email, phone,
              '+91', row.applicant_email || null,
              row.branch_id, companyId, row.department_id, divisionId, gradeId,
              Math.round((ctc as number) * 100),
              row.job_profile_id,
              row.dob, row.blood_group, row.applicant_image_url,
              row.assigned_phone_pool_id,
              row.biometric_mapped_at ? 1 : 0,
              row.gender, row.marital_status, row.nationality, row.religion,
              toJsonParam(row.languages_known), row.caste_category,
              row.alternate_phone, row.alternate_phone_country_code,
              row.probation_from, row.probation_to,
              toJsonParam(row.present_address), toJsonParam(row.permanent_address),
              row.ao_pan, row.ao_aadhaar,
              row.employment_type || 'Permanent', row.work_mode || 'Onsite',
            ]
          );
          // Re-point any onboarding-allocated assets to the new employee.
          await query(
            `UPDATE assets a
                JOIN applicant_asset_allocations aaa ON aaa.asset_id = a.id
                SET a.current_employee_id = ?
              WHERE aaa.ao_id = ?`,
            [employeeId, aoId]
          );
          // Re-point any onboarding-assigned phone number to the new employee.
          if (row.phone_assigned) {
            await query(
              "UPDATE phone_number_pool SET assigned_employee_id = ?, status = 'assigned' WHERE number = ?",
              [employeeId, row.phone_assigned]
            );
          }
          // Copy onboarding-captured emergency contacts and dependents to the
          // employee's own tables. Each gets a fresh ULID; ao_id is replaced
          // with the new employee_id. We delete-then-insert in case a previous
          // promotion attempt left stale rows.
          await query('DELETE FROM employee_emergency_contacts WHERE employee_id = ?', [employeeId]);
          const aec = await query<{
            name: string; relation: string | null; phone: string | null;
            phone_country_code: string | null; address: string | null; sort_order: number;
          }>('SELECT name, relation, phone, phone_country_code, address, sort_order FROM applicant_emergency_contacts WHERE ao_id = ? ORDER BY sort_order, created_at', [aoId]);
          for (const r of aec) {
            await query(
              `INSERT INTO employee_emergency_contacts (id, employee_id, name, relation, phone, phone_country_code, address, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [ulid(), employeeId, r.name, r.relation, r.phone, r.phone_country_code, r.address, r.sort_order]
            );
          }
          await query('DELETE FROM employee_dependents WHERE employee_id = ?', [employeeId]);
          const adep = await query<{
            relation: string; name: string; phone: string | null;
            phone_country_code: string | null; email: string | null;
            dob: string | null; sort_order: number;
          }>('SELECT relation, name, phone, phone_country_code, email, dob, sort_order FROM applicant_dependents WHERE ao_id = ? ORDER BY sort_order, created_at', [aoId]);
          for (const r of adep) {
            await query(
              `INSERT INTO employee_dependents (id, employee_id, relation, name, phone, phone_country_code, email, dob, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [ulid(), employeeId, r.relation, r.name, r.phone, r.phone_country_code, r.email, r.dob, r.sort_order]
            );
          }
        } catch (e) {
          console.error('[onboarding-close] employee creation failed', e);
          employeeId = null;
          employeeCode = null;
          warning = 'Employee row creation failed (see server logs). Onboarding closed without promotion.';
        }
      }
    }

    // Only mark the onboarding 'onboarded' when:
    //   - HR opted out of employee creation (createEmployee=false), OR
    //   - we successfully created (or already had) an employee row.
    // If createEmployee was on but creation failed (warning set), leave the
    // onboarding in its current state so HR can fix the issue and retry.
    const archiveNow = !createEmployee || !!employeeId;
    if (archiveNow) {
      await query(
        "UPDATE applicant_onboarding SET status = 'onboarded', closed_at = ?, promoted_employee_id = COALESCE(?, promoted_employee_id) WHERE id = ?",
        [new Date(), employeeId, aoId]
      );
    }

    await writeOnboardingActivity(aoId, req.params.id, req.user?.id ?? null, 'close_and_archive', {
      section: 'close', meta: { employeeId, employeeCode, warning },
    });

    res.json({ data: { id: aoId, status: 'onboarded', employeeId, employeeCode, warning } });
  } catch (err) { next(err); }
});

// Activities feed for the onboarding detail page.
app.get('/api/v1/applicants/:id/onboarding/activities', authRequired, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT a.*, CONCAT_WS(' ', e.first_name, e.last_name) AS actor_name, u.email AS actor_email
       FROM onboarding_activities a
       LEFT JOIN users u ON u.id = a.actor_user_id
       LEFT JOIN employees e ON e.id = u.employee_id
       WHERE a.applicant_id = ?
       ORDER BY a.created_at DESC
       LIMIT 500`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// ─── APPLICANTS ──────────────────────────────────────────────────────────────

app.get('/api/v1/vacancies/:id/applicants', authRequired, async (req, res, next) => {
  try {
    const stage = typeof req.query.stage === 'string' ? req.query.stage : undefined;
    const where = stage ? 'WHERE a.vacancy_id = ? AND a.stage = ?' : 'WHERE a.vacancy_id = ?';
    const params = stage ? [req.params.id, stage] : [req.params.id];
    const rows = await query(
      `SELECT a.id, a.full_name, a.email, a.phone, a.current_company,
              a.experience_years, a.notes, a.stage, a.applied_at, a.updated_at
       FROM applicants a ${where} ORDER BY a.applied_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

app.get('/api/v1/applicants/:id', authRequired, async (req, res, next) => {
  try {
    // Applicants come from either the legacy vacancy flow or the newer
    // job-listing flow. LEFT JOIN both and COALESCE so either source
    // resolves a branch / job profile / company.
    const rows = await query<Record<string, unknown>>(
      `SELECT a.*,
              COALESCE(v.positions, jl.positions) AS positions,
              COALESCE(v.filled, jl.filled)       AS filled,
              COALESCE(vjp.title, jljp.title)         AS job_title,
              COALESCE(vjp.designation, jljp.designation) AS designation,
              COALESCE(vb.name, jlb.name)             AS branch_name,
              COALESCE(vb.city, jlb.city)             AS branch_city,
              loc.name AS location_name,
              COALESCE(v.company_name, jl.company_name) AS company_name
       FROM applicants a
       LEFT JOIN vacancies     v    ON v.id   = a.vacancy_id
       LEFT JOIN branches      vb   ON vb.id  = v.branch_id
       LEFT JOIN job_profiles  vjp  ON vjp.id = v.job_profile_id
       LEFT JOIN job_listings  jl   ON jl.id  = a.job_listing_id
       LEFT JOIN branches      jlb  ON jlb.id = jl.branch_id
       LEFT JOIN locations     loc  ON loc.id = jl.location_id
       LEFT JOIN job_profiles  jljp ON jljp.id = jl.job_profile_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Applicant not found' } });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

app.post('/api/v1/vacancies/:id/applicants', authRequired, async (req, res, next) => {
  try {
    const { fullName, email, phone, currentCompany, experienceYears, notes } = req.body ?? {};
    if (!fullName || !email) return res.status(400).json({ error: { code: 'VALIDATION', message: 'fullName and email required' } });
    const id = ulid();
    await query(
      `INSERT INTO applicants (id, vacancy_id, full_name, email, phone, current_company, experience_years, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.id, fullName, email, phone || null, currentCompany || null, experienceYears || null, notes || null]
    );
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

app.patch('/api/v1/applicants/:id', authRequired, async (req, res, next) => {
  try {
    const { stage, notes, fullName, email, phone, currentCompany, experienceYears } = req.body ?? {};
    const VALID_STAGES = new Set(['applied','screening','interview','offer','hired','rejected']);
    const sets: string[] = []; const vals: unknown[] = [];
    if (stage && VALID_STAGES.has(stage)) { sets.push('stage = ?'); vals.push(stage); }
    if (notes !== undefined)               { sets.push('notes = ?'); vals.push(notes); }
    if (fullName)                          { sets.push('full_name = ?'); vals.push(fullName); }
    if (email)                             { sets.push('email = ?'); vals.push(email); }
    if (phone !== undefined)               { sets.push('phone = ?'); vals.push(phone); }
    if (currentCompany !== undefined)      { sets.push('current_company = ?'); vals.push(currentCompany); }
    if (experienceYears !== undefined)     { sets.push('experience_years = ?'); vals.push(experienceYears); }
    if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
    vals.push(req.params.id);
    await query(`UPDATE applicants SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/:id/hire', authRequired, async (req, res, next) => {
  try {
    await query("UPDATE applicants SET stage = 'hired', status = 'Hired' WHERE id = ?", [req.params.id]);
    const rows = await query<{ vacancy_id: string | null; job_listing_id: string | null }>(
      'SELECT vacancy_id, job_listing_id FROM applicants WHERE id = ?',
      [req.params.id]
    );
    const row = rows[0];
    if (row?.vacancy_id) {
      await query('UPDATE vacancies SET filled = filled + 1 WHERE id = ?', [row.vacancy_id]);
      await query("UPDATE vacancies SET status = 'filled' WHERE id = ? AND filled >= positions", [row.vacancy_id]);
    }
    if (row?.job_listing_id) {
      await query('UPDATE job_listings SET filled = filled + 1 WHERE id = ?', [row.job_listing_id]);
    }
    await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'hire', {
      toStage: 'hired', toStatus: 'Hired',
    });
    res.json({ data: { id: req.params.id, stage: 'hired' } });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/:id/reject', authRequired, async (req, res, next) => {
  try {
    await query("UPDATE applicants SET stage = 'rejected', status = 'Rejected' WHERE id = ?", [req.params.id]);
    await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'reject', { toStage: 'rejected', toStatus: 'Rejected' });
    res.json({ data: { id: req.params.id, stage: 'rejected' } });
  } catch (err) { next(err); }
});

// ─── HIRING FUNNEL — per-applicant screening / interview / offer / activity ──

// Audit log helper. Best-effort — failure to log should not break the action.
async function writeApplicantActivity(
  applicantId: string,
  actorUserId: string | null,
  action: string,
  opts: {
    fromStage?: string | null; toStage?: string | null;
    fromStatus?: string | null; toStatus?: string | null;
    message?: string | null; meta?: unknown;
  } = {}
): Promise<void> {
  try {
    const listingRows = await query<{ job_listing_id: string | null }>(
      'SELECT job_listing_id FROM applicants WHERE id = ?', [applicantId]
    );
    const listingId = listingRows[0]?.job_listing_id ?? null;
    await query(
      `INSERT INTO applicant_activities
         (id, applicant_id, job_listing_id, actor_user_id, action,
          from_stage, to_stage, from_status, to_status, message, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ulid(), applicantId, listingId, actorUserId, action,
        opts.fromStage ?? null, opts.toStage ?? null,
        opts.fromStatus ?? null, opts.toStatus ?? null,
        opts.message ?? null,
        opts.meta != null ? JSON.stringify(opts.meta) : null,
      ]
    );
  } catch (e) {
    console.error('[activity] failed to log', action, e);
  }
}

async function getApplicantStageStatus(id: string): Promise<{ stage: string | null; status: string | null }> {
  const rows = await query<{ stage: string | null; status: string | null }>(
    'SELECT stage, status FROM applicants WHERE id = ?', [id]
  );
  return rows[0] ?? { stage: null, status: null };
}

// ── Screening ───────────────────────────────────────────────────────────────
app.get('/api/v1/applicants/:id/screening', authRequired, async (req, res, next) => {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT s.*, t.name AS template_name
       FROM applicant_screenings s
       LEFT JOIN screening_templates t ON t.id = s.template_id
       WHERE s.applicant_id = ?`,
      [req.params.id]
    );
    res.json({ data: rows[0] ?? null });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/:id/screening', authRequired, async (req, res, next) => {
  try {
    const { templateId, responses, score, result, notes } = req.body ?? {};
    const responsesJson = responses == null ? null : typeof responses === 'string' ? responses : JSON.stringify(responses);
    const existing = await query<{ id: string }>('SELECT id FROM applicant_screenings WHERE applicant_id = ?', [req.params.id]);
    const now = new Date();
    if (existing[0]) {
      await query(
        `UPDATE applicant_screenings
            SET template_id = ?, responses_json = ?, score = ?, result = ?, notes = ?,
                screened_at = ?, screened_by_user_id = ?
          WHERE id = ?`,
        [templateId || null, responsesJson, score ?? null, result || null, notes || null,
         now, req.user?.id ?? null, existing[0].id]
      );
    } else {
      await query(
        `INSERT INTO applicant_screenings
           (id, applicant_id, template_id, responses_json, score, result, notes, screened_at, screened_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ulid(), req.params.id, templateId || null, responsesJson, score ?? null, result || null, notes || null,
         now, req.user?.id ?? null]
      );
    }
    const prev = await getApplicantStageStatus(req.params.id);
    await query(
      "UPDATE applicants SET stage = 'screening', status = 'Screening', screen_score = COALESCE(?, screen_score) WHERE id = ?",
      [score ?? null, req.params.id]
    );
    await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'screen', {
      fromStage: prev.stage, toStage: 'screening',
      fromStatus: prev.status, toStatus: 'Screening',
      meta: { score, result, templateId },
    });
    res.json({ data: { id: req.params.id, stage: 'screening', status: 'Screening' } });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/:id/approve-interview', authRequired, async (req, res, next) => {
  try {
    const prev = await getApplicantStageStatus(req.params.id);
    await query("UPDATE applicants SET stage = 'interview', status = 'Interview Approved' WHERE id = ?", [req.params.id]);
    await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'approve_interview', {
      fromStage: prev.stage, toStage: 'interview',
      fromStatus: prev.status, toStatus: 'Interview Approved',
    });
    res.json({ data: { id: req.params.id, stage: 'interview' } });
  } catch (err) { next(err); }
});

// ── Interviews ──────────────────────────────────────────────────────────────
app.get('/api/v1/applicants/:id/interviews', authRequired, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT i.*, t.title AS template_title, t.fields_json AS template_fields,
              CONCAT_WS(' ', e.first_name, e.last_name) AS interviewer_name,
              u.email AS interviewer_email
       FROM applicant_interviews i
       LEFT JOIN interview_templates t ON t.id = i.template_id
       LEFT JOIN users u ON u.id = i.interviewer_user_id
       LEFT JOIN employees e ON e.id = u.employee_id
       WHERE i.applicant_id = ?
       ORDER BY i.round_no, i.scheduled_at`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/:id/interviews', authRequired, async (req, res, next) => {
  try {
    const { templateId, mode, scheduledAt, durationMinutes, interviewerUserId, meetingUrl, roundNo, notes } = req.body ?? {};
    const id = ulid();
    let resolvedRound = Number(roundNo);
    if (!resolvedRound) {
      const max = await query<{ n: number | string | null }>('SELECT COALESCE(MAX(round_no), 0) AS n FROM applicant_interviews WHERE applicant_id = ?', [req.params.id]);
      resolvedRound = Number(max[0]?.n ?? 0) + 1;
    }
    await query(
      `INSERT INTO applicant_interviews
         (id, applicant_id, round_no, template_id, mode, scheduled_at, duration_minutes,
          interviewer_user_id, meeting_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.id, resolvedRound, templateId || null, mode || null,
       scheduledAt || null, durationMinutes != null && durationMinutes !== '' ? Number(durationMinutes) : null,
       interviewerUserId || null, meetingUrl || null, notes || null]
    );
    const prev = await getApplicantStageStatus(req.params.id);
    await query("UPDATE applicants SET stage = 'interview', status = 'Interview Scheduled' WHERE id = ?", [req.params.id]);
    await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'schedule_interview', {
      fromStage: prev.stage, toStage: 'interview',
      fromStatus: prev.status, toStatus: 'Interview Scheduled',
      meta: { roundNo: resolvedRound, mode, scheduledAt, interviewerUserId },
    });
    res.status(201).json({ data: { id, round_no: resolvedRound } });
  } catch (err) { next(err); }
});

app.patch('/api/v1/applicants/interviews/:interviewId', authRequired, async (req, res, next) => {
  try {
    const body = { ...(req.body ?? {}) } as Record<string, unknown>;
    if (body.responses !== undefined && body.responses !== null && typeof body.responses !== 'string') {
      body.responsesJson = JSON.stringify(body.responses);
      delete body.responses;
    }
    const map: Array<[string, string]> = [
      ['mode', 'mode'], ['scheduledAt', 'scheduled_at'], ['durationMinutes', 'duration_minutes'],
      ['interviewerUserId', 'interviewer_user_id'], ['meetingUrl', 'meeting_url'],
      ['recordingUrl', 'recording_url'], ['responsesJson', 'responses_json'],
      ['score', 'score'], ['result', 'result'], ['notes', 'notes'],
    ];
    const sets: string[] = []; const vals: unknown[] = [];
    for (const [k, c] of map) {
      if (body[k] !== undefined) { sets.push(`${c} = ?`); vals.push(body[k] === '' ? null : body[k]); }
    }
    if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No fields' } });
    vals.push(req.params.interviewId);
    await query(`UPDATE applicant_interviews SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ data: { id: req.params.interviewId } });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/interviews/:interviewId/share', authRequired, async (req, res, next) => {
  try {
    await query('UPDATE applicant_interviews SET shared_at = ? WHERE id = ?', [new Date(), req.params.interviewId]);
    const rows = await query<{ applicant_id: string }>('SELECT applicant_id FROM applicant_interviews WHERE id = ?', [req.params.interviewId]);
    if (rows[0]) {
      await writeApplicantActivity(rows[0].applicant_id, req.user?.id ?? null, 'share_schedule', { meta: { interviewId: req.params.interviewId } });
    }
    res.json({ data: { id: req.params.interviewId } });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/interviews/:interviewId/start', authRequired, async (req, res, next) => {
  try {
    await query('UPDATE applicant_interviews SET started_at = ? WHERE id = ?', [new Date(), req.params.interviewId]);
    const rows = await query<{ applicant_id: string }>('SELECT applicant_id FROM applicant_interviews WHERE id = ?', [req.params.interviewId]);
    if (rows[0]) {
      await writeApplicantActivity(rows[0].applicant_id, req.user?.id ?? null, 'start_interview', { meta: { interviewId: req.params.interviewId } });
    }
    res.json({ data: { id: req.params.interviewId } });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/interviews/:interviewId/complete', authRequired, async (req, res, next) => {
  try {
    const { responses, score, result, notes } = req.body ?? {};
    const responsesJson = responses == null ? null : typeof responses === 'string' ? responses : JSON.stringify(responses);
    await query(
      `UPDATE applicant_interviews
          SET responses_json = ?, score = ?, result = ?, notes = COALESCE(?, notes),
              completed_at = ?
        WHERE id = ?`,
      [responsesJson, score ?? null, result || null, notes ?? null, new Date(), req.params.interviewId]
    );
    const rows = await query<{ applicant_id: string }>('SELECT applicant_id FROM applicant_interviews WHERE id = ?', [req.params.interviewId]);
    if (rows[0]) {
      if (score != null) {
        await query('UPDATE applicants SET interview_score = ? WHERE id = ?', [Number(score), rows[0].applicant_id]);
      }
      await writeApplicantActivity(rows[0].applicant_id, req.user?.id ?? null, 'complete_interview', { meta: { interviewId: req.params.interviewId, score, result } });
    }
    res.json({ data: { id: req.params.interviewId } });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/:id/no-show', authRequired, async (req, res, next) => {
  try {
    const prev = await getApplicantStageStatus(req.params.id);
    await query("UPDATE applicants SET status = 'No Show' WHERE id = ?", [req.params.id]);
    await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'no_show', {
      fromStage: prev.stage, toStage: prev.stage, fromStatus: prev.status, toStatus: 'No Show',
    });
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/:id/hold', authRequired, async (req, res, next) => {
  try {
    const prev = await getApplicantStageStatus(req.params.id);
    await query("UPDATE applicants SET status = 'On Hold' WHERE id = ?", [req.params.id]);
    await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'hold', {
      fromStage: prev.stage, toStage: prev.stage, fromStatus: prev.status, toStatus: 'On Hold',
    });
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

// ── Offers ──────────────────────────────────────────────────────────────────
app.get('/api/v1/applicants/:id/offer', authRequired, async (req, res, next) => {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT o.*, t.name AS template_name, t.body_md AS template_body
       FROM applicant_offers o
       LEFT JOIN offer_templates t ON t.id = o.template_id
       WHERE o.applicant_id = ?`,
      [req.params.id]
    );
    res.json({ data: rows[0] ?? null });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/:id/offer', authRequired, async (req, res, next) => {
  try {
    const { templateId, draftBody, ctc, ctcCurrency, joiningDate, designation, notes } = req.body ?? {};
    const existing = await query<{ id: string }>('SELECT id FROM applicant_offers WHERE applicant_id = ?', [req.params.id]);
    const now = new Date();
    if (existing[0]) {
      await query(
        `UPDATE applicant_offers
            SET template_id = ?, draft_body = ?, ctc = ?, ctc_currency = ?, joining_date = ?,
                designation = ?, notes = ?, drafted_at = ?, status = COALESCE(status, 'Draft')
          WHERE id = ?`,
        [templateId || null, draftBody || null,
         ctc != null && ctc !== '' ? Number(ctc) : null, ctcCurrency || null,
         joiningDate || null, designation || null, notes || null, now, existing[0].id]
      );
    } else {
      await query(
        `INSERT INTO applicant_offers
           (id, applicant_id, template_id, draft_body, ctc, ctc_currency, joining_date,
            designation, notes, status, drafted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)`,
        [ulid(), req.params.id, templateId || null, draftBody || null,
         ctc != null && ctc !== '' ? Number(ctc) : null, ctcCurrency || null,
         joiningDate || null, designation || null, notes || null, now]
      );
    }
    const prev = await getApplicantStageStatus(req.params.id);
    await query("UPDATE applicants SET stage = 'offer', status = COALESCE(status, 'Offer Sent') WHERE id = ?", [req.params.id]);
    await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'draft_offer', {
      fromStage: prev.stage, toStage: 'offer',
      fromStatus: prev.status,
      meta: { templateId, ctc, joiningDate, designation },
    });
    res.json({ data: { id: req.params.id, stage: 'offer' } });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/:id/offer/share', authRequired, async (req, res, next) => {
  try {
    const now = new Date();
    await query(
      "UPDATE applicant_offers SET status = 'Sent', sent_at = COALESCE(sent_at, ?), shared_at = ? WHERE applicant_id = ?",
      [now, now, req.params.id]
    );
    const prev = await getApplicantStageStatus(req.params.id);
    await query("UPDATE applicants SET stage = 'offer', status = 'Offer Sent' WHERE id = ?", [req.params.id]);
    await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'share_offer', {
      fromStage: prev.stage, toStage: 'offer',
      fromStatus: prev.status, toStatus: 'Offer Sent',
    });
    res.json({ data: { id: req.params.id, status: 'Offer Sent' } });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/:id/offer/accept', authRequired, async (req, res, next) => {
  try {
    await query("UPDATE applicant_offers SET status = 'Accepted', accepted_at = ? WHERE applicant_id = ?", [new Date(), req.params.id]);
    const prev = await getApplicantStageStatus(req.params.id);
    await query("UPDATE applicants SET status = 'Offer Accepted' WHERE id = ?", [req.params.id]);
    await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'accept_offer', {
      fromStage: prev.stage, fromStatus: prev.status, toStatus: 'Offer Accepted',
    });
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

app.post('/api/v1/applicants/:id/offer/decline', authRequired, async (req, res, next) => {
  try {
    await query("UPDATE applicant_offers SET status = 'Declined', declined_at = ? WHERE applicant_id = ?", [new Date(), req.params.id]);
    const prev = await getApplicantStageStatus(req.params.id);
    await query("UPDATE applicants SET status = 'Offer Declined' WHERE id = ?", [req.params.id]);
    await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'decline_offer', {
      fromStage: prev.stage, fromStatus: prev.status, toStatus: 'Offer Declined',
    });
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

// Seed an applicant's onboarding children from the Job Profile it was hired
// against: the Induction template (presentations + docs), the Onboarding
// template (programs/tours/activities) and the Training modules. Called once,
// when the applicant_onboarding shell is first created.
async function seedOnboardingFromJobProfile(applicantId: string, aoId: string): Promise<void> {
  // Idempotent: if this onboarding already has any seeded children, do nothing.
  const seeded = await query<{ n: number | string }>(
    `SELECT
        (SELECT COUNT(*) FROM applicant_presentations    WHERE ao_id = ?) +
        (SELECT COUNT(*) FROM applicant_documents         WHERE ao_id = ?) +
        (SELECT COUNT(*) FROM applicant_onboarding_items  WHERE ao_id = ?) +
        (SELECT COUNT(*) FROM applicant_trainings          WHERE ao_id = ?) AS n`,
    [aoId, aoId, aoId, aoId]
  );
  if (Number(seeded[0]?.n ?? 0) > 0) return;

  const jpRows = await query<{ form_data: unknown }>(
    `SELECT jp.form_data
     FROM applicants a
     JOIN job_listings jl ON jl.id = a.job_listing_id
     JOIN job_profiles jp ON jp.id = jl.job_profile_id
     WHERE a.id = ?`,
    [applicantId]
  );
  const raw = jpRows[0]?.form_data;
  if (raw == null) return;
  let fd: Record<string, unknown>;
  try { fd = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>); }
  catch { return; }

  const inductionTemplateId  = typeof fd.inductionTemplateId === 'string' ? fd.inductionTemplateId : '';
  const onboardingTemplateId = typeof fd.onboardingTemplateId === 'string' ? fd.onboardingTemplateId : '';
  const trainingModules = Array.isArray(fd.trainingModules) ? fd.trainingModules : [];

  if (inductionTemplateId) {
    const items = await query<{ ref_kind: string; ref_id: string }>(
      'SELECT ref_kind, ref_id FROM induction_template_items WHERE template_id = ? ORDER BY sort_order',
      [inductionTemplateId]
    );
    for (const it of items) {
      if (it.ref_kind === 'presentation') {
        await query("INSERT INTO applicant_presentations (id, ao_id, presentation_id, status) VALUES (?, ?, ?, 'pending')", [ulid(), aoId, it.ref_id]);
      } else if (it.ref_kind === 'doc') {
        await query("INSERT INTO applicant_documents (id, ao_id, doc_id, status) VALUES (?, ?, ?, 'pending')", [ulid(), aoId, it.ref_id]);
      }
    }
  }

  if (onboardingTemplateId) {
    const items = await query<{ item_id: string }>(
      'SELECT item_id FROM onboarding_template_items WHERE template_id = ? ORDER BY sort_order',
      [onboardingTemplateId]
    );
    for (const it of items) {
      await query("INSERT INTO applicant_onboarding_items (id, ao_id, item_id, status) VALUES (?, ?, ?, 'pending')", [ulid(), aoId, it.item_id]);
    }
  }

  for (const tm of trainingModules) {
    const tmId = tm && typeof tm === 'object' && typeof (tm as Record<string, unknown>).id === 'string'
      ? (tm as Record<string, unknown>).id as string : '';
    if (tmId) {
      await query("INSERT INTO applicant_trainings (id, ao_id, training_module_id, status) VALUES (?, ?, ?, 'pending')", [ulid(), aoId, tmId]);
    }
  }
}

// ── Onboard (handoff from Hire tab into existing applicant_onboarding flow) ──
app.post('/api/v1/applicants/:id/onboard', authRequired, async (req, res, next) => {
  try {
    const existing = await query<{ id: string }>('SELECT id FROM applicant_onboarding WHERE applicant_id = ?', [req.params.id]);
    let aoId = existing[0]?.id ?? '';
    // Pull context to pre-fill the onboarding header. Best-effort: any field
    // that can't be resolved is left null and HR fills it in the detail page.
    const ctx = await query<{
      branch_id: string | null; location_id: string | null; department_id: string | null;
      division_name: string | null; designation_name: string | null; email: string; phone: string | null;
    }>(
      `SELECT jl.branch_id, jl.location_id, jp.department_id, jp.division AS division_name,
              COALESCE(o.designation, jp.designation) AS designation_name,
              a.email, a.phone
       FROM applicants a
       LEFT JOIN job_listings jl ON jl.id = a.job_listing_id
       LEFT JOIN job_profiles jp ON jp.id = jl.job_profile_id
       LEFT JOIN applicant_offers o ON o.applicant_id = a.id
       WHERE a.id = ?`,
      [req.params.id]
    );
    const c = ctx[0] ?? null;
    let designationId: string | null = null;
    if (c?.designation_name) {
      const d = await query<{ id: string }>('SELECT id FROM designations WHERE name = ? LIMIT 1', [c.designation_name]);
      designationId = d[0]?.id ?? null;
    }
    let divisionId: string | null = null;
    if (c?.division_name) {
      const dv = await query<{ id: string }>('SELECT id FROM divisions WHERE name = ? LIMIT 1', [c.division_name]);
      divisionId = dv[0]?.id ?? null;
    }

    if (!aoId) {
      aoId = ulid();
      await query(
        `INSERT INTO applicant_onboarding
           (id, applicant_id, status, branch_id, location_id, division_id, department_id, designation_id, phone_assigned)
         VALUES (?, ?, 'onboarding', ?, ?, ?, ?, ?, ?)`,
        [aoId, req.params.id,
         c?.branch_id ?? null, c?.location_id ?? null, divisionId, c?.department_id ?? null,
         designationId, c?.phone ?? null]
      );
      // Seed presentations / documents / programs-tours-activities / trainings
      // from the templates & training modules defined on the linked Job Profile.
      await seedOnboardingFromJobProfile(req.params.id, aoId);
    } else {
      // Only pre-fill columns that are still NULL on the existing row.
      await query(
        `UPDATE applicant_onboarding
            SET status = 'onboarding',
                branch_id      = COALESCE(branch_id, ?),
                location_id    = COALESCE(location_id, ?),
                division_id    = COALESCE(division_id, ?),
                department_id  = COALESCE(department_id, ?),
                designation_id = COALESCE(designation_id, ?),
                phone_assigned = COALESCE(phone_assigned, ?)
          WHERE id = ?`,
        [c?.branch_id ?? null, c?.location_id ?? null, divisionId, c?.department_id ?? null,
         designationId, c?.phone ?? null, aoId]
      );
    }
    const prev = await getApplicantStageStatus(req.params.id);
    await writeApplicantActivity(req.params.id, req.user?.id ?? null, 'onboard', {
      fromStage: prev.stage, fromStatus: prev.status,
      meta: { aoId, prefilled: { branchId: c?.branch_id, departmentId: c?.department_id, designationId } },
    });
    await writeOnboardingActivity(aoId, req.params.id, req.user?.id ?? null, 'open', {
      section: 'header', meta: { prefilled: true },
    });
    res.json({ data: { id: req.params.id, aoId } });
  } catch (err) { next(err); }
});

// ── Activities feed ─────────────────────────────────────────────────────────
app.get('/api/v1/applicants/:id/activities', authRequired, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT a.*, CONCAT_WS(' ', e.first_name, e.last_name) AS actor_name, u.email AS actor_email
       FROM applicant_activities a
       LEFT JOIN users u ON u.id = a.actor_user_id
       LEFT JOIN employees e ON e.id = u.employee_id
       WHERE a.applicant_id = ?
       ORDER BY a.created_at DESC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

app.get('/api/v1/job-listings/:id/activities', authRequired, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT a.*, ap.full_name AS applicant_name, ap.app_no,
              CONCAT_WS(' ', e.first_name, e.last_name) AS actor_name, u.email AS actor_email
       FROM applicant_activities a
       JOIN applicants ap ON ap.id = a.applicant_id
       LEFT JOIN users u ON u.id = a.actor_user_id
       LEFT JOIN employees e ON e.id = u.employee_id
       WHERE a.job_listing_id = ?
       ORDER BY a.created_at DESC
       LIMIT 500`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// Onboarding tasks
app.get('/api/v1/onboarding/tasks', authRequired, async (_req, res, next) => {
  try {
    const rows = await query('SELECT * FROM onboarding_tasks ORDER BY category, sort_order');
    res.json({ data: rows });
  } catch (err) { next(err); }
});

app.post('/api/v1/onboarding/tasks', authRequired, async (req, res, next) => {
  try {
    const { title, category, description, isMandatory = 1 } = req.body ?? {};
    if (!title || !category) return res.status(400).json({ error: { code: 'VALIDATION', message: 'title and category required' } });
    const id = ulid();
    await query('INSERT INTO onboarding_tasks (id, title, category, description, is_mandatory) VALUES (?, ?, ?, ?, ?)',
      [id, title, category, description || null, isMandatory]);
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

// Onboarding progress for a specific employee
app.get('/api/v1/onboarding/employees/:employeeId', authRequired, async (req, res, next) => {
  try {
    const tasks = await query('SELECT * FROM onboarding_tasks ORDER BY category, sort_order');
    const progress = await query(
      'SELECT task_id, status, completed_at, notes FROM employee_onboarding WHERE employee_id = ?',
      [req.params.employeeId]
    );
    const progressMap = new Map((progress as { task_id: string; status: string; completed_at: string | null; notes: string | null }[]).map((p) => [p.task_id, p]));
    const result = (tasks as { id: string; title: string; category: string; is_mandatory: number; sort_order: number }[]).map((t) => ({
      ...t,
      status: progressMap.get(t.id)?.status ?? 'pending',
      completed_at: progressMap.get(t.id)?.completed_at ?? null,
    }));
    res.json({ data: result });
  } catch (err) { next(err); }
});

app.post('/api/v1/onboarding/employees/:employeeId/complete/:taskId', authRequired, async (req, res, next) => {
  try {
    const { notes } = req.body ?? {};
    const existing = await query<{ id: string }>(
      'SELECT id FROM employee_onboarding WHERE employee_id = ? AND task_id = ?',
      [req.params.employeeId, req.params.taskId]
    );
    if (existing.length) {
      await query("UPDATE employee_onboarding SET status = 'completed', completed_at = NOW(), notes = ? WHERE id = ?",
        [notes || null, existing[0].id]);
    } else {
      await query("INSERT INTO employee_onboarding (id, employee_id, task_id, status, completed_at, notes) VALUES (?, ?, ?, 'completed', NOW(), ?)",
        [ulid(), req.params.employeeId, req.params.taskId, notes || null]);
    }
    res.json({ data: { employeeId: req.params.employeeId, taskId: req.params.taskId, status: 'completed' } });
  } catch (err) { next(err); }
});

// ─── MUTATIONS ───────────────────────────────────────────────────────────────

// Create employee — direct-add to the Employee Master (bypasses the hiring
// flow, used to bring existing staff onto the system). Accepts the core
// identity/org fields plus an optional monthly `salary` block; when salary is
// present it also creates a linked "Joining" compensation (Active) and syncs
// the employee's current_compensation_id + ctc snapshot.
const EMP_STATUSES = ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'EXITED'] as const;
app.post('/api/v1/employees', authRequired, async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const { firstName, lastName, email, phone, designation, branchId, departmentId,
      gradeId, ctcRupees, joiningDate, bankName, bankAccount, ifsc, pan, aadhaar,
      companyId, divisionId, salary } = b;
    // grade + ctc are no longer mandatory: existing employees may not map to a
    // salary grade, and the salary block (if given) supplies the CTC.
    if (!firstName || !lastName || !email || !phone || !designation || !branchId || !departmentId) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'Required fields missing (name, email, phone, designation, branch, department)' } });
    }
    const status = EMP_STATUSES.includes(b.status) ? b.status : 'ACTIVE';

    // Annual CTC (paise): salary block is MONTHLY (legacy screen) → ×12; else
    // fall back to an explicit annual ctcRupees; else 0 (column is NOT NULL).
    const hasSalary = salary && Number(salary.grossMonthly) > 0;
    const annualCtcPaise = hasSalary
      ? Math.round(Number(salary.grossMonthly) * 12 * 100)
      : (ctcRupees ? Math.round(Number(ctcRupees) * 100) : 0);

    const [maxRow] = await query<{ n: number | string | null }>(
      "SELECT COALESCE(MAX(CAST(SUBSTRING(code, 8) AS UNSIGNED)), 0) AS n FROM employees WHERE code LIKE 'CK-EMP-%'"
    );
    const code = `CK-EMP-${String(Number(maxRow?.n ?? 0) + 1).padStart(4, '0')}`;
    const id = ulid();

    // Build the INSERT from a column→value map so optional fields stay optional.
    const cols: string[] = ['id', 'code', 'first_name', 'last_name', 'designation', 'status',
      'email', 'phone', 'branch_id', 'department_id', 'ctc'];
    const vals: unknown[] = [id, code, firstName, lastName, designation, status,
      email, phone, branchId, departmentId, annualCtcPaise];
    const add = (col: string, v: unknown) => { cols.push(col); vals.push(v); };
    const addIf = (col: string, v: unknown) => { if (v !== undefined && v !== '' && v !== null) add(col, v); };
    const addDate = (col: string, v: unknown) => { if (v) add(col, v); };
    const addBool = (col: string, v: unknown) => { if (v !== undefined) add(col, v ? 1 : 0); };

    addDate('joining_date', joiningDate);
    addIf('company_id', companyId);
    addIf('division_id', divisionId);
    addIf('grade_id', gradeId);
    addIf('bank_name', bankName); addIf('bank_account', bankAccount); addIf('ifsc', ifsc);
    addIf('pan', pan); addIf('aadhaar', aadhaar);
    // Extended legacy "General Info" / personal fields (all map to existing columns).
    addIf('middle_name', b.middleName); addIf('display_name', b.displayName); addIf('photo_url', b.photoUrl);
    addIf('gender', b.gender); addDate('dob', b.dob); addIf('marital_status', b.maritalStatus);
    addIf('blood_group', b.bloodGroup); addIf('nationality', b.nationality); addIf('religion', b.religion);
    addIf('employment_type', b.employmentType); addIf('work_mode', b.workMode);
    addIf('pay_mode', b.payMode); addIf('wage_basis', b.wageBasis);
    addIf('default_shift_id', b.defaultShiftId);
    addIf('personal_email', b.personalEmail); addIf('alternate_phone', b.alternatePhone);
    addIf('bank_branch', b.bankBranch); addIf('account_type', b.accountType); addIf('pt_state', b.ptState);
    addIf('pf', b.pf); addIf('esic', b.esic); addIf('uan', b.uan);
    addBool('pf_applicable', b.pfApplicable); addBool('esi_applicable', b.esiApplicable);
    addBool('tds_applicable', b.tdsApplicable);
    if (b.presentAddress != null) add('present_address', typeof b.presentAddress === 'string' ? b.presentAddress : JSON.stringify(b.presentAddress));
    if (b.permanentAddress != null) add('permanent_address', typeof b.permanentAddress === 'string' ? b.permanentAddress : JSON.stringify(b.permanentAddress));

    await query(
      `INSERT INTO employees (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      vals
    );

    // Salary block → linked "Joining" compensation, activated immediately.
    let compId: string | null = null;
    if (hasSalary) {
      compId = ulid();
      const compCode = await nextCompCode();
      const mToAnnualPaise = (v: unknown) => {
        if (v === '' || v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? Math.round(n * 12 * 100) : null;
      };
      // other_allowances amounts are stored in RUPEES (see POST /compensations);
      // Special + Phone allowances plus any extras, annualised.
      const otherAll: Array<{ name: string; amount: number }> = [];
      if (Number(salary.specialAllowanceMonthly) > 0) otherAll.push({ name: 'Special Allowance', amount: Math.round(Number(salary.specialAllowanceMonthly) * 12) });
      if (Number(salary.phoneAllowanceMonthly) > 0) otherAll.push({ name: 'Phone Allowance', amount: Math.round(Number(salary.phoneAllowanceMonthly) * 12) });
      if (Array.isArray(salary.otherAllowances)) {
        for (const a of salary.otherAllowances) {
          if (a && a.name && Number(a.amount) > 0) otherAll.push({ name: String(a.name), amount: Math.round(Number(a.amount) * 12) });
        }
      }
      await query(
        `INSERT INTO compensations
           (id, code, record_type, employee_id, effective_from, annual_ctc,
            basic, hra, conveyance, medical_allowance, other_allowances,
            pf_applicable, esi_applicable, status, reason_for_change)
         VALUES (?, ?, 'Joining', ?, COALESCE(?, CURDATE()), ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 'Direct add to Employee Master')`,
        [
          compId, compCode, id, salary.effectiveFrom || joiningDate || null, annualCtcPaise,
          mToAnnualPaise(salary.basicMonthly), mToAnnualPaise(salary.hraMonthly),
          mToAnnualPaise(salary.taMonthly), mToAnnualPaise(salary.medicalMonthly),
          otherAll.length ? JSON.stringify(otherAll) : null,
          salary.pfApplicable ? 1 : 0, salary.esiApplicable ? 1 : 0,
        ]
      );
      await query('UPDATE employees SET current_compensation_id = ? WHERE id = ?', [compId, id]);
      await writeAudit(req.user!.id, 'create', 'compensation', compId, null, { code: compCode, recordType: 'Joining', employeeId: id, annualCtcPaise });
    }

    await writeAudit(req.user!.id, 'create', 'employee', id, null, {
      id, code, firstName, lastName, designation, status, joiningDate, email, phone,
      branchId, companyId, departmentId, divisionId, gradeId, annualCtcPaise, compId,
    });
    res.status(201).json({ data: { id, code, compensationId: compId } });
  } catch (err) { next(err); }
});

// Update employee
app.patch('/api/v1/employees/:id', authRequired, async (req, res, next) => {
  try {
    const allowed = [
      // existing core fields
      'first_name','last_name','designation','status','phone','email',
      'bank_name','bank_account','ifsc','pan','aadhaar','pf','esic','uan',
      'branch_id','company_id','department_id','division_id','grade_id','job_profile_id','current_compensation_id',
      // Info tab — identity / personal / employment (migration 0025)
      'middle_name','display_name','photo_url','gender','dob','marital_status',
      'blood_group','nationality','religion','languages_known','caste_category',
      'joining_date','date_of_confirmation','employment_type','work_mode',
      'probation_from','probation_to','contract_period','contract_from',
      'contract_to','contract_attachment_url',
      // Info tab — contact / addresses
      'personal_phone_country_code','alternate_phone','alternate_phone_country_code',
      'office_contact_phone_id','personal_email','present_address','permanent_address',
      // Salary/ESIC/PF tab (migration 0029)
      'bank_branch','account_type','pf_applicable','esi_applicable','pt_state','form16_url',
      // Attendance & Leaves tab
      'biometric_mapped','annual_leave_entitlement','attendance_rule_id','default_shift_id',
      // Increment tab
      'next_review_due','increment_notes',
      // Other tab
      'nda_signed','background_verification','policy_acknowledgements',
      'linkedin_url','hobbies','willing_to_relocate','willing_to_travel','driving_license',
      'medical_insurance_provider','medical_policy_number','medical_nominee','vaccination_status',
      'bond_signed','visa_work_permit','legal_case_declaration',
      'digital_signature_id','esignature_url','workflow_approver_roles',
      'preferred_career_path','training_interests','open_to_mentorship','self_assessed_strengths',
    ];
    const jsonCols = new Set([
      'languages_known','present_address','permanent_address',
      'policy_acknowledgements','vaccination_status','workflow_approver_roles','training_interests',
    ]);
    const boolCols = new Set([
      'contract_period',
      'pf_applicable','esi_applicable','biometric_mapped',
      'nda_signed','driving_license','bond_signed','open_to_mentorship',
    ]);
    const dateCols = new Set([
      'dob','joining_date','date_of_confirmation','probation_from','probation_to','contract_from','contract_to',
      'next_review_due',
    ]);
    const updates: string[] = [];
    const values: unknown[] = [];
    const before = await query('SELECT * FROM employees WHERE id = ? LIMIT 1', [req.params.id]);
    for (const [k, raw] of Object.entries(req.body ?? {})) {
      if (!allowed.includes(k)) continue;
      let v: unknown = raw;
      if (jsonCols.has(k)) {
        // mysql2 doesn't auto-stringify objects/arrays into JSON columns.
        v = raw == null ? null : (typeof raw === 'string' ? raw : JSON.stringify(raw));
      } else if (boolCols.has(k)) {
        v = raw ? 1 : 0;
      } else if (dateCols.has(k)) {
        v = raw === '' ? null : raw;
      }
      updates.push(`${k} = ?`);
      values.push(v);
    }
    if (!updates.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields to update' } });
    values.push(req.params.id);
    await query(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`, values);
    const after = await query('SELECT * FROM employees WHERE id = ? LIMIT 1', [req.params.id]);
    await writeAudit(req.user!.id, 'update', 'employee', req.params.id, before[0] ?? null, after[0] ?? null);
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

// Soft-delete employee (mark exited)
app.delete('/api/v1/employees/:id', authRequired, async (req, res, next) => {
  try {
    const before = await query('SELECT * FROM employees WHERE id = ? LIMIT 1', [req.params.id]);
    await query("UPDATE employees SET status = 'EXITED', exit_date = CURDATE() WHERE id = ?", [req.params.id]);
    const after = await query('SELECT * FROM employees WHERE id = ? LIMIT 1', [req.params.id]);
    await writeAudit(req.user!.id, 'exit', 'employee', req.params.id, before[0] ?? null, after[0] ?? null);
    res.json({ data: { id: req.params.id, status: 'EXITED' } });
  } catch (err) { next(err); }
});

// ─── Employee Info tab side tables ──────────────────────────────────────────
// Emergency contacts and dependents are small multi-row grids edited inline
// on the Info tab. We use bulk-replace semantics: PUT a full array, server
// wipes and re-inserts, so the client doesn't have to track per-row diffs.

type EmergencyContactInput = {
  id?: string;
  name?: string;
  relation?: string | null;
  phone?: string | null;
  phone_country_code?: string | null;
  address?: string | null;
  sort_order?: number;
};
app.put('/api/v1/employees/:id/emergency-contacts', authRequired, async (req, res, next) => {
  try {
    const items: EmergencyContactInput[] = Array.isArray(req.body?.items) ? req.body.items : [];
    await query('DELETE FROM employee_emergency_contacts WHERE employee_id = ?', [req.params.id]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it?.name) continue;
      await query(
        `INSERT INTO employee_emergency_contacts (id, employee_id, name, relation, phone, phone_country_code, address, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [ulid(), req.params.id, it.name, it.relation ?? null, it.phone ?? null,
         it.phone_country_code ?? null, it.address ?? null, it.sort_order ?? i]
      );
    }
    const rows = await query('SELECT * FROM employee_emergency_contacts WHERE employee_id = ? ORDER BY sort_order, created_at', [req.params.id]);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

type DependentInput = {
  id?: string;
  relation?: string;
  name?: string;
  phone?: string | null;
  phone_country_code?: string | null;
  email?: string | null;
  dob?: string | null;
  sort_order?: number;
};
app.put('/api/v1/employees/:id/dependents', authRequired, async (req, res, next) => {
  try {
    const items: DependentInput[] = Array.isArray(req.body?.items) ? req.body.items : [];
    await query('DELETE FROM employee_dependents WHERE employee_id = ?', [req.params.id]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it?.relation || !it?.name) continue;
      await query(
        `INSERT INTO employee_dependents (id, employee_id, relation, name, phone, phone_country_code, email, dob, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ulid(), req.params.id, it.relation, it.name, it.phone ?? null,
         it.phone_country_code ?? null, it.email ?? null,
         it.dob ? it.dob : null, it.sort_order ?? i]
      );
    }
    const rows = await query('SELECT * FROM employee_dependents WHERE employee_id = ? ORDER BY sort_order, created_at', [req.params.id]);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// ─── Employee Documents & Experience tab side tables (Phase 2.B) ───────────

type DocumentInput = {
  id?: string;
  doc_type?: string;
  doc_number?: string | null;
  description?: string | null;
  file_url?: string | null;
  sort_order?: number;
};
app.put('/api/v1/employees/:id/documents', authRequired, async (req, res, next) => {
  try {
    const items: DocumentInput[] = Array.isArray(req.body?.items) ? req.body.items : [];
    await query('DELETE FROM employee_documents WHERE employee_id = ?', [req.params.id]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it?.doc_type) continue;
      await query(
        `INSERT INTO employee_documents (id, employee_id, doc_type, doc_number, description, file_url, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ulid(), req.params.id, it.doc_type, it.doc_number ?? null,
         it.description ?? null, it.file_url ?? null, it.sort_order ?? i]
      );
    }
    const rows = await query('SELECT * FROM employee_documents WHERE employee_id = ? ORDER BY sort_order, created_at', [req.params.id]);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

type EducationInput = {
  id?: string;
  level?: string | null;
  course_name?: string | null;
  board_university?: string | null;
  institute?: string | null;
  specialization?: string | null;
  passing_year?: string | null;
  percentage_cgpa?: string | null;
  sort_order?: number;
};
app.put('/api/v1/employees/:id/education', authRequired, async (req, res, next) => {
  try {
    const items: EducationInput[] = Array.isArray(req.body?.items) ? req.body.items : [];
    await query('DELETE FROM employee_education WHERE employee_id = ?', [req.params.id]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      // Skip rows that have no meaningful data at all.
      if (!it?.level && !it?.course_name && !it?.institute) continue;
      await query(
        `INSERT INTO employee_education
           (id, employee_id, level, course_name, board_university, institute, specialization, passing_year, percentage_cgpa, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ulid(), req.params.id, it.level ?? null, it.course_name ?? null,
         it.board_university ?? null, it.institute ?? null, it.specialization ?? null,
         it.passing_year ? it.passing_year : null, it.percentage_cgpa ?? null, it.sort_order ?? i]
      );
    }
    const rows = await query('SELECT * FROM employee_education WHERE employee_id = ? ORDER BY sort_order, created_at', [req.params.id]);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

type WorkExperienceInput = {
  id?: string;
  company_name?: string | null;
  designation?: string | null;
  from_date?: string | null;
  to_date?: string | null;
  reporting_manager_name?: string | null;
  reporting_manager_phone?: string | null;
  last_drawn_salary?: string | null;
  reason_for_leaving?: string | null;
  experience_letter_url?: string | null;
  sort_order?: number;
};
app.put('/api/v1/employees/:id/work-experience', authRequired, async (req, res, next) => {
  try {
    const items: WorkExperienceInput[] = Array.isArray(req.body?.items) ? req.body.items : [];
    await query('DELETE FROM employee_work_experience WHERE employee_id = ?', [req.params.id]);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it?.company_name && !it?.designation) continue;
      await query(
        `INSERT INTO employee_work_experience
           (id, employee_id, company_name, designation, from_date, to_date,
            reporting_manager_name, reporting_manager_phone, last_drawn_salary,
            reason_for_leaving, experience_letter_url, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ulid(), req.params.id,
         it.company_name ?? null, it.designation ?? null,
         it.from_date ? it.from_date : null, it.to_date ? it.to_date : null,
         it.reporting_manager_name ?? null, it.reporting_manager_phone ?? null,
         it.last_drawn_salary ?? null, it.reason_for_leaving ?? null,
         it.experience_letter_url ?? null, it.sort_order ?? i]
      );
    }
    const rows = await query('SELECT * FROM employee_work_experience WHERE employee_id = ? ORDER BY sort_order, created_at', [req.params.id]);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// ─── Employee Skills (Phase 2.C — Job Profile tab) ─────────────────────────
type SkillInput = {
  id?: string;
  skill_id?: string;
  rating?: number | string;
  notes?: string | null;
  sort_order?: number;
};
app.put('/api/v1/employees/:id/skills', authRequired, async (req, res, next) => {
  try {
    const items: SkillInput[] = Array.isArray(req.body?.items) ? req.body.items : [];
    await query('DELETE FROM employee_skills WHERE employee_id = ?', [req.params.id]);
    // De-dupe by skill_id within the same payload — the table has a UNIQUE
    // (employee_id, skill_id), so a duplicate would fail the INSERT and
    // leave the row half-saved.
    const seen = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it?.skill_id || seen.has(it.skill_id)) continue;
      seen.add(it.skill_id);
      const rawRating = typeof it.rating === 'string' ? Number(it.rating) : it.rating;
      const rating = Math.max(1, Math.min(5, Number.isFinite(rawRating) ? Math.round(rawRating as number) : 3));
      await query(
        `INSERT INTO employee_skills (id, employee_id, skill_id, rating, notes, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ulid(), req.params.id, it.skill_id, rating, it.notes ?? null, it.sort_order ?? i]
      );
    }
    const rows = await query(
      `SELECT es.id, es.skill_id, es.rating, es.notes, es.sort_order,
              s.code AS skill_code, s.name AS skill_name, s.category AS skill_category
       FROM employee_skills es
       JOIN skills s ON s.id = es.skill_id
       WHERE es.employee_id = ?
       ORDER BY es.sort_order, es.created_at`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// Apply leave
app.post('/api/v1/leaves', authRequired, async (req, res, next) => {
  try {
    const { employeeId, type, fromDate, toDate, days, reason } = req.body ?? {};
    if (!employeeId || !type || !fromDate || !toDate || !days || !reason) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'Required fields missing' } });
    }
    const id = ulid();
    await query(
      `INSERT INTO leaves (id, employee_id, type, from_date, to_date, days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [id, employeeId, type, fromDate, toDate, days, reason]
    );
    await writeAudit(req.user!.id, 'create', 'leave', id, null, { employeeId, type, fromDate, toDate, days, reason });
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

// Approve / reject leave
app.post('/api/v1/leaves/:id/decide', authRequired, async (req, res, next) => {
  try {
    const { decision } = req.body ?? {};
    if (!['APPROVED','REJECTED'].includes(decision)) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'decision must be APPROVED or REJECTED' } });
    }
    const before = await query('SELECT * FROM leaves WHERE id = ? LIMIT 1', [req.params.id]);
    await query(
      `UPDATE leaves SET status = ?, approver_id = ?, decided_at = NOW() WHERE id = ?`,
      [decision, req.user!.id, req.params.id]
    );
    const after = await query('SELECT * FROM leaves WHERE id = ? LIMIT 1', [req.params.id]);
    await writeAudit(req.user!.id, 'decide', 'leave', req.params.id, before[0] ?? null, after[0] ?? null);
    res.json({ data: { id: req.params.id, status: decision } });
  } catch (err) { next(err); }
});

// Manual attendance punch
app.post('/api/v1/attendance/punch', authRequired, async (req, res, next) => {
  try {
    const { employeeId, date, inAt, outAt, source = 'MANUAL', notes } = req.body ?? {};
    if (!employeeId || !date) return res.status(400).json({ error: { code: 'VALIDATION', message: 'employeeId and date required' } });
    const existing = await query<{ id: string }>('SELECT id FROM attendance WHERE employee_id = ? AND date = ?', [employeeId, date]);
    const totalMin = inAt && outAt
      ? Math.max(0, Math.round((new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000))
      : 0;
    if (existing.length) {
      const before = await query('SELECT * FROM attendance WHERE id = ? LIMIT 1', [existing[0].id]);
      await query('UPDATE attendance SET in_at = ?, out_at = ?, total_min = ?, source = ?, notes = ? WHERE id = ?',
        [inAt || null, outAt || null, totalMin, source, notes || null, existing[0].id]);
      const after = await query('SELECT * FROM attendance WHERE id = ? LIMIT 1', [existing[0].id]);
      await writeAudit(req.user!.id, 'update', 'attendance', existing[0].id, before[0] ?? null, after[0] ?? null);
      res.json({ data: { id: existing[0].id } });
    } else {
      const id = ulid();
      await query('INSERT INTO attendance (id, employee_id, date, in_at, out_at, total_min, source, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, employeeId, date, inAt || null, outAt || null, totalMin, source, notes || null]);
      await writeAudit(req.user!.id, 'create', 'attendance', id, null, { employeeId, date, inAt, outAt, source, notes });
      res.status(201).json({ data: { id } });
    }
  } catch (err) { next(err); }
});

// Add holiday
app.post('/api/v1/holidays', authRequired, async (req, res, next) => {
  try {
    const { date, name, kind, branchIds } = req.body ?? {};
    if (!date || !name || !kind) return res.status(400).json({ error: { code: 'VALIDATION', message: 'date, name, kind required' } });
    const id = ulid();
    await query('INSERT INTO holidays (id, date, name, kind) VALUES (?, ?, ?, ?)', [id, date, name, kind]);
    if (Array.isArray(branchIds) && branchIds.length) {
      for (const bid of branchIds) {
        await query('INSERT INTO holiday_branches (holiday_id, branch_id) VALUES (?, ?)', [id, bid]);
      }
    }
    await writeAudit(req.user!.id, 'create', 'holiday', id, null, { date, name, kind, branchIds: branchIds ?? [] });
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

// Edit holiday
app.patch('/api/v1/holidays/:id', authRequired, async (req, res, next) => {
  try {
    const { name, kind, date } = req.body ?? {};
    const before = await query('SELECT * FROM holidays WHERE id = ? LIMIT 1', [req.params.id]);
    if (name || kind || date) {
      const updates: string[] = [];
      const vals: unknown[] = [];
      if (name) { updates.push('name = ?'); vals.push(name); }
      if (kind) { updates.push('kind = ?'); vals.push(kind); }
      if (date) { updates.push('date = ?'); vals.push(date); }
      vals.push(req.params.id);
      await query(`UPDATE holidays SET ${updates.join(', ')} WHERE id = ?`, vals);
    }
    const after = await query('SELECT * FROM holidays WHERE id = ? LIMIT 1', [req.params.id]);
    await writeAudit(req.user!.id, 'update', 'holiday', req.params.id, before[0] ?? null, after[0] ?? null);
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

// New loan / advance
app.post('/api/v1/loans', authRequired, async (req, res, next) => {
  try {
    const { employeeId, kind, principalRupees, emiRupees, tenureMonths, purpose, startedAt } = req.body ?? {};
    if (!employeeId || !kind || !principalRupees || !emiRupees || !tenureMonths) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'Required fields missing' } });
    }
    const principal = Math.round(Number(principalRupees) * 100);
    const emi = Math.round(Number(emiRupees) * 100);
    const id = ulid();
    await query(
      `INSERT INTO loans (id, employee_id, kind, principal, outstanding, emi, tenure_months, remaining, status, purpose, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [id, employeeId, kind, principal, principal, emi, tenureMonths, tenureMonths, purpose || null, startedAt || new Date().toISOString().slice(0,10)]
    );
    await writeAudit(req.user!.id, 'create', 'loan', id, null, { employeeId, kind, principalRupees, emiRupees, tenureMonths, purpose, startedAt });
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

// Close loan
app.post('/api/v1/loans/:id/close', authRequired, async (req, res, next) => {
  try {
    const before = await query('SELECT * FROM loans WHERE id = ? LIMIT 1', [req.params.id]);
    await query("UPDATE loans SET status = 'CLOSED', outstanding = 0, remaining = 0 WHERE id = ?", [req.params.id]);
    const after = await query('SELECT * FROM loans WHERE id = ? LIMIT 1', [req.params.id]);
    await writeAudit(req.user!.id, 'close', 'loan', req.params.id, before[0] ?? null, after[0] ?? null);
    res.json({ data: { id: req.params.id, status: 'CLOSED' } });
  } catch (err) { next(err); }
});

// Decide increment stage
app.post('/api/v1/increments/:id/decide', authRequired, async (req, res, next) => {
  try {
    const { decision, remarks } = req.body ?? {};
    const STAGE_PROGRESSION: Record<string, string> = { manager_review: 'hr', hr: 'finance', finance: 'done' };
    const [rows] = await query<{ stage: string; approvals: string }>('SELECT stage, approvals FROM increments WHERE id = ?', [req.params.id]);
    if (!rows) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    const inc = rows as unknown as { stage: string; approvals: string };
    const approvals = JSON.parse(inc.approvals || '[]');
    approvals.push({ stage: inc.stage, decision, remarks, by: req.user!.id, at: new Date().toISOString() });
    const nextStage = decision === 'approve' ? (STAGE_PROGRESSION[inc.stage] ?? 'done') : 'done';
    const before = await query('SELECT * FROM increments WHERE id = ? LIMIT 1', [req.params.id]);
    await query('UPDATE increments SET stage = ?, approvals = ?, remarks = ? WHERE id = ?',
      [nextStage, JSON.stringify(approvals), remarks || null, req.params.id]);
    const after = await query('SELECT * FROM increments WHERE id = ? LIMIT 1', [req.params.id]);
    await writeAudit(req.user!.id, 'decide', 'increment', req.params.id, before[0] ?? null, after[0] ?? null);
    res.json({ data: { id: req.params.id, stage: nextStage } });
  } catch (err) { next(err); }
});

// Add incentive
app.post('/api/v1/incentives', authRequired, async (req, res, next) => {
  try {
    const { employeeId, kind, month, year, amountRupees } = req.body ?? {};
    if (!employeeId || !kind || !month || !year || !amountRupees) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'Required fields missing' } });
    }
    const id = ulid();
    await query(
      `INSERT INTO incentives (id, employee_id, kind, month, year, amount, status) VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
      [id, employeeId, kind, month, year, Math.round(Number(amountRupees) * 100)]
    );
    await writeAudit(req.user!.id, 'create', 'incentive', id, null, { employeeId, kind, month, year, amountRupees });
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

// Decide incentive
app.post('/api/v1/incentives/:id/decide', authRequired, async (req, res, next) => {
  try {
    const { decision } = req.body ?? {};
    const status = decision === 'approve' ? 'approved' : 'rejected';
    const before = await query('SELECT * FROM incentives WHERE id = ? LIMIT 1', [req.params.id]);
    await query('UPDATE incentives SET status = ? WHERE id = ?', [status, req.params.id]);
    const after = await query('SELECT * FROM incentives WHERE id = ? LIMIT 1', [req.params.id]);
    await writeAudit(req.user!.id, 'decide', 'incentive', req.params.id, before[0] ?? null, after[0] ?? null);
    res.json({ data: { id: req.params.id, status } });
  } catch (err) { next(err); }
});

// Push incentives to payroll
app.post('/api/v1/incentives/push-to-payroll', authRequired, async (req, res, next) => {
  try {
    const { ids } = req.body ?? {};
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'ids array required' } });
    for (const id of ids) {
      const before = await query('SELECT * FROM incentives WHERE id = ? LIMIT 1', [id]);
      await query("UPDATE incentives SET pushed = 1, pushed_at = NOW() WHERE id = ?", [id]);
      const after = await query('SELECT * FROM incentives WHERE id = ? LIMIT 1', [id]);
      await writeAudit(req.user!.id, 'push_to_payroll', 'incentive', id, before[0] ?? null, after[0] ?? null);
    }
    res.json({ data: { pushed: ids.length } });
  } catch (err) { next(err); }
});

// Create payroll period
app.post('/api/v1/payroll/periods', authRequired, async (req, res, next) => {
  try {
    const { month, year } = req.body ?? {};
    if (!month || !year) return res.status(400).json({ error: { code: 'VALIDATION', message: 'month and year required' } });
    const existing = await query<{ id: string }>('SELECT id FROM payroll_periods WHERE month = ? AND year = ? LIMIT 1', [month, year]);
    if (existing.length) {
      return res.status(409).json({ error: { code: 'ALREADY_EXISTS', message: 'Payroll period already exists' } });
    }
    const id = ulid();
    await query('INSERT INTO payroll_periods (id, month, year, status) VALUES (?, ?, ?, "DRAFT")', [id, month, year]);
    await query('UPDATE payroll_periods SET run_at = NOW() WHERE id = ?', [id]);

    const employees = await query<{ id: string; ctc: number }>(
      "SELECT id, ctc FROM employees WHERE status IN ('ACTIVE','PROBATION','ON_LEAVE')"
    );
    for (const emp of employees) {
      const gross = Math.round(Number(emp.ctc) / 12);
      await query(
        `INSERT INTO payroll_items (id, period_id, employee_id, days_paid, gross, earnings, deductions, loan_recovery, net, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
        [ulid(), id, emp.id, 30, gross, JSON.stringify([]), JSON.stringify([]), 0, gross]
      );
    }
    await writeAudit(req.user!.id, 'run', 'payroll_period', id, null, { month, year, status: 'DRAFT', employees: employees.length });
    res.status(201).json({ data: { id } });
  } catch (err) { next(err); }
});

app.post('/api/v1/payroll/periods/:id/approve', authRequired, async (req, res, next) => {
  try {
    const before = await query('SELECT * FROM payroll_periods WHERE id = ? LIMIT 1', [req.params.id]);
    await query('UPDATE payroll_periods SET status = "APPROVED", approved_at = NOW() WHERE id = ?', [req.params.id]);
    await query('UPDATE payroll_items SET status = "APPROVED" WHERE period_id = ?', [req.params.id]);
    const after = await query('SELECT * FROM payroll_periods WHERE id = ? LIMIT 1', [req.params.id]);
    await writeAudit(req.user!.id, 'approve', 'payroll_period', req.params.id, before[0] ?? null, after[0] ?? null);
    res.json({ data: { id: req.params.id, status: 'APPROVED' } });
  } catch (err) { next(err); }
});

app.post('/api/v1/payroll/periods/:id/disburse', authRequired, async (req, res, next) => {
  try {
    const before = await query('SELECT * FROM payroll_periods WHERE id = ? LIMIT 1', [req.params.id]);
    await query('UPDATE payroll_periods SET status = "DISBURSED", disbursed_at = NOW() WHERE id = ?', [req.params.id]);
    await query('UPDATE payroll_items SET status = "DISBURSED" WHERE period_id = ?', [req.params.id]);
    const after = await query('SELECT * FROM payroll_periods WHERE id = ? LIMIT 1', [req.params.id]);
    await writeAudit(req.user!.id, 'disburse', 'payroll_period', req.params.id, before[0] ?? null, after[0] ?? null);
    res.json({ data: { id: req.params.id, status: 'DISBURSED' } });
  } catch (err) { next(err); }
});

// New tour request
app.post('/api/v1/tours', authRequired, async (req, res, next) => {
  try {
    const { employeeId, fromCity, toCity, fromDate, toDate, advanceRupees, itinerary } = req.body ?? {};
    if (!employeeId || !fromCity || !toCity || !fromDate || !toDate || !advanceRupees) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'Required fields missing' } });
    }
    const [maxRow] = await query<{ n: number | string | null }>(
      'SELECT COALESCE(MAX(CAST(SUBSTRING(code, 8) AS UNSIGNED)), 0) AS n FROM tours'
    );
    const code = `CK-TOUR-${String(Number(maxRow?.n ?? 0) + 1).padStart(3, '0')}`;
    const id = ulid();
    await query(
      `INSERT INTO tours (id, code, employee_id, from_city, to_city, from_date, to_date, advance, expense, status, itinerary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'requested', ?)`,
      [id, code, employeeId, fromCity, toCity, fromDate, toDate, Math.round(Number(advanceRupees) * 100), JSON.stringify(itinerary ?? [])]
    );
    await writeAudit(req.user!.id, 'create', 'tour', id, null, { employeeId, fromCity, toCity, fromDate, toDate, advanceRupees });
    res.status(201).json({ data: { id, code } });
  } catch (err) { next(err); }
});

// Settle tour expenses
app.post('/api/v1/tours/:id/settle', authRequired, async (req, res, next) => {
  try {
    const { expenseRupees } = req.body ?? {};
    if (!expenseRupees) return res.status(400).json({ error: { code: 'VALIDATION', message: 'expenseRupees required' } });
    const before = await query('SELECT * FROM tours WHERE id = ? LIMIT 1', [req.params.id]);
    await query(
      "UPDATE tours SET expense = ?, status = 'settled' WHERE id = ?",
      [Math.round(Number(expenseRupees) * 100), req.params.id]
    );
    const after = await query('SELECT * FROM tours WHERE id = ? LIMIT 1', [req.params.id]);
    await writeAudit(req.user!.id, 'settle', 'tour', req.params.id, before[0] ?? null, after[0] ?? null);
    res.json({ data: { id: req.params.id, status: 'settled' } });
  } catch (err) { next(err); }
});

// ─── COMPENSATION MASTER (02) ───────────────────────────────────────────────
// Standalone module that owns the full compensation history for each
// employee, plus reusable Templates and Offer/Increment/One-time records.
// The Employee Master keeps only `ctc` (snapshot) + `current_compensation_id`
// (pointer to the active row) — see migration 0031.

const COMP_STATUSES = ['Draft', 'Approved', 'Active', 'Archived'] as const;
const COMP_RECORD_TYPES = ['Template', 'Offer', 'Joining', 'Increment', 'One-time'] as const;

type CompensationInput = {
  recordType?: string;
  employeeId?: string | null;
  templateId?: string | null;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  annualCtc?: number | string;            // RUPEES on the wire — converted to paise here
  basic?: number | string | null;
  hra?: number | string | null;
  conveyance?: number | string | null;
  medicalAllowance?: number | string | null;
  otherAllowances?: Array<{ name: string; amount: number }> | string | null;
  variablePay?: number | string | null;
  variablePayPct?: number | string | null;
  pfApplicable?: unknown;
  esiApplicable?: unknown;
  payrollCode?: string | null;
  attachmentUrl?: string | null;
  reasonForChange?: string | null;
  notes?: string | null;
};

function toPaise(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
function toPct(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toJsonOrNull(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    try { JSON.parse(v); return v; } catch { return null; }
  }
  return JSON.stringify(v);
}

async function nextCompCode(): Promise<string> {
  const rows = await query<{ n: number | string | null }>(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(code, 5) AS UNSIGNED)), 0) AS n FROM compensations WHERE code LIKE 'CMP-%'"
  );
  return `CMP-${String(Number(rows[0]?.n ?? 0) + 1).padStart(6, '0')}`;
}

// LIST — supports filtering by employee, record_type, status, search.
app.get('/api/v1/compensations', authRequired, async (req, res, next) => {
  try {
    const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
    const recordType = typeof req.query.recordType === 'string' ? req.query.recordType : undefined;
    const status     = typeof req.query.status     === 'string' ? req.query.status     : undefined;
    const search     = typeof req.query.search     === 'string' ? req.query.search.trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    const offset = (page - 1) * pageSize;

    const where: string[] = []; const params: unknown[] = [];
    if (employeeId) { where.push('c.employee_id = ?'); params.push(employeeId); }
    if (recordType) { where.push('c.record_type = ?'); params.push(recordType); }
    if (status)     { where.push('c.status = ?');      params.push(status); }
    if (search) {
      where.push('(c.code LIKE ? OR e.code LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query(
      `SELECT
         c.id, c.code, c.record_type, c.employee_id, c.template_id,
         c.effective_from, c.effective_to, c.annual_ctc, c.status,
         c.approved_at, c.created_at, c.updated_at,
         e.code AS employee_code,
         CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name,
         tpl.code AS template_code
       FROM compensations c
       LEFT JOIN employees e ON e.id = c.employee_id
       LEFT JOIN compensations tpl ON tpl.id = c.template_id
       ${whereSql}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [cnt] = await query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM compensations c LEFT JOIN employees e ON e.id = c.employee_id ${whereSql}`,
      params
    );
    res.json({ data: rows, meta: { page, pageSize, total: Number(cnt?.total ?? 0) } });
  } catch (err) { next(err); }
});

app.get('/api/v1/compensations/:id', authRequired, async (req, res, next) => {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT c.*,
              e.code AS employee_code,
              CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name,
              tpl.code AS template_code,
              u.email AS approved_by_email
       FROM compensations c
       LEFT JOIN employees e        ON e.id   = c.employee_id
       LEFT JOIN compensations tpl  ON tpl.id = c.template_id
       LEFT JOIN users u            ON u.id   = c.approved_by_user_id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Compensation not found' } });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

app.post('/api/v1/compensations', authRequired, async (req, res, next) => {
  try {
    const body: CompensationInput = req.body ?? {};
    if (!body.recordType || !COMP_RECORD_TYPES.includes(body.recordType as typeof COMP_RECORD_TYPES[number])) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: `recordType must be one of ${COMP_RECORD_TYPES.join(', ')}` } });
    }
    if (!body.effectiveFrom) return res.status(400).json({ error: { code: 'VALIDATION', message: 'effectiveFrom required' } });
    if (body.annualCtc == null || Number(body.annualCtc) <= 0) return res.status(400).json({ error: { code: 'VALIDATION', message: 'annualCtc (rupees) required' } });
    // Templates have no employee; everything else does.
    if (body.recordType !== 'Template' && !body.employeeId) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'employeeId required for non-Template records' } });
    }

    const id = ulid();
    const code = await nextCompCode();
    const annualPaise = toPaise(body.annualCtc) ?? 0;
    await query(
      `INSERT INTO compensations
         (id, code, record_type, employee_id, template_id,
          effective_from, effective_to, annual_ctc,
          basic, hra, conveyance, medical_allowance, other_allowances,
          variable_pay, variable_pay_pct,
          pf_applicable, esi_applicable, payroll_code,
          status, attachment_url, reason_for_change, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?)`,
      [
        id, code, body.recordType,
        body.recordType === 'Template' ? null : (body.employeeId || null),
        body.templateId || null,
        body.effectiveFrom, body.effectiveTo || null, annualPaise,
        toPaise(body.basic), toPaise(body.hra), toPaise(body.conveyance),
        toPaise(body.medicalAllowance), toJsonOrNull(body.otherAllowances),
        toPaise(body.variablePay), toPct(body.variablePayPct),
        body.pfApplicable ? 1 : 0, body.esiApplicable ? 1 : 0,
        body.payrollCode || null,
        body.attachmentUrl || null, body.reasonForChange || null, body.notes || null,
      ]
    );
    await writeAudit(req.user!.id, 'create', 'compensation', id, null, { code, ...body });
    res.status(201).json({ data: { id, code } });
  } catch (err) { next(err); }
});

app.patch('/api/v1/compensations/:id', authRequired, async (req, res, next) => {
  try {
    const before = await query<Record<string, unknown>>('SELECT * FROM compensations WHERE id = ?', [req.params.id]);
    const row = before[0];
    if (!row) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Compensation not found' } });
    // Only Draft can be freely edited. Archived is immutable. Approved/Active
    // require an explicit unarchive/draft step before changes — we just allow
    // Active edits to fields that are operational (notes, attachment, reason)
    // and block the rest. Keep this strict to avoid silent history rewrites.
    const status = String(row.status);
    if (!['Draft', 'Approved'].includes(status)) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: `Only Draft / Approved records can be edited (current: ${status}).` } });
    }
    const body: CompensationInput = req.body ?? {};
    const sets: string[] = []; const vals: unknown[] = [];
    const push = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
    if (body.recordType !== undefined) push('record_type', body.recordType);
    if (body.employeeId !== undefined) push('employee_id', body.employeeId || null);
    if (body.templateId !== undefined) push('template_id', body.templateId || null);
    if (body.effectiveFrom !== undefined) push('effective_from', body.effectiveFrom);
    if (body.effectiveTo   !== undefined) push('effective_to',   body.effectiveTo || null);
    if (body.annualCtc     !== undefined) push('annual_ctc',     toPaise(body.annualCtc) ?? 0);
    if (body.basic            !== undefined) push('basic',             toPaise(body.basic));
    if (body.hra              !== undefined) push('hra',               toPaise(body.hra));
    if (body.conveyance       !== undefined) push('conveyance',        toPaise(body.conveyance));
    if (body.medicalAllowance !== undefined) push('medical_allowance', toPaise(body.medicalAllowance));
    if (body.otherAllowances  !== undefined) push('other_allowances',  toJsonOrNull(body.otherAllowances));
    if (body.variablePay      !== undefined) push('variable_pay',      toPaise(body.variablePay));
    if (body.variablePayPct   !== undefined) push('variable_pay_pct',  toPct(body.variablePayPct));
    if (body.pfApplicable  !== undefined) push('pf_applicable',  body.pfApplicable  ? 1 : 0);
    if (body.esiApplicable !== undefined) push('esi_applicable', body.esiApplicable ? 1 : 0);
    if (body.payrollCode      !== undefined) push('payroll_code',      body.payrollCode || null);
    if (body.attachmentUrl    !== undefined) push('attachment_url',    body.attachmentUrl || null);
    if (body.reasonForChange  !== undefined) push('reason_for_change', body.reasonForChange || null);
    if (body.notes            !== undefined) push('notes',             body.notes || null);
    if (!sets.length) return res.status(400).json({ error: { code: 'VALIDATION', message: 'No valid fields' } });
    vals.push(req.params.id);
    await query(`UPDATE compensations SET ${sets.join(', ')} WHERE id = ?`, vals);
    const after = await query<Record<string, unknown>>('SELECT * FROM compensations WHERE id = ?', [req.params.id]);
    await writeAudit(req.user!.id, 'update', 'compensation', req.params.id, row, after[0] ?? null);
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

app.delete('/api/v1/compensations/:id', authRequired, async (req, res, next) => {
  try {
    const before = await query<Record<string, unknown>>('SELECT * FROM compensations WHERE id = ?', [req.params.id]);
    const row = before[0];
    if (!row) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Compensation not found' } });
    if (String(row.status) !== 'Draft') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Only Draft records can be deleted. Use Archive instead.' } });
    }
    await query('DELETE FROM compensations WHERE id = ?', [req.params.id]);
    await writeAudit(req.user!.id, 'delete', 'compensation', req.params.id, row, null);
    res.json({ data: { id: req.params.id } });
  } catch (err) { next(err); }
});

// Status transitions ────────────────────────────────────────────────────────
// Draft → Approved
app.post('/api/v1/compensations/:id/approve', authRequired, async (req, res, next) => {
  try {
    const rows = await query<{ status: string }>('SELECT status FROM compensations WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Compensation not found' } });
    if (rows[0].status !== 'Draft') return res.status(409).json({ error: { code: 'CONFLICT', message: `Cannot approve from status ${rows[0].status}` } });
    await query(
      "UPDATE compensations SET status = 'Approved', approved_by_user_id = ?, approved_at = NOW(3) WHERE id = ?",
      [req.user!.id, req.params.id]
    );
    await writeAudit(req.user!.id, 'approve', 'compensation', req.params.id, { status: 'Draft' }, { status: 'Approved' });
    res.json({ data: { id: req.params.id, status: 'Approved' } });
  } catch (err) { next(err); }
});

// Approved → Active (archives previous Active for the same employee, syncs employees snapshot).
app.post('/api/v1/compensations/:id/activate', authRequired, async (req, res, next) => {
  try {
    const rows = await query<{ status: string; employee_id: string | null; annual_ctc: number | string }>(
      'SELECT status, employee_id, annual_ctc FROM compensations WHERE id = ?',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Compensation not found' } });
    if (rows[0].status !== 'Approved') return res.status(409).json({ error: { code: 'CONFLICT', message: `Activate requires status Approved (current: ${rows[0].status})` } });
    if (!rows[0].employee_id) return res.status(400).json({ error: { code: 'VALIDATION', message: 'Cannot activate a Template — only employee-linked comps go Active.' } });

    const employeeId = rows[0].employee_id;
    const newCtc = Number(rows[0].annual_ctc);
    // Demote any previously Active comp for this employee to Archived.
    await query(
      "UPDATE compensations SET status = 'Archived' WHERE employee_id = ? AND status = 'Active' AND id != ?",
      [employeeId, req.params.id]
    );
    await query("UPDATE compensations SET status = 'Active' WHERE id = ?", [req.params.id]);
    // Sync the Employee Master snapshot.
    await query(
      'UPDATE employees SET current_compensation_id = ?, ctc = ? WHERE id = ?',
      [req.params.id, newCtc, employeeId]
    );
    await writeAudit(req.user!.id, 'activate', 'compensation', req.params.id, { status: 'Approved' }, { status: 'Active', employeeId, newCtcPaise: newCtc });
    res.json({ data: { id: req.params.id, status: 'Active' } });
  } catch (err) { next(err); }
});

// Approved / Active → Archived
app.post('/api/v1/compensations/:id/archive', authRequired, async (req, res, next) => {
  try {
    const rows = await query<{ status: string; employee_id: string | null }>(
      'SELECT status, employee_id FROM compensations WHERE id = ?', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Compensation not found' } });
    if (rows[0].status === 'Archived') return res.json({ data: { id: req.params.id, status: 'Archived' } });
    if (!['Approved', 'Active', 'Draft'].includes(rows[0].status)) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: `Cannot archive from status ${rows[0].status}` } });
    }
    await query("UPDATE compensations SET status = 'Archived' WHERE id = ?", [req.params.id]);
    // If this was the employee's active comp, clear the FK on the employee.
    if (rows[0].status === 'Active' && rows[0].employee_id) {
      await query('UPDATE employees SET current_compensation_id = NULL WHERE id = ? AND current_compensation_id = ?',
        [rows[0].employee_id, req.params.id]);
    }
    await writeAudit(req.user!.id, 'archive', 'compensation', req.params.id, { status: rows[0].status }, { status: 'Archived' });
    res.json({ data: { id: req.params.id, status: 'Archived' } });
  } catch (err) { next(err); }
});

// Reference: list users for the Approved By picker.
app.get('/api/v1/compensations/lookups/approvers', authRequired, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT u.id, u.email, u.role,
              CONCAT_WS(' ', e.first_name, e.last_name) AS name
       FROM users u
       LEFT JOIN employees e ON e.id = u.employee_id
       WHERE u.role IN ('HR_ADMIN','FINANCE')
       ORDER BY u.email`
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// ─── DEV WIPE TOOL ──────────────────────────────────────────────────────────
// Admin-only utility for clearing test data. Gated to HR_ADMIN. Each table is
// allow-listed by category so a typo in the URL can't blow away `users` or
// `migrations`. Deletes are best-effort: any FK constraint violation comes
// back to the caller with a 409 + the SQL message so the caller knows which
// child table is blocking.

type WipeTable = {
  name: string;        // actual SQL table name
  label: string;       // friendly label
  group: string;       // UI grouping
  pk?: string;         // PK column (default 'id')
  hint?: string;       // optional caveat shown in UI
};

const WIPE_TABLES: WipeTable[] = [
  // Hiring funnel
  { name: 'applicants',                  label: 'Applicants',                 group: 'Hiring' },
  { name: 'applicant_onboarding',        label: 'Applicant Onboarding',       group: 'Hiring',
    hint: 'Cascades to ERP/asset/doc/training/giveaway/item links + emergency/dependent rows.' },
  { name: 'applicant_offers',            label: 'Applicant Offers',           group: 'Hiring' },
  { name: 'applicant_screenings',        label: 'Applicant Screenings',       group: 'Hiring' },
  { name: 'applicant_interviews',        label: 'Applicant Interviews',       group: 'Hiring' },
  { name: 'applicant_activities',        label: 'Applicant Activities (log)', group: 'Hiring' },
  { name: 'onboarding_activities',       label: 'Onboarding Activities (log)', group: 'Hiring' },
  { name: 'applicant_giveaways',         label: 'Applicant Giveaways',        group: 'Hiring' },
  { name: 'applicant_erp_modules',       label: 'Applicant ERP Modules',      group: 'Hiring' },
  { name: 'applicant_asset_allocations', label: 'Applicant Asset Allocations', group: 'Hiring' },
  { name: 'applicant_presentations',     label: 'Applicant Presentations',    group: 'Hiring' },
  { name: 'applicant_documents',         label: 'Applicant Documents',        group: 'Hiring' },
  { name: 'applicant_onboarding_items',  label: 'Applicant Onboarding Items', group: 'Hiring' },
  { name: 'applicant_trainings',         label: 'Applicant Trainings',        group: 'Hiring' },
  { name: 'applicant_tags',              label: 'Applicant Tags',             group: 'Hiring' },
  { name: 'applicant_emergency_contacts',label: 'Applicant Emergency Contacts', group: 'Hiring' },
  { name: 'applicant_dependents',        label: 'Applicant Dependents',       group: 'Hiring' },
  { name: 'vacancies',                   label: 'Vacancies',                  group: 'Hiring' },
  { name: 'job_listings',                label: 'Job Listings',               group: 'Hiring' },
  { name: 'job_profiles',                label: 'Job Profiles',               group: 'Hiring' },

  // Employment
  { name: 'employees',                       label: 'Employees',              group: 'Employment',
    hint: 'Will fail if employees still own loans / payroll / leaves / assets / users. Delete those first.' },
  { name: 'employee_emergency_contacts',     label: 'Employee Emergency Contacts', group: 'Employment' },
  { name: 'employee_dependents',             label: 'Employee Dependents',    group: 'Employment' },
  { name: 'employee_documents',              label: 'Employee Documents',     group: 'Employment' },
  { name: 'employee_education',              label: 'Employee Education',     group: 'Employment' },
  { name: 'employee_work_experience',        label: 'Employee Work Experience', group: 'Employment' },
  { name: 'employee_skills',                 label: 'Employee Skills',        group: 'Employment' },
  { name: 'employee_onboarding',             label: 'Employee Onboarding Tasks', group: 'Employment' },
  { name: 'attendance',                      label: 'Attendance',             group: 'Employment' },
  { name: 'leaves',                          label: 'Leaves',                 group: 'Employment' },
  { name: 'leave_balances',                  label: 'Leave Balances',         group: 'Employment' },
  { name: 'increments',                      label: 'Increments',             group: 'Employment' },
  { name: 'tours',                           label: 'Tours',                  group: 'Employment' },
  { name: 'incentives',                      label: 'Incentives',             group: 'Employment' },
  { name: 'loans',                           label: 'Loans / Advances',       group: 'Employment' },
  { name: 'loan_payments',                   label: 'Loan Payments',          group: 'Employment' },
  { name: 'payroll_periods',                 label: 'Payroll Periods',        group: 'Employment' },
  { name: 'payroll_items',                   label: 'Payroll Items',          group: 'Employment' },
  { name: 'roster_entries',                  label: 'Roster Entries',         group: 'Employment' },

  // Masters (be careful)
  { name: 'designations',     label: 'Designations',  group: 'Masters' },
  { name: 'divisions',        label: 'Divisions',     group: 'Masters' },
  { name: 'locations',        label: 'Locations',     group: 'Masters' },
  { name: 'skills',           label: 'Skills',        group: 'Masters' },
  { name: 'training_modules', label: 'Training Modules', group: 'Masters' },
  { name: 'attendance_rules', label: 'Attendance Rules', group: 'Masters' },
  { name: 'holidays',         label: 'Holidays',      group: 'Masters' },
  { name: 'assets',           label: 'Assets',        group: 'Masters' },
  { name: 'asset_categories', label: 'Asset Categories', group: 'Masters' },
  { name: 'phone_number_pool',label: 'Phone Number Pool', group: 'Masters' },
  { name: 'lookups',          label: 'Lookup Values', group: 'Masters' },
  { name: 'tags',             label: 'Tags',          group: 'Masters' },
];

const WIPE_TABLE_BY_NAME = new Map(WIPE_TABLES.map((t) => [t.name, t]));

function escapeIdent(name: string): string {
  // Defence in depth — every caller already validates against the allowlist,
  // but escape the identifier too so the query is impossible to abuse via a
  // missed validation later.
  return '`' + name.replace(/`/g, '``') + '`';
}

app.get('/api/v1/dev/wipe/tables', authRequired, requireRole('HR_ADMIN'), (_req, res) => {
  res.json({ data: WIPE_TABLES });
});

app.get('/api/v1/dev/wipe/rows', authRequired, requireRole('HR_ADMIN'), async (req, res, next) => {
  try {
    const name = typeof req.query.table === 'string' ? req.query.table : '';
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const t = WIPE_TABLE_BY_NAME.get(name);
    if (!t) return res.status(400).json({ error: { code: 'BAD_TABLE', message: 'Unknown or non-wipeable table' } });
    const pk = t.pk ?? 'id';
    const ident = escapeIdent(t.name);
    const [columns, rows, count] = await Promise.all([
      query<{ Field: string; Type: string }>(`SHOW COLUMNS FROM ${ident}`),
      query<Record<string, unknown>>(`SELECT * FROM ${ident} ORDER BY ${escapeIdent(pk)} DESC LIMIT ?`, [limit]),
      query<{ n: number | string }>(`SELECT COUNT(*) AS n FROM ${ident}`),
    ]);
    res.json({
      data: {
        table: t,
        pk,
        columns: columns.map((c) => ({ name: c.Field, type: c.Type })),
        rows,
        total: Number(count[0]?.n ?? 0),
        limit,
      },
    });
  } catch (err) { next(err); }
});

app.post('/api/v1/dev/wipe/delete', authRequired, requireRole('HR_ADMIN'), async (req, res) => {
  const name = typeof req.body?.table === 'string' ? req.body.table : '';
  const ids: unknown[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const t = WIPE_TABLE_BY_NAME.get(name);
  if (!t)          return res.status(400).json({ error: { code: 'BAD_TABLE', message: 'Unknown or non-wipeable table' } });
  if (!ids.length) return res.status(400).json({ error: { code: 'NO_IDS', message: 'Provide ids[] to delete' } });
  const ident = escapeIdent(t.name);
  const pk = escapeIdent(t.pk ?? 'id');
  const placeholders = ids.map(() => '?').join(',');
  try {
    const result = await query<unknown>(`DELETE FROM ${ident} WHERE ${pk} IN (${placeholders})`, ids);
    const affected = (result as unknown as { affectedRows?: number }).affectedRows ?? null;
    await writeAudit(req.user!.id, 'wipe', t.name, ids.map(String).join(','), null, { ids, affected });
    res.json({ data: { table: t.name, requested: ids.length, deleted: affected } });
  } catch (err) {
    const msg = (err as { sqlMessage?: string; code?: string }).sqlMessage ?? (err as Error).message;
    const code = (err as { code?: string }).code ?? 'DELETE_FAILED';
    res.status(409).json({ error: { code, message: msg } });
  }
});

// FK-violation → friendly 409/400. The schema's FOREIGN KEYs are the source of
// truth for "is this record used somewhere": a DELETE blocked by errno 1451
// means referencing rows still exist, so surface that as an in-use validation
// error (not a generic 500) and let the UI tell the user why. 1452 is the
// mirror case — an INSERT/UPDATE pointing at a record that doesn't exist.
const fkErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  const e = err as { errno?: number; code?: string };
  if (e?.errno === 1451 || e?.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({
      error: {
        code: 'IN_USE',
        message: 'Cannot delete — this record is still used by other data (employees, transactions or templates). Remove or reassign those references first.',
      },
    });
  }
  if (e?.errno === 1452 || e?.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: 'A referenced record does not exist (it may have been deleted).' },
    });
  }
  next(err);
};
app.use(fkErrorHandler);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('[server] error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Server error' } });
};
app.use(errorHandler);

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
  // Arm unattended CK master-data syncs (twice-daily on login + midnight IST).
  initCkSchedule().catch((e) => console.error('[ck-sync] schedule init failed:', e));
});
