-- Migration 0026: Backfill Info-tab columns for employees that were promoted
-- from the hiring pipeline BEFORE the close handler was patched to copy the
-- full set of Info fields.
--
-- Idempotent — every column uses COALESCE so a manually-edited value is
-- preserved. Re-running this is a no-op for already-populated rows.

UPDATE employees e
JOIN applicant_onboarding ao ON ao.promoted_employee_id = e.id
LEFT JOIN applicants  a  ON a.id  = ao.applicant_id
LEFT JOIN designations dx ON dx.id = ao.designation_id
LEFT JOIN branches    b  ON b.id  = e.branch_id
LEFT JOIN phone_number_pool pn ON pn.number = ao.phone_assigned
SET
  e.dob                     = COALESCE(e.dob,                ao.dob),
  e.blood_group             = COALESCE(e.blood_group,        ao.blood_group),
  e.photo_url               = COALESCE(e.photo_url,          a.image_url),
  e.personal_email          = COALESCE(e.personal_email,     a.email),
  e.company_id              = COALESCE(e.company_id,         b.company_id),
  e.division_id             = COALESCE(e.division_id,        ao.division_id, dx.division_id),
  e.office_contact_phone_id = COALESCE(e.office_contact_phone_id, pn.id),
  e.employment_type         = COALESCE(e.employment_type,    'Permanent'),
  e.work_mode               = COALESCE(e.work_mode,          'Onsite'),
  e.personal_phone_country_code = COALESCE(NULLIF(e.personal_phone_country_code, ''), '+91');

-- Repair name parsing for any employee whose last_name still contains spaces
-- (the old splitter put the middle word into last_name, e.g. "K. Patel").
-- Only touched rows where middle_name is NULL — never overwrite explicit data.
UPDATE employees
SET
  middle_name  = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(last_name, ' ', LENGTH(last_name) - LENGTH(REPLACE(last_name, ' ', '')) ), ' ', 1)),
  last_name    = TRIM(SUBSTRING_INDEX(last_name, ' ', -1))
WHERE middle_name IS NULL
  AND last_name LIKE '% %';

-- Display name fallback so the new employee detail page always has something
-- friendly to show in the header band.
UPDATE employees
SET display_name = TRIM(CONCAT_WS(' ', first_name, middle_name, last_name))
WHERE display_name IS NULL OR display_name = '';
