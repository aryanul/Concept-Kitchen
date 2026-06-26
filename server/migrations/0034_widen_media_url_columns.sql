-- Files & photos are now uploaded from the device and stored as base64 data
-- URLs (no external storage yet), so every "*_url" column that holds a file or
-- image must be widened from VARCHAR(500) to MEDIUMTEXT.
ALTER TABLE presentations MODIFY COLUMN file_url MEDIUMTEXT NULL;
ALTER TABLE presentations MODIFY COLUMN thumbnail_url MEDIUMTEXT NULL;
ALTER TABLE onboarding_docs MODIFY COLUMN file_url MEDIUMTEXT NULL;
ALTER TABLE onboarding_docs MODIFY COLUMN thumbnail_url MEDIUMTEXT NULL;
ALTER TABLE onboarding_items MODIFY COLUMN thumbnail_url MEDIUMTEXT NULL;
ALTER TABLE training_modules MODIFY COLUMN cover_image_url MEDIUMTEXT NULL;
ALTER TABLE interview_templates MODIFY COLUMN image_url MEDIUMTEXT NULL;
ALTER TABLE onboarding_giveaway_templates MODIFY COLUMN thumbnail_url MEDIUMTEXT NULL;
ALTER TABLE assets MODIFY COLUMN thumbnail_url MEDIUMTEXT NULL;
ALTER TABLE employees MODIFY COLUMN contract_attachment_url MEDIUMTEXT NULL;
ALTER TABLE employees MODIFY COLUMN form16_url MEDIUMTEXT NULL;
ALTER TABLE employees MODIFY COLUMN esignature_url MEDIUMTEXT NULL;
ALTER TABLE employee_documents MODIFY COLUMN file_url MEDIUMTEXT NULL;
ALTER TABLE employee_work_experience MODIFY COLUMN experience_letter_url MEDIUMTEXT NULL;
ALTER TABLE applicant_documents MODIFY COLUMN signed_url MEDIUMTEXT NULL;
ALTER TABLE compensations MODIFY COLUMN attachment_url MEDIUMTEXT NULL;
