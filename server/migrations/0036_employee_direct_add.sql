-- Migration 0036: Direct-add to Employee Master.
--
-- Existing employees are onboarded straight into the master (bypassing the full
-- hiring flow). The legacy EK Payroll "General Info" screen carries two pay
-- attributes our schema did not yet model — Pay Mode and Wage Basis — plus a
-- TDS-deduction flag alongside the existing pf_applicable / esi_applicable.
-- Everything else on that screen already maps to existing employee columns
-- (gender, dob, employment_type, default_shift_id, bank_*, pan, uan, esic …)
-- and the salary block is stored as a linked "Joining" compensation record.
--
-- TiDB-safe: one ADD COLUMN clause per line, no `;` inside string literals
-- (the migrate.ts splitter is naive).

ALTER TABLE employees
  ADD COLUMN pay_mode       VARCHAR(20) NULL,
  ADD COLUMN wage_basis     VARCHAR(20) NULL,
  ADD COLUMN tds_applicable TINYINT(1)  NOT NULL DEFAULT 0;
