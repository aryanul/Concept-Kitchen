-- Module 8: Hard-coded canonical task catalogue for ATM (Auto Task Mapping).
-- Job Profiles pick from this catalogue; the catalogue rows are seeded and
-- typically not user-editable in production, but the CRUD endpoints exist for
-- ops to extend it.

CREATE TABLE atm_task_catalogue (
  id CHAR(26) NOT NULL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  task VARCHAR(160) NOT NULL,
  description TEXT NULL,
  category VARCHAR(60) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
