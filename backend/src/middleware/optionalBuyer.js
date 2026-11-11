// Like requireBuyer, but a missing or bad token is fine: the request just has no req.buyer.
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function optionalBuyer(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme === 'Bearer' && token) {
      const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
      if (payload.role === 'buyer' && /^\d+$/.test(String(payload.sub))) req.buyerId = payload.sub;
    }
  } catch {
    // Not logged in, or the token expired: carry on as a visitor.
  }
  next();
}
