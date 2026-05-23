-- Migration 0027: Phase 2.B — Documents & Experience tab side tables.
--
-- All three follow the same pattern as 0025's emergency_contacts/dependents:
-- one row per item, FK back to employees with ON DELETE CASCADE, sort_order
-- for stable ordering, and audit timestamps. Bulk-replace semantics on the
-- API side (PUT a full array, server wipes and re-inserts).

CREATE TABLE employee_documents (
  id           CHAR(26)     NOT NULL PRIMARY KEY,
  employee_id  CHAR(26)     NOT NULL,
  doc_type     VARCHAR(60)  NOT NULL,
  doc_number   VARCHAR(60)  NULL,
  description  TEXT         NULL,
  file_url     VARCHAR(500) NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_emp_docs_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_emp_docs_employee ON employee_documents (employee_id);

CREATE TABLE employee_education (
  id                CHAR(26)     NOT NULL PRIMARY KEY,
  employee_id       CHAR(26)     NOT NULL,
  level             VARCHAR(60)  NULL,
  course_name       VARCHAR(160) NULL,
  board_university  VARCHAR(160) NULL,
  institute         VARCHAR(160) NULL,
  specialization    VARCHAR(160) NULL,
  passing_year      DATE         NULL,
  percentage_cgpa   VARCHAR(30)  NULL,
  sort_order        INT          NOT NULL DEFAULT 0,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_emp_edu_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_emp_edu_employee ON employee_education (employee_id);

CREATE TABLE employee_work_experience (
  id                       CHAR(26)     NOT NULL PRIMARY KEY,
  employee_id              CHAR(26)     NOT NULL,
  company_name             VARCHAR(160) NULL,
  designation              VARCHAR(160) NULL,
  from_date                DATE         NULL,
  to_date                  DATE         NULL,
  reporting_manager_name   VARCHAR(120) NULL,
  reporting_manager_phone  VARCHAR(30)  NULL,
  last_drawn_salary        VARCHAR(60)  NULL,
  reason_for_leaving       VARCHAR(160) NULL,
  experience_letter_url    VARCHAR(500) NULL,
  sort_order               INT          NOT NULL DEFAULT 0,
  created_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_emp_exp_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_emp_exp_employee ON employee_work_experience (employee_id);
