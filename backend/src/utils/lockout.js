// Locks an account for a while after too many wrong passwords in a row.
import { pool } from '../config/db.js';
import { httpError } from './httpError.js';

export const MAX_FAILS = 5;
export const LOCK_MINUTES = 15;
const TABLES = new Set(['sellers', 'admins']);

const message = (minutes) => `Too many wrong passwords. For your safety, try again in ${minutes} minutes.`;

// The error to throw when the row is locked right now, or null.
export function lockedError(row) {
  if (!row?.locked_until) return null;
  const ms = new Date(row.locked_until).getTime() - Date.now();
  return ms > 0 ? httpError(429, message(Math.max(1, Math.ceil(ms / 60000)))) : null;
}

// Counts one wrong password. Returns the error to throw: 429 if this wrong try locked the account, otherwise null.
export async function recordFailure(table, id) {
  if (!TABLES.has(table)) throw new Error('bad table');
  const { rows } = await pool.query(
    `WITH x AS (SELECT CASE WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1 ELSE failed_logins + 1 END AS n FROM ${table} WHERE id = $1)
     UPDATE ${table} t SET failed_logins = x.n, locked_until = CASE WHEN x.n >= $2 THEN now() + make_interval(mins => $3) ELSE NULL END
     FROM x WHERE t.id = $1 RETURNING t.failed_logins, t.locked_until`,
    [id, MAX_FAILS, LOCK_MINUTES]
  );
  return rows[0] && rows[0].failed_logins >= MAX_FAILS ? httpError(429, message(LOCK_MINUTES)) : null;
}

export async function clearFailures(table, id, row) {
  if (!TABLES.has(table)) throw new Error('bad table');
  if (row && !row.failed_logins && !row.locked_until) return; // nothing to clear: skip the write
  await pool.query(`UPDATE ${table} SET failed_logins = 0, locked_until = NULL WHERE id = $1`, [id]);
}
