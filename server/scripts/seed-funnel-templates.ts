// Seeds default screening, interview and offer templates so HR has a working
// flow on day one. Idempotent — skips templates already present by name.
// Usage: npm --workspace server run seed:funnel-templates

import '../src/env';
import { ulid } from 'ulid';
import { pool, query } from '../src/db';

type ScreeningField = {
  name: string; label: string;
  type: 'text' | 'number' | 'select' | 'checkbox';
  options?: string[]; required?: boolean; weight?: number;
};

const SCREENING_TEMPLATES: Array<{ name: string; description: string; fields: ScreeningField[]; isDefault?: boolean }> = [
  {
    name: 'Standard HR Screening',
    description: 'Salary expectation, notice period, work location and basic alignment check.',
    isDefault: true,
    fields: [
      { name: 'salary_expectation', label: 'Salary Expectation (annual)', type: 'number', required: true, weight: 25 },
      { name: 'notice_period_days', label: 'Notice Period (days)',         type: 'number', required: true, weight: 15 },
      { name: 'work_location_ok',   label: 'Accepts proposed work location?', type: 'select',
        options: ['Yes', 'No', 'Negotiable'], required: true, weight: 20 },
      { name: 'reason_for_change',  label: 'Reason for change',            type: 'text', weight: 10 },
      { name: 'culture_fit_notes',  label: 'Culture-fit notes',            type: 'text', weight: 15 },
      { name: 'recommend_interview', label: 'Recommend for interview?',    type: 'checkbox', weight: 15 },
    ],
  },
];

type InterviewField = {
  name: string; label: string;
  type: 'text' | 'number' | 'select' | 'checkbox';
  options?: string[]; required?: boolean; weight?: number;
};

const INTERVIEW_TEMPLATES: Array<{ title: string; description: string; fields: InterviewField[]; isDefault?: boolean }> = [
  {
    title: 'Standard Technical Interview',
    description: 'Generic scorecard covering communication, technical, problem-solving and culture fit.',
    isDefault: true,
    fields: [
      { name: 'communication',    label: 'Communication (0–10)',     type: 'number', required: true, weight: 20 },
      { name: 'technical',        label: 'Technical depth (0–10)',   type: 'number', required: true, weight: 30 },
      { name: 'problem_solving',  label: 'Problem solving (0–10)',   type: 'number', required: true, weight: 25 },
      { name: 'culture_fit',      label: 'Culture fit (0–10)',       type: 'number', required: true, weight: 15 },
      { name: 'ownership',        label: 'Ownership / initiative (0–10)', type: 'number', weight: 10 },
      { name: 'red_flags',        label: 'Red flags',                type: 'text' },
      { name: 'recommend_offer',  label: 'Recommend offer?',         type: 'select',
        options: ['Strong yes', 'Yes', 'Maybe', 'No', 'Strong no'], required: true },
    ],
  },
];

const OFFER_TEMPLATES: Array<{ name: string; description: string; body: string; isDefault?: boolean }> = [
  {
    name: 'Standard Offer Letter',
    description: 'Default offer letter template with merge tokens.',
    isDefault: true,
    body: `Dear {{candidate_name}},

We are delighted to extend an offer of employment for the position of **{{designation}}** at {{company}}, based out of {{branch}}.

**Offer Details**

- Designation: {{designation}}
- Annual CTC: {{ctc_currency}} {{ctc}}
- Joining Date: {{joining_date}}
- Location: {{branch}}

This offer is contingent on background verification and the documentation listed in the onboarding kit shared separately.

Please confirm your acceptance by replying to this email within 7 days from the date of this offer.

Looking forward to having you on board.

Warm regards,
HR Team
{{company}}`,
  },
];

async function seedScreening(): Promise<number> {
  const existing = await query<{ name: string }>('SELECT name FROM screening_templates');
  const seen = new Set(existing.map((r) => r.name.toLowerCase()));
  let added = 0;
  for (const t of SCREENING_TEMPLATES) {
    if (seen.has(t.name.toLowerCase())) continue;
    await query(
      'INSERT INTO screening_templates (id, name, description, fields_json, is_default, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [ulid(), t.name, t.description, JSON.stringify(t.fields), t.isDefault ? 1 : 0]
    );
    added++;
  }
  return added;
}

async function seedInterview(): Promise<number> {
  // Update existing default if present (add fields_json); insert new otherwise.
  let added = 0;
  for (const t of INTERVIEW_TEMPLATES) {
    const found = await query<{ id: string; fields_json: unknown }>(
      'SELECT id, fields_json FROM interview_templates WHERE title = ? LIMIT 1',
      [t.title]
    );
    if (found[0]) {
      if (!found[0].fields_json) {
        await query('UPDATE interview_templates SET fields_json = ?, description = ? WHERE id = ?',
          [JSON.stringify(t.fields), t.description, found[0].id]);
      }
      continue;
    }
    await query(
      'INSERT INTO interview_templates (id, title, description, fields_json, is_default) VALUES (?, ?, ?, ?, ?)',
      [ulid(), t.title, t.description, JSON.stringify(t.fields), t.isDefault ? 1 : 0]
    );
    added++;
  }
  return added;
}

async function seedOffer(): Promise<number> {
  const existing = await query<{ name: string }>('SELECT name FROM offer_templates');
  const seen = new Set(existing.map((r) => r.name.toLowerCase()));
  let added = 0;
  for (const t of OFFER_TEMPLATES) {
    if (seen.has(t.name.toLowerCase())) continue;
    await query(
      'INSERT INTO offer_templates (id, name, description, body_md, is_default, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [ulid(), t.name, t.description, t.body, t.isDefault ? 1 : 0]
    );
    added++;
  }
  return added;
}

(async () => {
  const s = await seedScreening();
  const i = await seedInterview();
  const o = await seedOffer();
  console.log(`[seed:funnel-templates] screening: +${s}, interview: +${i}, offer: +${o}`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
