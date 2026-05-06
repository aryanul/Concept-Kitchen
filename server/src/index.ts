import './env';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { query } from './db';
import { signAccessToken, authRequired, type Role } from './auth';

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
    const rows = await query(
      'SELECT id, code, name, start_time, end_time, kind, break_min FROM shifts ORDER BY code'
    );
    res.json({ data: rows });
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
      }
    >(
      `SELECT
         e.id, e.code, e.first_name, e.last_name, e.designation, e.status,
         e.joining_date, e.email, e.phone, e.ctc,
         e.bank_name, e.bank_account, e.ifsc,
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
app.get('/api/v1/tours', authRequired, async (req, res, next) => {
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
app.get('/api/v1/incentives', authRequired, async (req, res, next) => {
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

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('[server] error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Server error' } });
};
app.use(errorHandler);

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
