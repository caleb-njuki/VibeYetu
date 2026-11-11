-- Running totals, so a list of products can show its average without counting every rating each time.
ALTER TABLE products ADD COLUMN stars_sum   INTEGER NOT NULL DEFAULT 0 CHECK (stars_sum >= 0);
ALTER TABLE products ADD COLUMN stars_count INTEGER NOT NULL DEFAULT 0 CHECK (stars_count >= 0);
ALTER TABLE shops    ADD COLUMN stars_sum   INTEGER NOT NULL DEFAULT 0 CHECK (stars_sum >= 0);
ALTER TABLE shops    ADD COLUMN stars_count INTEGER NOT NULL DEFAULT 0 CHECK (stars_count >= 0);

-- A buyer rates a shop, or a product from the order. One rating per order, kind and target.
CREATE TABLE ratings (
  id         BIGSERIAL PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id),
  buyer_id   BIGINT NOT NULL REFERENCES buyers(id),
  shop_id    BIGINT NOT NULL REFERENCES shops(id),
  kind       TEXT NOT NULL CHECK (kind IN ('shop', 'product')),
  target_id  BIGINT NOT NULL,                      -- the shop id or the product id
  stars      INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment    TEXT NOT NULL DEFAULT '' CHECK (char_length(comment) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ratings_order_kind_target UNIQUE (order_id, kind, target_id)
);

CREATE INDEX idx_ratings_target ON ratings (kind, target_id, created_at DESC);

-- "Skip" on the rating prompt.
CREATE TABLE rating_skips (
  order_id   TEXT PRIMARY KEY REFERENCES orders(id),
  buyer_id   BIGINT NOT NULL REFERENCES buyers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Best sellers count units from completed orders.
CREATE INDEX idx_order_items_product ON order_items (product_id);

-- Messages to a shop that do not come from an order (for example a suspension).
CREATE TABLE shop_notices (
  id         BIGSERIAL PRIMARY KEY,
  shop_id    BIGINT NOT NULL REFERENCES shops(id),
  text       TEXT NOT NULL,
  href       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shop_notices_shop ON shop_notices (shop_id, created_at DESC);

-- Which notifications have been read. owner_type 'buyer' (owner_id = buyer id) or 'shop' (owner_id = shop id).
CREATE TABLE notification_reads (
  owner_type TEXT NOT NULL CHECK (owner_type IN ('buyer', 'shop')),
  owner_id   BIGINT NOT NULL,
  notif_id   TEXT NOT NULL,
  PRIMARY KEY (owner_type, owner_id, notif_id)
);
