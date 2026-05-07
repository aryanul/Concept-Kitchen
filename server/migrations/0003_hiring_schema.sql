-- Migration 0003: Hiring module tables (Phase 2)

CREATE TABLE job_profiles (
  id CHAR(26) NOT NULL PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  department_id CHAR(26) NOT NULL,
  description TEXT NULL,
  requirements TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_jp_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE vacancies (
  id CHAR(26) NOT NULL PRIMARY KEY,
  job_profile_id CHAR(26) NOT NULL,
  branch_id CHAR(26) NOT NULL,
  positions INT NOT NULL DEFAULT 1,
  filled INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_vac_jp FOREIGN KEY (job_profile_id) REFERENCES job_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_vac_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE onboarding_tasks (
  id CHAR(26) NOT NULL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  category VARCHAR(60) NOT NULL,
  is_mandatory TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE employee_onboarding (
  id CHAR(26) NOT NULL PRIMARY KEY,
  employee_id CHAR(26) NOT NULL,
  task_id CHAR(26) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  completed_at DATETIME(3) NULL,
  notes VARCHAR(500) NULL,
  UNIQUE KEY uq_emp_onboard (employee_id, task_id),
  CONSTRAINT fk_eo_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_eo_task FOREIGN KEY (task_id) REFERENCES onboarding_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB;
