// What buyers see: home sections, search, a product, a shop. Nobody needs to be logged in.
// A product is shown only when it is switched on, not deleted, and its shop is open and not suspended.
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { toProduct } from './product.service.js';

// ---- Pieces of SQL used by every query below ----
const PRODUCT_COLUMNS = `
  p.id, p.shop_id, p.name, p.price, p.stock, p.size_type, p.sizes, p.category_id, c.emoji,
  p.description, p.images, p.active, p.created_at,
  0::int AS sold,          -- real numbers arrive with orders (Batch 5)
  0::float8 AS rating,     -- real numbers arrive with ratings (Batch 6)
  0::int AS rating_count`;

const SHOP_COLUMNS = `
  s.name AS sh_name, s.area_id AS sh_area_id, a.name AS sh_area, a.town AS sh_town,
  s.lat AS sh_lat, s.lng AS sh_lng,
  to_char(s.opens, 'HH24:MI') AS sh_opens, to_char(s.closes, 'HH24:MI') AS sh_closes,
  s.verified AS sh_verified, EXTRACT(YEAR FROM s.created_at)::int AS sh_since,
  s.description AS sh_description, s.fulfillment AS sh_fulfillment, s.delivery_fee AS sh_delivery_fee,
  -- Open or closed is worked out in Kenya time (the server may run in another time zone).
  ((now() AT TIME ZONE 'Africa/Nairobi')::time >= s.opens
    AND (now() AT TIME ZONE 'Africa/Nairobi')::time < s.closes) AS sh_open_now`;

const PRODUCT_FROM = `
  FROM products p
  JOIN shops s ON s.id = p.shop_id
  JOIN areas a ON a.id = s.area_id
  JOIN categories c ON c.id = p.category_id`;

const LIVE_PRODUCT = 'p.deleted_at IS NULL AND p.active AND s.closed_at IS NULL AND NOT s.suspended';

// Collects the values for a query and builds the distance part (Haversine formula, in kilometres).
// `distance` and `nearWhere` add their values ONLY when a query actually reads them. PostgreSQL
// refuses a query that is sent with a value it never uses ("could not determine data type of parameter").
function startQuery(near) {
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (!near) return { params, add, distance: 'NULL::float8', nearWhere: '' };

  let distance;
  let nearWhere;
  return {
    params,
    add,
    get distance() {
      if (distance === undefined) {
        const lat = `${add(near.lat)}::float8`;
        const lng = `${add(near.lng)}::float8`;
        distance = `(2 * 6371 * asin(sqrt(LEAST(1,
      power(sin(radians(s.lat - ${lat}) / 2), 2)
      + cos(radians(${lat})) * cos(radians(s.lat)) * power(sin(radians(s.lng - ${lng}) / 2), 2)))))`;
      }
      return distance;
    },
    get nearWhere() {
      if (nearWhere === undefined) {
        const dist = this.distance;
        nearWhere = `AND ${dist} <= ${add(near.radiusKm)}::float8`;
      }
      return nearWhere;
    },
  };
}

// A simple city estimate: 15 minutes to prepare, plus travel time. Same as the frontend.
export const etaMinutes = (km) => Math.max(15, Math.round((15 + km * 4) / 5) * 5);

function toShop(row) {
  const shop = {
    id: String(row.shop_id),
    name: row.sh_name,
    areaId: row.sh_area_id,
    area: row.sh_area,
    town: row.sh_town,
    lat: row.sh_lat,
    lng: row.sh_lng,
    opens: row.sh_opens,
    closes: row.sh_closes,
    verified: row.sh_verified,
    rating: 0, // real numbers arrive with ratings (Batch 6)
    reviews: 0,
    since: row.sh_since,
    description: row.sh_description,
    fulfillment: row.sh_fulfillment,
    deliveryFee: row.sh_delivery_fee, // null until the seller sets it: then buyers cannot choose delivery
    openNow: row.sh_open_now,
  };
  if (row.distance_km !== null && row.distance_km !== undefined) {
    shop.distanceKm = Math.round(row.distance_km * 1000) / 1000;
    shop.etaMinutes = etaMinutes(row.distance_km);
  }
  return shop;
}

