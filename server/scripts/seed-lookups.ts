// Seeds the generic `lookup_categories` + `lookups` tables with the canonical
// enumerated value sets the Vacancy / Job Listing module relies on.
//
// Idempotent: skips categories already present, and within each category skips
// codes already present.
// Usage: npm --workspace server run seed:lookups

import '../src/env';
import { ulid } from 'ulid';
import { pool, query } from '../src/db';

type LookupRow = { code: string; label: string; color?: string; isDefault?: boolean };
type CategorySpec = {
  code: string;
  name: string;
  description: string;
  isSystem?: boolean;
  values: LookupRow[];
};

const CATEGORIES: CategorySpec[] = [
  {
    code: 'listing_status',
    name: 'Job Listing Status',
    description: 'Lifecycle status shown on Job Listing rows.',
    isSystem: true,
    values: [
      { code: 'Open',      label: 'Open',      color: '#888', isDefault: true },
      { code: 'Published', label: 'Published', color: '#222' },
      { code: 'Closed',    label: 'Closed',    color: '#cc4444' },
    ],
  },
  {
    code: 'hiring_status',
    name: 'Hiring Status',
    description: 'Pipeline progress for a Job Listing.',
    isSystem: true,
    values: [
      { code: 'Applications Invited',    label: 'Applications Invited',    isDefault: true },
      { code: 'Application Received',    label: 'Application Received'    },
      { code: 'Screening in Progress',   label: 'Screening in Progress'   },
      { code: 'Interviews in Progress',  label: 'Interviews in Progress'  },
      { code: 'Offers in Progress',      label: 'Offers in Progress'      },
      { code: 'Partially Filled',        label: 'Partially Filled'        },
      { code: 'Hired & Closed',          label: 'Hired & Closed'          },
      { code: 'Cancelled',               label: 'Cancelled'               },
      { code: 'On Hold',                 label: 'On Hold'                 },
      { code: 'Archived',                label: 'Archived'                },
    ],
  },
  {
    code: 'applicant_status',
    name: 'Applicant Status',
    description: 'Per-applicant funnel state inside a Job Listing.',
    isSystem: true,
    values: [
      { code: 'Screening',          label: 'Screening', isDefault: true },
      { code: 'Interview Approved', label: 'Interview Approved' },
      { code: 'Interview Scheduled',label: 'Interview Scheduled' },
      { code: 'No Show',            label: 'No Show' },
      { code: 'Offer Sent',         label: 'Offer Sent' },
      { code: 'Hired',              label: 'Hired' },
      { code: 'Rejected',           label: 'Rejected' },
      { code: 'Offer Declined',     label: 'Offer Declined' },
      { code: 'Position Filled',    label: 'Position Filled' },
      { code: 'On Hold',            label: 'On Hold' },
    ],
  },
  {
    code: 'applicant_source',
    name: 'Applicant Source',
    description: 'Where the application originated.',
    values: [
      { code: 'LinkedIn',  label: 'LinkedIn' },
      { code: 'Naukri',    label: 'Naukri.com' },
      { code: 'Indeed',    label: 'Indeed' },
      { code: 'Website',   label: 'Company Website' },
      { code: 'Email',     label: 'Email' },
      { code: 'WhatsApp',  label: 'WhatsApp' },
      { code: 'Referral',  label: 'Referral' },
      { code: 'Walk-in',   label: 'Walk-in' },
      { code: 'Other',     label: 'Other' },
    ],
  },
  {
    code: 'interview_mode',
    name: 'Interview Mode',
    description: 'How the interview is conducted.',
    values: [
      { code: 'In-Person',         label: 'In-Person' },
      { code: 'Video Call',        label: 'Video Call', isDefault: true },
      { code: 'Phone',             label: 'Phone' },
      { code: 'Group Discussion',  label: 'Group Discussion' },
      { code: 'Online Test',       label: 'Online Test' },
      { code: 'Assignment',        label: 'Take-home Assignment' },
    ],
  },
  {
    code: 'salary_currency',
    name: 'Salary Currency',
    description: 'Currency for salary range fields.',
    values: [
      { code: 'INR', label: '₹ INR', isDefault: true },
      { code: 'USD', label: '$ USD' },
      { code: 'EUR', label: '€ EUR' },
      { code: 'GBP', label: '£ GBP' },
      { code: 'AED', label: 'AED' },
    ],
  },
  {
    code: 'education_level',
    name: 'Education Level',
    description: 'Highest education attained.',
    values: [
      { code: 'High School',   label: 'High School' },
      { code: 'Diploma',       label: 'Diploma' },
      { code: 'Bachelor',      label: "Bachelor's Degree" },
      { code: 'Master',        label: "Master's Degree" },
      { code: 'MBA',           label: 'MBA' },
      { code: 'PhD',           label: 'PhD / Doctorate' },
      { code: 'Certification', label: 'Certification' },
    ],
  },
  {
    code: 'offer_status',
    name: 'Offer Status',
    description: 'Lifecycle of an offer letter.',
    isSystem: true,
    values: [
      { code: 'Draft',    label: 'Draft', isDefault: true },
      { code: 'Sent',     label: 'Sent' },
      { code: 'Accepted', label: 'Accepted' },
      { code: 'Declined', label: 'Declined' },
      { code: 'Hold',     label: 'Hold' },
      { code: 'Hired',    label: 'Hired' },
    ],
  },
  {
    code: 'blood_group',
    name: 'Blood Group',
    description: 'Used in the onboarding header (Other Info).',
    values: [
      { code: 'A+',  label: 'A+' },
      { code: 'A-',  label: 'A-' },
      { code: 'B+',  label: 'B+' },
      { code: 'B-',  label: 'B-' },
      { code: 'AB+', label: 'AB+' },
      { code: 'AB-', label: 'AB-' },
      { code: 'O+',  label: 'O+' },
      { code: 'O-',  label: 'O-' },
    ],
  },
  // ── Personal / HR reference masters ──────────────────────────────────────
  // Rarely-updated value sets owned by us (the writeup's "second field" group).
  // Consumed by the onboarding / employee Personal Details forms. Editable from
  // the Lookup Master page like any other category. Codes mirror the values the
  // forms previously hard-coded so existing saved rows stay valid.
  {
    code: 'gender',
    name: 'Gender',
    description: 'Gender options for personal details.',
    values: [
      { code: 'Male',               label: 'Male' },
      { code: 'Female',             label: 'Female' },
      { code: 'Other',              label: 'Other' },
      { code: 'Prefer not to say',  label: 'Prefer not to say' },
    ],
  },
  {
    code: 'marital_status',
    name: 'Marital Status',
    description: 'Marital status options for personal details.',
    values: [
      { code: 'Single',    label: 'Single', isDefault: true },
      { code: 'Married',   label: 'Married' },
      { code: 'Divorced',  label: 'Divorced' },
      { code: 'Widowed',   label: 'Widowed' },
      { code: 'Separated', label: 'Separated' },
    ],
  },
  {
    code: 'religion',
    name: 'Religion',
    description: 'Religion options for personal details.',
    values: [
      { code: 'Hindu',             label: 'Hindu' },
      { code: 'Muslim',            label: 'Muslim' },
      { code: 'Christian',         label: 'Christian' },
      { code: 'Sikh',              label: 'Sikh' },
      { code: 'Buddhist',          label: 'Buddhist' },
      { code: 'Jain',              label: 'Jain' },
      { code: 'Parsi',             label: 'Parsi' },
      { code: 'Jewish',            label: 'Jewish' },
      { code: 'Other',             label: 'Other' },
      { code: 'Prefer not to say', label: 'Prefer not to say' },
    ],
  },
  {
    code: 'nationality',
    name: 'Nationality',
    description: 'Nationality options for personal details.',
    values: [
      { code: 'Indian',     label: 'Indian', isDefault: true },
      { code: 'Nepali',     label: 'Nepali' },
      { code: 'Bangladeshi',label: 'Bangladeshi' },
      { code: 'Sri Lankan', label: 'Sri Lankan' },
      { code: 'American',   label: 'American' },
      { code: 'British',    label: 'British' },
      { code: 'Canadian',   label: 'Canadian' },
      { code: 'Australian', label: 'Australian' },
      { code: 'Other',      label: 'Other' },
    ],
  },
  {
    code: 'language',
    name: 'Language',
    description: 'Languages known (multi-select on personal details).',
    values: [
      { code: 'English',   label: 'English', isDefault: true },
      { code: 'Hindi',     label: 'Hindi' },
      { code: 'Bengali',   label: 'Bengali' },
      { code: 'Marathi',   label: 'Marathi' },
      { code: 'Telugu',    label: 'Telugu' },
      { code: 'Tamil',     label: 'Tamil' },
      { code: 'Gujarati',  label: 'Gujarati' },
      { code: 'Urdu',      label: 'Urdu' },
      { code: 'Kannada',   label: 'Kannada' },
      { code: 'Odia',      label: 'Odia' },
      { code: 'Malayalam', label: 'Malayalam' },
      { code: 'Punjabi',   label: 'Punjabi' },
      { code: 'Assamese',  label: 'Assamese' },
      { code: 'Other',     label: 'Other' },
    ],
  },
  {
    code: 'caste_category',
    name: 'Caste Category',
    description: 'Reservation category (ST / SC / OBC / EWS) for personal details.',
    values: [
      { code: 'General', label: 'General', isDefault: true },
      { code: 'EWS',     label: 'EWS' },
      { code: 'OBC',     label: 'OBC' },
      { code: 'SC',      label: 'SC' },
      { code: 'ST',      label: 'ST' },
      { code: 'Other',   label: 'Other' },
    ],
  },
  {
    code: 'identification_document_type',
    name: 'Identification & Document Type',
    description: 'Types of identity / KYC documents collected during onboarding.',
    values: [
      { code: 'Aadhaar',         label: 'Aadhaar Card', isDefault: true },
      { code: 'PAN',             label: 'PAN Card' },
      { code: 'Passport',        label: 'Passport' },
      { code: 'Voter ID',        label: 'Voter ID' },
      { code: 'Driving License', label: 'Driving License' },
      { code: 'Ration Card',     label: 'Ration Card' },
      { code: 'Bank Passbook',   label: 'Bank Passbook' },
      { code: 'Other',           label: 'Other' },
    ],
  },
  {
    code: 'social_media',
    name: 'Social Media',
    description: 'Social media / professional network platforms.',
    values: [
      { code: 'LinkedIn',  label: 'LinkedIn' },
      { code: 'Facebook',  label: 'Facebook' },
      { code: 'Instagram', label: 'Instagram' },
      { code: 'Twitter',   label: 'X (Twitter)' },
      { code: 'YouTube',   label: 'YouTube' },
      { code: 'GitHub',    label: 'GitHub' },
      { code: 'Other',     label: 'Other' },
    ],
  },
  {
    code: 'medical_vaccination_type',
    name: 'Medical Vaccination Type',
    description: 'Vaccination types tracked for employees.',
    values: [
      { code: 'COVID-19',     label: 'COVID-19' },
      { code: 'Hepatitis B',  label: 'Hepatitis B' },
      { code: 'Tetanus',      label: 'Tetanus' },
      { code: 'Typhoid',      label: 'Typhoid' },
      { code: 'Influenza',    label: 'Influenza (Flu)' },
      { code: 'Polio',        label: 'Polio' },
      { code: 'Other',        label: 'Other' },
    ],
  },
  {
    code: 'giveaway_occasion',
    name: 'Giveaway Occasion',
    description: 'Occasion grouping for the onboarding giveaway picker tiles.',
    values: [
      { code: 'Onboarding', label: 'Onboarding', isDefault: true },
      { code: 'Birthday',   label: 'Birthday' },
      { code: 'Anniversary',label: 'Work Anniversary' },
      { code: 'Festival',   label: 'Festival' },
      { code: 'Promotion',  label: 'Promotion' },
      { code: 'Exit',       label: 'Exit / Farewell' },
    ],
  },
  {
    code: 'erp_module_status',
    name: 'ERP Module Status',
    description: 'Activation state of an ERP module per employee.',
    isSystem: true,
    values: [
      { code: 'active',   label: 'Active' },
      { code: 'inactive', label: 'Inactive', isDefault: true },
      { code: 'blocked',  label: 'Blocked' },
    ],
  },
  {
    code: 'asset_status',
    name: 'Asset Status',
    description: 'State of an asset in the asset master.',
    isSystem: true,
    values: [
      { code: 'available',    label: 'Available', isDefault: true },
      { code: 'allocated',    label: 'Allocated' },
      { code: 'maintenance',  label: 'Maintenance' },
      { code: 'retired',      label: 'Retired' },
    ],
  },
  {
    code: 'onboarding_item_status',
    name: 'Onboarding Item Status',
    description: 'Per-applicant status for programs / tours / activities.',
    isSystem: true,
    values: [
      { code: 'pending',  label: 'Pending', isDefault: true },
      { code: 'ongoing',  label: 'Ongoing' },
      { code: 'done',     label: 'Done' },
    ],
  },
  {
    code: 'training_status',
    name: 'Training Status',
    description: 'Per-applicant status for assigned training modules.',
    isSystem: true,
    values: [
      { code: 'pending', label: 'Pending', isDefault: true },
      { code: 'ongoing', label: 'Ongoing' },
      { code: 'done',    label: 'Done' },
      { code: 'overdue', label: 'Over Due' },
    ],
  },
  {
    code: 'onboarding_status',
    name: 'Onboarding Status',
    description: 'Overall onboarding session status shown on the list page.',
    isSystem: true,
    values: [
      { code: 'pending',    label: 'Pending', isDefault: true },
      { code: 'onboarding', label: 'Onboarding' },
      { code: 'onboarded',  label: 'Onboarded' },
    ],
  },
  {
    code: 'phone_pool_status',
    name: 'Phone Pool Status',
    description: 'Status of a company phone number in the pool.',
    isSystem: true,
    values: [
      { code: 'available', label: 'Available', isDefault: true },
      { code: 'assigned',  label: 'Assigned' },
      { code: 'blocked',   label: 'Blocked' },
    ],
  },
];

