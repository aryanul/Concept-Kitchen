-- Migration 0006: Extended form data for Job Profile wizard
-- Split per-column for TiDB (no forward AFTER references in multi-add ALTER).

ALTER TABLE job_profiles ADD COLUMN alternate_title VARCHAR(120) NULL AFTER title;
ALTER TABLE job_profiles ADD COLUMN location_applicable VARCHAR(120) NULL AFTER division;
ALTER TABLE job_profiles ADD COLUMN work_shift VARCHAR(60) NULL AFTER location_applicable;
ALTER TABLE job_profiles ADD COLUMN reporting_dept_id CHAR(26) NULL;
ALTER TABLE job_profiles ADD COLUMN reporting_division VARCHAR(80) NULL;
ALTER TABLE job_profiles ADD COLUMN reporting_designation VARCHAR(120) NULL;
ALTER TABLE job_profiles ADD COLUMN form_data JSON NULL;
