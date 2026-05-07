// Seeds default onboarding task templates.
// Run once after 0003 migration.
// Usage: npm --workspace server run seed:hiring

import '../src/env';
import { ulid } from 'ulid';
import { pool } from '../src/db';

const TASKS = [
  // HR
  { category: 'HR', title: 'Submit ID proof (Aadhaar / Passport / Voter ID)', mandatory: 1, order: 1 },
  { category: 'HR', title: 'Submit address proof', mandatory: 1, order: 2 },
  { category: 'HR', title: 'Submit educational certificates', mandatory: 1, order: 3 },
  { category: 'HR', title: 'Complete company policy acknowledgement', mandatory: 1, order: 4 },
  { category: 'HR', title: 'Attend company orientation session', mandatory: 1, order: 5 },
  // Finance
  { category: 'Finance', title: 'Submit bank account details (for salary)', mandatory: 1, order: 1 },
  { category: 'Finance', title: 'Submit PF nomination form', mandatory: 1, order: 2 },
  { category: 'Finance', title: 'Submit ESIC declaration form', mandatory: 0, order: 3 },
  { category: 'Finance', title: 'Submit income tax declaration', mandatory: 0, order: 4 },
  // IT
  { category: 'IT', title: 'Workstation / laptop setup and handover', mandatory: 1, order: 1 },
  { category: 'IT', title: 'Email account and system access provisioned', mandatory: 1, order: 2 },
  { category: 'IT', title: 'Security awareness training completed', mandatory: 1, order: 3 },
  // Operations
  { category: 'Operations', title: 'Site tour and safety briefing', mandatory: 1, order: 1 },
  { category: 'Operations', title: 'Introduction to team and reporting manager', mandatory: 1, order: 2 },
  { category: 'Operations', title: 'NDA / confidentiality agreement signed', mandatory: 1, order: 3 },
];

(async () => {
  console.log('[seed:hiring] clearing existing onboarding tasks…');
  await pool.query('DELETE FROM employee_onboarding');
  await pool.query('DELETE FROM onboarding_tasks');

  for (const t of TASKS) {
    await pool.execute(
      'INSERT INTO onboarding_tasks (id, title, category, is_mandatory, sort_order) VALUES (?, ?, ?, ?, ?)',
      [ulid(), t.title, t.category, t.mandatory, t.order]
    );
  }

  console.log(`[seed:hiring] done — ${TASKS.length} onboarding task templates seeded`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