const toPublicProduct = (row) => ({
  ...toProduct(row),
  sold: row.sold,
  rating: row.rating,
  ratingCount: row.rating_count,
  shop: toShop(row),
});

const validId = (id) => /^\d{1,18}$/.test(String(id));

// A text typed into search, with the characters that mean something in a LIKE search made harmless.
const likePattern = (text) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

// ---- Products ----
export async function searchProducts({ q = '', category = '', sort = 'relevance', near = null, limit = 60, offset = 0 } = {}) {
  const ctx = startQuery(near);
  const where = [LIVE_PRODUCT];
  if (near) where.push(ctx.nearWhere.replace(/^AND /, ''));
  if (category) where.push(`p.category_id = ${ctx.add(category)}`);
  const term = q.trim().slice(0, 100);
  if (term) {
    const like = ctx.add(likePattern(term));
    where.push(
      `(p.name ILIKE ${like} ESCAPE '\\' OR p.description ILIKE ${like} ESCAPE '\\' OR s.name ILIKE ${like} ESCAPE '\\')`
    );
  }

  const byDistance = `${ctx.distance} ASC NULLS LAST, p.created_at DESC, p.id DESC`;
  const orders = {
    'price-asc': 'p.price ASC, p.id ASC',
    'price-desc': 'p.price DESC, p.id ASC',
    rating: `rating DESC, ${byDistance}`,
    relevance: byDistance,
  };
  const order = orders[sort];
  if (!order) throw httpError(400, 'Choose a valid way to sort.');

  const { rows } = await pool.query(
    `SELECT ${PRODUCT_COLUMNS}, ${SHOP_COLUMNS}, ${ctx.distance} AS distance_km,
            COUNT(*) OVER ()::int AS total_count
     ${PRODUCT_FROM}
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}
     LIMIT ${ctx.add(limit)}::int OFFSET ${ctx.add(offset)}::int`,
    ctx.params
  );
  return { products: rows.map(toPublicProduct), total: rows[0]?.total_count ?? 0 };
}

export async function getProduct(id, near = null) {
  if (!validId(id)) return null;
  const ctx = startQuery(near);
  const { rows } = await pool.query(
    `SELECT ${PRODUCT_COLUMNS}, ${SHOP_COLUMNS}, ${ctx.distance} AS distance_km
     ${PRODUCT_FROM}
     WHERE p.id = ${ctx.add(id)} AND ${LIVE_PRODUCT}`,
    ctx.params
  );
  return rows[0] ? toPublicProduct(rows[0]) : null;
}

// More from the same shop, and similar products from other shops. Only shops near the buyer.
export async function getRelated(id, near = null) {
  const product = await getProduct(id, near);
  if (!product) return null;

  const pick = async (condition, value) => {
    const ctx = startQuery(near);
    const { rows } = await pool.query(
      `SELECT ${PRODUCT_COLUMNS}, ${SHOP_COLUMNS}, ${ctx.distance} AS distance_km
       ${PRODUCT_FROM}
       WHERE ${LIVE_PRODUCT} ${ctx.nearWhere} AND p.id <> ${ctx.add(id)} AND ${condition(ctx.add(value))}
       ORDER BY ${ctx.distance} ASC NULLS LAST, p.created_at DESC, p.id DESC
       LIMIT 4`,
      ctx.params
    );
    return rows.map(toPublicProduct);
  };

  const [fromShop, similar] = await Promise.all([
    pick((v) => `p.shop_id = ${v}`, product.shopId),
    pick((v) => `p.category_id = ${v} AND p.shop_id <> ${product.shopId}`, product.category),
  ]);
  return { fromShop, similar };
}

