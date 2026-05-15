// Seeds the training_modules master with starter course modules.
// Idempotent: skips modules whose `name` already exists.
//
// Usage: npm --workspace server run seed:training-modules

import '../src/env';
import { ulid } from 'ulid';
import { pool, query } from '../src/db';

const MODULES = [
  { name: 'Company Orientation',          description: 'Onboarding overview of company history, mission, values and policies.', chapters: 4,  hours: 4 },
  { name: 'Workplace Safety',             description: 'Industrial safety practices, PPE usage, emergency procedures.',        chapters: 5,  hours: 6 },
  { name: 'Quality Management Systems',   description: 'ISO standards, quality control procedures, audit readiness.',          chapters: 6,  hours: 8 },
  { name: 'Lean Manufacturing',           description: '5S, Kaizen, waste reduction and continuous-improvement fundamentals.',  chapters: 7,  hours: 10 },
  { name: 'ERP System Training',          description: 'Hands-on ERP modules, transaction flow, reporting.',                    chapters: 8,  hours: 12 },
  { name: 'Leadership Foundations',       description: 'Team management, delegation, feedback and 1:1 frameworks.',             chapters: 5,  hours: 8 },
  { name: 'Customer Service Excellence',  description: 'Communication skills, complaint handling, CRM best practices.',         chapters: 4,  hours: 6 },
  { name: 'Compliance & Ethics',          description: 'Anti-bribery, data privacy, code of conduct, whistleblower process.',   chapters: 3,  hours: 4 },
  { name: 'AutoCAD Essentials',           description: '2D drafting fundamentals, layers, blocks, annotations.',                 chapters: 9,  hours: 16 },
  { name: 'Excel for Analysts',           description: 'Pivot tables, lookups, formulas, dashboards.',                          chapters: 6,  hours: 10 },
];

(async () => {
  const existing = await query<{ name: string }>('SELECT name FROM training_modules');
  const seen = new Set(existing.map((r) => r.name.toLowerCase()));

  const [maxRow] = await query<{ n: number | string | null }>(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(code, 3) AS UNSIGNED)), 0) AS n FROM training_modules WHERE code LIKE 'TM%'"
  );
  let nextSeq = Number(maxRow?.n ?? 0) + 1;

  let added = 0, skipped = 0;
  for (const m of MODULES) {
    if (seen.has(m.name.toLowerCase())) { skipped++; continue; }
    const code = `TM${String(nextSeq++).padStart(3, '0')}`;
    await query(
      `INSERT INTO training_modules (id, code, name, description, chapter_count, duration_hours, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [ulid(), code, m.name, m.description, m.chapters, m.hours]
    );
    added++;
  }
  console.log(`[seed:training-modules] done — added ${added}, skipped ${skipped}`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
