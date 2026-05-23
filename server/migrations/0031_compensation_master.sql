-- Migration 0031: 02_Compensation Master.
--
-- The Employee Master keeps only a CTC snapshot + a pointer to the active
-- compensation record. All component breakdown / history / approvals live
-- here so payroll and audit can read them independently.
--
-- All money values stored as paise (BIGINT). variable_pay_pct is the percent
-- of CTC paid as variable; the absolute variable amount can also be stored
-- (variable_pay) if the comp is in absolute mode rather than rule-driven.

CREATE TABLE compensations (
  id                   CHAR(26)     NOT NULL PRIMARY KEY,
  code                 VARCHAR(20)  NOT NULL UNIQUE,
  record_type          VARCHAR(30)  NOT NULL,        -- Template | Offer | Joining | Increment | One-time
  employee_id          CHAR(26)     NULL,            -- NULL for Template
  template_id          CHAR(26)     NULL,            -- self-FK if derived from a Template
  effective_from       DATE         NOT NULL,
  effective_to         DATE         NULL,
  annual_ctc           BIGINT       NOT NULL,
  basic                BIGINT       NULL,
  hra                  BIGINT       NULL,
  conveyance           BIGINT       NULL,
  medical_allowance    BIGINT       NULL,
  other_allowances     JSON         NULL,            -- [{name, amount}]
  variable_pay         BIGINT       NULL,            -- absolute paise (optional)
  variable_pay_pct     DECIMAL(6,2) NULL,            -- percentage of CTC
  pf_applicable        TINYINT(1)   NOT NULL DEFAULT 0,
  esi_applicable       TINYINT(1)   NOT NULL DEFAULT 0,
  payroll_code         VARCHAR(60)  NULL,
  status               VARCHAR(20)  NOT NULL DEFAULT 'Draft',  -- Draft | Approved | Active | Archived
  approved_by_user_id  CHAR(26)     NULL,
  approved_at          DATETIME(3)  NULL,
  attachment_url       VARCHAR(500) NULL,
  reason_for_change    VARCHAR(500) NULL,
  notes                TEXT         NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_comp_employee FOREIGN KEY (employee_id)         REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_comp_template FOREIGN KEY (template_id)         REFERENCES compensations(id) ON DELETE SET NULL,
  CONSTRAINT fk_comp_approver FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX ix_comp_employee_status ON compensations (employee_id, status);
CREATE INDEX ix_comp_record_type     ON compensations (record_type);

-- Link the Employee Master to its current active comp.
ALTER TABLE employees
  ADD COLUMN current_compensation_id CHAR(26) NULL AFTER ctc;

ALTER TABLE employees
  ADD CONSTRAINT fk_employees_current_comp FOREIGN KEY (current_compensation_id) REFERENCES compensations(id) ON DELETE SET NULL;

-- Backfill: every existing employee with a non-zero CTC gets one Active
-- "Joining" compensation record. id is derived from UUID() (first 26 hex
-- chars after stripping dashes) so we don't need a stored proc. The code
-- runs in a session-variable counter for sequential CMP-NNNNNN labels.
-- Idempotent-ish: bailing if a comp already exists for an employee.

SET @rownum := 0;

INSERT INTO compensations
  (id, code, record_type, employee_id, effective_from, annual_ctc,
   pf_applicable, esi_applicable, status, approved_at, reason_for_change)
SELECT
  UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 26)),
  CONCAT('CMP-', LPAD(@rownum := @rownum + 1, 6, '0')),
  'Joining',
  e.id,
  e.joining_date,
  e.ctc,
  COALESCE(e.pf_applicable, 0),
  COALESCE(e.esi_applicable, 0),
  'Active',
  e.joining_date,
  'Initial compensation (backfilled from Employee Master CTC snapshot).'
FROM employees e
WHERE e.ctc > 0
  AND NOT EXISTS (SELECT 1 FROM compensations c WHERE c.employee_id = e.id);

-- Point each employee at their backfilled Active comp.
UPDATE employees e
JOIN compensations c ON c.employee_id = e.id AND c.status = 'Active'
SET e.current_compensation_id = c.id
WHERE e.current_compensation_id IS NULL;
