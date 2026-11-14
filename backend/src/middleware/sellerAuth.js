// Login tokens (JWT) for sellers, and the guard for seller-only routes.
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { pool } from '../config/db.js';
import { httpError } from '../utils/httpError.js';

// `tv` is the seller's token version. A password change raises it, which ends every older login.
export async function signSellerToken(seller) {
  const tv = (await pool.query('SELECT token_version FROM sellers WHERE id = $1', [seller.id])).rows[0]?.token_version ?? 0;
  return jwt.sign({ role: 'seller', tv }, config.jwt.secret, {
    algorithm: 'HS256',
    subject: String(seller.id),
    expiresIn: config.jwt.expiresIn,
  });
}

// Use on any route that only a logged-in seller may call.
// The app sends the header:  Authorization: Bearer <token>
export async function requireSeller(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw httpError(401, 'Please log in.');

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    } catch {
      throw httpError(401, 'Please log in.');
    }
    if (payload.role !== 'seller' || !/^\d+$/.test(String(payload.sub))) {
      throw httpError(401, 'Please log in.');
    }

    const { rows } = await pool.query('SELECT id, email, full_name, phone, token_version FROM sellers WHERE id = $1', [payload.sub]);
    if (!rows[0]) throw httpError(401, 'Please log in.');
    if ((payload.tv ?? 0) !== rows[0].token_version) throw httpError(401, 'Your password was changed. Please sign in again.');

    req.seller = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}
