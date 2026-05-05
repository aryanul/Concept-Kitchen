// Seeds reference / lookup data: branches, departments, salary_grades, shifts,
// holidays (+ holiday_branches), and 3 demo users.
//
// Idempotent: clears and re-inserts these tables. Does NOT touch employees,
// attendance, leaves, payroll, etc. — those come in later seed steps.
//
// Run: `npm --workspace server run seed:ref`

import '../src/env';
import { ulid } from 'ulid';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db';

type BranchCode = 'mum' | 'rai' | 'del' | 'pun';

const BRANCHES: { code: BranchCode; name: string; city: string; kind: string }[] = [
  { code: 'mum', name: 'Mumbai HQ',    city: 'Mumbai, Maharashtra',     kind: 'Office' },
  { code: 'rai', name: 'Raipur Plant', city: 'Raipur, Chhattisgarh',    kind: 'Plant'  },
  { code: 'del', name: 'Delhi Office', city: 'Delhi, NCR',              kind: 'Office' },
  { code: 'pun', name: 'Pune Plant',   city: 'Pune, Maharashtra',       kind: 'Plant'  },
];

const DEPARTMENTS = [
  'Operations', 'Quality Assurance', 'Engineering', 'Finance',
  'Human Resources', 'Logistics', 'IT', 'Marketing', 'Production', 'Maintenance',
];

// Gross amounts in rupees per month (multiplied by 100 below for paise).
const SALARY_GRADES = [
  { code: 'L01', kind: 'Trainee / Junior', minGross:  18000, maxGross:  28000 },
  { code: 'L02', kind: 'Executive',        minGross:  28000, maxGross:  45000 },
  { code: 'L03', kind: 'Senior Executive', minGross:  45000, maxGross:  70000 },
  { code: 'L04', kind: 'Manager',          minGross:  70000, maxGross: 110000 },
  { code: 'L05', kind: 'Senior Manager',   minGross: 110000, maxGross: 200000 },
];

const SHIFTS = [
  { code: 'day',   name: 'Day Shift',     start: '09:00', end: '18:00', kind: 'General',    breakMin: 45 },
  { code: 'night', name: 'Night Shift',   start: '22:00', end: '07:00', kind: 'Production', breakMin: 60 },
  { code: 'rot-a', name: 'Rotational A',  start: '06:00', end: '14:00', kind: 'Production', breakMin: 30 },
  { code: 'rot-b', name: 'Rotational B',  start: '14:00', end: '22:00', kind: 'Production', breakMin: 30 },
  { code: 'flex',  name: 'Flex / Hybrid', start: '10:00', end: '19:00', kind: 'Office',     breakMin: 60 },
];

// branchCodes: 'all' = applies to every branch (junction left empty).
type HolidaySeed = { date: string; name: string; kind: string; branchCodes: 'all' | BranchCode[] };
const HOLIDAYS: HolidaySeed[] = [
  { date: '2026-01-26', name: 'Republic Day',     kind: 'Public',   branchCodes: 'all' },
  { date: '2026-03-06', name: 'Holi',             kind: 'Public',   branchCodes: 'all' },
  { date: '2026-04-14', name: 'Ambedkar Jayanti', kind: 'Optional', branchCodes: ['mum','pun'] },
  { date: '2026-05-01', name: 'Maharashtra Day',  kind: 'Regional', branchCodes: ['mum','pun'] },
  { date: '2026-08-15', name: 'Independence Day', kind: 'Public',   branchCodes: 'all' },
  { date: '2026-08-30', name: 'Janmashtami',      kind: 'Optional', branchCodes: 'all' },
  { date: '2026-10-02', name: 'Gandhi Jayanti',   kind: 'Public',   branchCodes: 'all' },
  { date: '2026-11-01', name: 'Chhattisgarh Day', kind: 'Regional', branchCodes: ['rai'] },
  { date: '2026-11-09', name: 'Diwali',           kind: 'Public',   branchCodes: 'all' },
  { date: '2026-12-25', name: 'Christmas',        kind: 'Public',   branchCodes: 'all' },
];

const USERS = [
  { email: 'hr@cknest.local',      password: 'Hr@123',  role: 'HR_ADMIN' as const },
  { email: 'manager@cknest.local', password: 'Mgr@123', role: 'MANAGER'  as const },
  { email: 'emp@cknest.local',     password: 'Emp@123', role: 'EMPLOYEE' as const },
];

async function clear() {
  // Order matters: child rows first, then parents.
  await pool.query('DELETE FROM holiday_branches');
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM holidays');
  await pool.query('DELETE FROM branches');
  await pool.query('DELETE FROM departments');
  await pool.query('DELETE FROM salary_grades');
  await pool.query('DELETE FROM shifts');
}

async function seedBranches(): Promise<Record<BranchCode, string>> {
  const idByCode = {} as Record<BranchCode, string>;
  for (const b of BRANCHES) {
    const id = ulid();
    idByCode[b.code] = id;
    await pool.execute(
      'INSERT INTO branches (id, code, name, city, kind) VALUES (?, ?, ?, ?, ?)',
      [id, b.code, b.name, b.city, b.kind]
    );
  }
  return idByCode;
}

async function seedDepartments() {
  for (const name of DEPARTMENTS) {
    await pool.execute(
      'INSERT INTO departments (id, name) VALUES (?, ?)',
      [ulid(), name]
    );
  }
}

async function seedSalaryGrades() {
  for (const g of SALARY_GRADES) {
    await pool.execute(
      'INSERT INTO salary_grades (id, code, kind, min_gross, max_gross) VALUES (?, ?, ?, ?, ?)',
      [ulid(), g.code, g.kind, g.minGross * 100, g.maxGross * 100]
    );
  }
}

async function seedShifts() {
  for (const s of SHIFTS) {
    await pool.execute(
      'INSERT INTO shifts (id, code, name, start_time, end_time, kind, break_min) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [ulid(), s.code, s.name, s.start, s.end, s.kind, s.breakMin]
    );
  }
}

async function seedHolidays(branchIdByCode: Record<BranchCode, string>) {
  for (const h of HOLIDAYS) {
    const id = ulid();
    await pool.execute(
      'INSERT INTO holidays (id, date, name, kind) VALUES (?, ?, ?, ?)',
      [id, h.date, h.name, h.kind]
    );
    if (h.branchCodes !== 'all') {
      for (const code of h.branchCodes) {
        await pool.execute(
          'INSERT INTO holiday_branches (holiday_id, branch_id) VALUES (?, ?)',
          [id, branchIdByCode[code]]
        );
      }
    }
  }
}

async function seedUsers() {
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.execute(
      'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [ulid(), u.email, hash, u.role]
    );
  }
}

(async () => {
  console.log('[seed:ref] clearing existing reference data...');
  await clear();

  console.log('[seed:ref] seeding...');
  await seedDepartments();
  await seedSalaryGrades();
  await seedShifts();
  const branchIdByCode = await seedBranches();
  await seedHolidays(branchIdByCode);
  await seedUsers();

  console.log(
    `[seed:ref] done — ${BRANCHES.length} branches, ${DEPARTMENTS.length} departments, ` +
    `${SALARY_GRADES.length} grades, ${SHIFTS.length} shifts, ${HOLIDAYS.length} holidays, ${USERS.length} users`
  );
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
