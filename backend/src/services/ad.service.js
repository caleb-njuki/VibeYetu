// Ads: sellers buy them, buyers see and report them, staff review the ones with problems.
import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { withTransaction } from '../utils/transaction.js';
import { formatKES } from '../utils/orderRules.js';
import {
  DAY_SECONDS, DURATIONS, MAX_LIVE_ADS, MAX_OPEN_ADS_PER_SHOP, MIN_CONTRAST, PRICE_PER_DAY, REPORT_LIMIT, REPORT_REASONS,
  contrastOnWhite, isHexColor, textIssue,
} from '../utils/adRules.js';
import { imageUrl, isOwnImage } from './cloudinary.service.js';
import { chargeAdvertiser, refundAdvertiser } from './payment.service.js';
import { addShopNotice } from './notification.service.js';

const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newId = () => 'AD-' + Array.from({ length: 6 }, () => ID_CHARS[crypto.randomInt(ID_CHARS.length)]).join('');
const ms = (d) => (d ? new Date(d).getTime() : null);
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// live, scheduled, ended, attention, stopped or refunded, by the database clock.
const STATE = `CASE WHEN a.status IN ('stopped', 'refunded', 'attention') THEN a.status
                    WHEN now() < a.starts_at THEN 'scheduled' WHEN now() > a.ends_at THEN 'ended' ELSE 'live' END`;

const shapeAd = (a) => ({
  id: a.id,
  shopId: String(a.shop_id),
  headline: a.headline,
  subtext: a.subtext,
  image: a.image ? imageUrl(a.image, 1200) : '',
  imageId: a.image,
  darken: a.darken,
  headlineColor: a.headline_color,
  subtextColor: a.subtext_color,
  target: a.target,
  productId: a.product_id ? String(a.product_id) : '',
  days: a.days,
  total: a.total,
  state: a.state,
  issue: a.issue,
  startsAt: ms(a.starts_at),
  endsAt: ms(a.ends_at),
  createdAt: ms(a.created_at),
});

// ---------- Seller ----------
export async function listShopAds(shopId) {
  const { rows } = await pool.query(`SELECT a.*, ${STATE} AS state FROM ads a WHERE a.shop_id = $1 ORDER BY a.created_at DESC, a.id LIMIT 100`, [shopId]);
  return { ads: rows.map(shapeAd) };
}

export async function createAd(shopId, input) {
  const headline = clean(input.headline);
  const subtext = clean(input.subtext);
  if (headline.length < 5 || headline.length > 40) throw httpError(400, 'The headline must have 5 to 40 characters.');
  if (subtext.length > 90) throw httpError(400, 'The extra text can have at most 90 characters.');
  if (!DURATIONS.includes(input.days)) throw httpError(400, 'Choose how many days the ad runs.');
  if (!isHexColor(input.headlineColor) || !isHexColor(input.subtextColor)) throw httpError(400, 'The text colour is not valid.');
  const image = input.image ? String(input.image) : '';
  if (image && !isOwnImage(shopId, image)) throw httpError(400, 'The photo is not valid. Please upload it again.');
  if (!image) {
    // On a plain white ad, a very light text colour cannot be read.
    if (contrastOnWhite(input.headlineColor) < MIN_CONTRAST) throw httpError(400, 'Your headline colour is too light to read on a white ad. Pick a darker colour or add a photo.');
    if (subtext && contrastOnWhite(input.subtextColor) < MIN_CONTRAST) throw httpError(400, 'Your extra text colour is too light to read on a white ad. Pick a darker colour or add a photo.');
  }
  const total = input.days * PRICE_PER_DAY; // the price comes from here, never from the app

  const id = await withTransaction(async (c) => {
    const shop = (await c.query('SELECT id, suspended, closed_at FROM shops WHERE id = $1 FOR UPDATE', [shopId])).rows[0];
    if (!shop || shop.closed_at) throw httpError(404, 'Shop not found.');
    if (shop.suspended) throw httpError(409, 'Your shop is suspended, so you cannot buy ads right now.');

    let productId = null;
    let productLive = true;
    if (input.target === 'product') {
      if (!/^\d{1,18}$/.test(String(input.productId ?? ''))) throw httpError(400, 'Choose the product to promote.');
      const p = (await c.query('SELECT id, active, deleted_at FROM products WHERE id = $1 AND shop_id = $2', [input.productId, shopId])).rows[0];
      if (!p) throw httpError(400, 'Choose the product to promote.');
      productId = p.id;
      productLive = p.active && !p.deleted_at;
    }
    const open = (await c.query(
      `SELECT count(*)::int AS n FROM ads WHERE shop_id = $1 AND (status = 'attention' OR (status = 'approved' AND ends_at > now()))`, [shopId]
    )).rows[0].n;
    if (open >= MAX_OPEN_ADS_PER_SHOP) throw httpError(409, `You already have ${MAX_OPEN_ADS_PER_SHOP} ads waiting or running. Stop one or wait for one to end.`);

    // The automatic checks. A problem does not refuse the ad: it is paid, then waits for staff.
    const liveProducts = (await c.query('SELECT count(*)::int AS n FROM products WHERE shop_id = $1 AND active AND deleted_at IS NULL', [shopId])).rows[0].n;
    let issue = textIssue(headline, subtext);
    if (!issue && liveProducts === 0) issue = 'The shop has no products to show yet.';
    if (!issue && !productLive) issue = 'The product chosen is not available.';

    const charge = await chargeAdvertiser({ amount: total, shopId });
    if (!charge.ok) throw httpError(402, 'The payment did not go through. You have not been charged. Please try again.');

    const adId = newId();
    await c.query(
      `INSERT INTO ads (id, shop_id, headline, subtext, image, darken, headline_color, subtext_color, target, product_id, days, total,
                        status, issue, starts_at, ends_at, payment_provider)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
               CASE WHEN $13 = 'approved' THEN now() END,
               CASE WHEN $13 = 'approved' THEN now() + make_interval(secs => $15) END, $16)`,
      [adId, shopId, headline, subtext, image, Boolean(image) && input.darken !== false, input.headlineColor, input.subtextColor,
       input.target, productId, input.days, total, issue ? 'attention' : 'approved', issue ?? '', input.days * DAY_SECONDS, charge.provider]
    );
    return adId;
  });

  const { rows } = await pool.query(`SELECT a.*, ${STATE} AS state FROM ads a WHERE a.id = $1`, [id]);
  const ad = shapeAd(rows[0]);
  return {
    ad,
    message: ad.state === 'attention'
      ? `Your payment of ${formatKES(total)} was received, but your ad could not go live yet: ${ad.issue} Our team will sort it out. If it cannot be fixed, you are refunded.`
      : `Payment of ${formatKES(total)} received. Your ad is live now for ${ad.days} ${ad.days === 1 ? 'day' : 'days'}.`,
  };
}

