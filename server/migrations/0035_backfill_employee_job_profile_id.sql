-- Backfill job_profile_id on employees that were promoted from onboarding
-- but got a NULL job_profile_id because the activate query only looked up
-- the profile through the job_listing path and missed the vacancy path.
-- Only touches rows where job_profile_id is currently NULL so manually-set
-- values are never overwritten. job_listing takes precedence over vacancy
-- (matching the COALESCE order in the fixed activate query).
UPDATE employees e
  JOIN applicant_onboarding ao ON ao.promoted_employee_id = e.id
  JOIN applicants a ON a.id = ao.applicant_id
  LEFT JOIN job_listings jl ON jl.id = a.job_listing_id
  LEFT JOIN job_profiles jljp ON jljp.id = jl.job_profile_id
  LEFT JOIN vacancies v ON v.id = a.vacancy_id
  LEFT JOIN job_profiles vjp ON vjp.id = v.job_profile_id
SET e.job_profile_id = COALESCE(jljp.id, vjp.id)
WHERE e.job_profile_id IS NULL
  AND COALESCE(jljp.id, vjp.id) IS NOT NULL;
