-- Migration 0038: Phase 3 — Relieving (Exit) module
--
-- Models the full exit lifecycle as one `exit_cases` entity that flows through
-- six stages (Initiation → Approval → Clearance → Interview → Settlement →
-- Access Closure → Completed), with child tables for the list-type data in each
-- stage. Mirrors the structure of the Onboarding module.
--
-- Naive migration runner: no ';' inside strings; inline FKs are fine in CREATE
-- TABLE (see 0009); each CREATE INDEX is its own statement.

CREATE TABLE exit_cases (
  id CHAR(26) NOT NULL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  employee_id CHAR(26) NOT NULL,
  exit_type ENUM('RESIGNATION','TERMINATION') NOT NULL,
  reason VARCHAR(160) NULL,
  reason_detail TEXT NULL,
  initiated_by CHAR(26) NULL,
  proposed_last_working_day DATE NULL,
  actual_last_working_day DATE NULL,
  notice_period_type ENUM('FULL','WAIVED','BUYOUT','GARDEN_LEAVE') NULL,
  notice_start_date DATE NULL,
  notice_end_date DATE NULL,
  resignation_doc_url TEXT NULL,
  stage ENUM('INITIATION','APPROVAL','CLEARANCE','INTERVIEW','SETTLEMENT','ACCESS_CLOSURE','COMPLETED') NOT NULL DEFAULT 'INITIATION',
  status ENUM('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  manager_approved_by CHAR(26) NULL,
  manager_approved_at DATETIME(3) NULL,
  hr_approved_by CHAR(26) NULL,
  hr_approved_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_exit_cases_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_exit_cases_employee ON exit_cases (employee_id);
CREATE INDEX ix_exit_cases_stage ON exit_cases (stage);
CREATE INDEX ix_exit_cases_status ON exit_cases (status);

-- Stage 2: approval / notice action log
CREATE TABLE exit_approvals (
  id CHAR(26) NOT NULL PRIMARY KEY,
  exit_case_id CHAR(26) NOT NULL,
  action VARCHAR(40) NOT NULL,
  actor_id CHAR(26) NULL,
  actor_role VARCHAR(20) NULL,
  note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_exit_approvals_case FOREIGN KEY (exit_case_id) REFERENCES exit_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_exit_approvals_case ON exit_approvals (exit_case_id);

-- Stage 3: handover, asset return and departmental No-Dues Certificates
CREATE TABLE exit_clearance_items (
  id CHAR(26) NOT NULL PRIMARY KEY,
  exit_case_id CHAR(26) NOT NULL,
  kind ENUM('NDC','ASSET','HANDOVER') NOT NULL,
  department VARCHAR(80) NULL,
  asset_name VARCHAR(120) NULL,
  label VARCHAR(160) NULL,
  handover_person_id CHAR(26) NULL,
  status ENUM('PENDING','IN_PROGRESS','CLEARED','RETURNED','NA') NOT NULL DEFAULT 'PENDING',
  notes TEXT NULL,
  doc_url TEXT NULL,
  cleared_by CHAR(26) NULL,
  cleared_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_exit_clearance_case FOREIGN KEY (exit_case_id) REFERENCES exit_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_exit_clearance_case ON exit_clearance_items (exit_case_id);

-- Stage 4: exit interview + feedback
CREATE TABLE exit_interviews (
  id CHAR(26) NOT NULL PRIMARY KEY,
  exit_case_id CHAR(26) NOT NULL UNIQUE,
  scheduled_at DATETIME(3) NULL,
  conducted_at DATETIME(3) NULL,
  interviewer_id CHAR(26) NULL,
  questionnaire TEXT NULL,
  hr_notes TEXT NULL,
  grievance_flag TINYINT(1) NOT NULL DEFAULT 0,
  overall_sentiment ENUM('POSITIVE','NEUTRAL','NEGATIVE') NULL,
  status ENUM('PENDING','SCHEDULED','COMPLETED','SKIPPED') NOT NULL DEFAULT 'PENDING',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_exit_interviews_case FOREIGN KEY (exit_case_id) REFERENCES exit_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Stage 5: final settlement header + line items
CREATE TABLE exit_settlements (
  id CHAR(26) NOT NULL PRIMARY KEY,
  exit_case_id CHAR(26) NOT NULL UNIQUE,
  status ENUM('DRAFT','PENDING_FINANCE','APPROVED','PAID') NOT NULL DEFAULT 'DRAFT',
  gross_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_payable DECIMAL(12,2) NOT NULL DEFAULT 0,
  approved_by CHAR(26) NULL,
  approved_at DATETIME(3) NULL,
  finance_note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_exit_settlements_case FOREIGN KEY (exit_case_id) REFERENCES exit_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE exit_settlement_lines (
  id CHAR(26) NOT NULL PRIMARY KEY,
  settlement_id CHAR(26) NOT NULL,
  kind ENUM('EARNING','DEDUCTION') NOT NULL,
  label VARCHAR(120) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  source ENUM('MANUAL','PAYROLL','LEAVE_ENCASHMENT','NOTICE_RECOVERY') NOT NULL DEFAULT 'MANUAL',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_exit_settlement_lines FOREIGN KEY (settlement_id) REFERENCES exit_settlements(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_exit_settlement_lines ON exit_settlement_lines (settlement_id);

-- Stage 5: generated / uploaded documents
CREATE TABLE exit_documents (
  id CHAR(26) NOT NULL PRIMARY KEY,
  exit_case_id CHAR(26) NOT NULL,
  doc_type ENUM('SETTLEMENT_SHEET','RELIEVING_LETTER','EXPERIENCE_CERTIFICATE','REFERENCE_LETTER','OTHER') NOT NULL,
  title VARCHAR(160) NULL,
  url TEXT NULL,
  generated_by CHAR(26) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_exit_documents_case FOREIGN KEY (exit_case_id) REFERENCES exit_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_exit_documents_case ON exit_documents (exit_case_id);

-- Stage 6: access-revocation checklist
CREATE TABLE exit_access_items (
  id CHAR(26) NOT NULL PRIMARY KEY,
  exit_case_id CHAR(26) NOT NULL,
  system_name VARCHAR(120) NOT NULL,
  status ENUM('PENDING','REVOKED','NA') NOT NULL DEFAULT 'PENDING',
  revoked_by CHAR(26) NULL,
  revoked_at DATETIME(3) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_exit_access_case FOREIGN KEY (exit_case_id) REFERENCES exit_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_exit_access_case ON exit_access_items (exit_case_id);
