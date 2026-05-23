-- Migration 0028: Phase 2.C — Employee Master "Job Profile" tab.
--
-- 1. Link each employee to the Job Profile they were hired against. Stays
--    NULL for older rows until backfilled (step 3 below). Nullable because
--    not every employee comes from a JP-driven hire.
-- 2. employee_skills bridge with a 1..5 rating.
-- 3. Backfill job_profile_id for already-promoted employees by walking
--    applicant_onboarding -> applicants -> job_listings -> job_profiles.
--    Idempotent (COALESCE).

ALTER TABLE employees
  ADD COLUMN job_profile_id CHAR(26) NULL AFTER grade_id;

ALTER TABLE employees
  ADD CONSTRAINT fk_employees_job_profile FOREIGN KEY (job_profile_id) REFERENCES job_profiles(id) ON DELETE SET NULL;

CREATE TABLE employee_skills (
  id           CHAR(26)    NOT NULL PRIMARY KEY,
  employee_id  CHAR(26)    NOT NULL,
  skill_id     CHAR(26)    NOT NULL,
  rating       TINYINT     NOT NULL DEFAULT 3,
  notes        VARCHAR(500) NULL,
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_emp_skill (employee_id, skill_id),
  CONSTRAINT fk_emp_skill_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_emp_skill_skill    FOREIGN KEY (skill_id)    REFERENCES skills(id)    ON DELETE CASCADE,
  CONSTRAINT ck_emp_skill_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE INDEX ix_emp_skills_employee ON employee_skills (employee_id);

-- Backfill: connect each already-promoted employee to the JP they came from.
UPDATE employees e
JOIN applicant_onboarding ao ON ao.promoted_employee_id = e.id
JOIN applicants           a  ON a.id  = ao.applicant_id
JOIN job_listings         jl ON jl.id = a.job_listing_id
JOIN job_profiles         jp ON jp.id = jl.job_profile_id
SET e.job_profile_id = COALESCE(e.job_profile_id, jp.id);
