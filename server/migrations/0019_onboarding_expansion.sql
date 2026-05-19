-- Migration 0019: Induction & Onboarding expansion
--
-- The writeup blows the flat applicant_onboarding row (giveaways JSON + 3 text
-- blobs) into ~7 structured sub-sections (giveaways, ERP modules, assets,
-- presentations, documents, programs/tours/activities, training modules) plus
-- header fields (DOB, blood group, branch/division/department/designation,
-- induction buddy, ID card / face / biometric tracking).
--
-- Strategy:
--   1. Extend existing master `onboarding_giveaway_templates` with category /
--      occasion / thumbnail so the picker can show tiles grouped by occasion.
--   2. Add new master tables: phone_number_pool, erp_modules,
--      asset_categories + assets, presentations, onboarding_docs,
--      onboarding_items (programs/tours/activities — discriminated by kind),
--      id_card_templates.
--   3. Add `designation_erp_modules` so default ERP module list per designation
--      can pre-populate the activation grid in Pre-Onboarding.
--   4. Extend `applicant_onboarding` with header fields.
--   5. Add child tables linking applicant_onboarding to each master (giveaways
--      already JSON — we keep that for backward compatibility and add a proper
--      child table for new selections; old code keeps working).
--
-- TiDB caveat: each ADD COLUMN / ADD INDEX must be its own statement.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend onboarding_giveaway_templates
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE onboarding_giveaway_templates ADD COLUMN category VARCHAR(60) NULL AFTER name;
ALTER TABLE onboarding_giveaway_templates ADD COLUMN occasion VARCHAR(60) NULL AFTER category;
ALTER TABLE onboarding_giveaway_templates ADD COLUMN thumbnail_url VARCHAR(500) NULL AFTER occasion;
ALTER TABLE onboarding_giveaway_templates ADD COLUMN description TEXT NULL AFTER thumbnail_url;
ALTER TABLE onboarding_giveaway_templates ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER description;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2a. Phone number pool
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE phone_number_pool (
  id CHAR(26) NOT NULL PRIMARY KEY,
  number VARCHAR(30) NOT NULL,
  carrier VARCHAR(60) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available', -- available | assigned | blocked
  assigned_employee_id CHAR(26) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_phone_number (number)
) ENGINE=InnoDB;