// ---- Shops ----
export async function getShop(id, near = null) {
  if (!validId(id)) return null;
  const ctx = startQuery(near);
  const { rows } = await pool.query(
    `SELECT s.id AS shop_id, ${SHOP_COLUMNS}, ${ctx.distance} AS distance_km
     FROM shops s
     JOIN areas a ON a.id = s.area_id
     WHERE s.id = ${ctx.add(id)} AND s.closed_at IS NULL`,
    ctx.params
  );
  if (!rows[0]) return null; // a closed shop is gone for buyers, as if it never existed

  const productCtx = startQuery(near);
  const products = await pool.query(
    `SELECT ${PRODUCT_COLUMNS}, ${SHOP_COLUMNS}, ${productCtx.distance} AS distance_km
     ${PRODUCT_FROM}
     WHERE ${LIVE_PRODUCT} AND p.shop_id = ${productCtx.add(id)}
     ORDER BY p.created_at DESC, p.id DESC`,
    productCtx.params
  );
  return { ...toShop(rows[0]), products: products.rows.map(toPublicProduct) };
}

// ---- Home page ----
export async function getHome(near = null) {
  const productCtx = startQuery(near);
  const shopCtx = startQuery(near);

  const [count, fresh, shops] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS n ${PRODUCT_FROM} WHERE ${LIVE_PRODUCT} ${productCtx.nearWhere}`,
      productCtx.params
    ),
    (() => {
      const ctx = startQuery(near);
      return pool.query(
        `SELECT ${PRODUCT_COLUMNS}, ${SHOP_COLUMNS}, ${ctx.distance} AS distance_km
         ${PRODUCT_FROM}
         WHERE ${LIVE_PRODUCT} ${ctx.nearWhere}
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT 8`,
        ctx.params
      );
    })(),
    pool.query(
      `SELECT s.id AS shop_id, ${SHOP_COLUMNS}, ${shopCtx.distance} AS distance_km
       FROM shops s
       JOIN areas a ON a.id = s.area_id
       WHERE s.closed_at IS NULL AND NOT s.suspended ${shopCtx.nearWhere}
         AND EXISTS (SELECT 1 FROM products p WHERE p.shop_id = s.id AND p.deleted_at IS NULL AND p.active)
       ORDER BY ${shopCtx.distance} ASC NULLS LAST, s.id ASC
       LIMIT 50`,
      shopCtx.params
    ),
  ]);

  return {
    total: count.rows[0].n,
    offers: [], // seller offers are not built yet
    newArrivals: fresh.rows.map(toPublicProduct),
    bestSellers: [], // filled in when orders exist (Batch 5)
    shops: shops.rows.map(toShop),
  };
}

// ---- Favourites (a logged-in buyer's saved products) ----
export async function listFavourites(buyerId, near = null) {
  const ctx = startQuery(near);
  const { rows } = await pool.query(
    `SELECT ${PRODUCT_COLUMNS}, ${SHOP_COLUMNS}, ${ctx.distance} AS distance_km
     ${PRODUCT_FROM}
     JOIN favourites f ON f.product_id = p.id
     WHERE f.buyer_id = ${ctx.add(buyerId)} AND ${LIVE_PRODUCT}
     ORDER BY f.created_at DESC, p.id DESC
     LIMIT 200`,
    ctx.params
  );
  return rows.map(toPublicProduct);
}

// Saving the same product twice is fine: it stays saved once.
export async function addFavourite(buyerId, productId) {
  if (!validId(productId)) throw httpError(404, 'This product is not available.');
  const found = await pool.query(
    `SELECT p.id
     FROM products p
     JOIN shops s ON s.id = p.shop_id
     WHERE p.id = $1 AND ${LIVE_PRODUCT}`,
    [productId]
  );
  if (!found.rows[0]) throw httpError(404, 'This product is not available.');
  await pool.query(
    'INSERT INTO favourites (buyer_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [buyerId, productId]
  );
}

export async function removeFavourite(buyerId, productId) {
  if (!validId(productId)) return;
  await pool.query('DELETE FROM favourites WHERE buyer_id = $1 AND product_id = $2', [buyerId, productId]);
}
