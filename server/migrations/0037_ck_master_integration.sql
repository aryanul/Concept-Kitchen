-- Migration 0037: Concept Kitchen master-data integration
--
-- We mirror CK's central masters (api.conceptkitchen.net) into our own tables
-- as an EDITABLE CO-OWNED mirror. Per-row ownership after sync:
--   * CK owns `name` + `ck_id` (refreshed by sync; read-only in the UI).
--   * Every other column stays OURS and is never touched by sync — the sync
--     runs a partial UPDATE of the CK columns only, so local edits (code, city,
--     description, custom flags) can never be emptied.
--
-- Two structural changes are needed here:
--   1. Add a nullable, unique `ck_id` mapping column per synced table. NULL is
--      allowed (locally-created rows have no CK origin); UNIQUE guards against a
--      CK id mapping to two rows. Multiple NULLs are allowed by TiDB/MySQL.
--   2. Drop the `name` UNIQUE constraint on synced tables. CK returns duplicate
--      names (e.g. Division "POWDER COATING " at id 4 AND id 7); we dedupe on
--      ck_id, not name, so the name-unique index must go.
--
-- Statements are kept single-clause (separate ADD COLUMN / CREATE INDEX) because
-- the migration runner splits on ';' and TiDB prefers discrete DDL statements.

-- ── 1. ck_id mapping column + unique index, per synced table ────────────────

ALTER TABLE branches ADD COLUMN ck_id INT NULL AFTER id;
CREATE UNIQUE INDEX ux_branches_ck_id ON branches (ck_id);

ALTER TABLE departments ADD COLUMN ck_id INT NULL AFTER id;
CREATE UNIQUE INDEX ux_departments_ck_id ON departments (ck_id);

ALTER TABLE divisions ADD COLUMN ck_id INT NULL AFTER id;
CREATE UNIQUE INDEX ux_divisions_ck_id ON divisions (ck_id);

ALTER TABLE designations ADD COLUMN ck_id INT NULL AFTER id;
CREATE UNIQUE INDEX ux_designations_ck_id ON designations (ck_id);

ALTER TABLE locations ADD COLUMN ck_id INT NULL AFTER id;
CREATE UNIQUE INDEX ux_locations_ck_id ON locations (ck_id);

ALTER TABLE hiring_companies ADD COLUMN ck_id INT NULL AFTER id;
CREATE UNIQUE INDEX ux_hiring_companies_ck_id ON hiring_companies (ck_id);

ALTER TABLE skills ADD COLUMN ck_id INT NULL AFTER id;
CREATE UNIQUE INDEX ux_skills_ck_id ON skills (ck_id);

ALTER TABLE lookups ADD COLUMN ck_id INT NULL AFTER id;
CREATE UNIQUE INDEX ux_lookups_ck_id ON lookups (ck_id);

-- ── 2. Drop the `name` UNIQUE index on synced tables (CK has dup names) ──────
-- The inline `name ... UNIQUE` column definition auto-created an index literally
-- named `name` (verified via SHOW INDEX). branches/hiring_companies never had a
-- name-unique index, so they are not touched here.

ALTER TABLE departments DROP INDEX name;
ALTER TABLE divisions DROP INDEX name;
ALTER TABLE designations DROP INDEX name;
ALTER TABLE locations DROP INDEX name;
ALTER TABLE skills DROP INDEX name;

-- ── 3. Skills grouping (Decision D3: flatten, keep CK's Head/Type grouping) ──
-- CK models skills as SkillHead -> SkillType -> SkillMaster. We import the 90
-- SkillMasters into `skills` and keep the grouping denormalized on the row so
-- we can filter/display by Head/Type without new tables or employee_skills FK
-- rework. The *_ck_id columns let sync re-resolve the grouping on refresh.

ALTER TABLE skills ADD COLUMN skill_head VARCHAR(120) NULL AFTER category;
ALTER TABLE skills ADD COLUMN skill_head_ck_id INT NULL AFTER skill_head;
ALTER TABLE skills ADD COLUMN skill_type VARCHAR(120) NULL AFTER skill_head_ck_id;
ALTER TABLE skills ADD COLUMN skill_type_ck_id INT NULL AFTER skill_type;
