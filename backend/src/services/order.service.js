// Orders and escrow: checkout, payment, and every step an order goes through.
// Rules and wording match the frontend (src/context/OrdersContext.jsx).
import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { withTransaction } from '../utils/transaction.js';
import { normalizePhone } from '../utils/phone.js';
import {
  ACCEPT_WINDOW_SECONDS, MAX_OPEN_CHECKOUTS, MAX_QTY_PER_ITEM, PLATFORM_FEE_PERCENT, PROMISES,
  UNPAID_EXPIRY_SECONDS, WINDOW_SECONDS, formatKES, formatSize, formatWhen,
} from '../utils/orderRules.js';
import { saveProduct, takeFrom, restockOrder } from './stock.service.js';
import { addEvent, holdPayment, refundOrder, releaseOrder } from './escrow.service.js';
import { chargeBuyer, PAYMENT_PROVIDER } from './payment.service.js';
import { evaluateShop } from './strike.service.js';

export const SELLER_REJECT_REASONS = ['Out of stock', 'Item is faulty', 'Cannot deliver in time', 'Other'];
export const BUYER_REJECT_REASONS = ['Item is faulty', 'Wrong item', 'Not as described', 'Damaged in transit'];
export const REPORT_REASONS = {
  buyer: ['I did not receive the item', 'The item arrived late', 'The item was faulty or wrong', 'The seller could not be reached', 'Other'],
  seller: ['The buyer could not be reached', 'The buyer was not at the location', 'I could not deliver in time', 'The item was refused or returned', 'Other'],
};

const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newId = (prefix) => prefix + Array.from({ length: 6 }, () => ID_CHARS[crypto.randomInt(ID_CHARS.length)]).join('');
const newCode = () => String(crypto.randomInt(100000, 1000000));
const ms = (d) => (d ? new Date(d).getTime() : null);
const cleanText = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// ---------- Checkout ----------

