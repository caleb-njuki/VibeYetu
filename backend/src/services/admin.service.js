// What VibeYetu staff do: sign in, see orders and shops, decide cases, verify and suspend shops.
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { withTransaction } from '../utils/transaction.js';
import { ACCEPT_WINDOW_SECONDS, WINDOW_SECONDS, formatKES } from '../utils/orderRules.js';
import { addEvent, refundOrder, releaseOrder } from './escrow.service.js';
import { shapeOrders } from './order.service.js';
import { evaluateShop } from './strike.service.js';
import { addShopNotice } from './notification.service.js';
import { currentReport } from './suspension.service.js';

const BCRYPT_COST = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORT_SECONDS = 72 * 60 * 60; // support decides within 72 hours of the 24-hour window ending
const ms = (d) => (d ? new Date(d).getTime() : null);
const HIDDEN = `'awaiting_payment', 'expired'`;
const REVIEW = `(o.status IN ('accepted', 'dispatched') AND now() > o.accepted_at + make_interval(secs => $1))`;
const STATUS_WITH_REVIEW = `CASE WHEN ${REVIEW} THEN 'review' ELSE o.status END`;

// ---------- Staff accounts ----------
let dummyHash;
export async function createAdmin({ email, fullName, password }) {
  const mail = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(mail)) throw new Error('Enter a valid email address.');
  if (String(fullName || '').trim().length < 2) throw new Error('Enter the full name.');
  if (String(password || '').length < 12) throw new Error('The password must be at least 12 characters.');
  const hash = await bcrypt.hash(String(password), BCRYPT_COST);
  try {
    const { rows } = await pool.query('INSERT INTO admins (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name', [mail, hash, String(fullName).trim()]);
    return rows[0];
  } catch (err) {
    if (err.constraint === 'uq_admins_email' || /uq_admins_email|duplicate key/.test(err.message)) throw new Error('A staff account with this email already exists.');
    throw err;
  }
}

export async function loginAdmin(email, password) {
  const mail = String(email || '').trim().toLowerCase();
  const { rows } = await pool.query('SELECT id, email, full_name, password_hash FROM admins WHERE email = $1', [mail]);
  dummyHash ??= await bcrypt.hash('not-a-real-password', BCRYPT_COST);
  const valid = await bcrypt.compare(String(password || ''), rows[0] ? rows[0].password_hash : dummyHash);
  if (!rows[0] || !valid) throw httpError(401, 'Wrong email or password.');
  return { id: rows[0].id, email: rows[0].email, fullName: rows[0].full_name };
}

const audit = (c, adminId, action, targetType, targetId, note = '') =>
  c.query('INSERT INTO admin_actions (admin_id, action, target_type, target_id, note) VALUES ($1, $2, $3, $4, $5)', [adminId, action, targetType, String(targetId), note]);

// ---------- Overview, orders, cases ----------
export async function overview() {
  const [totals, byStatus, reviews] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS orders,
              COALESCE(sum(o.total) FILTER (WHERE o.status IN ('pending', 'accepted', 'dispatched')), 0)::int AS escrow_total,
              (count(*) FILTER (WHERE o.status IN ('pending', 'accepted', 'dispatched')))::int AS escrow_count,
              COALESCE(sum(o.total) FILTER (WHERE o.status = 'completed'), 0)::int AS released_total,
              (count(*) FILTER (WHERE o.status = 'completed'))::int AS released_count,
              (count(*) FILTER (WHERE ${REVIEW}))::int AS cases
       FROM orders o WHERE o.status NOT IN (${HIDDEN})`,
      [WINDOW_SECONDS]
    ),
    pool.query(`SELECT ${STATUS_WITH_REVIEW} AS status, count(*)::int AS n FROM orders o WHERE o.status NOT IN (${HIDDEN}) GROUP BY 1`, [WINDOW_SECONDS]),
    pool.query(
      `SELECT count(*)::int AS n FROM shops s WHERE s.suspended AND
         (SELECT r.status FROM suspension_reports r WHERE r.shop_id = s.id AND r.suspended_at = s.suspended_at ORDER BY r.created_at DESC, r.id DESC LIMIT 1) = 'submitted'`
    ),
  ]);
  const t = totals.rows[0];
  const counts = Object.fromEntries(['pending', 'accepted', 'dispatched', 'review', 'completed', 'rejected', 'refunded'].map((k) => [k, 0]));
  for (const r of byStatus.rows) counts[r.status] = r.n;
  return {
    orders: t.orders,
    escrow: { total: t.escrow_total, count: t.escrow_count },
    released: { total: t.released_total, count: t.released_count },
    cases: t.cases,
    pendingReviews: reviews.rows[0].n,
    byStatus: counts,
  };
}

export async function listOrders({ status, q, limit = 100, offset = 0 }) {
  const params = [WINDOW_SECONDS];
  const where = [`o.status NOT IN (${HIDDEN})`];
  if (status) { params.push(status); where.push(`${STATUS_WITH_REVIEW} = $${params.length}`); }
  const term = String(q ?? '').trim().slice(0, 60);
  if (term) { params.push(`%${term.replace(/[\\%_]/g, '\\$&')}%`); where.push(`(o.id ILIKE $${params.length} OR o.shop_name ILIKE $${params.length})`); }
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT o.id, o.shop_id, o.shop_name, o.mode, o.total, o.paid_at, ${STATUS_WITH_REVIEW} AS status
     FROM orders o WHERE ${where.join(' AND ')}
     ORDER BY o.paid_at DESC, o.id LIMIT $${params.length - 1}::int OFFSET $${params.length}::int`,
    params
  );
  return { orders: rows.map((o) => ({ id: o.id, shopId: String(o.shop_id), shopName: o.shop_name, mode: o.mode, total: o.total, status: o.status, createdAt: ms(o.paid_at) })) };
}

