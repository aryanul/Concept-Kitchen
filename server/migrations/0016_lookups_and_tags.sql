-- Migration 0016: Generic lookup master + applicant tag master
--
-- The Vacancy / Job Listing module introduces many enumerated value sets that
-- the writeup wants centrally controllable (listing status, hiring status,
-- applicant source, applicant status, interview mode, salary currency, etc.).
-- Rather than create a table per enum, we store them as rows in a single
-- generic `lookups` table grouped by `lookup_categories`. Each consumer column
-- stores the lookup `code` as a string so we keep the existing varchar
-- ergonomics while making the set of allowed values editable from the UI.

CREATE TABLE lookup_categories (
  id CHAR(26) NOT NULL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  description TEXT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE lookups (
  id CHAR(26) NOT NULL PRIMARY KEY,
  category_id CHAR(26) NOT NULL,
  code VARCHAR(60) NOT NULL,
  label VARCHAR(120) NOT NULL,
  color VARCHAR(32) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_lookups (category_id, code),
  CONSTRAINT fk_lookups_cat FOREIGN KEY (category_id) REFERENCES lookup_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_lookups_cat_sort ON lookups (category_id, sort_order);

-- Applicant tags (separate table because tag set is open-ended and used as M2M).
CREATE TABLE tags (
  id CHAR(26) NOT NULL PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  color VARCHAR(16) NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
