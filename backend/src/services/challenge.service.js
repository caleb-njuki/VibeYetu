// One-time codes (OTP) for sensitive seller changes: the payout method and the password.
// The code goes by SMS to the phone the seller signed up with, so someone using an open session
// cannot send it to their own phone. Steps: request a code, verify it, then save the change.
// Saving only works right after a code was accepted, and only once.
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { httpError } from '../utils/httpError.js';
import { maskPhone } from '../utils/phoneMask.js';
import { withTransaction } from '../utils/transaction.js';
import { sendSms } from './sms.service.js';

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 300; // a code works for 5 minutes
export const RESEND_SECONDS = 30; // wait before asking for another code
export const MAX_TRIES = 5; // wrong codes allowed before the change is locked
export const LOCK_MINUTES = 10;
const MAX_CODES_PER_HOUR = 6;
const VERIFIED_SECONDS = { payout: 120, password: 300 }; // time to save after the code is accepted

const WHAT = { payout: 'payout change', password: 'password reset' };

const hash = (sellerId, purpose, subject, code) =>
  createHmac('sha256', config.jwt.secret).update(`${purpose}:${sellerId}:${subject}:${code}`).digest('hex');
const same = (a, b) => {
  const x = Buffer.from(a, 'hex'), y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
};

const lockMessage = (minutes) => `Too many wrong codes. For your safety, try again in ${minutes} minutes.`;

// Locks rows by hashing the three-part key, so two requests for the same seller never run together.
const lock = (c, purpose, sellerId, subject) => c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${purpose}:${sellerId}:${subject}`]);

async function limitRow(c, purpose, sellerId, subject) {
  await c.query(
    'INSERT INTO seller_challenge_limits (purpose, seller_id, subject) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [purpose, sellerId, subject]
  );
  return (await c.query(
    `SELECT tries, (locked_until IS NOT NULL AND locked_until > now()) AS locked,
            GREATEST(1, CEIL(EXTRACT(EPOCH FROM (locked_until - now())) / 60))::int AS minutes
     FROM seller_challenge_limits WHERE purpose = $1 AND seller_id = $2 AND subject = $3 FOR UPDATE`,
    [purpose, sellerId, subject]
  )).rows[0];
}

// Sends a new code. Returns the masked phone it went to.
export async function requestCode(sellerId, purpose, subject = '') {
  const seller = (await pool.query('SELECT phone FROM sellers WHERE id = $1', [sellerId])).rows[0];
  if (!seller?.phone) throw httpError(409, 'We have no phone number to send the code to. Contact support.');

  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
  await withTransaction(async (c) => {
    await lock(c, purpose, sellerId, subject);
    const lim = await limitRow(c, purpose, sellerId, subject);
    if (lim.locked) throw httpError(429, lockMessage(lim.minutes));
    const recent = (await c.query(
      `SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS last_hour,
              GREATEST(0, CEIL(EXTRACT(EPOCH FROM (MAX(created_at) + make_interval(secs => $4) - now()))))::int AS wait
       FROM seller_challenges WHERE purpose = $1 AND seller_id = $2 AND subject = $3`,
      [purpose, sellerId, subject, RESEND_SECONDS]
    )).rows[0];
    if (recent.wait > 0) throw httpError(429, `Please wait ${recent.wait} seconds before asking for another code.`);
    if (recent.last_hour >= MAX_CODES_PER_HOUR) throw httpError(429, 'Too many codes requested. Please try again in an hour.');
    // A new code replaces every older one.
    await c.query('UPDATE seller_challenges SET used_at = now() WHERE purpose = $1 AND seller_id = $2 AND subject = $3 AND used_at IS NULL', [purpose, sellerId, subject]);
    await c.query(
      `INSERT INTO seller_challenges (purpose, seller_id, subject, code_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
      [purpose, sellerId, subject, hash(sellerId, purpose, subject, code), OTP_TTL_SECONDS]
    );
  });

  try {
    await sendSms(seller.phone, `Your VibeYetu code for a ${WHAT[purpose]} is ${code}. It expires in ${OTP_TTL_SECONDS / 60} minutes. Never share it. If you did not ask for it, ignore this message.`);
  } catch (err) {
    // The SMS did not go out: the code is useless, so the seller may try again straight away.
    await pool.query('UPDATE seller_challenges SET used_at = now(), created_at = created_at - interval \'1 hour\' WHERE purpose = $1 AND seller_id = $2 AND subject = $3 AND used_at IS NULL', [purpose, sellerId, subject]);
    throw err;
  }
  return { phone: maskPhone(seller.phone), resendInMs: RESEND_SECONDS * 1000 };
}

