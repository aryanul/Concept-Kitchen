// Seeds the masters that back Job Profile pickers but are currently empty/thin:
//   • divisions (15 standard org divisions)
//   • designations (~30 across departments with parent hierarchy)
//   • locations (3-4 per branch)
//   • onboarding_giveaway_templates (10 standard items)
//
// Idempotent: skips rows whose `name` already exists in each table.
// Usage: npm --workspace server run seed:jp-masters

import '../src/env';
import { ulid } from 'ulid';
import { pool, query } from '../src/db';

async function getNextCodeSeq(table: string, column: string, prefix: string): Promise<number> {
  const [r] = await query<{ n: number | string | null }>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(${column}, ?) AS UNSIGNED)), 0) AS n
     FROM ${table} WHERE ${column} LIKE ?`,
    [prefix.length + 1, `${prefix}%`]
  );
  return Number(r?.n ?? 0) + 1;
}

// ─── 1. Divisions ────────────────────────────────────────────────────────────
const DIVISIONS = [
  'Operations', 'Quality Assurance', 'Engineering', 'Finance', 'Human Resources',
  'Logistics', 'Information Technology', 'Marketing', 'Production', 'Maintenance',
  'Sales', 'Procurement', 'R&D', 'Customer Service', 'Administration',
];

async function seedDivisions(): Promise<number> {
  const existing = await query<{ name: string }>('SELECT name FROM divisions');
  const seen = new Set(existing.map((r) => r.name.toLowerCase()));
  let seq = await getNextCodeSeq('divisions', 'code', 'DIV');
  let added = 0;
  for (const name of DIVISIONS) {
    if (seen.has(name.toLowerCase())) continue;
    const code = `DIV${String(seq++).padStart(3, '0')}`;
    await query('INSERT INTO divisions (id, code, name, is_active) VALUES (?, ?, ?, 1)', [ulid(), code, name]);
    added++;
  }
  return added;
}

// ─── 2. Designations ─────────────────────────────────────────────────────────
// Standard 4-tier hierarchy per major function. Department mapping is by name.
type DesigSpec = { name: string; level: number; parent?: string; departmentName: string; divisionName?: string };
const DESIGNATIONS: DesigSpec[] = [
  // HR
  { name: 'HR Director',     level: 3,                          departmentName: 'Human Resources', divisionName: 'Human Resources' },
  { name: 'HR Manager',      level: 2, parent: 'HR Director',   departmentName: 'Human Resources', divisionName: 'Human Resources' },
  { name: 'HR Executive',    level: 1, parent: 'HR Manager',    departmentName: 'Human Resources', divisionName: 'Human Resources' },
  { name: 'HR Assistant',    level: 0, parent: 'HR Executive',  departmentName: 'Human Resources', divisionName: 'Human Resources' },

  // Finance
  { name: 'Finance Director',  level: 3,                              departmentName: 'Finance', divisionName: 'Finance' },
  { name: 'Finance Manager',   level: 2, parent: 'Finance Director',  departmentName: 'Finance', divisionName: 'Finance' },
  { name: 'Accounts Executive',level: 1, parent: 'Finance Manager',   departmentName: 'Finance', divisionName: 'Finance' },
  { name: 'Accounts Assistant',level: 0, parent: 'Accounts Executive',departmentName: 'Finance', divisionName: 'Finance' },

  // IT
  { name: 'CTO',               level: 4,                              departmentName: 'IT', divisionName: 'Information Technology' },
  { name: 'Engineering Manager', level: 3, parent: 'CTO',             departmentName: 'IT', divisionName: 'Information Technology' },
  { name: 'Senior Developer',  level: 2, parent: 'Engineering Manager', departmentName: 'IT', divisionName: 'Information Technology' },
  { name: 'Software Engineer', level: 1, parent: 'Senior Developer',  departmentName: 'IT', divisionName: 'Information Technology' },
  { name: 'Junior Developer',  level: 0, parent: 'Software Engineer', departmentName: 'IT', divisionName: 'Information Technology' },

  // Production
  { name: 'Plant Manager',          level: 3,                                  departmentName: 'Production', divisionName: 'Production' },
  { name: 'Production Supervisor',  level: 2, parent: 'Plant Manager',         departmentName: 'Production', divisionName: 'Production' },
  { name: 'Production Operator',    level: 1, parent: 'Production Supervisor', departmentName: 'Production', divisionName: 'Production' },
  { name: 'Floor Supervisor',       level: 1, parent: 'Plant Manager',         departmentName: 'Production', divisionName: 'Production' },

  // Quality Assurance
  { name: 'QA Manager',             level: 2,                                  departmentName: 'Quality Assurance', divisionName: 'Quality Assurance' },
  { name: 'QA Engineer',            level: 1, parent: 'QA Manager',            departmentName: 'Quality Assurance', divisionName: 'Quality Assurance' },
  { name: 'Quality Inspector',      level: 0, parent: 'QA Engineer',           departmentName: 'Quality Assurance', divisionName: 'Quality Assurance' },

  // Engineering
  { name: 'Chief Engineer',         level: 3,                                  departmentName: 'Engineering', divisionName: 'Engineering' },
  { name: 'Engineering Lead',       level: 2, parent: 'Chief Engineer',        departmentName: 'Engineering', divisionName: 'Engineering' },
  { name: 'Design Engineer',        level: 1, parent: 'Engineering Lead',      departmentName: 'Engineering', divisionName: 'Engineering' },

  // Logistics
  { name: 'Logistics Head',         level: 2,                                  departmentName: 'Logistics', divisionName: 'Logistics' },
  { name: 'Logistics Coordinator',  level: 1, parent: 'Logistics Head',        departmentName: 'Logistics', divisionName: 'Logistics' },
  { name: 'Cargo Manager',          level: 1, parent: 'Logistics Head',        departmentName: 'Logistics', divisionName: 'Logistics' },

  // Marketing
  { name: 'Marketing Head',         level: 2,                                  departmentName: 'Marketing', divisionName: 'Marketing' },
  { name: 'Marketing Manager',      level: 1, parent: 'Marketing Head',        departmentName: 'Marketing', divisionName: 'Marketing' },
  { name: 'Marketing Executive',    level: 0, parent: 'Marketing Manager',     departmentName: 'Marketing', divisionName: 'Marketing' },

  // Operations
  { name: 'Operations Head',        level: 3,                                  departmentName: 'Operations', divisionName: 'Operations' },
  { name: 'Senior Manager',         level: 2, parent: 'Operations Head',      departmentName: 'Operations', divisionName: 'Operations' },
  { name: 'Team Leader',            level: 1, parent: 'Senior Manager',        departmentName: 'Operations', divisionName: 'Operations' },

  // Maintenance
  { name: 'Maintenance Manager',    level: 2,                                  departmentName: 'Maintenance', divisionName: 'Maintenance' },
  { name: 'Maintenance Tech',       level: 1, parent: 'Maintenance Manager',   departmentName: 'Maintenance', divisionName: 'Maintenance' },
];

async function seedDesignations(): Promise<number> {
  const depts = await query<{ id: string; name: string }>('SELECT id, name FROM departments');
  const deptByName = new Map(depts.map((d) => [d.name.toLowerCase(), d.id]));
  const divs = await query<{ id: string; name: string }>('SELECT id, name FROM divisions');
  const divByName = new Map(divs.map((d) => [d.name.toLowerCase(), d.id]));

  const existing = await query<{ id: string; name: string }>('SELECT id, name FROM designations');
  const seen = new Map(existing.map((r) => [r.name.toLowerCase(), r.id]));

  let seq = await getNextCodeSeq('designations', 'code', 'DES');
  let added = 0;

  // First pass: insert all without parents to ensure parent rows exist.
  for (const d of DESIGNATIONS) {
    if (seen.has(d.name.toLowerCase())) continue;
    const deptId = deptByName.get(d.departmentName.toLowerCase());
    if (!deptId) continue; // skip if department not present
    const divId = d.divisionName ? divByName.get(d.divisionName.toLowerCase()) : null;
    const code = `DES${String(seq++).padStart(3, '0')}`;
    const id = ulid();
    await query(
      `INSERT INTO designations (id, code, name, department_id, division_id, hierarchy_level, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, code, d.name, deptId, divId ?? null, d.level]
    );
    seen.set(d.name.toLowerCase(), id);
    added++;
  }

  // Second pass: link parent_designation_id (now that all rows exist).
  for (const d of DESIGNATIONS) {
    if (!d.parent) continue;
    const childId = seen.get(d.name.toLowerCase());
    const parentId = seen.get(d.parent.toLowerCase());
    if (childId && parentId) {
      await query('UPDATE designations SET parent_designation_id = ? WHERE id = ? AND parent_designation_id IS NULL',
        [parentId, childId]);
    }
  }
  return added;
}

