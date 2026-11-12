// A seller choosing a new password after a one-time code (OTP) sent to the phone they signed up with.
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { withTransaction } from '../utils/transaction.js';
import { consumeVerified, requestCode, verifyCode } from './challenge.service.js';
import { addShopNotice } from './notification.service.js';

const BCRYPT_COST = 12;

export const requestPasswordCode = (sellerId) => requestCode(sellerId, 'password', '');
export const verifyPasswordCode = (sellerId, code) => verifyCode(sellerId, 'password', '', String(code ?? '').trim());

export async function resetPassword(sellerId, { password, confirm }) {
  const pw = String(password ?? '');
  if (pw.length < 8) throw httpError(400, 'Your password must have at least 8 characters.');
  if (Buffer.byteLength(pw) > 72) throw httpError(400, 'Your password is too long. Use at most 72 characters.');
  if (pw !== confirm) throw httpError(400, 'The two passwords do not match.');
  const hash = await bcrypt.hash(pw, BCRYPT_COST);
  await withTransaction(async (c) => {
    await consumeVerified(c, sellerId, 'password', '');
    await c.query('UPDATE sellers SET password_hash = $2 WHERE id = $1', [sellerId, hash]);
    const shops = await c.query('SELECT id FROM shops WHERE seller_id = $1 AND closed_at IS NULL ORDER BY id', [sellerId]);
    for (const s of shops.rows) {
      await addShopNotice(s.id, 'Your password was changed. If this was not you, contact support now.', '/my-shop/settings', c);
    }
  });
  return { ok: true };
}
