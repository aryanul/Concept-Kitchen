-- Migration 0044: a duty shift or a holiday applies to MANY company / branch /
-- location combinations, not one.
--
-- Until now `shifts` carried a single free-text `company`, a single `branch_id`
-- and a single free-text `location`, so "07:00-15:00 at these four plants"
-- could not be expressed at all. Holidays had `holiday_branches`, which knew
-- about branches but not the company above them or the location below them.
--
-- Both get the same child-table shape so the UI can share one editor:
--   (company_id, branch_id, location_id) with location optional.
-- company_id is stored rather than derived through the branch because it is
-- what the user actually picked, and branches.company_id is nullable.
--
-- The legacy columns on `shifts` are left in place and are no longer written:
-- dropping them would break any report still reading them, and they cost
-- nothing. shift_scopes is the source of truth from here.
--
-- Each statement stands alone — the migration runner splits on ';'.

CREATE TABLE shift_scopes (
  id CHAR(26) NOT NULL PRIMARY KEY,
  shift_id CHAR(26) NOT NULL,
  company_id CHAR(26) NULL,
  branch_id CHAR(26) NOT NULL,
  location_id CHAR(26) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_shift_scopes_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  CONSTRAINT fk_shift_scopes_company FOREIGN KEY (company_id) REFERENCES hiring_companies(id) ON DELETE SET NULL,
  CONSTRAINT fk_shift_scopes_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_shift_scopes_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX ix_shift_scopes_shift ON shift_scopes (shift_id);

CREATE INDEX ix_shift_scopes_branch ON shift_scopes (branch_id);

CREATE TABLE holiday_scopes (
  id CHAR(26) NOT NULL PRIMARY KEY,
  holiday_id CHAR(26) NOT NULL,
  company_id CHAR(26) NULL,
  branch_id CHAR(26) NOT NULL,
  location_id CHAR(26) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_holiday_scopes_holiday FOREIGN KEY (holiday_id) REFERENCES holidays(id) ON DELETE CASCADE,
  CONSTRAINT fk_holiday_scopes_company FOREIGN KEY (company_id) REFERENCES hiring_companies(id) ON DELETE SET NULL,
  CONSTRAINT fk_holiday_scopes_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_holiday_scopes_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX ix_holiday_scopes_holiday ON holiday_scopes (holiday_id);

CREATE INDEX ix_holiday_scopes_branch ON holiday_scopes (branch_id);

-- Backfill: every shift that already named a branch keeps exactly that mapping,
-- with the company resolved through the branch. The old free-text `location`
-- cannot be matched to a locations row reliably, so it stays NULL (= all
-- locations of that branch) rather than being guessed at.
INSERT INTO shift_scopes (id, shift_id, company_id, branch_id, location_id, sort_order)
SELECT LEFT(REPLACE(UUID(), '-', ''), 26), s.id, b.company_id, s.branch_id, NULL, 0
FROM shifts s
JOIN branches b ON b.id = s.branch_id
WHERE s.branch_id IS NOT NULL;

-- Same for holidays, from the branch-only mapping table.
INSERT INTO holiday_scopes (id, holiday_id, company_id, branch_id, location_id, sort_order)
SELECT LEFT(REPLACE(UUID(), '-', ''), 26), hb.holiday_id, b.company_id, hb.branch_id, NULL, 0
FROM holiday_branches hb
JOIN branches b ON b.id = hb.branch_id;
