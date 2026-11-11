-- VibeYetu staff accounts. Created with scripts/create-admin.js, never through the website.
CREATE TABLE admins (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_admins_email UNIQUE (email),
  CONSTRAINT ck_admins_email_lower CHECK (email = lower(email))
);

-- Suspension details on the shop. A shop is suspended automatically (3 unfulfilled orders in a row)
-- or by support. Orders placed before `reinstated_at` no longer count towards a new streak.
ALTER TABLE shops ADD COLUMN suspend_kind      TEXT CHECK (suspend_kind IN ('auto', 'admin'));
ALTER TABLE shops ADD COLUMN suspended_at      TIMESTAMPTZ;
ALTER TABLE shops ADD COLUMN suspend_order_ids TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE shops ADD COLUMN reinstated_at     TIMESTAMPTZ;

-- The report a seller writes after a suspension. It belongs to one suspension (suspended_at).
-- A seller may send an updated report: the newest one counts.
CREATE TABLE suspension_reports (
  id           BIGSERIAL PRIMARY KEY,
  shop_id      BIGINT NOT NULL REFERENCES shops(id),
  suspended_at TIMESTAMPTZ NOT NULL,
  order_ids    TEXT[] NOT NULL DEFAULT '{}',
  reason       TEXT NOT NULL,
  details      TEXT NOT NULL CHECK (char_length(details) BETWEEN 30 AND 1000),
  plan         TEXT NOT NULL CHECK (char_length(plan) BETWEEN 20 AND 500),
  status       TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'more_info', 'accepted')),
  admin_note   TEXT NOT NULL DEFAULT '',
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suspension_reports_shop ON suspension_reports (shop_id, suspended_at, created_at DESC);

-- Every decision staff make, kept for good: who, what, on what, when.
CREATE TABLE admin_actions (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    BIGINT NOT NULL REFERENCES admins(id),
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('order', 'shop')),
  target_id   TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_actions_target ON admin_actions (target_type, target_id, created_at DESC);
