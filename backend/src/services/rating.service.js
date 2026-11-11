// Ratings from buyers who received their order. One rating per order, kind and target.
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { withTransaction } from '../utils/transaction.js';

const MAX_COMMENT = 200;

async function ownCompletedOrder(c, buyerId, orderId) {
  const { rows } = await c.query('SELECT id, shop_id, status FROM orders WHERE id = $1 AND buyer_id = $2 FOR UPDATE', [orderId, buyerId]);
  if (!rows[0]) throw httpError(404, 'Order not found.');
  if (rows[0].status !== 'completed') throw httpError(409, 'You can rate after you have received the order.');
  return rows[0];
}

export async function rateOrder(buyerId, orderId, { kind, productId, stars, comment }) {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw httpError(400, 'Tap a star to rate.');
  const text = String(comment ?? '').trim().slice(0, MAX_COMMENT);

  return withTransaction(async (c) => {
    const order = await ownCompletedOrder(c, buyerId, orderId);
    let targetId = order.shop_id;
    if (kind === 'product') {
      if (!/^\d{1,18}$/.test(String(productId ?? ''))) throw httpError(400, 'This product is not in your order.');
      const item = await c.query('SELECT 1 FROM order_items WHERE order_id = $1 AND product_id = $2', [orderId, productId]);
      if (!item.rows[0]) throw httpError(400, 'This product is not in your order.');
      targetId = productId;
    }
    const made = await c.query(
      `INSERT INTO ratings (order_id, buyer_id, shop_id, kind, target_id, stars, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING id`,
      [orderId, buyerId, order.shop_id, kind, targetId, stars, text]
    );
    if (made.rows.length === 0) throw httpError(409, 'You already rated this.');
    const table = kind === 'shop' ? 'shops' : 'products';
    await c.query(`UPDATE ${table} SET stars_sum = stars_sum + $2, stars_count = stars_count + 1 WHERE id = $1`, [targetId, stars]);
    return { rating: { orderId, kind, targetId: String(targetId), stars, comment: text } };
  });
}

export async function skipRating(buyerId, orderId) {
  await withTransaction(async (c) => {
    await ownCompletedOrder(c, buyerId, orderId);
    await c.query('INSERT INTO rating_skips (order_id, buyer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [orderId, buyerId]);
  });
  return { skipped: true };
}

// Public: the latest ratings of a product or a shop. Buyers' names are never shown.
export async function listReviews(kind, id, limit = 20, offset = 0) {
  if (!/^\d{1,18}$/.test(String(id))) throw httpError(404, kind === 'shop' ? 'Shop not found.' : 'This product is not available.');
  const target =
    kind === 'shop'
      ? await pool.query('SELECT stars_sum, stars_count FROM shops WHERE id = $1 AND closed_at IS NULL', [id])
      : await pool.query('SELECT stars_sum, stars_count FROM products WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (!target.rows[0]) throw httpError(404, kind === 'shop' ? 'Shop not found.' : 'This product is not available.');
  const { stars_sum: sum, stars_count: count } = target.rows[0];

  const { rows } = await pool.query(
    `SELECT stars, comment, created_at FROM ratings WHERE kind = $1 AND target_id = $2
     ORDER BY created_at DESC, id DESC LIMIT $3::int OFFSET $4::int`,
    [kind, id, limit, offset]
  );
  return {
    rating: count ? sum / count : 0,
    count,
    reviews: rows.map((r) => ({ stars: r.stars, comment: r.comment, at: new Date(r.created_at).getTime() })),
  };
}
