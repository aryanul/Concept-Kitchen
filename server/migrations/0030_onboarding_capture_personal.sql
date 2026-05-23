-- Migration 0030: Phase 2.G — Capture more personal/Info-tab fields during
-- onboarding so that Close & Archive populates the new Employee Master
-- completely. Mirrors the employees Info-tab columns added in 0025.
--
-- Side tables (applicant_emergency_contacts, applicant_dependents) mirror
-- their employee_* counterparts and are copied verbatim on close.

ALTER TABLE applicant_onboarding
  ADD COLUMN gender                       VARCHAR(30)  NULL,
  ADD COLUMN marital_status               VARCHAR(30)  NULL,
  ADD COLUMN nationality                  VARCHAR(60)  NULL,
  ADD COLUMN religion                     VARCHAR(60)  NULL,
  ADD COLUMN languages_known              JSON         NULL,
  ADD COLUMN caste_category               VARCHAR(30)  NULL,
  ADD COLUMN alternate_phone              VARCHAR(20)  NULL,
  ADD COLUMN alternate_phone_country_code VARCHAR(8)   NULL,
  ADD COLUMN probation_from               DATE         NULL,
  ADD COLUMN probation_to                 DATE         NULL,
  ADD COLUMN employment_type              VARCHAR(30)  NULL,
  ADD COLUMN work_mode                    VARCHAR(20)  NULL,
  ADD COLUMN present_address              JSON         NULL,
  ADD COLUMN permanent_address            JSON         NULL,
  ADD COLUMN pan                          VARCHAR(15)  NULL,
  ADD COLUMN aadhaar                      VARCHAR(20)  NULL;

CREATE TABLE applicant_emergency_contacts (
  id           CHAR(26)     NOT NULL PRIMARY KEY,
  ao_id        CHAR(26)     NOT NULL,
  name         VARCHAR(120) NOT NULL,
  relation     VARCHAR(50)  NULL,
  phone        VARCHAR(30)  NULL,
  phone_country_code VARCHAR(8) NULL,
  address      TEXT         NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_appec_ao FOREIGN KEY (ao_id) REFERENCES applicant_onboarding(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_appec_ao ON applicant_emergency_contacts (ao_id);

CREATE TABLE applicant_dependents (
  id           CHAR(26)     NOT NULL PRIMARY KEY,
  ao_id        CHAR(26)     NOT NULL,
  relation     VARCHAR(50)  NOT NULL,
  name         VARCHAR(120) NOT NULL,
  phone        VARCHAR(30)  NULL,
  phone_country_code VARCHAR(8) NULL,
  email        VARCHAR(190) NULL,
  dob          DATE         NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_appdep_ao FOREIGN KEY (ao_id) REFERENCES applicant_onboarding(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_appdep_ao ON applicant_dependents (ao_id);
