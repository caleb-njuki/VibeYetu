-- Seller ads shown in the home page slideshow. An ad is paid up front. If it passes the automatic
-- checks it goes live at once; otherwise it waits for staff ('attention').
CREATE TABLE ads (
  id               TEXT PRIMARY KEY,                       -- for example AD-4KQ9ZD
  shop_id          BIGINT NOT NULL REFERENCES shops(id),
  headline         TEXT NOT NULL CHECK (char_length(headline) BETWEEN 5 AND 40),
  subtext          TEXT NOT NULL DEFAULT '' CHECK (char_length(subtext) <= 90),
  image            TEXT NOT NULL DEFAULT '',               -- Cloudinary public id, or empty for a plain white ad
  darken           BOOLEAN NOT NULL DEFAULT false,
  headline_color   TEXT NOT NULL CHECK (headline_color ~ '^#[0-9a-fA-F]{6}$'),
  subtext_color    TEXT NOT NULL CHECK (subtext_color ~ '^#[0-9a-fA-F]{6}$'),
  target           TEXT NOT NULL CHECK (target IN ('shop', 'product')),
  product_id       BIGINT REFERENCES products(id),
  days             INTEGER NOT NULL CHECK (days IN (1, 3, 7, 14)),
  total            INTEGER NOT NULL CHECK (total > 0),
  status           TEXT NOT NULL CHECK (status IN ('approved', 'attention', 'stopped', 'refunded')),
  issue            TEXT NOT NULL DEFAULT '',
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  paused_at        TIMESTAMPTZ,
  refunded_at      TIMESTAMPTZ,
  payment_provider TEXT NOT NULL DEFAULT 'simulated',
  paid_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_ads_product_target CHECK ((target = 'product') = (product_id IS NOT NULL))
);

CREATE INDEX idx_ads_shop ON ads (shop_id, created_at DESC);
CREATE INDEX idx_ads_live ON ads (ends_at) WHERE status = 'approved';

-- A buyer reports an ad. Three different buyers hide it until staff look. One report per buyer per ad.
CREATE TABLE ad_reports (
  ad_id      TEXT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  buyer_id   BIGINT NOT NULL REFERENCES buyers(id),
  reason     TEXT NOT NULL CHECK (reason IN ('Misleading', 'Offensive', 'Spam')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_id, buyer_id)
);

-- Staff decisions can now be about ads too.
ALTER TABLE admin_actions DROP CONSTRAINT admin_actions_target_type_check;
ALTER TABLE admin_actions ADD CONSTRAINT admin_actions_target_type_check CHECK (target_type IN ('order', 'shop', 'ad'));
