// Login tokens (JWT) for VibeYetu staff, and the guard for admin-only routes.
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';

export function signAdminToken(admin) {
  // Staff tokens are short: 12 hours.
  return jwt.sign({ role: 'admin' }, config.jwt.secret, { algorithm: 'HS256', subject: String(admin.id), expiresIn: '12h' });
}

export async function requireAdmin(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw httpError(401, 'Please sign in.');
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    } catch {
      throw httpError(401, 'Please sign in.');
    }
    if (payload.role !== 'admin' || !/^\d+$/.test(String(payload.sub))) throw httpError(401, 'Please sign in.');
    const { rows } = await pool.query('SELECT id, email, full_name FROM admins WHERE id = $1', [payload.sub]);
    if (!rows[0]) throw httpError(401, 'Please sign in.');
    req.admin = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}
