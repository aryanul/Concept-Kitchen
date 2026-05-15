-- Module 11: link Job Profiles to Interview Templates (many-to-many).

CREATE TABLE job_profile_interview_templates (
  id CHAR(26) NOT NULL PRIMARY KEY,
  job_profile_id CHAR(26) NOT NULL,
  interview_template_id CHAR(26) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_jpit_jp FOREIGN KEY (job_profile_id) REFERENCES job_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_jpit_tpl FOREIGN KEY (interview_template_id) REFERENCES interview_templates(id) ON DELETE CASCADE,
  UNIQUE KEY uq_jpit (job_profile_id, interview_template_id)
) ENGINE=InnoDB;
