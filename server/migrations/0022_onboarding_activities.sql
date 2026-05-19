-- Migration 0022: Onboarding activities (audit log).
--
-- Mirror of applicant_activities (from migration 0021) but scoped to the
-- onboarding flow. Every action on the Onboarding detail page (giveaway add,
-- ERP module activation, asset allocation, presentation/doc check-off, item
-- complete, training status change, header field updates) writes a row here
-- so the new Activities tab on the onboarding detail page can render a
-- chronological feed of who did what.

CREATE TABLE onboarding_activities (
  id CHAR(26) NOT NULL PRIMARY KEY,
  ao_id CHAR(26) NOT NULL,
  applicant_id CHAR(26) NOT NULL,
  actor_user_id CHAR(26) NULL,
  action VARCHAR(60) NOT NULL,
  -- Free-form section identifier (giveaway | erp | asset | presentation |
  -- doc | item | training | header | id_card | face | biometric | close)
  section VARCHAR(40) NULL,
  message TEXT NULL,
  meta_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_oa_ao FOREIGN KEY (ao_id) REFERENCES applicant_onboarding(id) ON DELETE CASCADE,
  CONSTRAINT fk_oa_app FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE,
  CONSTRAINT fk_oa_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX ix_oa_ao_time ON onboarding_activities (ao_id, created_at);
