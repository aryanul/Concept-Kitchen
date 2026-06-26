-- Induction & Onboarding TEMPLATE masters: named bundles selected on a Job
-- Profile, then auto-populated into an applicant's onboarding.
--   Induction template  = a set of presentations + documents
--   Onboarding template = a set of onboarding_items (programs / tours / activities)
CREATE TABLE induction_templates (
  id CHAR(26) NOT NULL PRIMARY KEY,
  code VARCHAR(20) NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE induction_template_items (
  id CHAR(26) NOT NULL PRIMARY KEY,
  template_id CHAR(26) NOT NULL,
  ref_kind VARCHAR(20) NOT NULL,
  ref_id CHAR(26) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_iti_tpl FOREIGN KEY (template_id) REFERENCES induction_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE onboarding_templates (
  id CHAR(26) NOT NULL PRIMARY KEY,
  code VARCHAR(20) NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE onboarding_template_items (
  id CHAR(26) NOT NULL PRIMARY KEY,
  template_id CHAR(26) NOT NULL,
  item_id CHAR(26) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_oti_tpl FOREIGN KEY (template_id) REFERENCES onboarding_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB;
