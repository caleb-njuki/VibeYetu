// One-time codes for buyer login: create + send a code, then check it.
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { sendSms } from './sms.service.js';

const OTP_TTL_SECONDS = 300; // a code works for 5 minutes
const MAX_ATTEMPTS = 5; // wrong guesses allowed per code
const RESEND_COOLDOWN_SECONDS = 60; // wait between two code requests
const MAX_REQUESTS_PER_HOUR = 5; // codes per phone per hour

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Only a hash of the code is stored, never the code itself.
function hashCode(phone, code) {
  return createHmac('sha256', config.jwt.secret)
    .update(`${phone}:${code}`)
    .digest('hex');
}

function sameHash(a, b) {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

// Creates a new code for this phone and sends it by SMS.
export async function requestOtp(phone) {
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  let otpId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Stops two requests for the same phone from running at the same moment.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [phone]);

    await client.query(
      `DELETE FROM otp_codes
       WHERE phone = $1 AND created_at < now() - interval '1 day'`,
      [phone]
    );

    const { rows } = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS last_hour,
         GREATEST(0, CEIL(EXTRACT(EPOCH FROM
           (MAX(created_at) + make_interval(secs => $2) - now()))))::int AS wait_seconds
       FROM otp_codes
       WHERE phone = $1`,
      [phone, RESEND_COOLDOWN_SECONDS]
    );
    const { last_hour: lastHour, wait_seconds: waitSeconds } = rows[0];

    if (waitSeconds > 0) {
      throw httpError(
        429,
        `Please wait ${waitSeconds} seconds before asking for a new code.`
      );
    }
    if (lastHour >= MAX_REQUESTS_PER_HOUR) {
      throw httpError(429, 'Too many codes requested. Please try again in an hour.');
    }

    // Older unused codes stop working as soon as a new one is made.
    await client.query(
      'UPDATE otp_codes SET used_at = now() WHERE phone = $1 AND used_at IS NULL',
      [phone]
    );
    const inserted = await client.query(
      `INSERT INTO otp_codes (phone, code_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(secs => $3))
       RETURNING id`,
      [phone, hashCode(phone, code), OTP_TTL_SECONDS]
    );
    otpId = inserted.rows[0].id;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  try {
    await sendSms(
      phone,
      `Your VibeYetu code is ${code}. It expires in ${OTP_TTL_SECONDS / 60} minutes. Do not share it.`
    );
  } catch (err) {
    // The SMS did not go out, so the person may try again straight away.
    await pool.query('DELETE FROM otp_codes WHERE id = $1', [otpId]);
    throw err;
  }

  return { expiresInSeconds: OTP_TTL_SECONDS };
}

// Checks the code. If it is right, returns the buyer (created on first login).
export async function verifyOtp(phone, code) {
  let failure = null;
  let buyer = null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [phone]);

    const { rows } = await client.query(
      `SELECT id, code_hash, attempts, (expires_at <= now()) AS expired
       FROM otp_codes
       WHERE phone = $1 AND used_at IS NULL
       ORDER BY created_at DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [phone]
    );
    const row = rows[0];

    if (!row || row.expired) {
      failure = 'That code is wrong or has expired. Please request a new one.';
    } else if (row.attempts >= MAX_ATTEMPTS) {
      failure = 'Too many wrong tries. Please request a new code.';
    } else if (!sameHash(row.code_hash, hashCode(phone, code))) {
      await client.query(
        `UPDATE otp_codes
         SET attempts = attempts + 1,
             used_at = CASE WHEN attempts + 1 >= $2 THEN now() ELSE NULL END
         WHERE id = $1`,
        [row.id, MAX_ATTEMPTS]
      );
      failure = 'That code is wrong or has expired. Please request a new one.';
    } else {
      await client.query('UPDATE otp_codes SET used_at = now() WHERE id = $1', [row.id]);
      const result = await client.query(
        `INSERT INTO buyers (phone, last_login_at)
         VALUES ($1, now())
         ON CONFLICT (phone) DO UPDATE SET last_login_at = now()
         RETURNING id, phone, (xmax = 0) AS is_new`,
        [phone]
      );
      buyer = {
        id: result.rows[0].id,
        phone: result.rows[0].phone,
        isNew: result.rows[0].is_new,
      };
    }
    await client.query('COMMIT'); // saves the wrong-try count too
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  if (failure) throw httpError(400, failure);
  return buyer;
}
