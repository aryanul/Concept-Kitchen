-- Migration 0046: real user accounts + role-based access control.
--
-- Until now `users` held an email, a bcrypt hash, one of four roles and an
-- optional employee link — no name, no way to switch an account off, and no
-- connection to Concept Kitchen's staff list, so every account had to be
-- hand-keyed. Access control was a handful of `requireRole` calls, which meant
-- most routes were open to anyone signed in.
--
-- This adds, mirroring the sibling CK Accounting module:
--   * profile + lifecycle columns on `users`
--   * `ck_users`, a mirror of CK's staff list (source for provisioning)
--   * `role_permissions` / `user_permissions`, the grant model behind the
--     permission guard (a user's role grants, plus explicit allows, minus
--     explicit denies — a deny always wins)
--
-- Each ALTER stands alone: the migration runner splits on ';' and TiDB wants
-- one clause per statement.

ALTER TABLE users ADD COLUMN name VARCHAR(120) NULL AFTER id;

ALTER TABLE users ADD COLUMN status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active' AFTER role;

ALTER TABLE users ADD COLUMN phone VARCHAR(32) NULL AFTER status;

ALTER TABLE users ADD COLUMN designation VARCHAR(120) NULL AFTER phone;

-- Links an account to the CK person it was provisioned from. Nullable: accounts
-- created by hand (and the seeded demo logins) have no CK counterpart.
ALTER TABLE users ADD COLUMN ck_user_id VARCHAR(32) NULL AFTER designation;

-- Set on a provisioned or admin-reset account so the placeholder password is
-- replaced the first time the person actually signs in.
ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER ck_user_id;

ALTER TABLE users ADD COLUMN last_login_at DATETIME(3) NULL AFTER must_change_password;

CREATE UNIQUE INDEX ux_users_ck_user_id ON users (ck_user_id);

-- Backfill a display name for the accounts that predate the column, so the
-- Users screen is not a column of blanks on day one.
UPDATE users SET name = SUBSTRING_INDEX(email, '@', 1) WHERE name IS NULL;

-- CK's staff list, mirrored. Same co-ownership rule as the other CK tables:
-- matched on ck_id (never on name — CK has duplicates), and a row that
-- disappears upstream is left in place rather than deleted.
CREATE TABLE ck_users (
  id CHAR(26) NOT NULL PRIMARY KEY,
  ck_id VARCHAR(32) NOT NULL,
  name VARCHAR(190) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY ux_ck_users_ck_id (ck_id)
) ENGINE=InnoDB;

-- What a role grants. Seeded from the code defaults on first boot; editable
-- afterwards from the Roles & Permissions screen.
CREATE TABLE role_permissions (
  role VARCHAR(24) NOT NULL,
  permission_key VARCHAR(80) NOT NULL,
  PRIMARY KEY (role, permission_key)
) ENGINE=InnoDB;

-- Per-person overrides on top of the role. 'allow' adds, 'deny' removes and
-- wins — that is what makes "this one person must not touch Payroll"
-- expressible without inventing a role for them.
CREATE TABLE user_permissions (
  user_id CHAR(26) NOT NULL,
  permission_key VARCHAR(80) NOT NULL,
  effect VARCHAR(8) NOT NULL DEFAULT 'allow',
  PRIMARY KEY (user_id, permission_key),
  CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