CREATE INDEX ix_phone_pool_status ON phone_number_pool (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2b. ERP module master + per-designation defaults
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE erp_modules (
  id CHAR(26) NOT NULL PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  icon VARCHAR(60) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_erp_module_code (code)
) ENGINE=InnoDB;

CREATE TABLE designation_erp_modules (
  designation_id CHAR(26) NOT NULL,
  erp_module_id CHAR(26) NOT NULL,
  default_status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | inactive
  PRIMARY KEY (designation_id, erp_module_id),
  CONSTRAINT fk_dem_designation FOREIGN KEY (designation_id) REFERENCES designations(id) ON DELETE CASCADE,
  CONSTRAINT fk_dem_module FOREIGN KEY (erp_module_id) REFERENCES erp_modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2c. Asset master
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE asset_categories (
  id CHAR(26) NOT NULL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_asset_category_name (name)
) ENGINE=InnoDB;

CREATE TABLE assets (
  id CHAR(26) NOT NULL PRIMARY KEY,
  asset_tag VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  category_id CHAR(26) NULL,
  sub_category VARCHAR(80) NULL,
  serial_no VARCHAR(120) NULL,
  description TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available', -- available | allocated | maintenance | retired
  current_employee_id CHAR(26) NULL,
  purchase_date DATE NULL,
  purchase_cost DECIMAL(12,2) NULL,
  thumbnail_url VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_asset_tag (asset_tag),
  CONSTRAINT fk_assets_cat FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX ix_assets_status ON assets (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2d. Presentations master
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE presentations (
  id CHAR(26) NOT NULL PRIMARY KEY,
  category VARCHAR(60) NULL,
  sub_category VARCHAR(60) NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  file_url VARCHAR(500) NULL,
  thumbnail_url VARCHAR(500) NULL,
  duration_minutes INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE INDEX ix_presentations_cat ON presentations (category, sub_category);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2e. Onboarding documents master (forms, policies, NDAs etc.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE onboarding_docs (
  id CHAR(26) NOT NULL PRIMARY KEY,
  category VARCHAR(60) NULL,
  sub_category VARCHAR(60) NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  file_url VARCHAR(500) NULL,
  thumbnail_url VARCHAR(500) NULL,
  requires_signature TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE INDEX ix_onboarding_docs_cat ON onboarding_docs (category, sub_category);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2f. Onboarding items (programs / tours / activities — single table)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE onboarding_items (
  id CHAR(26) NOT NULL PRIMARY KEY,
  kind VARCHAR(20) NOT NULL, -- program | tour | activity
  category VARCHAR(60) NULL,
  sub_category VARCHAR(60) NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  thumbnail_url VARCHAR(500) NULL,
  duration_minutes INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE INDEX ix_onboarding_items_kind ON onboarding_items (kind, category);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2g. ID card template (single config row per template)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE id_card_templates (
  id CHAR(26) NOT NULL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  layout_json JSON NULL,
  logo_url VARCHAR(500) NULL,
  background_url VARCHAR(500) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Extend applicant_onboarding with header + status fields
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE applicant_onboarding ADD COLUMN dob DATE NULL AFTER training_notes;
ALTER TABLE applicant_onboarding ADD COLUMN blood_group VARCHAR(10) NULL AFTER dob;
ALTER TABLE applicant_onboarding ADD COLUMN division_id CHAR(26) NULL AFTER blood_group;
ALTER TABLE applicant_onboarding ADD COLUMN department_id CHAR(26) NULL AFTER division_id;
ALTER TABLE applicant_onboarding ADD COLUMN designation_id CHAR(26) NULL AFTER department_id;
ALTER TABLE applicant_onboarding ADD COLUMN branch_id CHAR(26) NULL AFTER designation_id;
ALTER TABLE applicant_onboarding ADD COLUMN location_id CHAR(26) NULL AFTER branch_id;
ALTER TABLE applicant_onboarding ADD COLUMN setup_email_account TINYINT(1) NOT NULL DEFAULT 0 AFTER location_id;
ALTER TABLE applicant_onboarding ADD COLUMN email_password_hash VARCHAR(255) NULL AFTER setup_email_account;
ALTER TABLE applicant_onboarding ADD COLUMN id_card_printed_at DATETIME(3) NULL AFTER email_password_hash;
ALTER TABLE applicant_onboarding ADD COLUMN face_mapped_at DATETIME(3) NULL AFTER id_card_printed_at;
ALTER TABLE applicant_onboarding ADD COLUMN biometric_mapped_at DATETIME(3) NULL AFTER face_mapped_at;
ALTER TABLE applicant_onboarding ADD COLUMN induction_buddy_employee_id CHAR(26) NULL AFTER biometric_mapped_at;
ALTER TABLE applicant_onboarding ADD COLUMN id_card_template_id CHAR(26) NULL AFTER induction_buddy_employee_id;
ALTER TABLE applicant_onboarding ADD COLUMN closed_at DATETIME(3) NULL AFTER id_card_template_id;
ALTER TABLE applicant_onboarding ADD COLUMN promoted_employee_id CHAR(26) NULL AFTER closed_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Child tables linking applicant_onboarding -> master rows
-- ─────────────────────────────────────────────────────────────────────────────

-- Giveaways: keep JSON column on parent for backward compat; new child table
-- is authoritative going forward.
CREATE TABLE applicant_giveaways (
  id CHAR(26) NOT NULL PRIMARY KEY,
  ao_id CHAR(26) NOT NULL,
  giveaway_template_id CHAR(26) NULL,
  custom_name VARCHAR(100) NULL, -- when not picked from master
  status VARCHAR(20) NOT NULL DEFAULT 'planned', -- planned | given
  given_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_ag_ao FOREIGN KEY (ao_id) REFERENCES applicant_onboarding(id) ON DELETE CASCADE,
  CONSTRAINT fk_ag_template FOREIGN KEY (giveaway_template_id) REFERENCES onboarding_giveaway_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX ix_applicant_giveaways_ao ON applicant_giveaways (ao_id);

CREATE TABLE applicant_erp_modules (
  id CHAR(26) NOT NULL PRIMARY KEY,
  ao_id CHAR(26) NOT NULL,
  erp_module_id CHAR(26) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'inactive', -- active | inactive | blocked
  activated_at DATETIME(3) NULL,
  blocked_at DATETIME(3) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_aem (ao_id, erp_module_id),
  CONSTRAINT fk_aem_ao FOREIGN KEY (ao_id) REFERENCES applicant_onboarding(id) ON DELETE CASCADE,
  CONSTRAINT fk_aem_module FOREIGN KEY (erp_module_id) REFERENCES erp_modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE applicant_asset_allocations (
  id CHAR(26) NOT NULL PRIMARY KEY,
  ao_id CHAR(26) NOT NULL,
  asset_id CHAR(26) NOT NULL,
  allocated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  returned_at DATETIME(3) NULL,
  notes TEXT NULL,
  CONSTRAINT fk_aaa_ao FOREIGN KEY (ao_id) REFERENCES applicant_onboarding(id) ON DELETE CASCADE,
  CONSTRAINT fk_aaa_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX ix_aaa_ao ON applicant_asset_allocations (ao_id);

CREATE TABLE applicant_presentations (
  id CHAR(26) NOT NULL PRIMARY KEY,
  ao_id CHAR(26) NOT NULL,
  presentation_id CHAR(26) NOT NULL,
  viewed_at DATETIME(3) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | done
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_ap (ao_id, presentation_id),
  CONSTRAINT fk_ap_ao FOREIGN KEY (ao_id) REFERENCES applicant_onboarding(id) ON DELETE CASCADE,
  CONSTRAINT fk_ap_pres FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE applicant_documents (
  id CHAR(26) NOT NULL PRIMARY KEY,
  ao_id CHAR(26) NOT NULL,
  doc_id CHAR(26) NOT NULL,
  signed_at DATETIME(3) NULL,
  signed_url VARCHAR(500) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | signed
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_ad (ao_id, doc_id),
  CONSTRAINT fk_ad_ao FOREIGN KEY (ao_id) REFERENCES applicant_onboarding(id) ON DELETE CASCADE,
  CONSTRAINT fk_ad_doc FOREIGN KEY (doc_id) REFERENCES onboarding_docs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE applicant_onboarding_items (
  id CHAR(26) NOT NULL PRIMARY KEY,
  ao_id CHAR(26) NOT NULL,
  item_id CHAR(26) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | ongoing | done
  scheduled_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_aoi (ao_id, item_id),
  CONSTRAINT fk_aoi_ao FOREIGN KEY (ao_id) REFERENCES applicant_onboarding(id) ON DELETE CASCADE,
  CONSTRAINT fk_aoi_item FOREIGN KEY (item_id) REFERENCES onboarding_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE applicant_trainings (
  id CHAR(26) NOT NULL PRIMARY KEY,
  ao_id CHAR(26) NOT NULL,
  training_module_id CHAR(26) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | ongoing | done | overdue
  due_at DATETIME(3) NULL,
  started_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_atr (ao_id, training_module_id),
  CONSTRAINT fk_atr_ao FOREIGN KEY (ao_id) REFERENCES applicant_onboarding(id) ON DELETE CASCADE,
  CONSTRAINT fk_atr_module FOREIGN KEY (training_module_id) REFERENCES training_modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;