// items: [{ productId, qty, size }]. Prices and names come from OUR database, never from the app.
export async function createCheckout(buyerId, { items, modes = {}, contact }) {
  const name = cleanText(contact?.name);
  const phone = normalizePhone(String(contact?.phone ?? ''));
  if (name.length < 2 || name.length > 80 || !phone) {
    throw httpError(400, 'Enter your name and a phone number the seller can reach you on.');
  }

  // The same product and size twice becomes one line.
  const lines = new Map();
  for (const i of items) {
    if (!/^\d+$/.test(String(i.productId))) throw httpError(400, 'An item in your cart is no longer for sale. Please remove it and try again.');
    const key = `${i.productId}|${i.size || ''}`;
    const line = lines.get(key) || { productId: String(i.productId), size: i.size || '', qty: 0 };
    line.qty += i.qty;
    lines.set(key, line);
  }
  for (const l of lines.values()) {
    if (l.qty > MAX_QTY_PER_ITEM) throw httpError(400, `You can order at most ${MAX_QTY_PER_ITEM} of one item.`);
  }

  return withTransaction(async (c) => {
    // One checkout at a time per buyer, so the open-checkout limit below cannot be skipped by two quick taps.
    await c.query('SELECT id FROM buyers WHERE id = $1 FOR UPDATE', [buyerId]);
    const open = await c.query(`SELECT count(*)::int AS n FROM checkout_groups WHERE buyer_id = $1 AND status = 'awaiting_payment'`, [buyerId]);
    if (open.rows[0].n >= MAX_OPEN_CHECKOUTS) {
      throw httpError(429, 'You have several unpaid checkouts. Please pay for them or wait a few minutes.');
    }

    const ids = [...new Set([...lines.values()].map((l) => l.productId))];
    const found = await c.query(
      `SELECT p.id, p.shop_id, p.name, p.price, p.stock, p.size_type, p.sizes, p.active, p.deleted_at,
              s.name AS shop_name, s.suspended, s.closed_at, s.fulfillment, s.delivery_fee
       FROM products p JOIN shops s ON s.id = p.shop_id
       WHERE p.id = ANY($1::bigint[]) ORDER BY p.id FOR UPDATE OF p`,
      [ids]
    );
    const products = new Map(found.rows.map((p) => [String(p.id), p]));

    const byShop = new Map();
    for (const l of lines.values()) {
      const p = products.get(l.productId);
      if (!p || p.deleted_at || !p.active) throw httpError(409, 'An item in your cart is no longer for sale. Please remove it and try again.');
      if (p.suspended) throw httpError(409, 'A shop in your cart is not taking orders right now. Please remove its items and try again.');
      if (p.closed_at) throw httpError(409, 'A shop in your cart has closed. Please remove its items and try again.');

      if (p.size_type !== 'none') {
        if (!l.size || !(l.size in (p.sizes || {}))) {
          throw httpError(400, `${p.name} is sold in sizes. Please remove it from your cart and choose a size on its page.`);
        }
      } else if (l.size) {
        throw httpError(400, `${p.name} does not come in sizes. Please remove it from your cart and add it again.`);
      }

      const left = takeFrom(p, l.size, l.qty);
      if (left !== null) {
        const where = p.size_type !== 'none' ? ` in ${formatSize(p.size_type, l.size)}` : '';
        throw httpError(
          409,
          left === 0 ? `${p.name}${where} is sold out. Please remove it from your cart.` : `Only ${left} of ${p.name}${where} left. Please lower the quantity.`
        );
      }

      const shopKey = String(p.shop_id);
      if (!byShop.has(shopKey)) byShop.set(shopKey, { shopId: p.shop_id, shopName: p.shop_name, shop: p, subtotal: 0, items: [] });
      const o = byShop.get(shopKey);
      o.subtotal += p.price * l.qty;
      o.items.push({ productId: p.id, name: p.name, price: p.price, qty: l.qty, size: l.size, sizeType: l.size ? p.size_type : '' });
    }

    const groupId = newId('G-');
    const orders = [];
    for (const o of byShop.values()) {
      const mode = modes[String(o.shopId)] === 'delivery' ? 'delivery' : 'pickup';
      const shop = o.shop;
      if (mode === 'delivery' && !(shop.fulfillment.includes('delivery') && shop.delivery_fee !== null)) {
        throw httpError(400, `${o.shopName} is not delivering right now. Please choose pickup for that shop.`);
      }
      if (mode === 'pickup' && !shop.fulfillment.includes('pickup')) {
        throw httpError(400, `${o.shopName} does not offer pickup. Please choose delivery for that shop.`);
      }
      const area = cleanText(contact?.area).slice(0, 80);
      const street = cleanText(contact?.street).slice(0, 120);
      if (mode === 'delivery' && (!area || !street)) throw httpError(400, 'Enter your area and street so the shop can deliver.');
      const deliveryFee = mode === 'delivery' ? shop.delivery_fee : 0;
      orders.push({ id: newId('VY-'), ...o, mode, deliveryFee, total: o.subtotal + deliveryFee, area, street });
    }
    const total = orders.reduce((n, o) => n + o.total, 0);

    await c.query(`INSERT INTO checkout_groups (id, buyer_id, total, payment_provider) VALUES ($1, $2, $3, $4)`, [groupId, buyerId, total, PAYMENT_PROVIDER]);
    for (const o of orders) {
      await c.query(
        `INSERT INTO orders (id, group_id, buyer_id, shop_id, shop_name, status, mode, subtotal, delivery_fee, total, fee_percent,
                             buyer_name, buyer_phone, address_area, address_street)
         VALUES ($1,$2,$3,$4,$5,'awaiting_payment',$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [o.id, groupId, buyerId, o.shopId, o.shopName, o.mode, o.subtotal, o.deliveryFee, o.total, PLATFORM_FEE_PERCENT, name, phone,
         o.mode === 'delivery' ? o.area : null, o.mode === 'delivery' ? o.street : null]
      );
      for (const i of o.items) {
        await c.query(
          `INSERT INTO order_items (order_id, product_id, name, price, qty, size, size_type) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [o.id, i.productId, i.name, i.price, i.qty, i.size, i.sizeType]
        );
      }
    }
    for (const [id, p] of products) await saveProduct(c, id, p);

    return {
      id: groupId,
      total,
      expiresAt: Date.now() + UNPAID_EXPIRY_SECONDS * 1000,
      orders: orders.map((o) => ({ id: o.id, shopId: String(o.shopId), shopName: o.shopName, mode: o.mode, subtotal: o.subtotal, deliveryFee: o.deliveryFee, total: o.total })),
    };
  });
}

