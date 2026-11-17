-- Every one-time code now goes by email. Buyers sign in with their email instead of their phone.
-- Old buyers (who signed in by phone) keep their rows; their phone column stays.
ALTER TABLE buyers ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE buyers ADD COLUMN email TEXT;
CREATE UNIQUE INDEX buyers_email_key ON buyers (email);

ALTER TABLE otp_codes ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE otp_codes ADD COLUMN email TEXT;
CREATE INDEX idx_otp_codes_email_created ON otp_codes (email, created_at DESC);
