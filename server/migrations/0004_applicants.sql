-- Migration 0004: Applicants table for hiring pipeline

CREATE TABLE applicants (
  id CHAR(26) NOT NULL PRIMARY KEY,
  vacancy_id CHAR(26) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(30) NULL,
  current_company VARCHAR(120) NULL,
  experience_years DECIMAL(4,1) NULL,
  resume_url VARCHAR(500) NULL,
  notes TEXT NULL,
  stage VARCHAR(30) NOT NULL DEFAULT 'applied',
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_app_vacancy FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE CASCADE
) ENGINE=InnoDB;
