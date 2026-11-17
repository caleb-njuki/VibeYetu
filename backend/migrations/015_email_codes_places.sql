-- Email codes for seller sign-up (the seller proves the email is real before the account is made).
CREATE TABLE email_codes (
  email      text PRIMARY KEY,
  code_hash  text NOT NULL,
  expires_at timestamptz NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  tries      integer NOT NULL DEFAULT 0
);

-- A shop is now placed by its map pin. The name of the place (for example "Westlands" and "Nairobi")
-- comes from the map and is shown to buyers. area_id stays as the nearest known area, for old data.
ALTER TABLE shops ADD COLUMN place_name text;
ALTER TABLE shops ADD COLUMN place_town text;
