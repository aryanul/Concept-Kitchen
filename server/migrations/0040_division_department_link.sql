-- Migration 0040: divisions -> department link.
--
-- CK's /Division response now carries departmentCode on every row, so the DDD
-- hierarchy (department -> division -> designation) can finally be mirrored in
-- full. departments/designations already had their FKs; divisions did not.
--
-- Like the other CK-derived FK columns (see 0037) this is CK-owned: ckSync sets it
-- and never nulls it, so a re-sync cannot blank a link.
-- One statement per line — migrate.ts splits naively on ';'.

ALTER TABLE divisions ADD COLUMN department_id CHAR(26) NULL AFTER name;

CREATE INDEX ix_divisions_department_id ON divisions (department_id);

ALTER TABLE divisions ADD CONSTRAINT fk_divisions_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