// Checks a code. Wrong codes count across codes; too many lock the change for 10 minutes.
export async function verifyCode(sellerId, purpose, subject, code) {
  let failure = null;
  await withTransaction(async (c) => {
    await lock(c, purpose, sellerId, subject);
    const lim = await limitRow(c, purpose, sellerId, subject);
    if (lim.locked) { failure = httpError(429, lockMessage(lim.minutes)); return; }

    const row = (await c.query(
      `SELECT id, code_hash, (expires_at <= now()) AS expired FROM seller_challenges
       WHERE purpose = $1 AND seller_id = $2 AND subject = $3 AND used_at IS NULL
       ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`,
      [purpose, sellerId, subject]
    )).rows[0];
    if (!row) { failure = httpError(410, 'Ask for a new code first.'); return; }
    if (row.expired) {
      await c.query('UPDATE seller_challenges SET used_at = now() WHERE id = $1', [row.id]);
      failure = httpError(410, 'That code has expired. Ask for a new one.');
      return;
    }

    if (!/^\d+$/.test(String(code)) || !same(row.code_hash, hash(sellerId, purpose, subject, String(code)))) {
      const tries = lim.tries + 1;
      if (tries >= MAX_TRIES) {
        await c.query('UPDATE seller_challenges SET used_at = now() WHERE id = $1', [row.id]);
        await c.query(`UPDATE seller_challenge_limits SET tries = 0, locked_until = now() + make_interval(mins => $4) WHERE purpose = $1 AND seller_id = $2 AND subject = $3`, [purpose, sellerId, subject, LOCK_MINUTES]);
        failure = httpError(429, `Too many wrong codes. For your safety, this is locked for ${LOCK_MINUTES} minutes.`);
      } else {
        await c.query('UPDATE seller_challenge_limits SET tries = $4 WHERE purpose = $1 AND seller_id = $2 AND subject = $3', [purpose, sellerId, subject, tries]);
        const left = MAX_TRIES - tries;
        failure = httpError(400, `That code is not correct. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
      }
      return;
    }
    await c.query('UPDATE seller_challenges SET used_at = now(), verified_until = now() + make_interval(secs => $2) WHERE id = $1', [row.id, VERIFIED_SECONDS[purpose]]);
    await c.query('UPDATE seller_challenge_limits SET tries = 0, locked_until = NULL WHERE purpose = $1 AND seller_id = $2 AND subject = $3', [purpose, sellerId, subject]);
  });
  // The wrong-try count must be saved, so the error is thrown only after the transaction has finished.
  if (failure) throw failure;
  return { ok: true };
}

// Used by the save step, inside its own transaction `c`: takes the accepted code (once). Throws if there is none.
export async function consumeVerified(c, sellerId, purpose, subject = '') {
  const { rows } = await c.query(
    `UPDATE seller_challenges SET consumed_at = now()
     WHERE id = (SELECT id FROM seller_challenges
                 WHERE purpose = $1 AND seller_id = $2 AND subject = $3
                   AND verified_until > now() AND consumed_at IS NULL
                 ORDER BY verified_until DESC LIMIT 1 FOR UPDATE)
     RETURNING id`,
    [purpose, sellerId, subject]
  );
  if (!rows[0]) throw httpError(410, 'Your code expired. Please start the change again.');
}
