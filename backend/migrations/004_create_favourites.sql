-- Products a buyer saved. One row per buyer and product.
CREATE TABLE favourites (
  buyer_id   BIGINT NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_id, product_id)
);

CREATE INDEX idx_favourites_product ON favourites (product_id);
