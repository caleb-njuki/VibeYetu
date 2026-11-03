-- Buyers log in with phone + OTP. One row per phone number.
CREATE TABLE buyers (
  id            BIGSERIAL PRIMARY KEY,
  phone         TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- One-time codes sent by SMS. Only a hash of the code is stored.
CREATE TABLE otp_codes (
  id         BIGSERIAL PRIMARY KEY,
  phone      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_codes_phone_created ON otp_codes (phone, created_at DESC);
