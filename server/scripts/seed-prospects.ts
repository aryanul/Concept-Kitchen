// Seeds talent pool / prospects data.
// Usage: npm --workspace server run seed:prospects

import '../src/env';
import { ulid } from 'ulid';
import { pool } from '../src/db';

const PROSPECTS = [
  { name: 'Karan Kumar',   email: 'karankumar920@gmail.com',   platform: 'LinkedIn', exp: 2,  role: 'Sales Manager',       company: 'CA Enterprises',   loc: 'Raipur', salary: '3.5-5Lpa',  edu: 'B.com',  inst: 'XHS', match: 80, signal: 'Job Seeking', status: 'Not Applied' },
  { name: 'Abhijeet Patel',email: 'abhijeet22@gmail.com',      platform: 'Naukeri',  exp: 4,  role: 'Lead Manager',        company: 'Sun Industries',   loc: 'Raipur', salary: '5-7.5Lpa', edu: 'MBA',   inst: 'XHS', match: 90, signal: 'Job Seeking', status: 'Not Applied' },
  { name: 'Neha Poddar',   email: 'nehapoddar21@gmail.com',    platform: 'LinkedIn', exp: 3,  role: 'Marketing Assistance',company: 'Concept Kitchen',  loc: 'Raipur', salary: '6.5-8Lpa', edu: 'M.Com', inst: 'XHS', match: 90, signal: 'Job Seeking', status: 'Applied'     },
  { name: 'Divya Singh',   email: 'divya32singh@gmail.com',    platform: 'Naukeri',  exp: 5,  role: 'Marketing Head',      company: 'Concept Kitchen',  loc: 'Raipur', salary: '11-13Lpa',edu: 'M.Com', inst: 'XHS', match: 90, signal: 'Job Seeking', status: 'Applied'     },
  { name: 'Harshit Kumar', email: 'harshitkumarj3@gmail.com',  platform: 'Naukeri',  exp: 1,  role: 'Lead Manager',        company: 'Sun Industries',   loc: 'Raipur', salary: '5-7.5Lpa', edu: 'B.Com', inst: 'XHS', match: 90, signal: 'Job Seeking', status: 'Not Applied' },
  { name: 'Priya Sharma',  email: 'priyasharma@gmail.com',     platform: 'LinkedIn', exp: 3.5,role: 'HR Executive',        company: 'TechCorp Ltd',     loc: 'Mumbai', salary: '4-6Lpa',  edu: 'MBA',   inst: 'IMS', match: 85, signal: 'Actively Looking', status: 'Not Applied' },
  { name: 'Rohit Gupta',   email: 'rohitgupta@gmail.com',      platform: 'Naukeri',  exp: 6,  role: 'Senior Developer',    company: 'InnovateCorp',     loc: 'Bangalore', salary: '12-16Lpa', edu: 'B.Tech', inst: 'NIT', match: 92, signal: 'Open to Work', status: 'Applied' },
  { name: 'Anita Verma',   email: 'anitaverma@gmail.com',      platform: 'LinkedIn', exp: 2.5,role: 'QA Engineer',         company: 'Tech Solutions',   loc: 'Pune',  salary: '4-5.5Lpa', edu: 'B.E.', inst: 'VIT', match: 78, signal: 'Job Seeking', status: 'Not Applied' },
  { name: 'Suresh Patil',  email: 'sureshpatil@gmail.com',     platform: 'Naukeri',  exp: 8,  role: 'Plant Manager',       company: 'Global Industries', loc: 'Raipur', salary: '15-20Lpa', edu: 'M.Tech', inst: 'MANIT', match: 88, signal: 'Actively Looking', status: 'Not Applied' },
  { name: 'Meera Joshi',   email: 'meerajoshi@gmail.com',      platform: 'LinkedIn', exp: 4,  role: 'Finance Executive',   company: 'Concept Kitchen',  loc: 'Delhi', salary: '6-9Lpa', edu: 'CA',   inst: 'ICAI', match: 95, signal: 'Open to Work', status: 'Applied' },
];

(async () => {
  console.log('[seed:prospects] clearing existing prospects…');
  await pool.query('DELETE FROM prospects');

  for (let i = 0; i < PROSPECTS.length; i++) {
    const p = PROSPECTS[i];
    await pool.execute(
      `INSERT INTO prospects
        (id, name, email, platform, experience_years, current_role, company,
         location, salary_range, education, institution, match_ratio, engagement_signal, application_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ulid(), p.name, p.email, p.platform, p.exp, p.role, p.company,
       p.loc, p.salary, p.edu, p.inst, p.match, p.signal, p.status]
    );
  }

  console.log(`[seed:prospects] done — ${PROSPECTS.length} prospects seeded`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
