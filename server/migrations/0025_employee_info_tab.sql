-- Migration 0025: Phase 2.A — Employee Master "Info" tab columns + side tables.
--
-- Columns added to `employees` to back the writeup's Info tab (identity,
-- personal, employment, contact, addresses). Two side tables for the multi-row
-- grids: emergency contacts and dependents.
--
-- ALTERs and FKs are split across statements so TiDB / older MySQL don't
-- complain about referencing a just-added column inside the same ALTER.
-- Never put a `;` inside string literals here — migrate.ts splits naively.

-- Identity, personal, employment columns.
ALTER TABLE employees
  ADD COLUMN middle_name              VARCHAR(50)  NULL AFTER first_name,
  ADD COLUMN display_name             VARCHAR(120) NULL AFTER last_name,
  ADD COLUMN photo_url                VARCHAR(500) NULL,
  ADD COLUMN gender                   VARCHAR(30)  NULL,
  ADD COLUMN dob                      DATE         NULL,
  ADD COLUMN marital_status           VARCHAR(30)  NULL,
  ADD COLUMN blood_group              VARCHAR(10)  NULL,
  ADD COLUMN nationality              VARCHAR(60)  NULL,
  ADD COLUMN religion                 VARCHAR(60)  NULL,
  ADD COLUMN languages_known          JSON         NULL,
  ADD COLUMN caste_category           VARCHAR(30)  NULL,
  ADD COLUMN date_of_confirmation     DATE         NULL,
  ADD COLUMN employment_type          VARCHAR(30)  NULL,
  ADD COLUMN work_mode                VARCHAR(20)  NULL,
  ADD COLUMN probation_from           DATE         NULL,
  ADD COLUMN probation_to             DATE         NULL,
  ADD COLUMN contract_period          TINYINT(1)   NOT NULL DEFAULT 0,
  ADD COLUMN contract_from            DATE         NULL,
  ADD COLUMN contract_to              DATE         NULL,
  ADD COLUMN contract_attachment_url  VARCHAR(500) NULL;

-- Contact + address columns.
ALTER TABLE employees
  ADD COLUMN personal_phone_country_code  VARCHAR(8)   NOT NULL DEFAULT '+91',
  ADD COLUMN alternate_phone              VARCHAR(20)  NULL,
  ADD COLUMN alternate_phone_country_code VARCHAR(8)   NULL,
  ADD COLUMN office_contact_phone_id      CHAR(26)     NULL,
  ADD COLUMN personal_email               VARCHAR(190) NULL,
  ADD COLUMN present_address              JSON         NULL,
  ADD COLUMN permanent_address            JSON         NULL;

ALTER TABLE employees
  ADD CONSTRAINT fk_employees_office_phone FOREIGN KEY (office_contact_phone_id) REFERENCES phone_number_pool(id) ON DELETE SET NULL;

-- Emergency contacts (multi-row).
CREATE TABLE employee_emergency_contacts (
  id           CHAR(26)     NOT NULL PRIMARY KEY,
  employee_id  CHAR(26)     NOT NULL,
  name         VARCHAR(120) NOT NULL,
  relation     VARCHAR(50)  NULL,
  phone        VARCHAR(30)  NULL,
  phone_country_code VARCHAR(8) NULL,
  address      TEXT         NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_emergency_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_emergency_employee ON employee_emergency_contacts (employee_id);

-- Dependents and family (multi-row).
CREATE TABLE employee_dependents (
  id           CHAR(26)     NOT NULL PRIMARY KEY,
  employee_id  CHAR(26)     NOT NULL,
  relation     VARCHAR(50)  NOT NULL,
  name         VARCHAR(120) NOT NULL,
  phone        VARCHAR(30)  NULL,
  phone_country_code VARCHAR(8) NULL,
  email        VARCHAR(190) NULL,
  dob          DATE         NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_dependent_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_dependent_employee ON employee_dependents (employee_id);
