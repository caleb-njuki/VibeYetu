// Buyer login: phone + one-time code, then a JWT.
//   POST /api/auth/buyer/request-otp   { "phone": "0712345678" }
//   POST /api/auth/buyer/verify-otp    { "phone": "0712345678", "code": "123456" }
//   GET  /api/auth/buyer/me            (needs the token)
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { normalizePhone } from '../utils/phone.js';
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

const requestSchema = z.object({ phone: z.string() });
const verifySchema = z.object({
  phone: z.string(),
  code: z.string().trim().regex(/^\d{6}$/),
});

function readBody(schema, req) {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const field = parsed.error.issues[0].path[0];
    throw badRequest(field === 'code' ? 'Enter the 6-digit code.' : 'Enter a valid phone number.');
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) throw badRequest('Enter a valid phone number.');
  return { ...parsed.data, phone };
}

router.post(
  '/request-otp',
  limiter(10, 'Too many code requests. Please try again later.'),
  handle(async (req, res) => {
    const { phone } = readBody(requestSchema, req);
    const { expiresInSeconds } = await requestOtp(phone);
    res.json({ message: 'Code sent.', expiresInSeconds });
  })
);

router.post(
  '/verify-otp',
  limiter(20, 'Too many tries. Please try again later.'),
  handle(async (req, res) => {
    const { phone, code } = readBody(verifySchema, req);
    const buyer = await verifyOtp(phone, code);
    res.json({
      token: signBuyerToken(buyer),
      isNewBuyer: buyer.isNew,
      buyer: { id: buyer.id, phone: buyer.phone },
    });
  })
);

router.get('/me', requireBuyer, (req, res) => {
  res.json({
    buyer: {
      id: req.buyer.id,
      phone: req.buyer.phone,
      createdAt: req.buyer.created_at,
    },
  });
});

export default router;
