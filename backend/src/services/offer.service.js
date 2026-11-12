// Seller offers: percentage discounts for a set time.
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';

export const MIN_PERCENT = 5;
export const MAX_PERCENT = 70;
export const MAX_OPEN_OFFERS = 30; // offers that have not ended yet, per shop
const MAX_LENGTH_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

const ms = (d) => (d ? new Date(d).getTime() : null);

export function shapeOffer(row, now = Date.now()) {
  const startsAt = ms(row.starts_at);
  const endsAt = ms(row.ends_at);
  const state = !row.active ? 'paused' : now < startsAt ? 'scheduled' : now > endsAt ? 'ended' : 'live';
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    name: row.name,
    percent: row.percent,
    productIds: row.all_products ? 'all' : row.product_ids.map(String),
    startsAt,
    endsAt,
    active: row.active,
    state,
  };
}

export async function listShopOffers(shopId) {
  const { rows } = await pool.query('SELECT * FROM offers WHERE shop_id = $1 ORDER BY created_at DESC, id DESC', [shopId]);
  return { offers: rows.map((r) => shapeOffer(r)) };
}

export async function createOffer(shopId, input) {
  const name = String(input.name || '').replace(/\s+/g, ' ').trim();
  if (name.length < 3 || name.length > 40) throw httpError(400, 'Give the offer a name of 3 to 40 characters, like Weekend sale.');
  const percent = input.percent;
  if (!Number.isInteger(percent) || percent < MIN_PERCENT || percent > MAX_PERCENT) {
    throw httpError(400, `The discount must be a whole number from ${MIN_PERCENT} to ${MAX_PERCENT}.`);
  }
  const { startsAt, endsAt } = input;
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) throw httpError(400, 'The end time must be after the start time.');
  if (endsAt <= Date.now()) throw httpError(400, 'The end time has already passed.');
  if (endsAt - startsAt > MAX_LENGTH_MS) throw httpError(400, 'An offer can run for at most 90 days.');
  if (startsAt > Date.now() + MAX_AHEAD_MS) throw httpError(400, 'An offer cannot start more than a year from now.');

  let all = input.productIds === 'all';
  let ids = [];
  if (!all) {
    if (!Array.isArray(input.productIds) || input.productIds.length === 0) {
      throw httpError(400, 'Choose at least one product, or apply the offer to all products.');
    }
    ids = [...new Set(input.productIds.map(String))];
    if (ids.length > 200 || ids.some((id) => !/^\d{1,18}$/.test(id))) throw httpError(400, 'Choose products from your own shop.');
    const own = await pool.query('SELECT id FROM products WHERE shop_id = $1 AND deleted_at IS NULL AND id = ANY($2::bigint[])', [shopId, ids]);
    if (own.rows.length !== ids.length) throw httpError(400, 'Choose products from your own shop.');
  }

  const open = await pool.query('SELECT count(*)::int AS n FROM offers WHERE shop_id = $1 AND ends_at > now()', [shopId]);
  if (open.rows[0].n >= MAX_OPEN_OFFERS) throw httpError(409, `You already have ${MAX_OPEN_OFFERS} offers that have not ended. Delete some first.`);

  const { rows } = await pool.query(
    `INSERT INTO offers (shop_id, name, percent, all_products, product_ids, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5::bigint[], $6, $7) RETURNING *`,
    [shopId, name, percent, all, ids, new Date(startsAt).toISOString(), new Date(endsAt).toISOString()]
  );
  return { offer: shapeOffer(rows[0]) };
}

const validId = (id) => /^\d{1,18}$/.test(String(id));

// Pause or resume. An offer that has ended cannot be resumed.
export async function toggleOffer(shopId, offerId) {
  if (!validId(offerId)) throw httpError(404, 'Offer not found.');
  const { rows } = await pool.query(
    `UPDATE offers SET active = NOT active WHERE id = $1 AND shop_id = $2 AND ends_at > now() RETURNING *`,
    [offerId, shopId]
  );
  if (rows[0]) return { offer: shapeOffer(rows[0]) };
  const exists = await pool.query('SELECT 1 FROM offers WHERE id = $1 AND shop_id = $2', [offerId, shopId]);
  throw exists.rows[0] ? httpError(409, 'This offer has ended.') : httpError(404, 'Offer not found.');
}

export async function deleteOffer(shopId, offerId) {
  if (!validId(offerId)) throw httpError(404, 'Offer not found.');
  const { rows } = await pool.query('DELETE FROM offers WHERE id = $1 AND shop_id = $2 RETURNING id', [offerId, shopId]);
  if (!rows[0]) throw httpError(404, 'Offer not found.');
  return { ok: true };
}

// A deleted product leaves every offer that listed it. An offer left with no products is removed.
// Offers for all products are not touched.
export async function removeProductFromOffers(productId, db = pool) {
  // First remove offers whose only product this was (an offer must keep at least one product), then take it out of the rest.
  await db.query('DELETE FROM offers WHERE NOT all_products AND product_ids = ARRAY[$1::bigint]', [productId]);
  await db.query(
    `UPDATE offers SET product_ids = array_remove(product_ids, $1::bigint) WHERE NOT all_products AND $1::bigint = ANY(product_ids)`,
    [productId]
  );
}
