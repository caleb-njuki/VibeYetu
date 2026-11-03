// The connection to PostgreSQL. Every part of the backend imports `pool` from here.
import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// An idle connection can drop (for example if PostgreSQL restarts).
// Log it instead of crashing the whole server.
pool.on('error', (err) => {
  console.error('Database connection error:', err.message);
});

// Returns true if the database answers, false if not. Never throws.
export async function checkDb() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    console.error('Database check failed:', err.message);
    return false;
  }
}
