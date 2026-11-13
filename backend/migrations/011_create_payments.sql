-- Money coming in from buyers through M-Pesa (STK Push). One row per attempt to charge a phone.
CREATE TABLE payments (
  id                  BIGSERIAL PRIMARY KEY,
  purpose             TEXT NOT NULL CHECK (purpose IN ('checkout')),
  group_id            TEXT REFERENCES checkout_groups(id),
  buyer_id            BIGINT REFERENCES buyers(id),
  amount              INTEGER NOT NULL CHECK (amount > 0),       -- whole shillings, always taken from OUR checkout total
  phone               TEXT NOT NULL,                             -- as sent to M-Pesa, for example 254712345678
  status              TEXT NOT NULL DEFAULT 'starting'
                      CHECK (status IN ('starting', 'pending', 'paid', 'failed', 'cancelled', 'timeout', 'mismatch', 'late')),
  -- starting  we are asking M-Pesa to prompt the phone
  -- pending   the buyer has the prompt, we wait for the answer
  -- paid      money received and the order was started
  -- failed / cancelled / timeout   the buyer was not charged
  -- mismatch  M-Pesa reported a different amount than we asked for: staff must look
  -- late      money received but the checkout had already expired or was paid: it must be refunded
  merchant_request_id TEXT,
  checkout_request_id TEXT UNIQUE,
  result_code         INTEGER,
  result_desc         TEXT,
  mpesa_receipt       TEXT UNIQUE,
  source              TEXT CHECK (source IN ('callback', 'query')),
  callback_raw        JSONB,
  last_query_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);
CREATE INDEX idx_payments_group ON payments (group_id, created_at DESC);
CREATE INDEX idx_payments_open ON payments (created_at) WHERE status IN ('starting', 'pending');
CREATE INDEX idx_payments_problems ON payments (created_at) WHERE status IN ('mismatch', 'late');
