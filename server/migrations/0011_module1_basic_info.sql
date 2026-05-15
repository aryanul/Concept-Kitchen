-- Module 1 (Step 1 — Basic Info): link JP to a parent designation, plus child
-- tables for Location Applicable and multi-Work-Shift selection.

ALTER TABLE job_profiles ADD COLUMN designation_id CHAR(26) NULL AFTER department_id;
ALTER TABLE job_profiles ADD CONSTRAINT fk_jp_designation FOREIGN KEY (designation_id) REFERENCES designations(id) ON DELETE SET NULL;

CREATE TABLE job_profile_locations (
  id CHAR(26) NOT NULL PRIMARY KEY,
  job_profile_id CHAR(26) NOT NULL,
  branch_id CHAR(26) NOT NULL,
  location_id CHAR(26) NULL,
  positions INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_jpl_jp FOREIGN KEY (job_profile_id) REFERENCES job_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_jpl_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT fk_jpl_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  UNIQUE KEY uq_jpl (job_profile_id, branch_id, location_id)
) ENGINE=InnoDB;

CREATE TABLE job_profile_shifts (
  id CHAR(26) NOT NULL PRIMARY KEY,
  job_profile_id CHAR(26) NOT NULL,
  shift_id CHAR(26) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_jps_jp FOREIGN KEY (job_profile_id) REFERENCES job_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_jps_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_jps (job_profile_id, shift_id)
) ENGINE=InnoDB;
