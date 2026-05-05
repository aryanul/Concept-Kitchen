import './env';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import { ulid } from 'ulid';
import { query } from './db';
import { signAccessToken, authRequired, type Role } from './auth';

const app = express();

const port = Number(process.env.PORT) || 4000;
const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:5173';

app.use(helmet());
app.use(cors({ origin: webOrigin, credentials: true }));
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

// --- Branches (smoke test from Step 4 — keep until employee module replaces it) ---

app.get('/api/v1/branches', async (_req, res, next) => {
  try {
    const rows = await query(
      'SELECT id, code, name, city, kind, created_at, updated_at FROM branches ORDER BY code'
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

app.post('/api/v1/branches', async (req, res, next) => {
  try {
    const { code, name, city, kind } = req.body ?? {};
    if (!code || !name || !city || !kind) {
      return res.status(400).json({
        error: { code: 'VALIDATION', message: 'code, name, city, kind are required' },
      });
    }
    const id = ulid();
    await query(
      'INSERT INTO branches (id, code, name, city, kind) VALUES (?, ?, ?, ?, ?)',
      [id, code, name, city, kind]
    );
    res.status(201).json({ data: { id, code, name, city, kind } });
  } catch (err) {
    next(err);
  }
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('[server] error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Server error' } });
};
app.use(errorHandler);

app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
