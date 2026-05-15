-- Migration 0007: Talent pool / prospects table

CREATE TABLE prospects (
  id CHAR(26) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  platform VARCHAR(40) NOT NULL DEFAULT 'LinkedIn',
  experience_years DECIMAL(4,1) NULL,
  `current_role` VARCHAR(120) NULL,
  company VARCHAR(120) NULL,
  location VARCHAR(80) NULL,
  salary_range VARCHAR(30) NULL,
  education VARCHAR(60) NULL,
  institution VARCHAR(60) NULL,
  match_ratio INT NULL,
  engagement_signal VARCHAR(60) NULL DEFAULT 'Job Seeking',
  application_status VARCHAR(30) NOT NULL DEFAULT 'Not Applied',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;
