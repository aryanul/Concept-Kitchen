-- Migration 0024: backfill data for the Employee Master writeup alignment.
--
-- Idempotent — each step only fills NULLs or no-ops when rows already exist:
--   1. Ensure at least one company exists.
--   2. Point every NULL-company branch at the first company.
--   3. Stamp every NULL-company employee with their branch's company.
--   4. Stamp every NULL-division employee whose designation text matches a
--      designation in the master, using that designation's division.
--   5. Seed three default Attendance Rules (Standard / Flexi / Field-staff).
--
-- Hand-coded ULID-shaped 26-char ids (literals) so MySQL can do this without
-- a UDF. Re-applying this migration is a no-op (migrate.ts tracks it).

INSERT INTO hiring_companies (id, lc_no, name, branch, city, location)
SELECT '01HSEED000000000000000C001', 'LC001', 'Concept Kitchen', NULL, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM hiring_companies LIMIT 1);

UPDATE branches b
SET    b.company_id = (SELECT id FROM hiring_companies ORDER BY lc_no LIMIT 1)
WHERE  b.company_id IS NULL;

UPDATE employees e
JOIN   branches  b ON b.id = e.branch_id
SET    e.company_id = b.company_id
WHERE  e.company_id IS NULL
  AND  b.company_id IS NOT NULL;

UPDATE employees e
JOIN   designations d ON d.name = e.designation
SET    e.division_id = d.division_id
WHERE  e.division_id IS NULL
  AND  d.division_id IS NOT NULL;

INSERT IGNORE INTO attendance_rules (id, code, name, description, is_active) VALUES
('01HSEED000000000000000R001', 'AR001', 'Standard',    'Standard fixed-shift attendance with biometric punch in / out.', 1),
('01HSEED000000000000000R002', 'AR002', 'Flexi',       'Flexible timings with mandatory core hours, biometric or geo punch.', 1),
('01HSEED000000000000000R003', 'AR003', 'Field-staff', 'Off-site staff — geo-tagged mobile check-in. No fixed shift.', 1);
