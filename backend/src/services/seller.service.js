// Seller accounts and their shops: sign up, sign in, open a branch, edit a shop.
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { normalizePhone } from '../utils/phone.js';
import { checkShopNameRules } from '../utils/shopName.js';
import { encryptText } from '../utils/crypto.js';
import { deleteImages, imageUrl, isOwnImage } from './cloudinary.service.js';

export const TERMS_VERSION = '2026-10-30';
export const MAX_SHOPS_PER_SELLER = 10;
const BCRYPT_COST = 12;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_RE = /^\d{7,8}$/; // Kenyan national ID numbers have 7 or 8 digits
const KRA_RE = /^[AP]\d{9}[A-Z]$/i; // A for individuals, P for companies
const BAD_PHONE = 'Enter a valid phone number, for example 0712 345 678.';

// The shop columns the API sends back, named the way the frontend names them.
const SHOP_SELECT = `
  SELECT s.id::text AS id, s.name, s.area_id AS "areaId", a.name AS area, a.town,
         s.lat, s.lng, to_char(s.opens, 'HH24:MI') AS opens, to_char(s.closes, 'HH24:MI') AS closes,
         s.fulfillment, s.delivery_fee AS "deliveryFee", s.description, s.verified, s.suspended,
         s.contact_phone AS "contactPhone", s.photo, EXTRACT(YEAR FROM s.created_at)::int AS since
  FROM shops s
  JOIN areas a ON a.id = s.area_id`;

// A hash to compare against when the email is unknown, so a wrong email takes
// as long as a wrong password and nobody can probe for accounts.
let dummyHash;
async function getDummyHash() {
  dummyHash ??= await bcrypt.hash('not-a-real-password', BCRYPT_COST);
  return dummyHash;
}

const publicSeller = (row) => ({
  id: String(row.id),
  email: row.email,
  fullName: row.full_name,
  phone: row.phone,
});

function mapDbError(err) {
  if (err.code === '23505') {
    if (err.constraint === 'uq_sellers_email') {
      return httpError(409, 'An account with this email already exists. Please sign in instead.');
    }
    if (err.constraint === 'uq_shops_name_key') {
      return httpError(409, 'That shop name is already taken.');
    }
  }
  return err;
}

// Runs `work(client)` inside one transaction. Everything is saved, or nothing is.
async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw mapDbError(err);
  } finally {
    client.release();
  }
}

