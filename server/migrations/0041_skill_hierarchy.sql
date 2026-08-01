-- Migration 0041: Skill Head / Skill Type hierarchy.
-- Normalizes CK's SkillHead -> SkillType -> SkillMaster grouping into real tables
-- (0037 denormalized this onto `skills` as 4 dead columns, never populated by sync
-- or read by any UI -- superseded here now that the UI needs independently
-- addable Skill Head/Skill Type rows with their own counts).
-- Co-ownership as elsewhere: ck_id/name/image_ck_id/parent-link FK are CK-owned;
-- is_active seeds on INSERT only (same limitation as divisions/designations).

CREATE TABLE skill_heads (
  id CHAR(26) NOT NULL PRIMARY KEY,
  ck_id INT NULL,
  name VARCHAR(120) NOT NULL,
  image_ck_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ux_skill_heads_ck_id ON skill_heads (ck_id);

CREATE TABLE skill_types (
  id CHAR(26) NOT NULL PRIMARY KEY,
  ck_id INT NULL,
  name VARCHAR(120) NOT NULL,
  skill_head_id CHAR(26) NULL,
  image_ck_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ux_skill_types_ck_id ON skill_types (ck_id);

CREATE INDEX ix_skill_types_skill_head_id ON skill_types (skill_head_id);

ALTER TABLE skill_types ADD CONSTRAINT fk_skill_types_skill_head FOREIGN KEY (skill_head_id) REFERENCES skill_heads(id) ON DELETE SET NULL;

ALTER TABLE skills ADD COLUMN skill_type_id CHAR(26) NULL AFTER category;

CREATE INDEX ix_skills_skill_type_id ON skills (skill_type_id);

ALTER TABLE skills ADD CONSTRAINT fk_skills_skill_type FOREIGN KEY (skill_type_id) REFERENCES skill_types(id) ON DELETE SET NULL;

ALTER TABLE skills ADD COLUMN image_ck_id INT NULL AFTER skill_type_id;

ALTER TABLE skills DROP COLUMN skill_head;

ALTER TABLE skills DROP COLUMN skill_head_ck_id;

ALTER TABLE skills DROP COLUMN skill_type;

ALTER TABLE skills DROP COLUMN skill_type_ck_id;