// Cancels an unpaid checkout and puts its items back. The caller holds the lock on the group row.
async function expireGroup(c, groupId) {
  const orders = (await c.query('SELECT id FROM orders WHERE group_id = $1 ORDER BY id FOR UPDATE', [groupId])).rows;
  for (const o of orders) {
    await restockOrder(c, o.id);
    await c.query(`UPDATE orders SET status = 'expired', updated_at = now() WHERE id = $1`, [o.id]);
  }
  await c.query(`UPDATE checkout_groups SET status = 'expired' WHERE id = $1`, [groupId]);
}

export async function payCheckout(buyerId, groupId, { method, phone }) {
  let payPhone = null;
  if (method === 'mpesa') {
    payPhone = normalizePhone(String(phone ?? ''));
    if (!payPhone) throw httpError(400, 'Enter the M-Pesa phone number you want to pay from.');
  }

  const result = await withTransaction(async (c) => {
    const g = (
      await c.query(
        `SELECT *, (created_at <= now() - make_interval(secs => $3)) AS stale FROM checkout_groups WHERE id = $1 AND buyer_id = $2 FOR UPDATE`,
        [groupId, buyerId, UNPAID_EXPIRY_SECONDS]
      )
    ).rows[0];
    if (!g) throw httpError(404, 'Checkout not found.');
    if (g.status === 'paid') return { already: true, group: g };
    if (g.status === 'expired') return { expired: true };
    if (g.stale) {
      await expireGroup(c, g.id);
      return { expired: true };
    }

    const charge = await chargeBuyer({ method, phone: payPhone, amount: g.total, groupId: g.id });
    if (!charge.ok) throw httpError(402, 'The payment did not go through. You have not been charged. Please try again.');

    await c.query(
      `UPDATE checkout_groups SET status = 'paid', payment_method = $2, payment_phone = $3, paid_at = now() WHERE id = $1`,
      [g.id, method, payPhone]
    );
    const orders = (await c.query(`SELECT * FROM orders WHERE group_id = $1 ORDER BY id FOR UPDATE`, [g.id])).rows;
    for (const o of orders) {
      await c.query(`UPDATE orders SET status = 'pending', paid_at = now(), updated_at = now() WHERE id = $1`, [o.id]);
      await holdPayment(c, o);
      await addEvent(c, o.id, 'Payment received. Your money is held in escrow.', `New order ${o.id} for ${formatKES(o.total)}. Agree to fulfil it.`, 'seller');
    }
    return { group: g, orderIds: orders.map((o) => o.id) };
  });

  if (result.expired) throw httpError(409, 'This checkout expired because it was not paid in time. Please start again.');
  if (result.already) {
    const ids = (await pool.query('SELECT id FROM orders WHERE group_id = $1 ORDER BY id', [groupId])).rows.map((r) => r.id);
    return { ok: true, alreadyPaid: true, groupId, total: result.group.total, orders: await getBuyerOrdersByIds(buyerId, ids) };
  }
  return { ok: true, groupId, total: result.group.total, orders: await getBuyerOrdersByIds(buyerId, result.orderIds) };
}

// ---------- Reading orders ----------

