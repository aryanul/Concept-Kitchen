-- Migration 0017: Job Listings — the per-(JP, branch, location) hiring slot
-- created from a Vacancy row via "Create Job Listing".
--
-- A Vacancy is a *derived* view (job_profile_locations join + JP). A Job
-- Listing is a concrete record we publish, track hiring status against and
-- attach applicants/interviews/offers to. `listing_no` is auto-generated as
-- JL-#### sequential.
--
-- Status / hiring_status are foreign-keyed to `lookups` *by code* (varchar),
-- consistent with how `kind`/`status` are stored elsewhere in the schema.

CREATE TABLE job_listings (
  id CHAR(26) NOT NULL PRIMARY KEY,
  listing_no VARCHAR(20) NOT NULL UNIQUE,
  sr_no INT NOT NULL,
  job_profile_id CHAR(26) NOT NULL,
  branch_id CHAR(26) NOT NULL,
  location_id CHAR(26) NULL,
  positions INT NOT NULL DEFAULT 1,
  filled INT NOT NULL DEFAULT 0,
  company_name VARCHAR(120) NOT NULL DEFAULT 'Concept Kitchen',
  status VARCHAR(40) NOT NULL DEFAULT 'Open',
  hiring_status VARCHAR(60) NOT NULL DEFAULT 'Applications Invited',
  recruiter_user_id CHAR(26) NULL,
  published_at DATETIME(3) NULL,
  deadline_at DATETIME(3) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_jl_jp FOREIGN KEY (job_profile_id) REFERENCES job_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_jl_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_jl_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  CONSTRAINT fk_jl_recruiter FOREIGN KEY (recruiter_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE UNIQUE INDEX uq_jl_sr_no ON job_listings (sr_no);
CREATE INDEX ix_jl_jp_branch_loc ON job_listings (job_profile_id, branch_id, location_id);

-- Tie applicants to listings (nullable while we still have legacy vacancy_id flow).
ALTER TABLE applicants ADD COLUMN job_listing_id CHAR(26) NULL AFTER vacancy_id;
ALTER TABLE applicants ADD CONSTRAINT fk_applicants_jl FOREIGN KEY (job_listing_id) REFERENCES job_listings(id) ON DELETE CASCADE;
