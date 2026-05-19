-- Migration 0021: Hiring funnel — screening / interview / offer / hire tabs.
--
-- The Job Listing detail page has six tabs (Applications, Screening,
-- Interviews, Offers, Hire, Activities). The `applicants` table already has
-- `stage` (coarse pipeline state) + `status` (fine-grained sub-state). What
-- it's missing is the per-stage rich data:
--
--   • Screening:  per-applicant filled template + score breakdown
--   • Interview:  multiple rounds with mode / schedule / interviewer / score
--   • Offer:      template-driven offer letter + accept/decline tracking
--   • Activities: append-only audit log of every action on an applicant
--
-- And two new masters:
--   • screening_templates  — HR-defined questionnaires (configurable fields)
--   • offer_templates      — offer letter bodies with merge tokens
--
-- `interview_templates` is extended with a `fields_json` column so it can
-- carry the interview scorecard schema (questions / weights / pass criteria).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Masters
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE screening_templates (
  id CHAR(26) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  fields_json JSON NULL, -- [{name, label, type: text|number|select|checkbox, options?, required?, weight?}]
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE offer_templates (
  id CHAR(26) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  -- body uses {{candidate_name}}, {{designation}}, {{ctc}}, {{joining_date}},
  -- {{branch}}, {{company}} merge tokens (rendered at draft time).
  body_md TEXT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

-- Add scorecard schema to interview_templates (existing table)
ALTER TABLE interview_templates ADD COLUMN fields_json JSON NULL AFTER description;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Per-applicant funnel data
-- ─────────────────────────────────────────────────────────────────────────────

-- Screening: one row per applicant (re-screen overwrites — single record).
CREATE TABLE applicant_screenings (
  id CHAR(26) NOT NULL PRIMARY KEY,
  applicant_id CHAR(26) NOT NULL,
  template_id CHAR(26) NULL,
  responses_json JSON NULL,
  score INT NULL, -- 0–100
  result VARCHAR(20) NULL, -- pass | fail | maybe
  notes TEXT NULL,
  screened_at DATETIME(3) NULL,
  screened_by_user_id CHAR(26) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_appscreen (applicant_id),
  CONSTRAINT fk_as_app FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
  CONSTRAINT fk_as_tpl FOREIGN KEY (template_id) REFERENCES screening_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Interviews: many rows per applicant (multiple rounds).
CREATE TABLE applicant_interviews (
  id CHAR(26) NOT NULL PRIMARY KEY,
  applicant_id CHAR(26) NOT NULL,
  round_no INT NOT NULL DEFAULT 1,
  template_id CHAR(26) NULL,
  mode VARCHAR(40) NULL, -- references lookups.interview_mode codes
  scheduled_at DATETIME(3) NULL,
  duration_minutes INT NULL,
  interviewer_user_id CHAR(26) NULL,
  meeting_url VARCHAR(500) NULL,
  recording_url VARCHAR(500) NULL,
  shared_at DATETIME(3) NULL, -- when schedule was shared with candidate
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  responses_json JSON NULL,
  score INT NULL, -- 0–100
  result VARCHAR(20) NULL, -- pass | fail | hold | no_show
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_ai_app FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_tpl FOREIGN KEY (template_id) REFERENCES interview_templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_ai_interviewer FOREIGN KEY (interviewer_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX ix_ai_applicant_round ON applicant_interviews (applicant_id, round_no);

-- Offers: one row per applicant (re-draft overwrites).
CREATE TABLE applicant_offers (
  id CHAR(26) NOT NULL PRIMARY KEY,
  applicant_id CHAR(26) NOT NULL,
  template_id CHAR(26) NULL,
  draft_body TEXT NULL, -- rendered text with merge tokens applied
  ctc DECIMAL(12,2) NULL,
  ctc_currency VARCHAR(10) NULL,
  joining_date DATE NULL,
  designation VARCHAR(120) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Draft', -- Draft | Sent | Accepted | Declined | Hired | Hold
  drafted_at DATETIME(3) NULL,
  sent_at DATETIME(3) NULL,
  shared_at DATETIME(3) NULL,
  accepted_at DATETIME(3) NULL,
  declined_at DATETIME(3) NULL,
  signed_copy_url VARCHAR(500) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_appoffer (applicant_id),
  CONSTRAINT fk_ao_app FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
  CONSTRAINT fk_ao_tpl FOREIGN KEY (template_id) REFERENCES offer_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Activities (audit log) — append-only.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE applicant_activities (
  id CHAR(26) NOT NULL PRIMARY KEY,
  applicant_id CHAR(26) NOT NULL,
  job_listing_id CHAR(26) NULL,
  actor_user_id CHAR(26) NULL,
  action VARCHAR(60) NOT NULL, -- screen | approve_interview | schedule | start_interview | offer_job | accept_offer | hire | onboard | reject | hold | tag | note | ...
  from_stage VARCHAR(30) NULL,
  to_stage VARCHAR(30) NULL,
  from_status VARCHAR(60) NULL,
  to_status VARCHAR(60) NULL,
  message TEXT NULL,
  meta_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_act_app FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
  CONSTRAINT fk_act_jl FOREIGN KEY (job_listing_id) REFERENCES job_listings(id) ON DELETE SET NULL,
  CONSTRAINT fk_act_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX ix_act_applicant_time ON applicant_activities (applicant_id, created_at);
CREATE INDEX ix_act_listing_time   ON applicant_activities (job_listing_id, created_at);
