// Seeds the ATM (Auto Task Mapping) catalogue with canonical hiring-flow tasks.
// Job Profiles pick from this catalogue; admins can extend it via the master CRUD.
// Idempotent: skips tasks whose `task` text already exists.
//
// Usage: npm --workspace server run seed:atm-tasks

import '../src/env';
import { ulid } from 'ulid';
import { pool, query } from '../src/db';

const TASKS: { task: string; description: string; category: string }[] = [
  // Listing & sourcing
  { task: 'Publish Job Listing',          description: 'Post the vacancy on the company careers page and integrated job boards.', category: 'Sourcing' },
  { task: 'Push to Job Aggregators',      description: 'Sync the listing to LinkedIn, Naukri, Indeed and other partner platforms.', category: 'Sourcing' },
  { task: 'Notify Internal Employees',    description: 'Send an internal-referral email and post on company intranet/Slack.', category: 'Sourcing' },
  { task: 'Tag Talent Pool Matches',      description: 'Auto-tag prospects in the talent pool whose match ratio crosses the threshold.', category: 'Sourcing' },

  // Screening
  { task: 'Auto-screen Resumes',          description: 'Run resume against required skills and experience filters; flag matches.', category: 'Screening' },
  { task: 'Send Acknowledgement Email',   description: 'Acknowledge each applicant within 24h with role overview and next steps.', category: 'Screening' },
  { task: 'Schedule Phone Screen',        description: 'Send calendar invites for the initial HR phone screen.', category: 'Screening' },
  { task: 'Capture Screening Score',      description: 'Record the screening interviewer scores against the rubric.', category: 'Screening' },

  // Interview
  { task: 'Assign Interview Panel',       description: 'Pick interviewers based on the JP\'s interview template and route invites.', category: 'Interview' },
  { task: 'Send Interview Invite',        description: 'Send calendar invite, location/link, and prep materials to the candidate.', category: 'Interview' },
  { task: 'Capture Interview Score',      description: 'Persist per-section scores and free-form notes against the candidate.', category: 'Interview' },
  { task: 'Collect Panel Feedback',       description: 'Aggregate panel feedback into a hire/no-hire recommendation.', category: 'Interview' },

  // Offer & background
  { task: 'Initiate Background Check',    description: 'Trigger the external background verification workflow.', category: 'Pre-Offer' },
  { task: 'Generate Offer Letter',        description: 'Auto-fill the offer letter template from JP salary band and candidate details.', category: 'Offer' },
  { task: 'Send Offer Letter',            description: 'Send the signed offer to the candidate via e-sign portal.', category: 'Offer' },
  { task: 'Capture Offer Acceptance',     description: 'Record candidate acceptance/decline; trigger onboarding on accept.', category: 'Offer' },

  // Onboarding
  { task: 'Trigger Onboarding Kit',       description: 'Issue laptop request, ID card, joining giveaways and welcome email.', category: 'Onboarding' },
  { task: 'Provision Email & Accounts',   description: 'IT request for email, ERP, Slack and tool access provisioning.', category: 'Onboarding' },
  { task: 'Schedule Day-1 Orientation',   description: 'Calendar-block orientation, safety briefing and team introductions.', category: 'Onboarding' },
  { task: 'Assign Onboarding Buddy',      description: 'Pair the new hire with a buddy from the same designation.', category: 'Onboarding' },
];

(async () => {
  const existing = await query<{ task: string }>('SELECT task FROM atm_task_catalogue');
  const seen = new Set(existing.map((r) => r.task.toLowerCase()));

  const [maxRow] = await query<{ n: number | string | null }>(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(code, 4) AS UNSIGNED)), 0) AS n FROM atm_task_catalogue WHERE code LIKE 'ATM%'"
  );
  let nextSeq = Number(maxRow?.n ?? 0) + 1;

  let added = 0, skipped = 0;
  for (let i = 0; i < TASKS.length; i++) {
    const t = TASKS[i];
    if (seen.has(t.task.toLowerCase())) { skipped++; continue; }
    const code = `ATM${String(nextSeq++).padStart(3, '0')}`;
    await query(
      `INSERT INTO atm_task_catalogue (id, code, task, description, category, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [ulid(), code, t.task, t.description, t.category, i]
    );
    added++;
  }
  console.log(`[seed:atm-tasks] done — added ${added}, skipped ${skipped}`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
