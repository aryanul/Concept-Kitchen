-- Migration 0029: Phase 2.D–2.F — Salary/ESIC/PF, Attendance & Leaves,
-- Increment, Ledger, Other tab columns. All editable employee-level fields
-- land here in one shot. Derived/read-only fields (last punch, leave
-- balances, asset count, etc.) stay computed at query time and do not
-- need columns.
--
-- TiDB-safe: ADD COLUMN and ADD CONSTRAINT split into separate ALTERs.
-- No `;` inside string literals (the migrate.ts splitter is naive).

-- Salary, ESIC & PF tab ----------------------------------------------------
ALTER TABLE employees
  ADD COLUMN bank_branch     VARCHAR(120) NULL,
  ADD COLUMN account_type    VARCHAR(20)  NULL,
  ADD COLUMN pf_applicable   TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN esi_applicable  TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN pt_state        VARCHAR(60)  NULL,
  ADD COLUMN form16_url      VARCHAR(500) NULL;

-- Attendance & Leaves tab --------------------------------------------------
ALTER TABLE employees
  ADD COLUMN biometric_mapped         TINYINT(1)  NOT NULL DEFAULT 0,
  ADD COLUMN annual_leave_entitlement INT         NULL,
  ADD COLUMN attendance_rule_id       CHAR(26)    NULL,
  ADD COLUMN default_shift_id         CHAR(26)    NULL;

ALTER TABLE employees
  ADD CONSTRAINT fk_employees_attendance_rule FOREIGN KEY (attendance_rule_id) REFERENCES attendance_rules(id) ON DELETE SET NULL;

ALTER TABLE employees
  ADD CONSTRAINT fk_employees_default_shift   FOREIGN KEY (default_shift_id)   REFERENCES shifts(id)           ON DELETE SET NULL;

-- Increment tab ------------------------------------------------------------
ALTER TABLE employees
  ADD COLUMN next_review_due  DATE NULL,
  ADD COLUMN increment_notes  TEXT NULL;

-- Other tab ----------------------------------------------------------------
-- HR & Compliance, Other Info, Health, Legal, Digital signature, Career.
ALTER TABLE employees
  ADD COLUMN nda_signed                 TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN background_verification    VARCHAR(30)  NULL,
  ADD COLUMN policy_acknowledgements    JSON         NULL,
  ADD COLUMN linkedin_url               VARCHAR(500) NULL,
  ADD COLUMN hobbies                    TEXT         NULL,
  ADD COLUMN willing_to_relocate        VARCHAR(20)  NULL,
  ADD COLUMN willing_to_travel          VARCHAR(20)  NULL,
  ADD COLUMN driving_license            TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN medical_insurance_provider VARCHAR(120) NULL,
  ADD COLUMN medical_policy_number      VARCHAR(80)  NULL,
  ADD COLUMN medical_nominee            VARCHAR(120) NULL,
  ADD COLUMN vaccination_status         JSON         NULL,
  ADD COLUMN bond_signed                TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN visa_work_permit           VARCHAR(200) NULL,
  ADD COLUMN legal_case_declaration     TEXT         NULL,
  ADD COLUMN digital_signature_id       VARCHAR(60)  NULL,
  ADD COLUMN esignature_url             VARCHAR(500) NULL,
  ADD COLUMN workflow_approver_roles    JSON         NULL,
  ADD COLUMN preferred_career_path      VARCHAR(120) NULL,
  ADD COLUMN training_interests         JSON         NULL,
  ADD COLUMN open_to_mentorship         TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN self_assessed_strengths    TEXT         NULL;

-- Backfill biometric_mapped from the hiring flow's onboarding timestamp.
UPDATE employees e
JOIN applicant_onboarding ao ON ao.promoted_employee_id = e.id
SET e.biometric_mapped = 1
WHERE ao.biometric_mapped_at IS NOT NULL
  AND e.biometric_mapped = 0;
