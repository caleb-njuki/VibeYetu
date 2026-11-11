// Automatic suspension: a shop with 3 unfulfilled orders in a row is suspended.
import { STRIKE_LIMIT, streakOf } from '../utils/strikes.js';
import { addShopNotice } from './notification.service.js';

// Call inside a transaction, after anything that can make an order unfulfilled. Returns true if the shop was suspended.
export async function evaluateShop(c, shopId) {
  const shop = (await c.query('SELECT id, suspended, closed_at, reinstated_at FROM shops WHERE id = $1 FOR UPDATE', [shopId])).rows[0];
  if (!shop || shop.suspended || shop.closed_at) return false;

  // The newest orders are enough: a streak ends at the first completed order going backwards.
  const { rows } = await c.query(
    `SELECT id, status, unanswered, rejected_by, seller_confirmed,
            (extract(epoch from paid_at) * 1000)::float8 AS paid_ms,
            (extract(epoch from accepted_at) * 1000)::float8 AS accepted_ms
     FROM orders
     WHERE shop_id = $1 AND status NOT IN ('awaiting_payment', 'expired')
       AND paid_at > COALESCE($2::timestamptz, '-infinity'::timestamptz)
     ORDER BY paid_at DESC, id DESC LIMIT 60`,
    [shopId, shop.reinstated_at]
  );
  const { streak, failedIds } = streakOf(rows.reverse());
  if (streak < STRIKE_LIMIT) return false;

  await c.query(
    `UPDATE shops SET suspended = true, suspend_kind = 'auto', suspended_at = now(), suspend_order_ids = $2::text[] WHERE id = $1`,
    [shopId, failedIds]
  );
  await addShopNotice(
    shopId,
    `Your shop was suspended because ${streak} orders in a row were not fulfilled. Write your report so support can review it.`,
    '/my-shop/report',
    c
  );
  return true;
}
