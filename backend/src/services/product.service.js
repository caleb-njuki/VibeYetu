// A seller's products: list, add, edit, hide and delete.
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { cleanSizes } from '../utils/sizes.js';
import { deleteImages, imageUrl, isOwnImage } from './cloudinary.service.js';

const MAX_PHOTOS = 4;

const PRODUCT_SELECT = `
  SELECT p.id, p.shop_id, p.name, p.price, p.stock, p.size_type, p.sizes, p.category_id,
         c.emoji, p.description, p.images, p.active, p.created_at
  FROM products p
  JOIN categories c ON c.id = p.category_id`;

// The colour of a product tile that has no photo. Same formula as the frontend.
const hueFor = (name) => [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

// A database row, in the shape the frontend uses.
export function toProduct(row) {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    name: row.name,
    price: row.price,
    stock: row.stock,
    sizeType: row.size_type,
    sizes: row.sizes,
    category: row.category_id,
    emoji: row.emoji,
    hue: hueFor(row.name),
    description: row.description,
    images: row.images.map((id) => ({ id, url: imageUrl(id, 800), thumb: imageUrl(id, 200) })),
    active: row.active,
    createdAt: row.created_at,
  };
}

// Is this a whole number in range? (zod already checked the type; this keeps the rules in one place.)
const isWhole = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

function checkName(name) {
  const clean = String(name).replace(/\s+/g, ' ').trim();
  if (clean.length < 3) throw httpError(400, 'Enter a product name of at least 3 characters.');
  if (clean.length > 100) throw httpError(400, 'A product name can have at most 100 characters.');
  return clean;
}

function checkPrice(price) {
  if (!isWhole(price, 1, 10000000)) {
    throw httpError(400, 'Enter a price in whole shillings from 1 to 10,000,000, like 1500.');
  }
  return price;
}

function checkDescription(text) {
  const clean = String(text).trim();
  return (clean || 'No description yet.').slice(0, 2000);
}

function checkImages(shopId, images) {
  if (images.length > MAX_PHOTOS) throw httpError(400, `A product can have at most ${MAX_PHOTOS} photos.`);
  if (new Set(images).size !== images.length) throw httpError(400, 'The same photo was added twice.');
  if (!images.every((id) => isOwnImage(shopId, id))) throw httpError(400, 'One of the photos is not valid. Please upload it again.');
  return images;
}

async function checkCategory(db, id) {
  const { rows } = await db.query('SELECT id FROM categories WHERE id = $1', [String(id)]);
  if (!rows[0]) throw httpError(400, 'Choose a category.');
  return rows[0].id;
}

// Works out the size type, the sizes and the stock together, so they always agree.
function resolveStock({ sizeType, sizes, stock }) {
  if (sizeType === 'none') {
    if (!isWhole(stock, 0, 1000000)) throw httpError(400, 'Enter the stock as a whole number, 0 or more.');
    return { sizeType, sizes: null, stock };
  }
  const cleaned = cleanSizes(sizeType, sizes);
  if (!cleaned.ok) throw httpError(400, cleaned.message);
  return { sizeType, sizes: cleaned.sizes, stock: cleaned.total };
}

// ---- Reading ----
export async function listShopProducts(shopId) {
  const { rows } = await pool.query(
    `${PRODUCT_SELECT} WHERE p.shop_id = $1 AND p.deleted_at IS NULL ORDER BY p.created_at DESC, p.id DESC`,
    [shopId]
  );
  return rows.map(toProduct);
}

export async function listCategories() {
  const { rows } = await pool.query('SELECT id, name, emoji FROM categories ORDER BY sort_order');
  return rows;
}

async function getShopProduct(db, shopId, productId) {
  const { rows } = await db.query(`${PRODUCT_SELECT} WHERE p.id = $1 AND p.shop_id = $2 AND p.deleted_at IS NULL`, [
    productId,
    shopId,
  ]);
  return rows[0] ? toProduct(rows[0]) : null;
}

