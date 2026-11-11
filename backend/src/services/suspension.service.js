// A suspended shop: what the seller sees, and the report the seller writes.
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { withTransaction } from '../utils/transaction.js';

export const REPORT_REASONS = [
  'I ran out of stock',
  'I was closed or away',
  'I could not arrange delivery',
  'My phone or network failed',
  'The buyer could not be reached',
  'Something else',
];

const ms = (d) => (d ? new Date(d).getTime() : null);

export const shapeReport = (r) =>
  !r ? null : {
    id: String(r.id),
    shopId: String(r.shop_id),
    suspendedAt: ms(r.suspended_at),
    orderIds: r.order_ids,
    reason: r.reason,
    details: r.details,
    plan: r.plan,
    status: r.status,
    adminNote: r.admin_note,
    at: ms(r.created_at),
    reviewedAt: ms(r.reviewed_at),
  };

// The newest report for the shop's CURRENT suspension.
export async function currentReport(db, shopId, suspendedAt) {
  const { rows } = await db.query(
    `SELECT * FROM suspension_reports WHERE shop_id = $1 AND suspended_at = $2::timestamptz ORDER BY created_at DESC, id DESC LIMIT 1`,
    [shopId, suspendedAt]
  );
  return shapeReport(rows[0]);
}

export async function getSuspension(shopId) {
  const shop = (await pool.query('SELECT suspended, suspend_kind, suspended_at, suspend_order_ids FROM shops WHERE id = $1', [shopId])).rows[0];
  if (!shop || !shop.suspended) return { suspended: false };
  const orders = (
    await pool.query(
      `SELECT id, total, paid_at FROM orders WHERE shop_id = $1 AND id = ANY($2::text[]) ORDER BY paid_at, id`,
      [shopId, shop.suspend_order_ids]
    )
  ).rows;
  return {
    suspended: true,
    kind: shop.suspend_kind,
    suspendedAt: ms(shop.suspended_at),
    orders: orders.map((o) => ({ id: o.id, total: o.total, createdAt: ms(o.paid_at) })),
    report: await currentReport(pool, shopId, shop.suspended_at),
    reasons: REPORT_REASONS,
  };
}

export async function submitSuspensionReport(shopId, { reason, details, plan }) {
  await withTransaction(async (c) => {
    const shop = (await c.query('SELECT suspended, suspended_at, suspend_order_ids FROM shops WHERE id = $1 FOR UPDATE', [shopId])).rows[0];
    if (!shop?.suspended) throw httpError(409, 'Your shop is not suspended.');
    if (!REPORT_REASONS.includes(reason)) throw httpError(400, 'Choose what best explains what happened.');
    const d = String(details ?? '').trim();
    const p = String(plan ?? '').trim();
    if (d.length < 30) throw httpError(400, 'Please explain what happened in at least 30 characters.');
    if (d.length > 1000) throw httpError(400, 'Please keep what happened under 1000 characters.');
    if (p.length < 20) throw httpError(400, 'Please tell us how you will prevent it, in at least 20 characters.');
    if (p.length > 500) throw httpError(400, 'Please keep your plan under 500 characters.');
    await c.query(
      `INSERT INTO suspension_reports (shop_id, suspended_at, order_ids, reason, details, plan) VALUES ($1, $2, $3::text[], $4, $5, $6)`,
      [shopId, shop.suspended_at, shop.suspend_order_ids, reason, d, p]
    );
  });
  return getSuspension(shopId);
}
