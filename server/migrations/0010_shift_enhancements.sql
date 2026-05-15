-- Migration 0010: extend shifts with company/branch/location/status/grace/OT
-- and introduce shift_breaks table for the redesigned Duty Shift Master.
-- Each ADD/CONSTRAINT in its own statement for TiDB compatibility.

ALTER TABLE shifts ADD COLUMN description TEXT NULL AFTER name;
ALTER TABLE shifts ADD COLUMN company VARCHAR(120) NULL AFTER description;
ALTER TABLE shifts ADD COLUMN branch_id CHAR(26) NULL AFTER company;
ALTER TABLE shifts ADD COLUMN location VARCHAR(120) NULL AFTER branch_id;
ALTER TABLE shifts ADD COLUMN status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE' AFTER location;
ALTER TABLE shifts ADD COLUMN total_hours DECIMAL(4,2) NOT NULL DEFAULT 8.00 AFTER end_time;
ALTER TABLE shifts ADD COLUMN grace_arrival_min INT NOT NULL DEFAULT 0 AFTER total_hours;
ALTER TABLE shifts ADD COLUMN grace_exit_min INT NOT NULL DEFAULT 0 AFTER grace_arrival_min;
ALTER TABLE shifts ADD COLUMN ot_after_min INT NOT NULL DEFAULT 0 AFTER grace_exit_min;
ALTER TABLE shifts ADD COLUMN ot_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.00 AFTER ot_after_min;
ALTER TABLE shifts ADD CONSTRAINT fk_shifts_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

CREATE TABLE shift_breaks (
  id CHAR(26) NOT NULL PRIMARY KEY,
  shift_id CHAR(26) NOT NULL,
  name VARCHAR(80) NOT NULL,
  start_offset_min INT NOT NULL DEFAULT 0,
  duration_min INT NOT NULL DEFAULT 0,
  is_paid TINYINT(1) NOT NULL DEFAULT 0,
  is_mandatory TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_shift_breaks_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
) ENGINE=InnoDB;
