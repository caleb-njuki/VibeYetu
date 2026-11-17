// "Forgot my password" for a seller who is not signed in. Same one-time code as the Close shop box (see challenge.service.js).
// It never says whether an email has an account: every answer looks the same for known and unknown emails.
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';
import { requestPasswordCode, resetPassword, verifyPasswordCode } from './password.service.js';

const GENERIC_SENT_TO = 'the email you signed up with';
const RESEND_MS = 30 * 1000;

async function sellerIdFor(emailRaw) {
  const email = String(emailRaw || '').trim().toLowerCase();
  const { rows } = await pool.query('SELECT id FROM sellers WHERE email = $1', [email]);
  return rows[0]?.id ?? null;
}

export async function requestForgot(email) {
  const id = await sellerIdFor(email);
  if (id) await requestPasswordCode(id);
  return { sentTo: GENERIC_SENT_TO, resendInMs: RESEND_MS };
}

export async function verifyForgot(email, code) {
  const id = await sellerIdFor(email);
  if (!id) throw httpError(400, 'That code is not correct.');
  return verifyPasswordCode(id, code);
}

export async function completeForgot(email, body) {
  const id = await sellerIdFor(email);
  if (!id) throw httpError(410, 'Your code expired. Please start again.');
  return resetPassword(id, body);
}
