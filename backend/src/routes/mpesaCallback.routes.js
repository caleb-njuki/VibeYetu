// Where Safaricom (M-Pesa) reports the result of a payment:  POST /hooks/mpesa/<DARAJA_CALLBACK_SECRET>
// The secret is part of the address, so only the address Safaricom was given works. It is mounted outside /api
// so that the normal rate limit does not block Safaricom. Safaricom only needs to be told that the message arrived.
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config/env.js';
import { handleCallback } from '../services/collection.service.js';
import { handle } from '../utils/routeHelpers.js';

const router = Router();

const sameSecret = (given) => {
  const want = config.payments.daraja.callbackSecret;
  if (!want || typeof given !== 'string') return false;
  const a = Buffer.from(given), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
};

router.post('/mpesa/:secret', handle(async (req, res) => {
  if (config.payments.mode !== 'daraja' || !sameSecret(req.params.secret)) return res.status(404).json({ error: 'Route not found' });
  await handleCallback(req.body);
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
}));

export default router;
