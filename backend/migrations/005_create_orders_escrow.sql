-- One checkout = one payment. It can hold orders from several shops (one order per shop).
CREATE TABLE checkout_groups (
  id               TEXT PRIMARY KEY,                -- for example G-4KQ9ZD
  buyer_id         BIGINT NOT NULL REFERENCES buyers(id),
  total            INTEGER NOT NULL CHECK (total > 0),
  status           TEXT NOT NULL DEFAULT 'awaiting_payment'
                   CHECK (status IN ('awaiting_payment', 'paid', 'expired')),
  payment_provider TEXT NOT NULL DEFAULT 'simulated',  -- becomes 'mpesa' when M-Pesa is connected
  payment_method   TEXT CHECK (payment_method IN ('mpesa', 'card')),
  payment_phone    TEXT,
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checkout_groups_buyer ON checkout_groups (buyer_id, created_at DESC);
CREATE INDEX idx_checkout_groups_waiting ON checkout_groups (created_at) WHERE status = 'awaiting_payment';

-- One order = the items bought from one shop.
-- Names and prices are copied here, so later changes to a product never change an old order.
CREATE TABLE orders (
  id               TEXT PRIMARY KEY,                -- for example VY-4KQ9ZD
  group_id         TEXT NOT NULL REFERENCES checkout_groups(id),
  buyer_id         BIGINT NOT NULL REFERENCES buyers(id),
  shop_id          BIGINT NOT NULL REFERENCES shops(id),
  shop_name        TEXT NOT NULL,
  status           TEXT NOT NULL
                   CHECK (status IN ('awaiting_payment', 'pending', 'accepted', 'dispatched',
                                     'completed', 'rejected', 'refunded', 'expired')),
  mode             TEXT NOT NULL CHECK (mode IN ('delivery', 'pickup')),
  subtotal         INTEGER NOT NULL CHECK (subtotal > 0),
  delivery_fee     INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total            INTEGER NOT NULL,
  fee_percent      NUMERIC(5, 2) NOT NULL,          -- the service fee when the order was placed
  buyer_name       TEXT NOT NULL,
  buyer_phone      TEXT NOT NULL,
  address_area     TEXT,
  address_street   TEXT,
  code             TEXT,                            -- the 6-digit receipt code, made when the seller agrees
  accepted_at      TIMESTAMPTZ,
  promised_by      TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  seller_confirmed BOOLEAN NOT NULL DEFAULT false,
  buyer_confirmed  BOOLEAN NOT NULL DEFAULT false,
  rejected_by      TEXT CHECK (rejected_by IN ('seller', 'buyer')),
  reject_reason    TEXT NOT NULL DEFAULT '',
  return_confirmed BOOLEAN NOT NULL DEFAULT false,
  refund_requested BOOLEAN NOT NULL DEFAULT false,
  refund_amount    INTEGER,
  unanswered       BOOLEAN NOT NULL DEFAULT false,  -- the seller never answered in time
  stock_held       BOOLEAN NOT NULL DEFAULT true,   -- true while these items are taken out of the shop's stock
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_orders_total CHECK (total = subtotal + delivery_fee)
);

CREATE INDEX idx_orders_buyer ON orders (buyer_id, paid_at DESC);
CREATE INDEX idx_orders_shop ON orders (shop_id, paid_at DESC);
CREATE INDEX idx_orders_group ON orders (group_id);
CREATE INDEX idx_orders_pending ON orders (paid_at) WHERE status = 'pending';

CREATE TABLE order_items (
  id         BIGSERIAL PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  name       TEXT NOT NULL,
  price      INTEGER NOT NULL CHECK (price > 0),
  qty        INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 10),
  size       TEXT NOT NULL DEFAULT '',
  size_type  TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_order_items_order ON order_items (order_id);

-- The progress timeline. The same event reads differently to each side.
-- `notify` says who gets a notification: 'buyer', 'seller' or 'both'.
CREATE TABLE order_events (
  id          BIGSERIAL PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_text  TEXT,
  seller_text TEXT,
  notify      TEXT CHECK (notify IN ('buyer', 'seller', 'both')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_events_order ON order_events (order_id);

-- The short form both sides answer when the 24-hour window ends. One per side.
CREATE TABLE order_reports (
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('buyer', 'seller')),
  reason     TEXT NOT NULL,
  details    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, role)
);

-- The escrow ledger: every shilling that moves, once.
--   escrow_in  money the buyer paid, now held by us
--   refund_out money sent back to the buyer
--   seller_out money owed to the seller
--   fee_out    VibeYetu's service fee
-- When an order is finished: escrow_in = refund_out + seller_out + fee_out.
-- The UNIQUE rule means money can never be released or refunded twice.
CREATE TABLE ledger_entries (
  id         BIGSERIAL PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id),
  kind       TEXT NOT NULL CHECK (kind IN ('escrow_in', 'refund_out', 'seller_out', 'fee_out')),
  amount     INTEGER NOT NULL CHECK (amount > 0),
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ledger_order_kind UNIQUE (order_id, kind)
);
