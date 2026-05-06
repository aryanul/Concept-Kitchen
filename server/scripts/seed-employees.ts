// Seeds 60 employees deterministically (seed=42, matching the prototype).
// Idempotent: clears employees and unlinks users first.
//
// Run: `npm --workspace server run seed:employees` (after seed:ref).

import '../src/env';
import { ulid } from 'ulid';
import { pool } from '../src/db';

const FIRST_NAMES = [
  'Rohan','Priya','Dilip','Yatin','Karan','Rahul','Ankit','Harish','Meera','Sneha',
  'Vikram','Anjali','Suresh','Pooja','Arun','Kavya','Manoj','Ritu','Nilesh','Deepa',
  'Sandeep','Geeta','Tarun','Lakshmi','Vivek','Neha','Pradeep','Ishaan','Aditi','Rakesh',
];
const LAST_NAMES = [
  'Patel','Sharma','Shukla','Singh','Tripathi','Kumar','Gupta','Verma','Jain','Mehra',
  'Nair','Iyer','Reddy','Rao','Joshi','Pandey','Mishra','Saxena','Agarwal','Kapoor',
];
const DESIGNATIONS = [
  'Production Supervisor','QA Engineer','Software Engineer','Team Leader','Senior Manager',
  'Plant Manager','Floor Supervisor','Logistics Coordinator','HR Executive','Accounts Executive',
  'Field Officer','Quality Inspector','Maintenance Tech','Senior Developer','Cargo Manager',
];
const BANKS = ['HDFC','ICICI','SBI','BOB','IDFC','Axis','Kotak'];

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

(async () => {
  console.log('[seed:employees] fetching reference rows...');
  const [branchRowsRaw] = await pool.query('SELECT id, code FROM branches');
  const [deptRowsRaw]   = await pool.query('SELECT id, name FROM departments');
  const [gradeRowsRaw]  = await pool.query('SELECT id, code FROM salary_grades');

  const branches = branchRowsRaw as { id: string; code: string }[];
  const depts    = deptRowsRaw   as { id: string; name: string }[];
  const grades   = gradeRowsRaw  as { id: string; code: string }[];

  if (!branches.length || !depts.length || !grades.length) {
    throw new Error('Reference tables are empty. Run `npm run seed:ref` first.');
  }

  console.log('[seed:employees] clearing existing employees...');
  await pool.query('UPDATE users SET employee_id = NULL');
  await pool.query('DELETE FROM employees');

  const rand = seededRand(42);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  const created: { id: string; code: string }[] = [];

  for (let i = 1; i <= 60; i++) {
    const fn = pick(FIRST_NAMES);
    const ln = pick(LAST_NAMES);
    const dept = pick(depts);
    const branch = pick(branches);
    const grade = pick(grades);
    const designation = pick(DESIGNATIONS);
    const bank = pick(BANKS);

    const grossMonthly = 18000 + Math.floor(rand() * 80000);
    const ctcPaise = grossMonthly * 12 * 100;
    const status = rand() > 0.08 ? 'ACTIVE' : 'ON_LEAVE';

    const joinYear = 2018 + Math.floor(rand() * 7);
    const joinMonth = 1 + Math.floor(rand() * 9);
    const joinDay = 10 + Math.floor(rand() * 18);
    const joiningDate = `${joinYear}-${String(joinMonth).padStart(2, '0')}-${String(joinDay).padStart(2, '0')}`;

    const phone = '+919' + Math.floor(100000000 + rand() * 899999999).toString().slice(0, 9);
    const code = `CK-EMP-${String(i).padStart(3, '0')}`;
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}.${String(i).padStart(3, '0')}@conceptkitchen.in`;
    const account = '****' + (1000 + Math.floor(rand() * 9000));
    const ifsc = `${bank.toUpperCase()}0001${String(100 + Math.floor(rand() * 900))}`;

    const id = ulid();
    created.push({ id, code });

    await pool.execute(
      `INSERT INTO employees (
        id, code, first_name, last_name, designation, status, joining_date,
        email, phone, branch_id, department_id, grade_id, ctc,
        bank_name, bank_account, ifsc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, code, fn, ln, designation, status, joiningDate,
        email, phone, branch.id, dept.id, grade.id, ctcPaise,
        bank, account, ifsc,
      ]
    );
  }

  console.log('[seed:employees] linking demo users...');
  const emp001 = created.find((e) => e.code === 'CK-EMP-001');
  const emp006 = created.find((e) => e.code === 'CK-EMP-006');
  if (emp001) {
    await pool.execute('UPDATE users SET employee_id = ? WHERE email = ?', [emp001.id, 'emp@cknest.local']);
  }
  if (emp006) {
    await pool.execute('UPDATE users SET employee_id = ? WHERE email = ?', [emp006.id, 'manager@cknest.local']);
  }

  console.log(`[seed:employees] done — ${created.length} employees seeded`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