// ─── 3. Locations ────────────────────────────────────────────────────────────
type LocSpec = { branchName: string; name: string; city: string; state: string };
const LOCATIONS: LocSpec[] = [
  // Mumbai HQ
  { branchName: 'Mumbai HQ', name: 'BKC Tower',           city: 'Mumbai',  state: 'Maharashtra' },
  { branchName: 'Mumbai HQ', name: 'Andheri East Office', city: 'Mumbai',  state: 'Maharashtra' },
  { branchName: 'Mumbai HQ', name: 'Lower Parel Wing',    city: 'Mumbai',  state: 'Maharashtra' },
  // Raipur Plant
  { branchName: 'Raipur Plant', name: 'Urla Plot A',      city: 'Raipur',  state: 'Chhattisgarh' },
  { branchName: 'Raipur Plant', name: 'Urla Plot B',      city: 'Raipur',  state: 'Chhattisgarh' },
  { branchName: 'Raipur Plant', name: 'Bhanpuri Yard',    city: 'Raipur',  state: 'Chhattisgarh' },
  // Delhi Office
  { branchName: 'Delhi Office', name: 'Connaught Place',  city: 'Delhi',   state: 'Delhi' },
  { branchName: 'Delhi Office', name: 'Gurugram Annex',   city: 'Gurugram',state: 'Haryana' },
  { branchName: 'Delhi Office', name: 'Noida Wing',       city: 'Noida',   state: 'Uttar Pradesh' },
  // Pune Plant
  { branchName: 'Pune Plant', name: 'Hinjewadi Block 1',  city: 'Pune',    state: 'Maharashtra' },
  { branchName: 'Pune Plant', name: 'Pimpri Plant',       city: 'Pune',    state: 'Maharashtra' },
  { branchName: 'Pune Plant', name: 'Chakan Yard',        city: 'Pune',    state: 'Maharashtra' },
];

