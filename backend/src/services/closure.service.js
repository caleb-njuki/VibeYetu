// A seller closing their own shop. Support can reopen it (see admin.service.js).
// Closing hides the shop and its products from buyers, stops its ads and removes its offers.
// Products, orders and payout details stay on file.
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { withTransaction } from '../utils/transaction.js';

export const CLOSE_REASONS = [
  'Not enough sales',
  'Too much work or not enough time',
  'I am moving or changing my business',
  'I found another place to sell',
  'The fees are too high',
  'Problems with orders or buyers',
  'Something else',
];
export const OTHER_REASON = 'Something else';
const MIN_OTHER_DETAILS = 10;
const MAX_DETAILS = 500;

// Orders that stop a shop from closing: money or goods are on the move, an unpaid checkout is still
// waiting (it expires in 15 minutes), or a returned item waits for the seller to confirm it.
const OPEN_ORDER = `(status IN ('awaiting_payment', 'pending', 'accepted', 'dispatched', 'review')
  OR (status = 'rejected' AND rejected_by = 'buyer' AND NOT return_confirmed))`;

export async function getClosureInfo(shopId, db = pool) {
  // One query after another: `db` may be a single transaction connection.
  const products = await db.query('SELECT count(*)::int AS n FROM products WHERE shop_id = $1 AND deleted_at IS NULL', [shopId]);
  const ads = await db.query(`SELECT count(*)::int AS n FROM ads WHERE shop_id = $1 AND status IN ('approved', 'attention') AND (ends_at IS NULL OR ends_at > now())`, [shopId]);
  const offers = await db.query('SELECT count(*)::int AS n FROM offers WHERE shop_id = $1 AND ends_at > now()', [shopId]);
  const orders = await db.query(`SELECT count(*)::int AS n, COALESCE(sum(subtotal), 0)::int AS held FROM orders WHERE shop_id = $1 AND ${OPEN_ORDER}`, [shopId]);
  return {
    products: products.rows[0].n,
    ads: ads.rows[0].n,
    offers: offers.rows[0].n,
    openOrders: orders.rows[0].n,
    held: orders.rows[0].held,
    canClose: orders.rows[0].n === 0,
  };
}

export function validateClosure({ reason, details }) {
  if (!CLOSE_REASONS.includes(reason)) return 'Choose the reason that fits best.';
  const d = String(details || '').trim();
  if (reason === OTHER_REASON && d.length < MIN_OTHER_DETAILS) return 'Please tell us a little more, at least 10 characters.';
  if (d.length > MAX_DETAILS) return 'Keep the details under 500 characters.';
  return '';
}

export async function closeShop(sellerId, shopId, { reason, details = '', password }) {
  const problem = validateClosure({ reason, details });
  if (problem) throw httpError(400, problem);

  const seller = (await pool.query('SELECT password_hash FROM sellers WHERE id = $1', [sellerId])).rows[0];
  if (!seller || !(await bcrypt.compare(String(password || ''), seller.password_hash))) {
    throw httpError(401, 'That password is not correct.');
  }

  return withTransaction(async (c) => {
    // The same locks checkout takes (the shop's products, then the shop), so a checkout that is
    // being made right now is either finished first (and blocks the closing) or sees the closed shop.
    await c.query('SELECT id FROM products WHERE shop_id = $1 ORDER BY id FOR UPDATE', [shopId]);
    const shop = (await c.query('SELECT id, closed_at FROM shops WHERE id = $1 AND seller_id = $2 FOR UPDATE', [shopId, sellerId])).rows[0];
    if (!shop) throw httpError(404, 'Shop not found.');
    if (shop.closed_at) throw httpError(409, 'This shop is already closed.');

    const info = await getClosureInfo(shopId, c);
    if (info.openOrders > 0) throw httpError(409, 'Finish your open orders first. Then you can close the shop.');

    await c.query('UPDATE shops SET closed_at = now(), close_reason = $2, close_details = $3 WHERE id = $1', [shopId, reason, String(details).trim().slice(0, MAX_DETAILS)]);
    await c.query(`UPDATE ads SET status = 'stopped' WHERE shop_id = $1 AND status IN ('approved', 'attention')`, [shopId]);
    await c.query('DELETE FROM offers WHERE shop_id = $1', [shopId]);

    const next = await c.query('SELECT id FROM shops WHERE seller_id = $1 AND closed_at IS NULL ORDER BY id LIMIT 1', [sellerId]);
    return { ok: true, nextShopId: next.rows[0] ? String(next.rows[0].id) : null };
  });
}
