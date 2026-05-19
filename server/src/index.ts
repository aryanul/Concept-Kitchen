import './env';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { ulid } from 'ulid';
import { query } from './db';
import { signAccessToken, authRequired, type Role } from './auth';
import { registerMasterRoutes } from './masters';

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
app.use(express.json());

// Master routes registered AFTER global middleware so req.body / CORS headers are available
registerMasterRoutes(app);

type AuditPayload = unknown | null;

async function writeAudit(
  actorId: string,
  action: string,
  resource: string,
  resourceId: string,
  beforeData: AuditPayload,
  afterData: AuditPayload
) {
  await query(
    'INSERT INTO audit_logs (id, actor_id, action, resource, resource_id, before_data, after_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      ulid(),
      actorId,
      action,
      resource,
      resourceId,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
    ]
  );
}

app.get('/api/v1/healthz', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
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
      'SELECT id, code, name, city, kind FROM branches ORDER BY code'
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

app.get('/api/v1/departments', authRequired, async (_req, res, next) => {
  try {
    const rows = await query('SELECT id, name FROM departments ORDER BY name');
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
    const branchId = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;
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
    if (branchId) {
      where.push('e.branch_id = ?');
      params.push(branchId);
    }
    if (departmentId) {
      where.push('e.department_id = ?');
      params.push(departmentId);
    }
    if (status) {
      where.push('e.status = ?');
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query<EmployeeListRow>(
      `SELECT
         e.id, e.code, e.first_name, e.last_name, e.designation, e.status,
         e.joining_date, e.email, e.phone, e.ctc,
         b.id AS branch_id, b.code AS branch_code, b.name AS branch_name,
         d.id AS department_id, d.name AS department_name,
         g.id AS grade_id, g.code AS grade_code
       FROM employees e
       JOIN branches b ON b.id = e.branch_id
       JOIN departments d ON d.id = e.department_id
       JOIN salary_grades g ON g.id = e.grade_id
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
    const rows = await query<
      EmployeeListRow & {
        bank_name: string | null;
        bank_account: string | null;
        ifsc: string | null;
        pan: string | null;
        aadhaar: string | null;
        pf: string | null;
        esic: string | null;
        uan: string | null;
      }
    >(
      `SELECT
         e.id, e.code, e.first_name, e.last_name, e.designation, e.status,
         e.joining_date, e.email, e.phone, e.ctc,
         e.bank_name, e.bank_account, e.ifsc, e.pan, e.aadhaar, e.pf, e.esic, e.uan,
         b.id AS branch_id, b.code AS branch_code, b.name AS branch_name,
         d.id AS department_id, d.name AS department_name,
         g.id AS grade_id, g.code AS grade_code
       FROM employees e
       JOIN branches b ON b.id = e.branch_id
       JOIN departments d ON d.id = e.department_id
       JOIN salary_grades g ON g.id = e.grade_id
       WHERE e.id = ?`,
      [req.params.id]
    );
    const emp = rows[0];
    if (!emp) {
      return res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
    }
    res.json({ data: emp });
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
              a.source, a.status, a.stage, a.notes, a.applied_at, a.updated_at
       FROM applicants a
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
    res.json({ data: { parent, giveaways, erp, assets, presentations, docs, items, trainings } });
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
    ];
    const sets: string[] = []; const vals: unknown[] = [];
    for (const [key, col] of map) {
      if (body[key] !== undefined) {
        sets.push(`${col} = ?`);
        if (key === 'setupEmailAccount') vals.push(body[key] ? 1 : 0);
        else vals.push(body[key] === '' ? null : body[key]);
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
    const ctx = await query<{
      ao_id: string; promoted_employee_id: string | null;
      branch_id: string | null; department_id: string | null;
      designation_id: string | null; designation_name: string | null;
      dob: string | null; email_assigned: string | null; phone_assigned: string | null;
      full_name: string; applicant_email: string; applicant_phone: string | null;
      offer_ctc: string | null; offer_joining: string | null; offer_designation: string | null;
      jp_designation: string | null;
    }>(
      `SELECT ao.id AS ao_id, ao.promoted_employee_id,
              ao.branch_id, ao.department_id, ao.designation_id,
              d.name AS designation_name,
              ao.dob, ao.email_assigned, ao.phone_assigned,
              a.full_name, a.email AS applicant_email, a.phone AS applicant_phone,
              o.ctc AS offer_ctc, o.joining_date AS offer_joining, o.designation AS offer_designation,
              jp.designation AS jp_designation
       FROM applicant_onboarding ao
       JOIN applicants a ON a.id = ao.applicant_id
       LEFT JOIN designations d ON d.id = ao.designation_id
       LEFT JOIN applicant_offers o ON o.applicant_id = ao.applicant_id
       LEFT JOIN job_listings jl ON jl.id = a.job_listing_id
       LEFT JOIN job_profiles jp ON jp.id = jl.job_profile_id
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
      const [first, ...rest] = (row.full_name || '').trim().split(/\s+/);
      const last = rest.join(' ') || first;
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

      if (missing.length) {
        warning = `Employee row not created — missing: ${missing.join(', ')}. Onboarding closed without promotion.`;
      } else {
        employeeId = ulid();
        employeeCode = `EMP${String(Date.now()).slice(-6)}`;
        try {
          await query(
            `INSERT INTO employees
               (id, code, first_name, last_name, designation, status,
                joining_date, email, phone, branch_id, department_id, grade_id, ctc)
             VALUES (?, ?, ?, ?, ?, 'PROBATION', ?, ?, ?, ?, ?, ?, ?)`,
            [employeeId, employeeCode, first, last, designation!,
             joiningDate, email, phone, row.branch_id, row.department_id, gradeId,
             Math.round((ctc as number) * 100)]
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
        } catch (e) {
          console.error('[onboarding-close] employee creation failed', e);
          employeeId = null;
          employeeCode = null;
          warning = 'Employee row creation failed (see server logs). Onboarding closed without promotion.';
        }
      }
    }

    await query(
      "UPDATE applicant_onboarding SET status = 'onboarded', closed_at = ?, promoted_employee_id = COALESCE(?, promoted_employee_id) WHERE id = ?",
      [new Date(), employeeId, aoId]
    );

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

// ── Onboard (handoff from Hire tab into existing applicant_onboarding flow) ──
app.post('/api/v1/applicants/:id/onboard', authRequired, async (req, res, next) => {
  try {
    const existing = await query<{ id: string }>('SELECT id FROM applicant_onboarding WHERE applicant_id = ?', [req.params.id]);
    let aoId = existing[0]?.id ?? '';
    // Pull context to pre-fill the onboarding header. Best-effort: any field
    // that can't be resolved is left null and HR fills it in the detail page.
    const ctx = await query<{
      branch_id: string | null; location_id: string | null; department_id: string | null;
      designation_name: string | null; email: string; phone: string | null;
    }>(
      `SELECT jl.branch_id, jl.location_id, jp.department_id,
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

    if (!aoId) {
      aoId = ulid();
      await query(
        `INSERT INTO applicant_onboarding
           (id, applicant_id, status, branch_id, location_id, department_id, designation_id, phone_assigned)
         VALUES (?, ?, 'onboarding', ?, ?, ?, ?, ?)`,
        [aoId, req.params.id,
         c?.branch_id ?? null, c?.location_id ?? null, c?.department_id ?? null,
         designationId, c?.phone ?? null]
      );
    } else {
      // Only pre-fill columns that are still NULL on the existing row.
      await query(
        `UPDATE applicant_onboarding
            SET status = 'onboarding',
                branch_id      = COALESCE(branch_id, ?),
                location_id    = COALESCE(location_id, ?),
                department_id  = COALESCE(department_id, ?),
                designation_id = COALESCE(designation_id, ?),
                phone_assigned = COALESCE(phone_assigned, ?)
          WHERE id = ?`,
        [c?.branch_id ?? null, c?.location_id ?? null, c?.department_id ?? null,
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

// Create employee
app.post('/api/v1/employees', authRequired, async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, designation, branchId, departmentId,
      gradeId, ctcRupees, joiningDate, bankName, bankAccount, ifsc, pan, aadhaar } = req.body ?? {};
    if (!firstName || !lastName || !email || !phone || !designation || !branchId || !departmentId || !gradeId || !ctcRupees || !joiningDate) {
      return res.status(400).json({ error: { code: 'VALIDATION', message: 'Required fields missing' } });
    }
    const [maxRow] = await query<{ n: number | string | null }>(
      'SELECT COALESCE(MAX(CAST(SUBSTRING(code, 8) AS UNSIGNED)), 0) AS n FROM employees'
    );
    const code = `CK-EMP-${String(Number(maxRow?.n ?? 0) + 1).padStart(3, '0')}`;
    const id = ulid();
    await query(
      `INSERT INTO employees (id, code, first_name, last_name, designation, status, joining_date, email, phone,
       branch_id, department_id, grade_id, ctc, bank_name, bank_account, ifsc, pan, aadhaar)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, code, firstName, lastName, designation, joiningDate, email, phone,
       branchId, departmentId, gradeId, Math.round(Number(ctcRupees) * 100),
       bankName || null, bankAccount || null, ifsc || null, pan || null, aadhaar || null]
    );
    await writeAudit(req.user!.id, 'create', 'employee', id, null, {
      id, code, firstName, lastName, designation, joiningDate, email, phone,
      branchId, departmentId, gradeId, ctcRupees,
    });
    res.status(201).json({ data: { id, code } });
  } catch (err) { next(err); }
});

// Update employee
app.patch('/api/v1/employees/:id', authRequired, async (req, res, next) => {
  try {
    const allowed = ['first_name','last_name','designation','status','phone','bank_name','bank_account','ifsc','pan','aadhaar','branch_id','department_id','grade_id'];
    const updates: string[] = [];
    const values: unknown[] = [];
    const before = await query('SELECT * FROM employees WHERE id = ? LIMIT 1', [req.params.id]);
    for (const [k, v] of Object.entries(req.body ?? {})) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
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

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('[server] error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Server error' } });
};
app.use(errorHandler);

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
