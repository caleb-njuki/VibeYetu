-- Seller offers: a percentage discount for a set time, on all products or on chosen ones.
CREATE TABLE offers (
  id            BIGSERIAL PRIMARY KEY,
  shop_id       BIGINT NOT NULL REFERENCES shops(id),
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 40),
  percent       INTEGER NOT NULL CHECK (percent BETWEEN 5 AND 70),
  all_products  BOOLEAN NOT NULL,
  product_ids   BIGINT[] NOT NULL DEFAULT '{}',
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,       -- false while the seller has paused it
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_offers_time CHECK (ends_at > starts_at),
  CONSTRAINT ck_offers_products CHECK (all_products OR cardinality(product_ids) > 0)
);
CREATE INDEX idx_offers_shop ON offers (shop_id, created_at DESC);

-- A shop its owner closed (shops.closed_at already exists): why, and when support reopened it.
ALTER TABLE shops ADD COLUMN close_reason  TEXT;
ALTER TABLE shops ADD COLUMN close_details TEXT;
ALTER TABLE shops ADD COLUMN reopened_at   TIMESTAMPTZ;
