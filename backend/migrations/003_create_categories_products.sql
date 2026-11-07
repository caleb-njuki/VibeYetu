-- Product categories (the same list the frontend uses).
CREATE TABLE categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

INSERT INTO categories (id, name, emoji, sort_order) VALUES
  ('fashion',     'Fashion',     '👗', 1),
  ('electronics', 'Electronics', '🎧', 2),
  ('phones',      'Phones',      '📱', 3),
  ('home',        'Home',        '🏠', 4),
  ('beauty',      'Beauty',      '🧴', 5),
  ('groceries',   'Groceries',   '🍯', 6);

-- Products. Photos are Cloudinary public ids (the first one is the main photo).
-- A product with sizes keeps its stock per size in `sizes` (for example {"S": 3, "M": 4}),
-- and `stock` is always the total of those.
-- A deleted product is only marked (deleted_at), so old orders can still point to it.
CREATE TABLE products (
  id          BIGSERIAL PRIMARY KEY,
  shop_id     BIGINT NOT NULL REFERENCES shops(id),
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  stock       INTEGER NOT NULL DEFAULT 0,
  size_type   TEXT NOT NULL DEFAULT 'none',
  sizes       JSONB,
  category_id TEXT NOT NULL REFERENCES categories(id),
  description TEXT NOT NULL DEFAULT 'No description yet.',
  images      TEXT[] NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT true,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_products_price CHECK (price BETWEEN 1 AND 10000000),
  CONSTRAINT ck_products_stock CHECK (stock BETWEEN 0 AND 1000000),
  CONSTRAINT ck_products_size_type CHECK (size_type IN ('none', 'clothing', 'shoes')),
  CONSTRAINT ck_products_sizes CHECK (
    (size_type = 'none' AND sizes IS NULL) OR (size_type <> 'none' AND sizes IS NOT NULL)
  ),
  CONSTRAINT ck_products_images CHECK (cardinality(images) <= 4)
);

CREATE INDEX idx_products_shop ON products (shop_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_category ON products (category_id) WHERE deleted_at IS NULL;
