-- Migration 0020: Make applicants.vacancy_id nullable.
--
-- Applicants now flow through Job Listings (see migration 0017). The old
-- Vacancy linkage is kept for backward compatibility but is no longer
-- required, so the NOT NULL constraint blocks the new flow which inserts
-- with job_listing_id only.

ALTER TABLE applicants MODIFY COLUMN vacancy_id CHAR(26) NULL;
