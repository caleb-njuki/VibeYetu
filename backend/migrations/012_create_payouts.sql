-- Money going OUT through M-Pesa: payouts to sellers and refunds to buyers.
-- A row is added in the same database transaction that writes the escrow ledger entry, so a payout can never be forgotten.
-- A separate worker then sends it to M-Pesa. UNIQUE (order_id, kind) means one payout of each kind per order, ever.
CREATE TABLE payouts (
  id                         BIGSERIAL PRIMARY KEY,
  kind                       TEXT NOT NULL CHECK (kind IN ('seller_payout', 'buyer_refund')),
  order_id                   TEXT NOT NULL REFERENCES orders(id),
  shop_id                    BIGINT REFERENCES shops(id),          -- for seller payouts
  amount                     INTEGER NOT NULL CHECK (amount > 0),  -- whole shillings, the same as the ledger entry
  status                     TEXT NOT NULL DEFAULT 'queued'
                             CHECK (status IN ('waiting_method', 'queued', 'sending', 'sent', 'paid', 'review', 'skipped')),
  -- waiting_method  the seller has not added a payout method yet
  -- queued          ready to be sent to M-Pesa
  -- sending         being sent right now
  -- sent            M-Pesa accepted it, we wait for the result
  -- paid            M-Pesa confirmed the money moved
  -- review          something is not clear or failed: staff must look (retry or mark paid)
  -- skipped         the buyer's payment was simulated, so there is no real money to move
  method                     TEXT CHECK (method IN ('till', 'paybill', 'pochi', 'mpesa', 'phone')),
  till                       TEXT,
  paybill                    TEXT,
  account                    TEXT,
  phone                      TEXT,                                 -- 254712345678
  conversation_id            TEXT UNIQUE,
  originator_conversation_id TEXT UNIQUE,
  mpesa_receipt              TEXT,
  result_code                INTEGER,
  result_desc                TEXT,
  last_error                 TEXT,
  attempts                   INTEGER NOT NULL DEFAULT 0,
  next_attempt_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw                        JSONB,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at                    TIMESTAMPTZ,
  completed_at               TIMESTAMPTZ,
  CONSTRAINT uq_payout_order_kind UNIQUE (order_id, kind)
);
CREATE INDEX idx_payouts_queue ON payouts (next_attempt_at) WHERE status = 'queued';
CREATE INDEX idx_payouts_shop ON payouts (shop_id, status);
CREATE INDEX idx_payouts_problems ON payouts (created_at) WHERE status IN ('review', 'waiting_method', 'sent', 'sending');

-- Staff actions on payouts are logged like the others.
ALTER TABLE admin_actions DROP CONSTRAINT IF EXISTS admin_actions_target_type_check;
ALTER TABLE admin_actions ADD CONSTRAINT admin_actions_target_type_check CHECK (target_type IN ('order', 'shop', 'ad', 'payout'));
