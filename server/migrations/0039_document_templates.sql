-- Migration 0039: configurable exit-document templates + org profile
--
-- Lets HR configure everything about generated relieving documents — letterhead
-- image, body text (with {{placeholders}}), signatory, footer — per document type,
-- plus a shared organisation profile (name/address/logo) used to resolve the
-- company placeholders. Consumed by the PDF generator (docgen.ts).

CREATE TABLE app_settings (
  setting_key VARCHAR(60) NOT NULL PRIMARY KEY,
  value MEDIUMTEXT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE document_templates (
  id CHAR(26) NOT NULL PRIMARY KEY,
  doc_type ENUM('SETTLEMENT_SHEET','RELIEVING_LETTER','EXPERIENCE_CERTIFICATE','REFERENCE_LETTER') NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  show_letterhead TINYINT(1) NOT NULL DEFAULT 1,
  letterhead_url TEXT NULL,
  body_template MEDIUMTEXT NULL,
  signatory_name VARCHAR(120) NULL,
  signatory_designation VARCHAR(120) NULL,
  signature_url TEXT NULL,
  footer_text TEXT NULL,
  accent_color VARCHAR(20) NOT NULL DEFAULT '#1e293b',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

-- Seed the organisation profile (blank — HR fills it in Settings).
INSERT INTO app_settings (setting_key, value) VALUES ('org_profile', '{"companyName":"","addressLine":"","city":"","logoUrl":"","email":"","phone":""}');

-- Seed default templates. Placeholders resolved at generation:
-- {{employee_name}} {{employee_code}} {{designation}} {{department}} {{branch}}
-- {{joining_date}} {{last_working_day}} {{exit_type}} {{reason}}
-- {{company_name}} {{company_address}} {{today}}
-- {{net_payable}} {{gross_earnings}} {{total_deductions}}
INSERT INTO document_templates (id, doc_type, title, body_template, signatory_name, signatory_designation, footer_text) VALUES
('01JDOCRELIEVINGLETTER00000', 'RELIEVING_LETTER', 'Relieving Letter',
 'This is to certify that {{employee_name}} ({{employee_code}}) was employed with {{company_name}} as {{designation}} in the {{department}} department.\n\nTheir last working day with the organisation was {{last_working_day}}. They are hereby relieved of all duties and responsibilities effective the said date.\n\nWe confirm that the employee has completed all exit formalities and settled all dues with the organisation.\n\nWe wish them the very best in their future endeavours.',
 'Authorised Signatory', 'Human Resources', 'This is a system-generated document.'),
('01JDOCEXPERIENCECERT000000', 'EXPERIENCE_CERTIFICATE', 'Experience Certificate',
 'This is to certify that {{employee_name}} ({{employee_code}}) worked with {{company_name}} as {{designation}} in the {{department}} department from {{joining_date}} to {{last_working_day}}.\n\nDuring their tenure, we found them to be sincere, hardworking and professional in conduct.\n\nWe wish them success in all their future endeavours.',
 'Authorised Signatory', 'Human Resources', 'This is a system-generated document.'),
('01JDOCREFERENCELETTER00000', 'REFERENCE_LETTER', 'Reference Letter',
 'To Whom It May Concern,\n\nThis letter serves as a professional reference for {{employee_name}}, who was employed with {{company_name}} as {{designation}} until {{last_working_day}}.\n\nWe are pleased to recommend them for future opportunities.',
 'Authorised Signatory', 'Human Resources', 'This is a system-generated document.'),
('01JDOCSETTLEMENTSHEET00000', 'SETTLEMENT_SHEET', 'Final Settlement Sheet',
 'Final settlement statement for {{employee_name}} ({{employee_code}}), {{designation}}, {{department}}.\nLast working day: {{last_working_day}}.',
 'Authorised Signatory', 'Finance', 'This is a system-generated document.');
