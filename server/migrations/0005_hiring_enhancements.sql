-- Migration 0005: Hiring module enhancements to match design
-- Note: TiDB does not support multi-column ALTER TABLE with forward AFTER references,
-- nor inline UNIQUE on ADD COLUMN. Each ADD/INDEX is its own statement.

ALTER TABLE job_profiles ADD COLUMN jp_no VARCHAR(20) NULL AFTER id;
ALTER TABLE job_profiles ADD COLUMN division VARCHAR(80) NULL AFTER department_id;
ALTER TABLE job_profiles ADD COLUMN designation VARCHAR(120) NULL AFTER division;
ALTER TABLE job_profiles ADD COLUMN jp_status VARCHAR(30) NOT NULL DEFAULT 'Pending' AFTER designation;
ALTER TABLE job_profiles ADD UNIQUE INDEX uq_job_profiles_jp_no (jp_no);

ALTER TABLE vacancies ADD COLUMN company_name VARCHAR(120) NOT NULL DEFAULT 'Concept Kitchen' AFTER id;
ALTER TABLE vacancies ADD COLUMN job_id VARCHAR(20) NULL AFTER company_name;
ALTER TABLE vacancies ADD COLUMN location VARCHAR(80) NULL AFTER job_id;
ALTER TABLE vacancies ADD COLUMN division VARCHAR(80) NULL AFTER location;
ALTER TABLE vacancies ADD COLUMN listing_status VARCHAR(30) NOT NULL DEFAULT 'Draft' AFTER division;
ALTER TABLE vacancies ADD UNIQUE INDEX uq_vacancies_job_id (job_id);

ALTER TABLE applicants ADD COLUMN match_score INT NULL AFTER notes;
ALTER TABLE applicants ADD COLUMN screen_score INT NULL AFTER match_score;
ALTER TABLE applicants ADD COLUMN interview_score INT NULL AFTER screen_score;
ALTER TABLE applicants ADD COLUMN source VARCHAR(60) NULL AFTER interview_score;

CREATE TABLE onboarding_giveaway_templates (
  id CHAR(26) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE applicant_onboarding (
  id CHAR(26) NOT NULL PRIMARY KEY,
  applicant_id CHAR(26) NOT NULL,
  giveaways JSON NULL,
  email_assigned VARCHAR(190) NULL,
  phone_assigned VARCHAR(30) NULL,
  induction_notes TEXT NULL,
  onboarding_notes TEXT NULL,
  training_notes TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_ao (applicant_id),
  CONSTRAINT fk_ao_app FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
) ENGINE=InnoDB;