const DEFAULT_TAGS = [
  { name: 'Hot Lead',       color: '#dc2626' },
  { name: 'Cultural Fit',   color: '#16a34a' },
  { name: 'Strong Profile', color: '#2563eb' },
  { name: 'Reference',      color: '#a855f7' },
  { name: 'Internal',       color: '#0891b2' },
  { name: 'Re-engage',      color: '#f59e0b' },
];

async function ensureCategory(spec: CategorySpec): Promise<string> {
  const existing = await query<{ id: string }>(
    'SELECT id FROM lookup_categories WHERE code = ? LIMIT 1',
    [spec.code]
  );
  if (existing.length) return existing[0].id;
  const id = ulid();
  await query(
    'INSERT INTO lookup_categories (id, code, name, description, is_system) VALUES (?, ?, ?, ?, ?)',
    [id, spec.code, spec.name, spec.description, spec.isSystem ? 1 : 0]
  );
  return id;
}

async function seedValues(categoryId: string, values: LookupRow[]): Promise<number> {
  const existing = await query<{ code: string }>(
    'SELECT code FROM lookups WHERE category_id = ?',
    [categoryId]
  );
  const seen = new Set(existing.map((r) => r.code));
  let added = 0;
  let order = 0;
  for (const v of values) {
    order++;
    if (seen.has(v.code)) continue;
    await query(
      'INSERT INTO lookups (id, category_id, code, label, color, sort_order, is_default, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [ulid(), categoryId, v.code, v.label, v.color ?? null, order, v.isDefault ? 1 : 0]
    );
    added++;
  }
  return added;
}

async function seedTags(): Promise<number> {
  const existing = await query<{ name: string }>('SELECT name FROM tags');
  const seen = new Set(existing.map((r) => r.name.toLowerCase()));
  let added = 0;
  for (const t of DEFAULT_TAGS) {
    if (seen.has(t.name.toLowerCase())) continue;
    await query('INSERT INTO tags (id, name, color, is_active) VALUES (?, ?, ?, 1)', [
      ulid(), t.name, t.color,
    ]);
    added++;
  }
  return added;
}

(async () => {
  let totalCategories = 0;
  let totalValues = 0;
  for (const spec of CATEGORIES) {
    const id = await ensureCategory(spec);
    const added = await seedValues(id, spec.values);
    totalValues += added;
    totalCategories++;
    console.log(`[seed:lookups] ${spec.code}: +${added} value(s)`);
  }
  const tagAdded = await seedTags();
  console.log(`[seed:lookups] categories processed: ${totalCategories}, new values: ${totalValues}, new tags: ${tagAdded}`);
  await pool.end();
})().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
