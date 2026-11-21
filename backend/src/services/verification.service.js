// A shop verifies itself: the seller presses a button, and it works when every setting is complete and the
// shop has enough products. Support can still take the verification away (see admin.service.js).
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { normalizePhone } from '../utils/phone.js';
import { withTransaction } from '../utils/transaction.js';
import { addShopNotice } from './notification.service.js';

export const MIN_PRODUCTS = 3;
export const VERIFIED_WARNING =
  'Your shop is now verified. Please note: VibeYetu can take this verification away if we find irregularities. ' +
  'In serious cases your shop can also be suspended, or closed completely.';

async function readChecks(db, shopId) {
  const shop = (
    await db.query(
      `SELECT photo, description, lat, lng, fulfillment, delivery_fee, contact_phone, verified, suspended, closed_at
       FROM shops WHERE id = $1`,
      [shopId]
    )
  ).rows[0];
  if (!shop) throw httpError(404, 'Shop not found.');
  const payout = (await db.query('SELECT 1 FROM payout_methods WHERE shop_id = $1', [shopId])).rows.length > 0;
  const products = (await db.query('SELECT count(*)::int AS n FROM products WHERE shop_id = $1 AND active AND deleted_at IS NULL', [shopId])).rows[0].n;
  const delivers = shop.fulfillment.includes('delivery');
  const phone = normalizePhone(String(shop.contact_phone ?? ''));
  const checks = [
    { id: 'photo', label: 'A shop photo', ok: Boolean(shop.photo), where: 'Settings' },
    { id: 'description', label: 'A shop description of at least 20 characters', ok: String(shop.description ?? '').trim().length >= 20, where: 'Settings' },
    { id: 'pin', label: 'Your shop pinned on the map', ok: shop.lat !== null && shop.lng !== null, where: 'Settings' },
    { id: 'fulfillment', label: 'Delivery or pickup chosen', ok: shop.fulfillment.length > 0, where: 'Settings' },
    { id: 'phone', label: 'A contact phone number, so buyers can reach you', ok: Boolean(phone), where: 'Settings' },
    { id: 'payout', label: 'A payout method', ok: payout, where: 'Payments' },
    {
      id: 'deliveryFee',
      label: 'A delivery fee per kilometre (not needed if you only offer pickup)',
      ok: !delivers || shop.delivery_fee !== null,
      where: 'Payments',
    },
    { id: 'products', label: `At least ${MIN_PRODUCTS} products on sale (you have ${products})`, ok: products >= MIN_PRODUCTS, where: 'Inventory' },
  ];
  return { shop, checks };
}

export async function getVerification(shopId) {
  const { shop, checks } = await readChecks(pool, shopId);
  return {
    verified: shop.verified,
    blocked: shop.suspended ? 'suspended' : shop.closed_at ? 'closed' : null,
    ready: checks.every((c) => c.ok),
    checks,
    warning: VERIFIED_WARNING,
  };
}

export async function verifyShop(shopId) {
  await withTransaction(async (c) => {
    await c.query('SELECT id FROM shops WHERE id = $1 FOR UPDATE', [shopId]);
    const { shop, checks } = await readChecks(c, shopId);
    if (shop.closed_at) throw httpError(409, 'A closed shop cannot be verified.');
    if (shop.suspended) throw httpError(409, 'A suspended shop cannot be verified.');
    if (shop.verified) return;
    const missing = checks.filter((x) => !x.ok);
    if (missing.length) throw httpError(409, `Your shop is not ready yet. Still missing: ${missing.map((x) => x.label.toLowerCase()).join('; ')}.`);
    await c.query('UPDATE shops SET verified = true WHERE id = $1', [shopId]);
    await addShopNotice(shopId, VERIFIED_WARNING, '/my-shop', c);
  });
  return getVerification(shopId);
}