// ---- Add ----
export async function createProduct(shopId, input) {
  const name = checkName(input.name);
  const price = checkPrice(input.price);
  const images = checkImages(shopId, input.images ?? []);
  const stockInfo = resolveStock({
    sizeType: input.sizeType ?? 'none',
    sizes: input.sizes,
    stock: input.stock,
  });
  const categoryId = await checkCategory(pool, input.category);

  const { rows } = await pool.query(
    `INSERT INTO products (shop_id, name, price, stock, size_type, sizes, category_id, description, images, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      shopId,
      name,
      price,
      stockInfo.stock,
      stockInfo.sizeType,
      stockInfo.sizes === null ? null : JSON.stringify(stockInfo.sizes),
      categoryId,
      checkDescription(input.description ?? ''),
      images,
      input.active ?? true,
    ]
  );
  return getShopProduct(pool, shopId, rows[0].id);
}

// ---- Edit. Only the fields that are sent change. ----
export async function updateProduct(shopId, productId, changes) {
  const client = await pool.connect();
  let removedImages = [];
  try {
    await client.query('BEGIN');
    // Locks the product while it is being changed, so two edits (or an order) cannot mix.
    const found = await client.query(
      `SELECT name, price, stock, size_type, sizes, category_id, description, images, active
       FROM products WHERE id = $1 AND shop_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [productId, shopId]
    );
    const cur = found.rows[0];
    if (!cur) throw httpError(404, 'This product no longer exists.');

    const next = {
      name: changes.name !== undefined ? checkName(changes.name) : cur.name,
      price: changes.price !== undefined ? checkPrice(changes.price) : cur.price,
      description: changes.description !== undefined ? checkDescription(changes.description) : cur.description,
      active: changes.active ?? cur.active,
      images: changes.images !== undefined ? checkImages(shopId, changes.images) : cur.images,
      categoryId: changes.category !== undefined ? await checkCategory(client, changes.category) : cur.category_id,
    };

    // Sizes and stock are decided together.
    const sizeType = changes.sizeType ?? cur.size_type;
    const sizesGiven = changes.sizes !== undefined && changes.sizes !== null;
    let stockInfo;
    if (sizeType === 'none') {
      const switched = cur.size_type !== 'none';
      if (switched && changes.stock === undefined) throw httpError(400, 'Enter the stock as a whole number, 0 or more.');
      stockInfo = resolveStock({ sizeType, sizes: null, stock: changes.stock ?? cur.stock });
    } else if (sizesGiven) {
      stockInfo = resolveStock({ sizeType, sizes: changes.sizes, stock: 0 });
    } else if (cur.size_type === sizeType && changes.stock === undefined) {
      stockInfo = { sizeType, sizes: cur.sizes, stock: cur.stock };
    } else {
      throw httpError(400, 'Enter the stock for each size.');
    }

    await client.query(
      `UPDATE products
       SET name = $2, price = $3, stock = $4, size_type = $5, sizes = $6, category_id = $7,
           description = $8, images = $9, active = $10, updated_at = now()
       WHERE id = $1`,
      [
        productId,
        next.name,
        next.price,
        stockInfo.stock,
        stockInfo.sizeType,
        stockInfo.sizes === null ? null : JSON.stringify(stockInfo.sizes),
        next.categoryId,
        next.description,
        next.images,
        next.active,
      ]
    );
    removedImages = cur.images.filter((id) => !next.images.includes(id));
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  deleteImages(removedImages); // after saving; a failure here never changes the result
  return getShopProduct(pool, shopId, productId);
}

// ---- Delete (the product is only marked, so old orders keep working) ----
export async function deleteProduct(shopId, productId) {
  const { rows } = await pool.query(
    `UPDATE products SET deleted_at = now(), active = false, updated_at = now()
     WHERE id = $1 AND shop_id = $2 AND deleted_at IS NULL
     RETURNING images`,
    [productId, shopId]
  );
  if (!rows[0]) throw httpError(404, 'This product no longer exists.');
  deleteImages(rows[0].images);
}
