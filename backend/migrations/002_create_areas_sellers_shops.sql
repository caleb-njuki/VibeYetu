-- Areas shops can be in (the same list the frontend uses; coordinates are the area centre).
CREATE TABLE areas (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  town TEXT NOT NULL,
  lat  DOUBLE PRECISION NOT NULL,
  lng  DOUBLE PRECISION NOT NULL
);

INSERT INTO areas (id, name, town, lat, lng) VALUES
  ('cbd',            'Nairobi CBD',    'Nairobi',  -1.2864, 36.8172),
  ('westlands',      'Westlands',      'Nairobi',  -1.2676, 36.8108),
  ('kilimani',       'Kilimani',       'Nairobi',  -1.2906, 36.7869),
  ('karen',          'Karen',          'Nairobi',  -1.319,  36.7106),
  ('eastleigh',      'Eastleigh',      'Nairobi',  -1.2744, 36.8503),
  ('kasarani',       'Kasarani',       'Nairobi',  -1.2216, 36.8963),
  ('ruaka',          'Ruaka',          'Nairobi',  -1.2,    36.77),
  ('embakasi',       'Embakasi',       'Nairobi',  -1.32,   36.9),
  ('rongai',         'Rongai',         'Nairobi',  -1.396,  36.764),
  ('nyali',          'Nyali',          'Mombasa',  -4.02,   39.7173),
  ('mombasa-island', 'Mombasa Island', 'Mombasa',  -4.0435, 39.6682),
  ('milimani',       'Milimani',       'Kisumu',   -0.1022, 34.7617),
  ('kisumu-cbd',     'Kisumu CBD',     'Kisumu',   -0.0917, 34.768);

-- Seller accounts: email + password. The password is stored as a bcrypt hash only.
CREATE TABLE sellers (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  id_number       TEXT NOT NULL,
  kra_pin         TEXT,
  phone           TEXT NOT NULL,
  business_type   TEXT NOT NULL,
  business_name   TEXT,
  business_reg_no TEXT,
  terms_version   TEXT NOT NULL,
  consented_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_sellers_email UNIQUE (email),
  CONSTRAINT ck_sellers_email_lower CHECK (email = lower(email)),
  CONSTRAINT ck_sellers_business_type CHECK (business_type IN ('individual', 'registered'))
);

-- Shops. A seller can have several (the main shop and branches).
-- name_key is the shop name with spaces, symbols and capitals removed, so
-- "Nairobi Threads", "nairobi-threads" and "NAIROBI THREADS" count as the same name.
CREATE TABLE shops (
  id            BIGSERIAL PRIMARY KEY,
  seller_id     BIGINT NOT NULL REFERENCES sellers(id),
  name          TEXT NOT NULL,
  name_key      TEXT NOT NULL,
  area_id       TEXT NOT NULL REFERENCES areas(id),
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  opens         TIME NOT NULL DEFAULT '08:00',
  closes        TIME NOT NULL DEFAULT '18:00',
  fulfillment   TEXT[] NOT NULL DEFAULT ARRAY['delivery', 'pickup'],
  delivery_fee  INTEGER,                -- whole shillings; NULL until the seller sets it
  contact_phone TEXT,                   -- private: never shown to the public
  verified      BOOLEAN NOT NULL DEFAULT false,
  suspended     BOOLEAN NOT NULL DEFAULT false,
  closed_at     TIMESTAMPTZ,            -- set when the owner closes the shop
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shops_name_key UNIQUE (name_key),
  CONSTRAINT ck_shops_hours CHECK (opens < closes),
  CONSTRAINT ck_shops_fulfillment CHECK (
    cardinality(fulfillment) > 0 AND fulfillment <@ ARRAY['delivery', 'pickup']
  ),
  CONSTRAINT ck_shops_delivery_fee CHECK (delivery_fee IS NULL OR delivery_fee BETWEEN 0 AND 1000)
);

CREATE INDEX idx_shops_seller ON shops (seller_id);
CREATE INDEX idx_shops_area ON shops (area_id);