export async function shapeOrders(rows, role) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [items, events, reports, ratings, skips] = await Promise.all([
    pool.query('SELECT * FROM order_items WHERE order_id = ANY($1::text[]) ORDER BY id', [ids]),
    pool.query('SELECT * FROM order_events WHERE order_id = ANY($1::text[]) ORDER BY id', [ids]),
    pool.query(`SELECT * FROM order_reports WHERE order_id = ANY($1::text[]) AND ($2::text = 'admin' OR role = $2)`, [ids, role]),
    // A seller sees only the rating of their shop. A buyer sees their own ratings.
    pool.query(
      `SELECT order_id, kind, target_id, stars, comment, created_at FROM ratings
       WHERE order_id = ANY($1::text[]) AND ($2::text IN ('buyer', 'admin') OR kind = 'shop') ORDER BY id`,
      [ids, role]
    ),
    pool.query('SELECT order_id FROM rating_skips WHERE order_id = ANY($1::text[])', [ids]),
  ]);
  const group = (list) => list.reduce((m, r) => (m.get(r.order_id)?.push(r) ?? m.set(r.order_id, [r]), m), new Map());
  const itemsBy = group(items.rows), eventsBy = group(events.rows), reportsBy = group(reports.rows), ratingsBy = group(ratings.rows);
  const skipped = new Set(skips.rows.map((r) => r.order_id));

  return rows.map((o) => {
    // The receipt code: the seller sees it while preparing the order, the buyer once it is on the way.
    const showCode = (role === 'seller' && o.status === 'accepted') || (role === 'buyer' && o.status === 'dispatched');
    return {
      id: o.id,
      groupId: o.group_id,
      shopId: String(o.shop_id),
      shopName: o.shop_name,
      status: o.status,
      mode: o.mode,
      subtotal: o.subtotal,
      deliveryFee: o.delivery_fee,
      total: o.total,
      items: (itemsBy.get(o.id) || []).map((i) => ({ productId: String(i.product_id), name: i.name, qty: i.qty, price: i.price, size: i.size, sizeType: i.size_type })),
      buyer: { name: o.buyer_name, phone: o.buyer_phone },
      address: o.mode === 'delivery' ? { area: o.address_area, street: o.address_street } : null,
      createdAt: ms(o.paid_at),
      acceptedAt: ms(o.accepted_at),
      promisedBy: ms(o.promised_by),
      completedAt: ms(o.completed_at),
      code: showCode ? o.code : null,
      sellerConfirmed: o.seller_confirmed,
      buyerConfirmed: o.buyer_confirmed,
      rejectedBy: o.rejected_by,
      rejectReason: o.reject_reason,
      returnConfirmed: o.return_confirmed,
      refundRequested: o.refund_requested,
      refundAmount: o.refund_amount,
      unanswered: o.unanswered,
      reports: Object.fromEntries((reportsBy.get(o.id) || []).map((r) => [r.role, { reason: r.reason, details: r.details, at: ms(r.created_at) }])),
      ratings: (ratingsBy.get(o.id) || []).map((r) => ({ kind: r.kind, targetId: String(r.target_id), stars: r.stars, comment: r.comment, at: ms(r.created_at) })),
      ratingSkipped: role === 'buyer' && skipped.has(o.id),
      events: (eventsBy.get(o.id) || []).map((e) => ({ at: ms(e.created_at), buyer: e.buyer_text, seller: e.seller_text, notify: e.notify })),
    };
  });
}

const VISIBLE = `o.status <> 'awaiting_payment' AND o.status <> 'expired'`;
const serverTime = () => Date.now();

async function getBuyerOrdersByIds(buyerId, ids) {
  const { rows } = await pool.query(`SELECT o.* FROM orders o WHERE o.buyer_id = $1 AND o.id = ANY($2::text[]) ORDER BY o.paid_at DESC, o.id`, [buyerId, ids]);
  return shapeOrders(rows, 'buyer');
}

export async function listBuyerOrders(buyerId) {
  const { rows } = await pool.query(`SELECT o.* FROM orders o WHERE o.buyer_id = $1 AND ${VISIBLE} ORDER BY o.paid_at DESC, o.id LIMIT 200`, [buyerId]);
  return { orders: await shapeOrders(rows, 'buyer'), serverTime: serverTime() };
}

