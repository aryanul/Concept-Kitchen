-- Job Profile completion percentage, shown next to the JP Status pill on the
-- Job Profiles list ("Partially Done · 60%").
--
-- The percentage is computed in the form (computeJpCompletion in
-- web/src/routes/hiring/JobProfileForm.tsx) from the same field checks that already
-- decide Pending / Partially Done / Done — the ratio was being calculated and then
-- thrown away. Persisting it keeps the list endpoint a plain SELECT instead of
-- forcing it to parse every row's form_data JSON just to render a badge.
--
-- Backfill maps existing rows off their current status so nothing shows a
-- misleading 0%: Done rows are complete by definition, Pending rows are empty, and
-- Partially Done rows get NULL — the UI renders the bare label with no number for
-- those, and the real value lands the next time the profile is saved. Guessing a
-- number for them would be inventing data.

ALTER TABLE job_profiles
  ADD COLUMN jp_completion_pct TINYINT UNSIGNED NULL AFTER jp_status;

UPDATE job_profiles SET jp_completion_pct = 100 WHERE jp_status = 'Done';

UPDATE job_profiles SET jp_completion_pct = 0 WHERE jp_status = 'Pending';
