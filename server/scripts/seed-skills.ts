// Seeds the skills master with sensible defaults across the categories used by
// the Job Profile wizard: Soft Skills, Hard Skills, Education, Tools, Documents,
// Department Functions, Cross-Department Interaction.
//
// Idempotent: skips skills whose `name` already exists.
//
// Usage: npm --workspace server run seed:skills

import '../src/env';
import { ulid } from 'ulid';
import { pool, query } from '../src/db';

const SKILLS: { category: string; items: string[] }[] = [
  { category: 'Soft Skills', items: [
    'Leadership', 'Communication', 'Teamwork', 'Problem Solving', 'Time Management',
    'Adaptability', 'Critical Thinking', 'Conflict Resolution', 'Negotiation',
    'Decision Making', 'Emotional Intelligence', 'Active Listening',
  ]},
  { category: 'Hard Skills', items: [
    'Project Management', 'Data Analysis', 'Financial Modeling', 'Quality Assurance',
    'Process Improvement', 'Inventory Management', 'Supply Chain Management',
    'Production Planning', 'Vendor Management', 'Compliance', 'Auditing',
  ]},
  { category: 'Education', items: [
    'B.Tech', 'B.E.', 'M.Tech', 'MBA', 'B.Com', 'M.Com', 'CA', 'CMA',
    'B.Sc', 'M.Sc', 'PhD', 'Diploma',
  ]},
  { category: 'Tools & Software', items: [
    'AutoCAD', 'SolidWorks', 'SAP', 'Oracle ERP', 'Microsoft Excel', 'Power BI',
    'Tableau', 'Figma', 'Adobe Photoshop', 'JIRA', 'Salesforce', 'QuickBooks',
    'Tally', 'Slack', 'MS Office',
  ]},
  { category: 'Documents', items: [
    'Blue Print', 'SPR Form', 'Purchase Order', 'Invoice', 'Bill of Materials',
    'Engineering Drawing', 'Quality Report', 'Audit Report', 'Compliance Certificate',
    'Standard Operating Procedure',
  ]},
  { category: 'Department Functions', items: [
    'Drafting', 'Quote Checking', 'Procurement', 'Inventory Audit', 'Production Scheduling',
    'Quality Inspection', 'Vendor Coordination', 'Customer Support', 'Sales Lead Generation',
    'Recruitment', 'Payroll Processing', 'Training Coordination',
  ]},
  { category: 'Cross-Department Interaction', items: [
    'Operations', 'Quality Assurance', 'Engineering', 'Finance', 'Human Resources',
    'Logistics', 'IT', 'Marketing', 'Production', 'Maintenance', 'Sales', 'Procurement',
  ]},
];

(async () => {
  const existing = await query<{ name: string }>('SELECT name FROM skills');
  const seen = new Set(existing.map((r) => r.name.toLowerCase()));

  let added = 0;
  let skipped = 0;

  // We need codes like SK001, SK002… seeded sequentially. Find current max.
  // CAST AS UNSIGNED returns a string from the mysql2 driver — coerce explicitly.
  const [maxRow] = await query<{ n: number | string | null }>(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(code, 3) AS UNSIGNED)), 0) AS n FROM skills WHERE code LIKE 'SK%'"
  );
  let nextSeq = Number(maxRow?.n ?? 0) + 1;

  for (const group of SKILLS) {
    for (const name of group.items) {
      const key = name.toLowerCase();
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);
      const code = `SK${String(nextSeq++).padStart(3, '0')}`;
      await query(
        'INSERT INTO skills (id, code, name, category, is_active) VALUES (?, ?, ?, ?, 1)',
        [ulid(), code, name, group.category]
      );
      added++;
    }
  }

  console.log(`[seed:skills] done — added ${added}, skipped ${skipped} (already existed)`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