export async function listCases() {
  const { rows } = await pool.query(
    `SELECT o.* FROM orders o WHERE ${REVIEW} AND o.status NOT IN (${HIDDEN}) ORDER BY o.accepted_at, o.id LIMIT 100`,
    [WINDOW_SECONDS]
  );
  const orders = await shapeOrders(rows, 'admin');
  return {
    cases: orders.map((o) => ({ ...o, supportDeadline: o.acceptedAt + (WINDOW_SECONDS + SUPPORT_SECONDS) * 1000 })),
    serverTime: Date.now(),
  };
}

// Support decides an order that passed its 24-hour window. The money has been held in escrow until now.
export async function decideCase(adminId, orderId, action) {
  await withTransaction(async (c) => {
    const o = (
      await c.query(
        `SELECT o.*, (o.accepted_at IS NOT NULL AND now() > o.accepted_at + make_interval(secs => $2)) AS window_over
         FROM orders o WHERE o.id = $1 FOR UPDATE`,
        [orderId, WINDOW_SECONDS]
      )
    ).rows[0];
    if (!o) throw httpError(404, 'Order not found.');
    if (!['accepted', 'dispatched'].includes(o.status) || !o.window_over) {
      throw httpError(409, 'This order is not waiting for a decision.');
    }
    if (action === 'refund') {
      const amount = await refundOrder(c, o, {
        extraEvents: [['Support reviewed the order and approved a refund.', 'Support reviewed the order and approved a refund.', 'both']],
      });
      await audit(c, adminId, 'refund', 'order', o.id, `Refunded ${formatKES(amount)}`);
    } else {
      const { payout, fee } = await releaseOrder(c, o);
      await addEvent(c, o.id, 'Support reviewed the order and released the funds to the seller.', null, 'both');
      await audit(c, adminId, 'release', 'order', o.id, `Released ${formatKES(payout)} (fee ${formatKES(fee)})`);
    }
    await evaluateShop(c, o.shop_id); // a refund of an order the seller never dispatched counts against the shop
  });
  return { ok: true, order: (await shapeOrders((await pool.query('SELECT o.* FROM orders o WHERE o.id = $1', [orderId])).rows, 'admin'))[0] };
}

// ---------- Shops ----------
const maskId = (id) => (id ? '•'.repeat(Math.max(0, String(id).length - 3)) + String(id).slice(-3) : '');

