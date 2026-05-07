-- Migration 0006: Extended form data for Job Profile wizard
ALTER TABLE job_profiles
  ADD COLUMN alternate_title VARCHAR(120) NULL AFTER title,
  ADD COLUMN location_applicable VARCHAR(120) NULL AFTER division,
  ADD COLUMN work_shift VARCHAR(60) NULL AFTER location_applicable,
  ADD COLUMN reporting_dept_id CHAR(26) NULL,
  ADD COLUMN reporting_division VARCHAR(80) NULL,
  ADD COLUMN reporting_designation VARCHAR(120) NULL,
  ADD COLUMN form_data JSON NULL;
