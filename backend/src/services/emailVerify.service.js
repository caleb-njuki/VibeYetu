// Proves that a seller really owns an email address, before the account is made.
//   requestEmailCode(email)         sends a 6-digit code by email
//   verifyEmailCode(email, code)    checks it and gives back a "proof" that is valid for 30 minutes
//   checkEmailProof(email, proof)   the sign-up uses this to be sure the email was verified
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { httpError } from '../utils/httpError.js';
import { sendEmail } from './email.service.js';

const CODE_MS = 10 * 60 * 1000; // a code works for 10 minutes
const RESEND_MS = 30 * 1000; // wait before asking for another code
const MAX_TRIES = 5;
const PROOF_MS = 30 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (email) => String(email || '').trim().toLowerCase();
const sign = (text) => createHmac('sha256', config.jwt.secret).update(`email-code:${text}`).digest('hex');

export async function requestEmailCode(rawEmail) {
  const email = clean(rawEmail);
  if (!EMAIL_RE.test(email) || email.length > 200) throw httpError(400, 'Enter a valid email address.');

  const taken = await pool.query('SELECT 1 FROM sellers WHERE email = $1', [email]);
  if (taken.rows[0]) throw httpError(409, 'An account with this email already exists. Please sign in instead.');

  const old = await pool.query('SELECT sent_at FROM email_codes WHERE email = $1', [email]);
  if (old.rows[0] && Date.now() - new Date(old.rows[0].sent_at).getTime() < RESEND_MS) {
    throw httpError(429, 'A code was just sent. Please wait a few seconds before asking again.');
  }

  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  await pool.query(
    `INSERT INTO email_codes (email, code_hash, expires_at, sent_at, tries)
     VALUES ($1, $2, now() + make_interval(secs => $3), now(), 0)
     ON CONFLICT (email) DO UPDATE SET code_hash = $2, expires_at = EXCLUDED.expires_at, sent_at = now(), tries = 0`,
    [email, sign(`${email}:${code}`), CODE_MS / 1000]
  );
  await sendEmail(email, 'Your VibeYetu verification code', `Your VibeYetu code is ${code}. It works for 10 minutes. If you did not ask for it, ignore this email.`);
  // In console mode (testing on one computer, never in production) the code is also returned, so the test scripts can run on their own.
  return { sentTo: email, resendInMs: RESEND_MS, ...(config.email.mode === 'test' ? { devCode: code } : {}) };
}

export async function verifyEmailCode(rawEmail, rawCode) {
  const email = clean(rawEmail);
  const code = String(rawCode || '').trim();
  const { rows } = await pool.query('SELECT code_hash, expires_at, tries FROM email_codes WHERE email = $1', [email]);
  const row = rows[0];
  if (!row || new Date(row.expires_at).getTime() < Date.now()) throw httpError(410, 'That code has expired. Ask for a new one.');
  if (row.tries >= MAX_TRIES) throw httpError(429, 'Too many wrong codes. Ask for a new code.');

  const a = Buffer.from(sign(`${email}:${code}`));
  const b = Buffer.from(row.code_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await pool.query('UPDATE email_codes SET tries = tries + 1 WHERE email = $1', [email]);
    throw httpError(400, 'That code is not correct. Please try again.');
  }
  await pool.query('DELETE FROM email_codes WHERE email = $1', [email]);
  const expires = Date.now() + PROOF_MS;
  return { proof: `${expires}.${sign(`proof:${email}:${expires}`)}` };
}

export function checkEmailProof(rawEmail, proof) {
  const email = clean(rawEmail);
  const [expires, mac] = String(proof || '').split('.');
  const ok = Number(expires) > Date.now() && mac && mac.length === 64 && timingSafeEqual(Buffer.from(mac), Buffer.from(sign(`proof:${email}:${expires}`)));
  if (!ok) throw httpError(400, 'Please verify your email first. The check may have expired.');
}