async function seedLocations(): Promise<number> {
  const branches = await query<{ id: string; name: string }>('SELECT id, name FROM branches');
  const branchByName = new Map(branches.map((b) => [b.name.toLowerCase(), b.id]));
  const existing = await query<{ name: string }>('SELECT name FROM locations');
  const seen = new Set(existing.map((r) => r.name.toLowerCase()));
  let seq = await getNextCodeSeq('locations', 'code', 'LOC');
  let added = 0;
  for (const l of LOCATIONS) {
    if (seen.has(l.name.toLowerCase())) continue;
    const branchId = branchByName.get(l.branchName.toLowerCase());
    if (!branchId) continue;
    const code = `LOC${String(seq++).padStart(3, '0')}`;
    await query(
      'INSERT INTO locations (id, code, name, city, state, branch_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [ulid(), code, l.name, l.city, l.state, branchId]
    );
    added++;
  }
  return added;
}

// ─── 4. Onboarding Giveaway Templates ────────────────────────────────────────
const GIVEAWAYS = [
  'Welcome Kit', 'Company ID Card', 'Laptop Bag', 'Branded T-Shirt',
  'Stationery Set', 'Notebook & Pen', 'Coffee Mug', 'Diary',
  'Backpack', 'Company Sticker Pack',
];

async function seedGiveaways(): Promise<number> {
  const existing = await query<{ name: string }>('SELECT name FROM onboarding_giveaway_templates');
  const seen = new Set(existing.map((r) => r.name.toLowerCase()));
  let added = 0;
  for (const name of GIVEAWAYS) {
    if (seen.has(name.toLowerCase())) continue;
    await query('INSERT INTO onboarding_giveaway_templates (id, name, is_default) VALUES (?, ?, 1)', [ulid(), name]);
    added++;
  }
  return added;
}

// ─── Orchestrator ────────────────────────────────────────────────────────────
(async () => {
  const d = await seedDivisions();
  console.log(`[seed:jp-masters] divisions: added ${d}`);
  const g = await seedDesignations();
  console.log(`[seed:jp-masters] designations: added ${g}`);
  const l = await seedLocations();
  console.log(`[seed:jp-masters] locations: added ${l}`);
  const v = await seedGiveaways();
  console.log(`[seed:jp-masters] giveaways: added ${v}`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