// ---- Checks that need no database (the same messages the frontend shows) ----
export function validateRegistration({ account, details, shop, consent }) {
  const email = String(account.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address.';
  const password = String(account.password || '');
  if (password.length < 8) return 'Your password must have at least 8 characters.';
  if (Buffer.byteLength(password) > 72) return 'Your password is too long. Use at most 72 characters.';

  const fullName = String(details.fullName || '').replace(/\s+/g, ' ').trim();
  if (fullName.length < 5 || !fullName.includes(' ')) return 'Enter your full name as it appears on your ID.';
  if (!ID_RE.test(String(details.idNumber || '').trim())) return 'Enter your national ID number (7 or 8 digits).';
  const kra = String(details.kraPin || '').trim();
  if (kra && !KRA_RE.test(kra)) return 'A KRA PIN looks like A123456789B. Leave it empty if you do not have one.';
  if (!normalizePhone(details.phone || '')) return BAD_PHONE;
  if (details.businessType !== 'individual' && details.businessType !== 'registered') return 'Choose how you sell.';
  if (details.businessType === 'registered') {
    if (String(details.businessName || '').trim().length < 3) return 'Enter your registered business name.';
    if (String(details.businessRegNo || '').trim().length < 3) return 'Enter your business registration number.';
  }

  if (!consent?.terms || !consent?.data || !consent?.accurate) return 'Please tick all three agreements to continue.';

  const nameCheck = checkShopNameRules(shop.name);
  if (!nameCheck.ok) return nameCheck.message;
  if (!String(shop.areaId || '').trim()) return 'Choose the area your shop is in.';
  return '';
}

// ---- Reading ----
// The shop photo is stored as a photo id; the API sends { id, url, thumb } (or null), like product photos.
const withPhoto = (row) => (row ? { ...row, photo: row.photo ? { id: row.photo, url: imageUrl(row.photo, 800), thumb: imageUrl(row.photo, 200) } : null } : row);

export async function getOwnedShop(sellerId, shopId, db = pool) {
  const { rows } = await db.query(`${SHOP_SELECT} WHERE s.id = $1 AND s.seller_id = $2 AND s.closed_at IS NULL`, [
    shopId,
    sellerId,
  ]);
  return withPhoto(rows[0]) || null;
}

// The shops the seller can work on. A closed shop is not one of them.
export async function listOwnShops(sellerId) {
  const { rows } = await pool.query(`${SHOP_SELECT} WHERE s.seller_id = $1 AND s.closed_at IS NULL ORDER BY s.id`, [
    sellerId,
  ]);
  return rows.map(withPhoto);
}

export async function getSeller(sellerId) {
  const { rows } = await pool.query('SELECT id, email, full_name, phone FROM sellers WHERE id = $1', [sellerId]);
  return rows[0] ? publicSeller(rows[0]) : null;
}

export async function listAreas() {
  const { rows } = await pool.query('SELECT id, name, town, lat, lng FROM areas ORDER BY town, name');
  return rows;
}

// For the shop-name field: is this name allowed and free?
export async function checkShopName(rawName, ignoreShopId) {
  const rules = checkShopNameRules(rawName);
  if (!rules.ok) return { ok: false, message: rules.message };
  const ignore = /^\d+$/.test(String(ignoreShopId ?? '')) ? String(ignoreShopId) : null;
  const { rows } = await pool.query(
    'SELECT 1 FROM shops WHERE name_key = $1 AND ($2::bigint IS NULL OR id <> $2::bigint) LIMIT 1',
    [rules.key, ignore]
  );
  if (rows.length) return { ok: false, taken: true, message: 'That shop name is already taken.' };
  return { ok: true, name: rules.name };
}

// ---- Sign up: the account and its first shop, saved together ----
export async function registerSeller(input) {
  const problem = validateRegistration(input);
  if (problem) throw httpError(400, problem);

  const { account, details, shop } = input;
  const nameRules = checkShopNameRules(shop.name);
  const passwordHash = await bcrypt.hash(String(account.password), BCRYPT_COST);
  const phone = normalizePhone(details.phone);
  const registered = details.businessType === 'registered';

  const { sellerRow, shopId } = await inTransaction(async (client) => {
    const area = await client.query('SELECT id, lat, lng FROM areas WHERE id = $1', [String(shop.areaId).trim()]);
    if (!area.rows[0]) throw httpError(400, 'Choose the area your shop is in.');

    const seller = await client.query(
      `INSERT INTO sellers
         (email, password_hash, full_name, id_number, kra_pin, phone,
          business_type, business_name, business_reg_no, terms_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, email, full_name, phone`,
      [
        String(account.email).trim().toLowerCase(),
        passwordHash,
        String(details.fullName).replace(/\s+/g, ' ').trim(),
        encryptText(String(details.idNumber).trim()), // locked in the database (see utils/crypto.js)
        encryptText(String(details.kraPin || '').trim().toUpperCase() || null),
        phone,
        details.businessType,
        registered ? String(details.businessName).trim() : null,
        registered ? String(details.businessRegNo).trim() : null,
        TERMS_VERSION,
      ]
    );

    const created = await client.query(
      `INSERT INTO shops (seller_id, name, name_key, area_id, lat, lng, description, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        seller.rows[0].id,
        nameRules.name,
        nameRules.key,
        area.rows[0].id,
        area.rows[0].lat,
        area.rows[0].lng,
        String(shop.description || '').trim().slice(0, 300),
        phone,
      ]
    );
    return { sellerRow: seller.rows[0], shopId: created.rows[0].id };
  });

  return {
    seller: publicSeller(sellerRow),
    shop: await getOwnedShop(sellerRow.id, shopId),
  };
}

// ---- Sign in ----
export async function loginSeller(emailRaw, password) {
  const email = String(emailRaw || '').trim().toLowerCase();
  const { rows } = await pool.query(
    'SELECT id, email, password_hash, full_name, phone FROM sellers WHERE email = $1',
    [email]
  );
  const seller = rows[0];
  const valid = await bcrypt.compare(String(password || ''), seller ? seller.password_hash : await getDummyHash());
  // The same message for a wrong email and a wrong password.
  if (!seller || !valid) throw httpError(401, 'The email or password is not correct.');

  const shops = await listOwnShops(seller.id);
  if (!shops.length) {
    const any = await pool.query('SELECT 1 FROM shops WHERE seller_id = $1 LIMIT 1', [seller.id]);
    throw httpError(
      403,
      any.rows.length
        ? 'Your shop is closed. Contact support if you want to reopen it.'
        : 'This account has no shop yet. Please contact support.'
    );
  }
  return { seller: publicSeller(seller), shops };
}

// ---- Open a branch ----
export async function createShop(sellerId, { name, areaId, description }) {
  const nameRules = checkShopNameRules(name);
  if (!nameRules.ok) throw httpError(400, nameRules.message);

  const shopId = await inTransaction(async (client) => {
    // Locks the seller's row so two requests cannot both pass the limit below.
    const seller = await client.query('SELECT phone FROM sellers WHERE id = $1 FOR UPDATE', [sellerId]);
    if (!seller.rows[0]) throw httpError(401, 'Please log in.');

    const count = await client.query(
      'SELECT COUNT(*)::int AS n FROM shops WHERE seller_id = $1 AND closed_at IS NULL',
      [sellerId]
    );
    if (count.rows[0].n >= MAX_SHOPS_PER_SELLER) {
      throw httpError(400, `You can run up to ${MAX_SHOPS_PER_SELLER} shops. Contact support if you need more.`);
    }

    const area = await client.query('SELECT id, lat, lng FROM areas WHERE id = $1', [String(areaId || '').trim()]);
    if (!area.rows[0]) throw httpError(400, 'Choose the area your shop is in.');

    const created = await client.query(
      `INSERT INTO shops (seller_id, name, name_key, area_id, lat, lng, description, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        sellerId,
        nameRules.name,
        nameRules.key,
        area.rows[0].id,
        area.rows[0].lat,
        area.rows[0].lng,
        String(description || '').trim().slice(0, 300),
        seller.rows[0].phone,
      ]
    );
    return created.rows[0].id;
  });

  return getOwnedShop(sellerId, shopId);
}

// ---- Edit a shop. Only the fields that are sent change. ----
export async function updateShop(sellerId, shopId, changes) {
  let replacedPhoto = null;
  await inTransaction(async (client) => {
    const found = await client.query(
      `SELECT name, name_key, area_id, lat, lng, description,
              to_char(opens, 'HH24:MI') AS opens, to_char(closes, 'HH24:MI') AS closes,
              fulfillment, delivery_fee, contact_phone, photo
       FROM shops
       WHERE id = $1 AND seller_id = $2 AND closed_at IS NULL
       FOR UPDATE`,
      [shopId, sellerId]
    );
    const cur = found.rows[0];
    if (!cur) throw httpError(404, 'Shop not found.');

    const next = {
      name: cur.name,
      key: cur.name_key,
      areaId: cur.area_id,
      lat: cur.lat,
      lng: cur.lng,
      description: cur.description,
      opens: cur.opens,
      closes: cur.closes,
      fulfillment: cur.fulfillment,
      deliveryFee: cur.delivery_fee,
      phone: cur.contact_phone,
      photo: cur.photo,
    };

    if (changes.name !== undefined) {
      const rules = checkShopNameRules(changes.name);
      if (!rules.ok) throw httpError(400, rules.message);
      next.name = rules.name;
      next.key = rules.key;
    }
    if (changes.description !== undefined) next.description = String(changes.description).trim().slice(0, 300);
    if (changes.areaId !== undefined) {
      const area = await client.query('SELECT id, lat, lng FROM areas WHERE id = $1', [String(changes.areaId).trim()]);
      if (!area.rows[0]) throw httpError(400, 'Choose the area your shop is in.');
      next.areaId = area.rows[0].id;
      next.lat = area.rows[0].lat;
      next.lng = area.rows[0].lng;
    }
    if (changes.opens !== undefined) next.opens = changes.opens;
    if (changes.closes !== undefined) next.closes = changes.closes;
    if (!(next.opens < next.closes)) throw httpError(400, 'The closing time must be after the opening time.');
    if (changes.fulfillment !== undefined) {
      const modes = [...new Set(changes.fulfillment)];
      if (!modes.length) throw httpError(400, 'Choose delivery, pickup or both.');
      next.fulfillment = modes;
    }
    if (changes.deliveryFee !== undefined) next.deliveryFee = changes.deliveryFee;
    if (changes.photo !== undefined) {
      // A photo id from this shop's own folder (made by the upload signature route), or null to remove the photo.
      if (changes.photo !== null && !isOwnImage(shopId, String(changes.photo))) throw httpError(400, 'The photo is not valid. Please upload it again.');
      next.photo = changes.photo === null ? null : String(changes.photo);
    }
    if (changes.phone !== undefined) {
      const raw = String(changes.phone).trim();
      if (raw === '') next.phone = null;
      else {
        next.phone = normalizePhone(raw);
        if (!next.phone) throw httpError(400, 'Enter a valid contact number, for example 0712 345 678.');
      }
    }

    await client.query(
      `UPDATE shops
       SET name = $2, name_key = $3, area_id = $4, lat = $5, lng = $6, description = $7,
           opens = $8, closes = $9, fulfillment = $10, delivery_fee = $11, contact_phone = $12, photo = $13
       WHERE id = $1`,
      [
        shopId,
        next.name,
        next.key,
        next.areaId,
        next.lat,
        next.lng,
        next.description,
        next.opens,
        next.closes,
        next.fulfillment,
        next.deliveryFee,
        next.phone,
        next.photo,
      ]
    );
    if (cur.photo && cur.photo !== next.photo) replacedPhoto = cur.photo;
  });
  if (replacedPhoto) await deleteImages([replacedPhoto]); // the old photo is no longer used

  return getOwnedShop(sellerId, shopId);
}
