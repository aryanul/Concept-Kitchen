// Seeds all transactional data: attendance (24), leaves (18), payroll period + 30 items,
// loans (6), increments (6), tours (4), incentives (7).
// Mirrors the shape from design/data.jsx deterministically.
// Idempotent — clears existing rows first.
//
// Run AFTER seed:ref and seed:employees.
// Usage: npm --workspace server run seed:transactional

import '../src/env';
import { ulid } from 'ulid';
import { pool } from '../src/db';

// ─── Seeded random (same LCG as data.jsx) ───────────────────────────────────
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

function dt(date: string, h: number, m: number) {
  return `${date} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
}

function toMay(day: number) {
  return `2026-05-${String(day).padStart(2,'0')}`;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
(async () => {
  console.log('[seed:tx] loading employee map…');
  const [empRows] = await pool.query(
    'SELECT id, code, ctc FROM employees ORDER BY code'
  );
  const employees = empRows as { id: string; code: string; ctc: string }[];
  if (!employees.length) throw new Error('No employees found. Run seed:employees first.');
  const byCode: Record<string, { id: string; ctc: number }> = {};
  for (const e of employees) byCode[e.code] = { id: e.id, ctc: Number(e.ctc) };

  // ── Clear in FK-safe order ──────────────────────────────────────────────
  console.log('[seed:tx] clearing existing transactional data…');
  await pool.query('DELETE FROM loan_payments');
  await pool.query('DELETE FROM payroll_items');
  await pool.query('DELETE FROM payroll_periods');
  await pool.query('DELETE FROM loans');
  await pool.query('DELETE FROM increments');
  await pool.query('DELETE FROM tours');
  await pool.query('DELETE FROM incentives');
  await pool.query('DELETE FROM leave_balances');
  await pool.query('DELETE FROM leaves');
  await pool.query('DELETE FROM attendance');

  // ── 1. Attendance — 24 rows for today ───────────────────────────────────
  console.log('[seed:tx] seeding attendance…');
  const randA = seededRand(7);
  const first24 = employees.slice(0, 24);

  for (const emp of first24) {
    const r = randA();
    let inAt: string | null = null;
    let outAt: string | null = null;
    let totalMin = 0;
    let otMin = 0;
    let isLate = 0;
    let source = 'BIOMETRIC';

    if (r < 0.62) {
      // Present
      inAt = dt(today, 9, 0);
      outAt = dt(today, 18, 0);
      totalMin = 480;
      otMin = Math.floor(randA() * 60);
    } else if (r < 0.78) {
      // Late
      const lateMin = 15 + Math.floor(randA() * 30);
      const lh = 9 + Math.floor((lateMin) / 60);
      const lm = lateMin % 60;
      inAt = dt(today, lh, lm);
      outAt = dt(today, 18, 0);
      totalMin = 480 - lateMin;
      isLate = 1;
    } else if (r < 0.88) {
      // Half-Day
      inAt = dt(today, 9, 0);
      outAt = dt(today, 13, 30);
      totalMin = 270;
      source = 'MANUAL';
    } else if (r < 0.95) {
      // On Leave — no punch
      source = 'MANUAL';
    } else {
      // Absent
      source = 'BIOMETRIC';
    }

    await pool.execute(
      `INSERT INTO attendance (id, employee_id, date, in_at, out_at, total_min, ot_min, source, is_late)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ulid(), emp.id, today, inAt, outAt, totalMin, otMin, source, isLate]
    );
  }

  // ── 2. Leaves — 18 rows ──────────────────────────────────────────────────
  console.log('[seed:tx] seeding leaves…');
  const randL = seededRand(99);
  const LEAVE_TYPES = ['EL', 'CL', 'SL', 'LWP', 'TOUR', 'COMP_OFF'] as const;
  const first18 = employees.slice(0, 18);

  for (const emp of first18) {
    const type = LEAVE_TYPES[Math.floor(randL() * LEAVE_TYPES.length)];
    const days = 1 + Math.floor(randL() * 5);
    const r = randL();
    let status: string;
    if (r < 0.50) status = 'APPROVED';
    else if (r < 0.78) status = 'PENDING';
    else if (r < 0.92) status = 'PENDING';
    else status = 'REJECTED';

    const fromDay = 10 + Math.floor(randL() * 18);
    const toDay = Math.min(fromDay + days - 1, 28);
    const fromDate = toMay(fromDay);
    const toDate = toMay(toDay);
    const reason = ['Family wedding', 'Medical appointment', 'Personal work', 'Annual vacation', 'Plant visit – Raipur', 'Sick'][Math.floor(randL() * 6)];

    await pool.execute(
      `INSERT INTO leaves (id, employee_id, type, from_date, to_date, days, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ulid(), emp.id, type, fromDate, toDate, days, reason, status]
    );
  }

  // ── 3. Payroll period + 30 items ────────────────────────────────────────
  console.log('[seed:tx] seeding payroll…');
  const periodId = ulid();
  await pool.execute(
    'INSERT INTO payroll_periods (id, month, year, status) VALUES (?, ?, ?, ?)',
    [periodId, 5, 2026, 'DRAFT']
  );

  const first30 = employees.slice(0, 30);
  for (let i = 0; i < first30.length; i++) {
    const emp = first30[i];
    const monthlyGrossPaise = Math.round(emp.ctc / 12);
    const daysPaid = 26 + (i % 3);
    const proRated = Math.round(monthlyGrossPaise * daysPaid / 31);

    const basicAmt    = Math.round(proRated * 0.40);
    const hraAmt      = Math.round(proRated * 0.20);
    const convAmt     = Math.round(proRated * 0.10);
    const specialAmt  = proRated - basicAmt - hraAmt - convAmt;

    const pfAmt       = Math.round(basicAmt * 0.12);
    const esicAmt     = proRated <= 2100000 ? Math.round(proRated * 0.0075) : 0;
    const ptAmt       = 20000; // ₹200/month in paise

    const totalDeduction = pfAmt + esicAmt + ptAmt;
    const net = proRated - totalDeduction;

    const earnings   = JSON.stringify([
      { component: 'Basic',            amount: basicAmt },
      { component: 'HRA',              amount: hraAmt },
      { component: 'Conveyance',       amount: convAmt },
      { component: 'Special Allowance', amount: specialAmt },
    ]);
    const deductions = JSON.stringify([
      { component: 'PF',                amount: pfAmt },
      { component: 'ESIC',              amount: esicAmt },
      { component: 'Professional Tax',  amount: ptAmt },
    ]);

    const r = (i * 7) % 100;
    const status = r < 60 ? 'DRAFT' : r < 78 ? 'APPROVED' : 'DRAFT';

    await pool.execute(
      `INSERT INTO payroll_items (id, period_id, employee_id, days_paid, gross, earnings, deductions, loan_recovery, net, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [ulid(), periodId, emp.id, daysPaid, proRated, earnings, deductions, net, status]
    );
  }

  // ── 4. Loans — 6 records ────────────────────────────────────────────────
  console.log('[seed:tx] seeding loans…');
  const LOANS = [
    { code: 'CK-EMP-002', kind: 'LOAN',    principal: 250000, outstanding: 162000, emi: 12500, tenure: 24, remaining: 13, status: 'ACTIVE',   purpose: 'Home renovation' },
    { code: 'CK-EMP-007', kind: 'ADVANCE', principal:  25000, outstanding:  10000, emi:  5000, tenure:  5, remaining:  2, status: 'ACTIVE',   purpose: 'Medical' },
    { code: 'CK-EMP-014', kind: 'LOAN',    principal: 150000, outstanding:      0, emi:  8500, tenure: 18, remaining:  0, status: 'CLOSED',   purpose: 'Education' },
    { code: 'CK-EMP-018', kind: 'ADVANCE', principal:  40000, outstanding:  40000, emi: 10000, tenure:  4, remaining:  4, status: 'ACTIVE',   purpose: 'Family event' },
    { code: 'CK-EMP-025', kind: 'LOAN',    principal: 300000, outstanding: 215000, emi: 15000, tenure: 24, remaining: 15, status: 'ACTIVE',   purpose: 'Vehicle' },
    { code: 'CK-EMP-031', kind: 'ADVANCE', principal:  30000, outstanding:  30000, emi:  6000, tenure:  5, remaining:  5, status: 'ACTIVE',   purpose: 'Personal' },
  ];
  for (const l of LOANS) {
    const emp = byCode[l.code];
    if (!emp) { console.warn(`[seed:tx] loan: ${l.code} not found, skip`); continue; }
    await pool.execute(
      `INSERT INTO loans (id, employee_id, kind, principal, outstanding, emi, tenure_months, remaining, status, purpose, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ulid(), emp.id, l.kind, l.principal * 100, l.outstanding * 100, l.emi * 100, l.tenure, l.remaining, l.status, l.purpose, '2025-01-01']
    );
  }

  // ── 5. Increments — 6 records ────────────────────────────────────────────
  console.log('[seed:tx] seeding increments…');
  const STAGE_MAP: Record<string, string> = {
    'HR Approval': 'hr', 'Manager Review': 'manager_review',
    'Approved': 'done', 'Submitted': 'manager_review',
  };
  const INCREMENTS = [
    { code: 'CK-EMP-001', current: 480000,  proposed: 528000,  hike: 10.0, rating: 'Outstanding', stage: 'HR Approval'    },
    { code: 'CK-EMP-004', current: 420000,  proposed: 450000,  hike:  7.1, rating: 'Meets',        stage: 'Manager Review' },
    { code: 'CK-EMP-009', current: 720000,  proposed: 828000,  hike: 15.0, rating: 'Outstanding', stage: 'Approved'        },
    { code: 'CK-EMP-012', current: 540000,  proposed: 567000,  hike:  5.0, rating: 'Meets',        stage: 'Submitted'      },
    { code: 'CK-EMP-021', current: 600000,  proposed: 690000,  hike: 15.0, rating: 'Exceeds',      stage: 'HR Approval'    },
    { code: 'CK-EMP-027', current: 360000,  proposed: 378000,  hike:  5.0, rating: 'Meets',        stage: 'Manager Review' },
  ];
  for (const inc of INCREMENTS) {
    const emp = byCode[inc.code];
    if (!emp) continue;
    await pool.execute(
      `INSERT INTO increments (id, employee_id, cycle_year, current_ctc, proposed_ctc, hike_pct, rating, stage, approvals)
       VALUES (?, ?, 2026, ?, ?, ?, ?, ?, '[]')`,
      [ulid(), emp.id, inc.current * 100, inc.proposed * 100, inc.hike, inc.rating, STAGE_MAP[inc.stage] ?? 'manager_review']
    );
  }

  // ── 6. Tours — 4 records ────────────────────────────────────────────────
  console.log('[seed:tx] seeding tours…');
  const TOURS = [
    { code: 'CK-EMP-005', tourCode: 'TR-0421', from: 'Mumbai',  to: 'Raipur',    fd: '2026-05-12', td: '2026-05-15', advance: 25000, expense: 22400, status: 'settled'     },
    { code: 'CK-EMP-011', tourCode: 'TR-0422', from: 'Delhi',   to: 'Pune',      fd: '2026-05-18', td: '2026-05-19', advance: 12000, expense: 10800, status: 'approved'    },
    { code: 'CK-EMP-019', tourCode: 'TR-0423', from: 'Mumbai',  to: 'Bangalore', fd: '2026-05-22', td: '2026-05-24', advance: 18000, expense:     0, status: 'in_progress' },
    { code: 'CK-EMP-023', tourCode: 'TR-0424', from: 'Raipur',  to: 'Mumbai',    fd: '2026-06-02', td: '2026-06-03', advance:  8000, expense:     0, status: 'requested'  },
  ];
  for (const t of TOURS) {
    const emp = byCode[t.code];
    if (!emp) continue;
    await pool.execute(
      `INSERT INTO tours (id, code, employee_id, from_city, to_city, from_date, to_date, advance, expense, status, itinerary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')`,
      [ulid(), t.tourCode, emp.id, t.from, t.to, t.fd, t.td, t.advance * 100, t.expense * 100, t.status]
    );
  }

  // ── 7. Incentives — 7 records ────────────────────────────────────────────
  console.log('[seed:tx] seeding incentives…');
  const INCENTIVES = [
    { code: 'CK-EMP-001', kind: 'Production Bonus',   amount: 8500,  status: 'approved', pushed: 0 },
    { code: 'CK-EMP-002', kind: 'Quality Award',       amount: 5000,  status: 'approved', pushed: 1 },
    { code: 'CK-EMP-007', kind: 'Spot Recognition',    amount: 2000,  status: 'draft',    pushed: 0 },
    { code: 'CK-EMP-009', kind: 'Performance Bonus',   amount: 12000, status: 'approved', pushed: 0 },
    { code: 'CK-EMP-014', kind: 'Referral Bonus',      amount: 10000, status: 'draft',    pushed: 0 },
    { code: 'CK-EMP-018', kind: 'Production Bonus',    amount: 7500,  status: 'approved', pushed: 1 },
    { code: 'CK-EMP-021', kind: 'Project Completion',  amount: 15000, status: 'approved', pushed: 0 },
  ];
  for (const inc of INCENTIVES) {
    const emp = byCode[inc.code];
    if (!emp) continue;
    await pool.execute(
      `INSERT INTO incentives (id, employee_id, kind, month, year, amount, status, pushed, pushed_at)
       VALUES (?, ?, ?, 5, 2026, ?, ?, ?, ?)`,
      [ulid(), emp.id, inc.kind, inc.amount * 100, inc.status, inc.pushed, inc.pushed === 1 ? '2026-05-01 00:00:00' : null]
    );
  }

  console.log('[seed:tx] done ✓');
  console.log('  attendance: 24 rows for', today);
  console.log('  leaves: 18 rows (May 2026)');
  console.log('  payroll: 1 period (May 2026) + 30 items');
  console.log('  loans: 6 · increments: 6 · tours: 4 · incentives: 7');
  await pool.end();
})().catch(async (err) => {
  console.error('[seed:tx] FAILED:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
