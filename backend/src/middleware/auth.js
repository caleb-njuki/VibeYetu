// Login tokens (JWT) for buyers, and the guard that protects buyer-only routes.
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { pool } from '../config/db.js';

export function signBuyerToken(buyer) {
  return jwt.sign({ role: 'buyer' }, config.jwt.secret, {
    algorithm: 'HS256',
    subject: String(buyer.id),
    expiresIn: config.jwt.expiresIn,
  });
}

function unauthorized() {
  const err = new Error('Please log in.');
  err.status = 401;
  return err;
}

// Use on any route that only a logged-in buyer may call.
// The app sends the header:  Authorization: Bearer <token>
export async function requireBuyer(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    } catch {
      throw unauthorized();
    }
    if (payload.role !== 'buyer' || !/^\d+$/.test(String(payload.sub))) {
      throw unauthorized();
    }

    const { rows } = await pool.query(
      'SELECT id, phone, created_at FROM buyers WHERE id = $1',
      [payload.sub]
    );
    if (!rows[0]) throw unauthorized();

    req.buyer = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}
