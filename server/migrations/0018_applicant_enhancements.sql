-- Migration 0018: Extend applicants for the Applications tab on the Job
-- Listing detail page. Per writeup: Application ID, Image, Source, Current
-- Role, Location, Salary Range, Education, Institution, Match Ratio,
-- Status, Tags.

ALTER TABLE applicants ADD COLUMN app_no VARCHAR(20) NULL AFTER id;
ALTER TABLE applicants ADD UNIQUE INDEX uq_applicants_app_no (app_no);
ALTER TABLE applicants ADD COLUMN image_url VARCHAR(500) NULL AFTER notes;
ALTER TABLE applicants ADD COLUMN `current_role` VARCHAR(120) NULL AFTER current_company;
ALTER TABLE applicants ADD COLUMN location VARCHAR(120) NULL AFTER `current_role`;
ALTER TABLE applicants ADD COLUMN salary_min DECIMAL(12,2) NULL AFTER location;
ALTER TABLE applicants ADD COLUMN salary_max DECIMAL(12,2) NULL AFTER salary_min;
ALTER TABLE applicants ADD COLUMN salary_currency VARCHAR(10) NULL AFTER salary_max;
ALTER TABLE applicants ADD COLUMN education_level VARCHAR(60) NULL AFTER salary_currency;
ALTER TABLE applicants ADD COLUMN institution VARCHAR(160) NULL AFTER education_level;
ALTER TABLE applicants ADD COLUMN match_ratio INT NULL AFTER institution;
ALTER TABLE applicants ADD COLUMN status VARCHAR(60) NOT NULL DEFAULT 'Screening' AFTER match_ratio;

CREATE TABLE applicant_tags (
  applicant_id CHAR(26) NOT NULL,
  tag_id CHAR(26) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (applicant_id, tag_id),
  CONSTRAINT fk_at_app FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
  CONSTRAINT fk_at_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB;
