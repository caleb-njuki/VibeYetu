-- Ads are now paid by M-Pesa STK Push, and ad refunds go back through the payout worker.

-- An ad exists as 'unpaid' while the seller has the M-Pesa prompt, and becomes 'approved' or 'attention' when the money arrives.
-- 'failed' = the payment did not happen (cancelled, wrong PIN, no answer). Neither status is shown to sellers, buyers or staff.
ALTER TABLE ads DROP CONSTRAINT ads_status_check;
ALTER TABLE ads ADD CONSTRAINT ads_status_check CHECK (status IN ('unpaid', 'failed', 'approved', 'attention', 'stopped', 'refunded'));

-- A payment can now be for an ad.
ALTER TABLE payments DROP CONSTRAINT payments_purpose_check;
ALTER TABLE payments ADD CONSTRAINT payments_purpose_check CHECK (purpose IN ('checkout', 'ad'));
ALTER TABLE payments ADD COLUMN ad_id TEXT REFERENCES ads(id);
ALTER TABLE payments ADD COLUMN shop_id BIGINT REFERENCES shops(id);
CREATE INDEX idx_payments_ad ON payments (ad_id, created_at DESC) WHERE ad_id IS NOT NULL;
ALTER TABLE payments ADD CONSTRAINT ck_payments_target CHECK ((purpose = 'checkout' AND group_id IS NOT NULL) OR (purpose = 'ad' AND ad_id IS NOT NULL));

-- A payout can now be the refund of an ad (instead of an order).
ALTER TABLE payouts DROP CONSTRAINT payouts_kind_check;
ALTER TABLE payouts ADD CONSTRAINT payouts_kind_check CHECK (kind IN ('seller_payout', 'buyer_refund', 'ad_refund'));
ALTER TABLE payouts ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE payouts ADD COLUMN ad_id TEXT REFERENCES ads(id);
ALTER TABLE payouts DROP CONSTRAINT uq_payout_order_kind;
CREATE UNIQUE INDEX uq_payout_order_kind ON payouts (order_id, kind) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX uq_payout_ad_kind ON payouts (ad_id, kind) WHERE ad_id IS NOT NULL;
ALTER TABLE payouts ADD CONSTRAINT ck_payout_target CHECK ((order_id IS NULL) <> (ad_id IS NULL));