export async function getBuyerOrder(buyerId, orderId) {
  const { rows } = await pool.query(`SELECT o.* FROM orders o WHERE o.buyer_id = $1 AND o.id = $2 AND ${VISIBLE}`, [buyerId, orderId]);
  if (!rows[0]) throw httpError(404, 'Order not found.');
  return { order: (await shapeOrders(rows, 'buyer'))[0], serverTime: serverTime() };
}

export async function listShopOrders(shopId) {
  const { rows } = await pool.query(`SELECT o.* FROM orders o WHERE o.shop_id = $1 AND ${VISIBLE} ORDER BY o.paid_at DESC, o.id LIMIT 200`, [shopId]);
  return { orders: await shapeOrders(rows, 'seller'), serverTime: serverTime() };
}

export async function getShopOrder(shopId, orderId) {
  const { rows } = await pool.query(`SELECT o.* FROM orders o WHERE o.shop_id = $1 AND o.id = $2 AND ${VISIBLE}`, [shopId, orderId]);
  if (!rows[0]) throw httpError(404, 'Order not found.');
  return { order: (await shapeOrders(rows, 'seller'))[0], serverTime: serverTime() };
}

// ---------- Steps an order goes through ----------

// Locks one order, and says whether its timers have run out (worked out by the database clock).
async function lockOrder(c, who, ownerId, orderId) {
  const column = who === 'buyer' ? 'o.buyer_id' : 'o.shop_id';
  const { rows } = await c.query(
    `SELECT o.*,
            (o.status = 'pending' AND o.paid_at <= now() - make_interval(secs => $2)) AS accept_late,
            (o.accepted_at IS NOT NULL AND now() > o.accepted_at + make_interval(secs => $3)) AS window_over
     FROM orders o WHERE o.id = $1 AND ${column} = $4 AND ${VISIBLE} FOR UPDATE OF o`,
    [orderId, ACCEPT_WINDOW_SECONDS, WINDOW_SECONDS, ownerId]
  );
  if (!rows[0]) throw httpError(404, 'Order not found.');
  return rows[0];
}

const LATE_TEXT = 'This order expired because it was not answered in time. The buyer was refunded.';
const WINDOW_TEXT = 'The 24-hour window has ended. Please answer the review form.';

// Runs one step. `step` returns normally, or returns { late: true } if the seller was too slow (then the refund is kept).
async function act(who, ownerId, orderId, step) {
  const out = await withTransaction(async (c) => {
    const o = await lockOrder(c, who, ownerId, orderId);
    return step(c, o);
  });
  if (out?.late) throw httpError(409, LATE_TEXT);
  return who === 'buyer' ? getBuyerOrder(ownerId, orderId) : getShopOrder(ownerId, orderId);
}

const wrongCode = (o, code) => {
  const a = Buffer.from(String(code ?? '').trim()), b = Buffer.from(String(o.code ?? ''));
  return a.length !== b.length || !crypto.timingSafeEqual(a, b);
};

export const sellerAccept = (shopId, orderId, promise) =>
  act('seller', shopId, orderId, async (c, o) => {
    if (o.status !== 'pending') throw httpError(409, 'This order can no longer be accepted.');
    if (o.accept_late) { await refundOrder(c, o, { unanswered: true }); await evaluateShop(c, o.shop_id); return { late: true }; }
    const seconds = PROMISES[promise];
    if (!seconds) throw httpError(400, 'Choose when the order will be ready.');
    const { rows } = await c.query(
      `UPDATE orders SET status = 'accepted', code = $2, accepted_at = now(), promised_by = now() + make_interval(secs => $3), updated_at = now()
       WHERE id = $1 RETURNING promised_by`,
      [o.id, newCode(), seconds]
    );
    const by = formatWhen(rows[0].promised_by);
    await addEvent(c, o.id, `Seller agreed to fulfil your order by ${by}.`, `You agreed to fulfil this order by ${by}.`, 'buyer');
  });