export async function listShops() {
  const { rows } = await pool.query(
    `SELECT s.id, s.name, a.town, s.verified, s.suspended, s.closed_at, s.suspend_kind, s.suspended_at, s.suspend_order_ids,
            (SELECT count(*)::int FROM orders o WHERE o.shop_id = s.id AND o.status NOT IN (${HIDDEN})) AS order_count,
            se.id AS seller_id, se.full_name, se.email, se.phone, se.id_number, se.kra_pin,
            se.business_type, se.business_name, se.business_reg_no, se.terms_version, se.consented_at
     FROM shops s JOIN areas a ON a.id = s.area_id JOIN sellers se ON se.id = s.seller_id
     ORDER BY s.created_at DESC, s.id DESC LIMIT 200`
  );
  const suspended = rows.filter((s) => s.suspended);
  const reports = new Map();
  for (const s of suspended) reports.set(String(s.id), await currentReport(pool, s.id, s.suspended_at));
  return {
    shops: rows.map((s) => ({
      id: String(s.id),
      name: s.name,
      town: s.town,
      verified: s.verified,
      suspended: s.suspended,
      closed: Boolean(s.closed_at),
      closedAt: ms(s.closed_at),
      orderCount: s.order_count,
      suspension: s.suspended ? { kind: s.suspend_kind, at: ms(s.suspended_at), orderIds: s.suspend_order_ids, report: reports.get(String(s.id)) } : null,
      seller: {
        fullName: s.full_name, email: s.email, phone: s.phone, idMasked: maskId(s.id_number), kraPin: s.kra_pin || '',
        businessType: s.business_type, businessName: s.business_name || '', businessRegNo: s.business_reg_no || '',
        termsVersion: s.terms_version, consentedAt: ms(s.consented_at),
        otherShops: rows.filter((x) => x.seller_id === s.seller_id && x.id !== s.id).map((x) => x.name),
      },
    })),
  };
}

async function lockShop(c, shopId) {
  if (!/^\d{1,18}$/.test(String(shopId))) throw httpError(404, 'Shop not found.');
  const shop = (await c.query('SELECT id, suspended, suspended_at, closed_at, verified FROM shops WHERE id = $1 FOR UPDATE', [shopId])).rows[0];
  if (!shop) throw httpError(404, 'Shop not found.');
  return shop;
}

export const setVerified = (adminId, shopId, verified) =>
  withTransaction(async (c) => {
    await lockShop(c, shopId);
    await c.query('UPDATE shops SET verified = $2 WHERE id = $1', [shopId, verified]);
    await audit(c, adminId, verified ? 'verify' : 'unverify', 'shop', shopId);
    return { ok: true, verified };
  });

export const suspendShop = (adminId, shopId) =>
  withTransaction(async (c) => {
    const shop = await lockShop(c, shopId);
    if (shop.suspended) throw httpError(409, 'This shop is already suspended.');
    if (shop.closed_at) throw httpError(409, 'This shop is closed.');
    await c.query(`UPDATE shops SET suspended = true, suspend_kind = 'admin', suspended_at = now(), suspend_order_ids = '{}' WHERE id = $1`, [shopId]);
    await addShopNotice(shopId, 'VibeYetu support suspended your shop. Write your report so support can review it.', '/my-shop/report', c);
    await audit(c, adminId, 'suspend', 'shop', shopId);
    return { ok: true };
  });

// "more_info": ask the seller for details. "reinstate": the shop goes live again.
// Reinstating needs a report, unless support overrides because the suspension was a mistake.
export const reviewSuspension = (adminId, shopId, { action, note = '', override = false }) =>
  withTransaction(async (c) => {
    const shop = await lockShop(c, shopId);
    if (!shop.suspended) throw httpError(409, 'This shop is not suspended.');
    const report = await currentReport(c, shopId, shop.suspended_at);
    if (action === 'more_info') {
      if (!report) throw httpError(409, 'The seller has not sent a report yet.');
      const text = String(note).trim();
      if (text.length < 5) throw httpError(400, 'Write what you need from the seller.');
      await c.query(`UPDATE suspension_reports SET status = 'more_info', admin_note = $2 WHERE id = $1`, [report.id, text.slice(0, 500)]);
      await addShopNotice(shopId, `Support needs more details about your suspension: ${text.slice(0, 200)}`, '/my-shop/report', c);
      await audit(c, adminId, 'more_info', 'shop', shopId, text.slice(0, 200));
      return { ok: true };
    }
    if (!report && !override) throw httpError(409, 'The seller has not written a report yet.');
    if (report) await c.query(`UPDATE suspension_reports SET status = 'accepted', reviewed_at = now() WHERE id = $1`, [report.id]);
    await c.query(`UPDATE shops SET suspended = false, reinstated_at = now() WHERE id = $1`, [shopId]);
    await addShopNotice(shopId, 'Your shop is live again. Thank you for cooperating. Please keep your promises to buyers.', '/my-shop', c);
    await audit(c, adminId, report ? 'reinstate' : 'reinstate_without_report', 'shop', shopId);
    return { ok: true };
  });
