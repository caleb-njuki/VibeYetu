-- Sellers and staff: lock an account after repeated wrong passwords, and let a password change end old logins.
ALTER TABLE sellers ADD COLUMN token_version integer NOT NULL DEFAULT 0;
ALTER TABLE sellers ADD COLUMN failed_logins integer NOT NULL DEFAULT 0;
ALTER TABLE sellers ADD COLUMN locked_until timestamptz;

ALTER TABLE admins ADD COLUMN failed_logins integer NOT NULL DEFAULT 0;
ALTER TABLE admins ADD COLUMN locked_until timestamptz;
