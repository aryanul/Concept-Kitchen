// Seeds hiring master data: companies (Step 9) + interview templates (Step 11).
// Usage: npm --workspace server run seed:hiring-masters

import '../src/env';
import { ulid } from 'ulid';
import { pool } from '../src/db';

const COMPANIES = [
  { lc: 'LC001', name: 'Concept Kitchen',    branch: 'Raipur',   city: 'Raipur',     location: 'MAHARAJA APARTMENT, C-3, 3RD FLOOR, Shankar Nagar, Raipur, Chhattisgarh 492001, India' },
  { lc: 'LC002', name: 'SK Enterprises',     branch: 'Raipur',   city: 'Raipur',     location: 'Street No. 8, New Shanti Nagar, near Shankar Temple, Raipur, Chhattisgarh 492001, India' },
  { lc: 'LC003', name: 'BO Industries',      branch: 'Raipur',   city: 'Raipur',     location: 'Office No. 25, 3rd Floor, Magneto Mall, Raipur, Chhattisgarh 492001, India' },
  { lc: 'LC004', name: 'One Company',        branch: 'Raipur',   city: 'Raipur',     location: '1st Floor, Mayadevi Market, Station Chowk, Station Rd, Raipur' },
  { lc: 'LC005', name: 'SI Enterprises',     branch: 'Raipur',   city: 'Raipur',     location: 'Ace Global, 303, 3rd Floor, Great Eastern Rd, Telibandha, Raipur, Chhattisgarh 492006, India' },
  { lc: 'LC006', name: 'TechCorp Ltd',       branch: 'Mumbai',   city: 'Mumbai',     location: 'Tech Park, Andheri East, Mumbai, Maharashtra 400069, India' },
  { lc: 'LC007', name: 'InnovateCorp',       branch: 'Bangalore', city: 'Bangalore', location: 'Whitefield, Bengaluru, Karnataka 560066, India' },
  { lc: 'LC008', name: 'Global Industries',  branch: 'Raipur',   city: 'Raipur',     location: 'Industrial Area, Urla, Raipur, Chhattisgarh 493221, India' },
  { lc: 'LC009', name: 'Sunrise Tech',       branch: 'Delhi',    city: 'Delhi',      location: 'Connaught Place, New Delhi, Delhi 110001, India' },
  { lc: 'LC010', name: 'Alpha Solutions',    branch: 'Pune',     city: 'Pune',       location: 'Hinjewadi Phase 1, Pune, Maharashtra 411057, India' },
];

const INTERVIEW_TEMPLATES = [
  { title: 'Structured Interview',   description: 'Predefined, consistent questions for objective scoring. Uses a fixed set of questions asked in the same order to every candidate.' },
  { title: 'Unstructured Interview', description: 'Open, conversational style with flexible questions. Allows the interviewer to explore topics freely based on candidate responses.' },
  { title: 'Panel Interview',        description: 'Multiple interviewers with shared scoring sections. A group of interviewers assess the candidate simultaneously from different perspectives.' },
  { title: 'Behavioral Interview',   description: 'Focus on past experiences and actions. Uses the STAR method — Situation, Task, Action, Result — to evaluate competency-based responses.' },
  { title: 'Technical Interview',    description: 'Assesses domain knowledge, problem-solving and hands-on skills relevant to the role through coding challenges, case studies or practical tests.' },
  { title: 'Case Study Interview',   description: 'Candidate analyses a realistic business problem and proposes solutions. Used for consulting, management and strategy roles.' },
];

(async () => {
  console.log('[seed:hiring-masters] clearing existing data…');
  await pool.query('DELETE FROM hiring_companies');
  await pool.query('DELETE FROM interview_templates');

  console.log('[seed:hiring-masters] seeding companies…');
  for (const c of COMPANIES) {
    await pool.execute(
      'INSERT INTO hiring_companies (id, lc_no, name, branch, city, location) VALUES (?, ?, ?, ?, ?, ?)',
      [ulid(), c.lc, c.name, c.branch, c.city, c.location]
    );
  }

  console.log('[seed:hiring-masters] seeding interview templates…');
  for (const t of INTERVIEW_TEMPLATES) {
    await pool.execute(
      'INSERT INTO interview_templates (id, title, description, is_default) VALUES (?, ?, ?, 1)',
      [ulid(), t.title, t.description]
    );
  }

  console.log(`[seed:hiring-masters] done — ${COMPANIES.length} companies, ${INTERVIEW_TEMPLATES.length} interview templates`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