// An ad that is waiting, scheduled or live can be stopped. There is no refund for a stopped ad.
export const stopShopAd = (shopId, adId) => stopAd(adId, { shopId });

async function stopAd(adId, { shopId = null, adminId = null }) {
  return withTransaction(async (c) => {
    const ad = await lockAd(c, adId, shopId);
    if (!['attention', 'scheduled', 'live'].includes(ad.state)) throw httpError(409, 'This ad is not running.');
    await c.query(`UPDATE ads SET status = 'stopped' WHERE id = $1`, [adId]);
    if (adminId) {
      await audit(c, adminId, 'stop_ad', adId);
      await addShopNotice(ad.shop_id, `Support took down your ad "${ad.headline}".`, '/my-shop/ads', c);
    }
    return { ok: true };
  });
}

async function lockAd(c, adId, shopId = null) {
  if (!/^AD-[A-Z0-9]{6}$/.test(String(adId))) throw httpError(404, 'Ad not found.');
  const { rows } = await c.query(
    `SELECT a.*, ${STATE} AS state FROM ads a WHERE a.id = $1 ${shopId ? 'AND a.shop_id = $2' : ''} FOR UPDATE OF a`,
    shopId ? [adId, shopId] : [adId]
  );
  if (!rows[0]) throw httpError(404, 'Ad not found.');
  return rows[0];
}

const audit = (c, adminId, action, adId, note = '') =>
  c.query(`INSERT INTO admin_actions (admin_id, action, target_type, target_id, note) VALUES ($1, $2, 'ad', $3, $4)`, [adminId, action, adId, note]);

// Stops ads that point at a product that was deleted. Called when a product is deleted.
export const stopAdsForProduct = (productId, db = pool) =>
  db.query(`UPDATE ads SET status = 'stopped' WHERE product_id = $1 AND status IN ('approved', 'attention')`, [productId]);

