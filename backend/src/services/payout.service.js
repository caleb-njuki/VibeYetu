// Where a shop's money is paid. Changing it needs a one-time code sent to the seller's own phone.
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { normalizePhone } from '../utils/phone.js';
import { maskPhone } from '../utils/phoneMask.js';
import { withTransaction } from '../utils/transaction.js';
import { consumeVerified, requestCode, verifyCode } from './challenge.service.js';
import { addShopNotice } from './notification.service.js';

export const PAYOUT_METHODS = ['till', 'paybill', 'pochi', 'mpesa'];
const TILL_RE = /^\d{5,7}$/;
const PAYBILL_RE = /^\d{5,7}$/;
const ACCOUNT_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,19}$/;
const compact = (v) => String(v ?? '').replace(/\s+/g, '');

// Checks what the seller typed. Returns { value } with clean fields, or { message }.
export function validatePayout(d = {}) {
  if (d.method === 'till') {
    const till = compact(d.till);
    return TILL_RE.test(till) ? { value: { method: 'till', till } } : { message: 'A till number has 5 to 7 digits, for example 5123456.' };
  }
  if (d.method === 'paybill') {
    const paybill = compact(d.paybill);
    const account = String(d.account ?? '').replace(/\s+/g, ' ').trim();
    if (!PAYBILL_RE.test(paybill)) return { message: 'A paybill number has 5 to 7 digits, for example 247247.' };
    if (!ACCOUNT_RE.test(account)) return { message: 'Enter the account number: letters and numbers only, up to 20 characters.' };
    return { value: { method: 'paybill', paybill, account } };
  }
  if (d.method === 'pochi' || d.method === 'mpesa') {
    const phone = normalizePhone(String(d.phone ?? ''));
    if (!phone || !phone.startsWith('+254')) return { message: 'Enter a valid Kenyan phone number, for example 0712 345 678.' };
    return { value: { method: d.method, phone } };
  }
  return { message: 'Choose how you want to be paid.' };
}

const maskDigits = (s) => '•'.repeat(Math.max(0, String(s).length - 3)) + String(s).slice(-3);

// A short sentence for notices. Numbers are partly hidden.
export function describePayout(p) {
  if (p.method === 'till') return `Till ${maskDigits(p.till)}`;
  if (p.method === 'paybill') return `Paybill ${maskDigits(p.paybill)}, account ${maskDigits(p.account)}`;
  return `${p.method === 'pochi' ? 'Pochi la Biashara' : 'M-Pesa'} ${maskPhone(p.phone)}`;
}

const shape = (r) => ({
  method: r.method,
  ...(r.till ? { till: r.till } : {}),
  ...(r.paybill ? { paybill: r.paybill, account: r.account } : {}),
  ...(r.phone ? { phone: r.phone } : {}),
  updatedAt: new Date(r.updated_at).getTime(),
});

// The seller sees the full details of their own payout method (buyers never see it).
export async function getPayout(shopId, db = pool) {
  const { rows } = await db.query('SELECT * FROM payout_methods WHERE shop_id = $1', [shopId]);
  return { payout: rows[0] ? shape(rows[0]) : null };
}

const same = (a, b) => a && b && a.method === b.method && a.till === b.till && a.paybill === b.paybill && a.account === b.account && a.phone === b.phone;

// Step 1. The details are checked first, so a code is not wasted on a mistake.
export async function requestPayoutCode(sellerId, shopId, draft) {
  const checked = validatePayout(draft);
  if (!checked.value) throw httpError(400, checked.message);
  const current = (await getPayout(shopId)).payout;
  if (same(current, checked.value)) throw httpError(409, 'That is already your payout method.');
  return requestCode(sellerId, 'payout', String(shopId));
}

// Step 2.
export const verifyPayoutCode = (sellerId, shopId, code) => verifyCode(sellerId, 'payout', String(shopId), String(code ?? '').trim());

// Step 3. Only works right after a code was accepted, and only once.
export async function savePayout(sellerId, shopId, draft) {
  const checked = validatePayout(draft);
  if (!checked.value) throw httpError(400, checked.message);
  const v = checked.value;
  await withTransaction(async (c) => {
    await consumeVerified(c, sellerId, 'payout', String(shopId));
    await c.query(
      `INSERT INTO payout_methods (shop_id, method, till, paybill, account, phone, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (shop_id) DO UPDATE
         SET method = $2, till = $3, paybill = $4, account = $5, phone = $6, updated_at = now()`,
      [shopId, v.method, v.till ?? null, v.paybill ?? null, v.account ?? null, v.phone ?? null]
    );
    // The notice reaches the bell, so a seller notices a change they did not make.
    await addShopNotice(shopId, `Your payout method was changed to ${describePayout(v)}. If this was not you, contact support now.`, '/my-shop/settings', c);
  });
  return getPayout(shopId);
}
