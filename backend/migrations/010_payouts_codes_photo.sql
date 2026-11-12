-- Where a shop's money is paid.
CREATE TABLE payout_methods (
  shop_id    BIGINT PRIMARY KEY REFERENCES shops(id),
  method     TEXT NOT NULL CHECK (method IN ('till', 'paybill', 'pochi', 'mpesa')),
  till       TEXT,
  paybill    TEXT,
  account    TEXT,
  phone      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_payout_fields CHECK (
    (method = 'till'    AND till IS NOT NULL    AND paybill IS NULL AND account IS NULL AND phone IS NULL) OR
    (method = 'paybill' AND paybill IS NOT NULL AND account IS NOT NULL AND till IS NULL AND phone IS NULL) OR
    (method IN ('pochi', 'mpesa') AND phone IS NOT NULL AND till IS NULL AND paybill IS NULL AND account IS NULL)
  )
);

-- One-time codes sent to a seller's own phone, for sensitive changes (payout method, password).
-- Only a hash of the code is stored. A code that has been accepted gets a short window to be used once.
CREATE TABLE seller_challenges (
  id             BIGSERIAL PRIMARY KEY,
  purpose        TEXT NOT NULL CHECK (purpose IN ('payout', 'password')),
  seller_id      BIGINT NOT NULL REFERENCES sellers(id),
  subject        TEXT NOT NULL,                  -- the shop id for payout, '' for password
  code_hash      TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  used_at        TIMESTAMPTZ,                    -- set when the code is accepted or replaced
  verified_until TIMESTAMPTZ,                    -- set when the code was accepted: the change may be saved until then
  consumed_at    TIMESTAMPTZ,                    -- set when the change was saved
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_seller_challenges_lookup ON seller_challenges (purpose, seller_id, subject, created_at DESC);

-- Wrong codes are counted per seller and purpose, across codes, so asking for a new code does not reset the limit.
CREATE TABLE seller_challenge_limits (
  purpose      TEXT NOT NULL,
  seller_id    BIGINT NOT NULL REFERENCES sellers(id),
  subject      TEXT NOT NULL,
  tries        INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  PRIMARY KEY (purpose, seller_id, subject)
);

-- The shop photo (a Cloudinary photo id from the shop's own folder).
ALTER TABLE shops ADD COLUMN photo TEXT;
