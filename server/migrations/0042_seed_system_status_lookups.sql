-- Guarantee the two system lookup categories that the Create Job Listing modal
-- depends on actually exist in every environment.
--
-- Why this is a migration and not left to `npm run seed:lookups`: the seed is a
-- manual step, and on a deployed database nobody remembers to run it. The result
-- was the Status / Hiring status dropdowns rendering with zero <option>s — the
-- form then failed its required-field check with nothing for the user to pick,
-- so no Job Listing could be created at all. Migrations run on every deploy, so
-- putting the system rows here makes the modal work on a fresh DB by default.
--
-- Idempotent: INSERT IGNORE leans on `lookup_categories.code` being UNIQUE and
-- on `uq_lookups (category_id, code)`. Re-running changes nothing, and it will
-- not clobber labels/colors an admin has since edited via the Lookup Master page.
--
-- IDs are synthetic but ULID-shaped (CHAR(26)) via LPAD so the literal in this
-- file stays readable and is self-evidently 26 chars. They are reserved values —
-- real ULIDs are time-prefixed and will never collide with an all-zero prefix.
--
-- NOTE: keep every statement free of semicolons inside string literals — the
-- migration runner splits on `;` naively (see server/src/migrate.ts).

INSERT IGNORE INTO lookup_categories (id, code, name, description, is_system) VALUES
  (LPAD('LSTSTA', 26, '0'), 'listing_status', 'Job Listing Status', 'Lifecycle status shown on Job Listing rows.', 1),
  (LPAD('HRGSTA', 26, '0'), 'hiring_status',  'Hiring Status',      'Pipeline progress for a Job Listing.',        1);

INSERT IGNORE INTO lookups (id, category_id, code, label, color, sort_order, is_default, is_active) VALUES
  (LPAD('LSTSTA001', 26, '0'), LPAD('LSTSTA', 26, '0'), 'Open',      'Open',      '#888',    1, 1, 1),
  (LPAD('LSTSTA002', 26, '0'), LPAD('LSTSTA', 26, '0'), 'Published', 'Published', '#222',    2, 0, 1),
  (LPAD('LSTSTA003', 26, '0'), LPAD('LSTSTA', 26, '0'), 'Closed',    'Closed',    '#cc4444', 3, 0, 1);

INSERT IGNORE INTO lookups (id, category_id, code, label, color, sort_order, is_default, is_active) VALUES
  (LPAD('HRGSTA001', 26, '0'), LPAD('HRGSTA', 26, '0'), 'Applications Invited',   'Applications Invited',   NULL,  1, 1, 1),
  (LPAD('HRGSTA002', 26, '0'), LPAD('HRGSTA', 26, '0'), 'Application Received',   'Application Received',   NULL,  2, 0, 1),
  (LPAD('HRGSTA003', 26, '0'), LPAD('HRGSTA', 26, '0'), 'Screening in Progress',  'Screening in Progress',  NULL,  3, 0, 1),
  (LPAD('HRGSTA004', 26, '0'), LPAD('HRGSTA', 26, '0'), 'Interviews in Progress', 'Interviews in Progress', NULL,  4, 0, 1),
  (LPAD('HRGSTA005', 26, '0'), LPAD('HRGSTA', 26, '0'), 'Offers in Progress',     'Offers in Progress',     NULL,  5, 0, 1),
  (LPAD('HRGSTA006', 26, '0'), LPAD('HRGSTA', 26, '0'), 'Partially Filled',       'Partially Filled',       NULL,  6, 0, 1),
  (LPAD('HRGSTA007', 26, '0'), LPAD('HRGSTA', 26, '0'), 'Hired & Closed',         'Hired & Closed',         NULL,  7, 0, 1),
  (LPAD('HRGSTA008', 26, '0'), LPAD('HRGSTA', 26, '0'), 'Cancelled',              'Cancelled',              NULL,  8, 0, 1),
  (LPAD('HRGSTA009', 26, '0'), LPAD('HRGSTA', 26, '0'), 'On Hold',                'On Hold',                NULL,  9, 0, 1),
  (LPAD('HRGSTA010', 26, '0'), LPAD('HRGSTA', 26, '0'), 'Archived',               'Archived',               NULL, 10, 0, 1);
