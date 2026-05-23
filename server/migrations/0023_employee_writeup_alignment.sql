-- Migration 0023: Employee Master writeup alignment (Phase 1 — list-view changes)
--
-- - Link branches to a parent company (hiring_companies).
-- - Give employees their own company_id and division_id FKs so the Employee
--   list can show/filter Company + Division per the writeup. Designation
--   stays a free-text column for now (a later phase will FK it to designations
--   and we will drop division_id then).
-- - Scaffold the Attendance Rules master (referenced from the Attendance &
--   Leaves tab in the writeup).
--
-- ADD COLUMN and ADD CONSTRAINT are split because some MySQL versions reject
-- a single ALTER that adds a column and immediately FKs it.

ALTER TABLE branches
  ADD COLUMN company_id CHAR(26) NULL AFTER kind;

ALTER TABLE branches
  ADD CONSTRAINT fk_branches_company FOREIGN KEY (company_id) REFERENCES hiring_companies(id) ON DELETE SET NULL;

ALTER TABLE employees
  ADD COLUMN company_id  CHAR(26) NULL AFTER branch_id,
  ADD COLUMN division_id CHAR(26) NULL AFTER department_id;

ALTER TABLE employees
  ADD CONSTRAINT fk_employees_company  FOREIGN KEY (company_id)  REFERENCES hiring_companies(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_employees_division FOREIGN KEY (division_id) REFERENCES divisions(id)        ON DELETE SET NULL;

CREATE TABLE attendance_rules (
  id CHAR(26) NOT NULL PRIMARY KEY,
  code VARCHAR(20) NULL UNIQUE,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
