-- Applicant / employee photos are uploaded from the device and stored as a
-- compressed base64 data URL (this deployment has no external file storage).
-- VARCHAR(500) is far too small for that, so widen both columns. employees
-- matters because onboarding copies applicants.image_url into employees.photo_url.
ALTER TABLE applicants MODIFY COLUMN image_url MEDIUMTEXT NULL;
ALTER TABLE employees MODIFY COLUMN photo_url MEDIUMTEXT NULL;