export const sellerReject = (shopId, orderId, reason) =>
  act('seller', shopId, orderId, async (c, o) => {
    if (!SELLER_REJECT_REASONS.includes(reason)) throw httpError(400, 'Choose a reason.');
    if (o.status !== 'pending' && o.status !== 'accepted') throw httpError(409, 'This order can no longer be rejected.');
    if (o.accept_late) { await refundOrder(c, o, { unanswered: true }); await evaluateShop(c, o.shop_id); return { late: true }; }
    if (o.window_over) throw httpError(409, WINDOW_TEXT);
    await c.query(`UPDATE orders SET status = 'rejected', rejected_by = 'seller', reject_reason = $2, updated_at = now() WHERE id = $1`, [o.id, reason]);
    await restockOrder(c, o.id); // nothing left the shop, so the items go back on sale
    await addEvent(c, o.id, `Seller rejected the order: ${reason}.`, `You rejected the order: ${reason}.`, 'buyer');
    if (o.status === 'accepted') await evaluateShop(c, o.shop_id); // agreeing and then rejecting counts as unfulfilled
  });

export const sellerDispatch = (shopId, orderId, code) =>
  act('seller', shopId, orderId, async (c, o) => {
    if (o.status !== 'accepted') throw httpError(409, 'This order can no longer be updated.');
    if (o.window_over) throw httpError(409, WINDOW_TEXT);
    if (wrongCode(o, code)) throw httpError(400, 'That code is not correct. Check it and try again.');
    await c.query(`UPDATE orders SET status = 'dispatched', seller_confirmed = true, updated_at = now() WHERE id = $1`, [o.id]);
    await addEvent(c, o.id, 'Seller entered the code. Your order has left. Enter your code when it arrives.', 'You entered the code. The order has left your shop.', 'buyer');
  });

export const sellerConfirmReturn = (shopId, orderId) =>
  act('seller', shopId, orderId, async (c, o) => {
    if (o.status !== 'rejected' || o.rejected_by !== 'buyer' || o.return_confirmed) {
      throw httpError(409, 'There is no return to confirm for this order.');
    }
    await c.query('UPDATE orders SET return_confirmed = true, updated_at = now() WHERE id = $1', [o.id]);
    await restockOrder(c, o.id);
    await addEvent(c, o.id, 'Seller confirmed the returned item.', 'You confirmed the returned item. Inventory updated.', 'buyer');
    if (o.refund_requested) await refundOrder(c, { ...o, return_confirmed: true });
  });

export const buyerConfirm = (buyerId, orderId, code) =>
  act('buyer', buyerId, orderId, async (c, o) => {
    if (o.status !== 'dispatched') throw httpError(409, 'This order can no longer be updated.');
    if (o.window_over) throw httpError(409, WINDOW_TEXT);
    if (wrongCode(o, code)) throw httpError(400, 'That code is not correct. Check it and try again.');
    await c.query('UPDATE orders SET buyer_confirmed = true WHERE id = $1', [o.id]);
    await releaseOrder(c, o);
    await addEvent(c, o.id, 'You confirmed receipt.', 'Buyer confirmed receipt.', 'seller');
    await addEvent(c, o.id, 'Funds released to the seller.', 'Payment released to you.', 'seller');
  });

export const buyerReject = (buyerId, orderId, reason) =>
  act('buyer', buyerId, orderId, async (c, o) => {
    if (!BUYER_REJECT_REASONS.includes(reason)) throw httpError(400, 'Choose a reason.');
    if (o.status !== 'dispatched') throw httpError(409, 'This order can no longer be rejected.');
    if (o.window_over) throw httpError(409, WINDOW_TEXT);
    await c.query(`UPDATE orders SET status = 'rejected', rejected_by = 'buyer', reject_reason = $2, updated_at = now() WHERE id = $1`, [o.id, reason]);
    await addEvent(c, o.id, `You rejected the item: ${reason}. Please return it to the seller.`, `Buyer rejected the item: ${reason}. Expect it back, then confirm the return.`, 'seller');
  });

