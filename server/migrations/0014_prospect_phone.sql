-- Module 10: prospect phone column (spec requirement).

ALTER TABLE prospects ADD COLUMN phone VARCHAR(30) NULL AFTER email;