// ---------- Buyers ----------
// Live ads from shops near the buyer, in random order so every seller gets a fair turn.
export async function listLiveAds(near) {
  const params = [];
  let nearWhere = '';
  if (near) {
    params.push(near.lat, near.lng, near.radiusKm);
    nearWhere = `AND (2 * 6371 * asin(sqrt(LEAST(1, power(sin(radians(s.lat - $1::float8) / 2), 2)
      + cos(radians($1::float8)) * cos(radians(s.lat)) * power(sin(radians(s.lng - $2::float8) / 2), 2))))) <= $3::float8`;
  }
  const { rows } = await pool.query(
    `SELECT a.*, s.name AS shop_name FROM ads a
     JOIN shops s ON s.id = a.shop_id
     LEFT JOIN products p ON p.id = a.product_id
     WHERE a.status = 'approved' AND now() >= a.starts_at AND now() <= a.ends_at
       AND NOT s.suspended AND s.closed_at IS NULL
       AND (a.target = 'shop' OR (p.id IS NOT NULL AND p.active AND p.deleted_at IS NULL))
       ${nearWhere}
     ORDER BY random() LIMIT ${MAX_LIVE_ADS}`,
    params
  );
  return {
    ads: rows.map((a) => ({
      id: a.id,
      headline: a.headline,
      subtext: a.subtext,
      image: a.image ? imageUrl(a.image, 1200) : '',
      darken: a.darken,
      headlineColor: a.headline_color,
      subtextColor: a.subtext_color,
      shopId: String(a.shop_id),
      shopName: a.shop_name,
      to: a.target === 'product' ? `/product/${a.product_id}` : `/shop/${a.shop_id}`,
    })),
  };
}

// Three different buyers reporting a live ad hide it until staff look at it.
export async function reportAd(buyerId, adId, reason) {
  if (!REPORT_REASONS.includes(reason)) throw httpError(400, 'Choose a reason.');
  return withTransaction(async (c) => {
    let ad;
    try {
      ad = await lockAd(c, adId);
    } catch {
      throw httpError(404, 'This ad is no longer running.');
    }
    if (ad.state !== 'live') throw httpError(404, 'This ad is no longer running.');
    const made = await c.query(`INSERT INTO ad_reports (ad_id, buyer_id, reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING ad_id`, [adId, buyerId, reason]);
    if (made.rows.length === 0) throw httpError(409, 'You already reported this ad.');
    const { n } = (await c.query('SELECT count(*)::int AS n FROM ad_reports WHERE ad_id = $1', [adId])).rows[0];
    if (n >= REPORT_LIMIT) {
      await c.query(`UPDATE ads SET status = 'attention', issue = 'Hidden after buyer reports.', paused_at = now() WHERE id = $1`, [adId]);
    }
    return { ok: true };
  });
}

// ---------- Staff ----------
export async function adminListAds() {
  const { rows } = await pool.query(
    `SELECT a.*, ${STATE} AS state, s.name AS shop_name FROM ads a JOIN shops s ON s.id = a.shop_id ORDER BY a.created_at DESC, a.id LIMIT 300`
  );
  const reports = rows.length ? (await pool.query('SELECT ad_id, reason, created_at FROM ad_reports WHERE ad_id = ANY($1::text[]) ORDER BY created_at', [rows.map((r) => r.id)])).rows : [];
  return {
    ads: rows.map((a) => ({
      ...shapeAd(a),
      shopName: a.shop_name,
      reports: reports.filter((r) => r.ad_id === a.id).map((r) => ({ reason: r.reason, at: ms(r.created_at) })),
    })),
  };
}

// Put an ad that needs attention live. Time already used before it was hidden is not given back twice.
export const adminActivate = (adminId, adId) =>
  withTransaction(async (c) => {
    const ad = await lockAd(c, adId);
    if (ad.state !== 'attention') throw httpError(409, 'This ad does not need attention.');
    const remaining = ad.paused_at && ad.ends_at
      ? Math.max((new Date(ad.ends_at).getTime() - new Date(ad.paused_at).getTime()) / 1000, 0)
      : ad.days * DAY_SECONDS;
    await c.query(
      `UPDATE ads SET status = 'approved', starts_at = now(), ends_at = now() + make_interval(secs => $2), issue = '', paused_at = NULL WHERE id = $1`,
      [adId, remaining]
    );
    await c.query('DELETE FROM ad_reports WHERE ad_id = $1', [adId]);
    await audit(c, adminId, 'activate_ad', adId);
    return { ok: true };
  });

// Close an ad that could not go live and give the money back.
export const adminRefund = (adminId, adId) =>
  withTransaction(async (c) => {
    const ad = await lockAd(c, adId);
    if (ad.state !== 'attention') throw httpError(409, 'Only an ad that needs attention can be refunded.');
    const back = await refundAdvertiser({ amount: ad.total, shopId: ad.shop_id });
    if (!back.ok) throw httpError(502, 'The refund did not go through. Please try again.');
    await c.query(`UPDATE ads SET status = 'refunded', refunded_at = now() WHERE id = $1`, [adId]);
    await addShopNotice(ad.shop_id, `Your ad "${ad.headline}" could not run, and you were refunded ${formatKES(ad.total)}.`, '/my-shop/ads', c);
    await audit(c, adminId, 'refund_ad', adId, formatKES(ad.total));
    return { ok: true };
  });

export const adminStop = (adminId, adId) => stopAd(adId, { adminId });