export const buyerRequestRefund = (buyerId, orderId) =>
  act('buyer', buyerId, orderId, async (c, o) => {
    if (o.status !== 'rejected' || o.refund_requested) throw httpError(409, 'A refund cannot be requested for this order.');
    await c.query('UPDATE orders SET refund_requested = true, updated_at = now() WHERE id = $1', [o.id]);
    await addEvent(c, o.id, 'You requested a refund.', 'Buyer requested a refund.', 'seller');
    if (o.rejected_by === 'seller' || o.return_confirmed) await refundOrder(c, { ...o, refund_requested: true });
  });

// The short form both sides answer when the 24-hour window ends.
export const submitReport = (who, ownerId, orderId, { reason, details }) =>
  act(who, ownerId, orderId, async (c, o) => {
    if (!['accepted', 'dispatched'].includes(o.status) || !o.window_over) throw httpError(409, 'This order is not waiting for a review form.');
    if (!REPORT_REASONS[who].includes(reason)) throw httpError(400, 'Choose a reason from the list.');
    const text = String(details ?? '').trim();
    if (text.length < 10) throw httpError(400, 'Please tell us what happened in a few words.');
    if (text.length > 1000) throw httpError(400, 'Please keep it under 1000 characters.');
    const done = await c.query('INSERT INTO order_reports (order_id, role, reason, details) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING order_id', [o.id, who, reason, text]);
    if (done.rows.length === 0) throw httpError(409, 'You already answered the review form.');
    await addEvent(
      c, o.id,
      who === 'buyer' ? 'You answered the review form.' : 'Seller answered the review form.',
      who === 'buyer' ? 'Buyer answered the review form.' : 'You answered the review form.',
      who === 'buyer' ? 'seller' : 'buyer'
    );
  });

// ---------- Background sweep (runs every 30 seconds) ----------

export async function sweep() {
  let cancelled = 0, refunded = 0, suspended = 0;

  // 1. Unpaid checkouts older than 15 minutes: cancel and put the items back.
  const groups = await pool.query(
    `SELECT id FROM checkout_groups WHERE status = 'awaiting_payment' AND created_at <= now() - make_interval(secs => $1) LIMIT 100`,
    [UNPAID_EXPIRY_SECONDS]
  );
  for (const { id } of groups.rows) {
    try {
      await withTransaction(async (c) => {
        const g = (await c.query(`SELECT id FROM checkout_groups WHERE id = $1 AND status = 'awaiting_payment' FOR UPDATE SKIP LOCKED`, [id])).rows[0];
        if (g) { await expireGroup(c, id); cancelled++; }
      });
    } catch (err) { console.error('Sweep: could not cancel checkout', id, err.message); }
  }

  // 2. Paid orders the seller did not answer within 1 hour: refund the buyer in full.
  const late = await pool.query(
    `SELECT id FROM orders WHERE status = 'pending' AND paid_at <= now() - make_interval(secs => $1) LIMIT 100`,
    [ACCEPT_WINDOW_SECONDS]
  );
  for (const { id } of late.rows) {
    try {
      await withTransaction(async (c) => {
        const o = (
          await c.query(
            `SELECT * FROM orders WHERE id = $1 AND status = 'pending' AND paid_at <= now() - make_interval(secs => $2) FOR UPDATE SKIP LOCKED`,
            [id, ACCEPT_WINDOW_SECONDS]
          )
        ).rows[0];
        if (o) { await refundOrder(c, o, { unanswered: true }); await evaluateShop(c, o.shop_id); refunded++; }
      });
    } catch (err) { console.error('Sweep: could not refund order', id, err.message); }
  }

  // 3. Shops with an order they agreed to but never dispatched in 24 hours: that counts as unfulfilled too.
  const overdue = await pool.query(
    `SELECT DISTINCT shop_id FROM orders WHERE status = 'accepted' AND NOT seller_confirmed AND accepted_at <= now() - make_interval(secs => $1) LIMIT 100`,
    [WINDOW_SECONDS]
  );
  for (const { shop_id: shopId } of overdue.rows) {
    try {
      if (await withTransaction((c) => evaluateShop(c, shopId))) suspended++;
    } catch (err) { console.error('Sweep: could not check shop', shopId, err.message); }
  }
  return { cancelled, refunded, suspended };
}
