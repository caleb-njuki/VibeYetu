// Buyer login: email + one-time code (sent by email), then a JWT.
//   POST /api/auth/buyer/request-otp   { "email": "amina@example.com" }
//   POST /api/auth/buyer/verify-otp    { "email": "amina@example.com", "code": "123456" }
//   GET  /api/auth/buyer/me            (needs the token)
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requestOtp, verifyOtp } from '../services/otp.service.js';
import { signBuyerToken, requireBuyer } from '../middleware/auth.js';

const router = Router();

function limiter(limit, message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
  });
}

// Passes errors from async routes to the app's error handler.
const handle = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

const requestSchema = z.object({ email: z.string() });
const verifySchema = z.object({
  email: z.string(),
  code: z.string().trim().regex(/^\d{6}$/),
});

function readBody(schema, req) {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const field = parsed.error.issues[0].path[0];
    throw badRequest(field === 'code' ? 'Enter the 6-digit code.' : 'Enter a valid email address.');
  }
  const email = parsed.data.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw badRequest('Enter a valid email address.');
  return { ...parsed.data, email };
}

router.post(
  '/request-otp',
  limiter(10, 'Too many code requests. Please try again later.'),
  handle(async (req, res) => {
    const { email } = readBody(requestSchema, req);
    const { expiresInSeconds } = await requestOtp(email);
    res.json({ message: 'Code sent.', expiresInSeconds });
  })
);

router.post(
  '/verify-otp',
  limiter(20, 'Too many tries. Please try again later.'),
  handle(async (req, res) => {
    const { email, code } = readBody(verifySchema, req);
    const buyer = await verifyOtp(email, code);
    res.json({
      token: signBuyerToken(buyer),
      isNewBuyer: buyer.isNew,
      buyer: { id: buyer.id, email: buyer.email },
    });
  })
);

router.get('/me', requireBuyer, (req, res) => {
  res.json({
    buyer: {
      id: req.buyer.id,
      email: req.buyer.email,
      createdAt: req.buyer.created_at,
    },
  });
});

export default router;
