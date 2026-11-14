// Seller sign up and sign in: email + password, then a JWT.
//   POST /api/auth/seller/register   (account, details, shop, consent)
//   POST /api/auth/seller/login      { "email": "...", "password": "..." }
//   GET  /api/auth/seller/me         (needs the token)
import { Router } from 'express';
import { z } from 'zod';
import { registerSeller, loginSeller, getSeller, listOwnShops } from '../services/seller.service.js';
import { signSellerToken, requireSeller } from '../middleware/sellerAuth.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';
import { completeForgot, requestForgot, verifyForgot } from '../services/forgotPassword.service.js';

const router = Router();

const registerSchema = z.object({
  account: z.object({ email: z.string(), password: z.string() }),
  details: z.object({
    fullName: z.string(),
    idNumber: z.string(),
    kraPin: z.string().optional(),
    phone: z.string(),
    businessType: z.string(),
    businessName: z.string().optional(),
    businessRegNo: z.string().optional(),
  }),
  shop: z.object({
    name: z.string(),
    areaId: z.string(),
    description: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
  consent: z.object({ terms: z.boolean(), data: z.boolean(), accurate: z.boolean() }),
});

const loginSchema = z.object({ email: z.string(), password: z.string() });

router.post(
  '/register',
  limiter(10, 'Too many sign-up attempts. Please try again later.'),
  handle(async (req, res) => {
    const input = parseBody(registerSchema, req.body, 'Please fill in every field and try again.');
    const { seller, shop } = await registerSeller(input);
    res.status(201).json({ token: await signSellerToken(seller), seller, shop });
  })
);

router.post(
  '/login',
  limiter(10, 'Too many sign-in attempts. Please try again later.'),
  handle(async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body, 'Enter your email and password.');
    const { seller, shops } = await loginSeller(email, password);
    res.json({ token: await signSellerToken(seller), seller, shops });
  })
);

// Forgot password (not signed in). A code goes by SMS to the phone the seller signed up with.
//   POST /forgot/code    { email }                      -> { phone, resendInMs }   (the same answer whether or not the email exists)
//   POST /forgot/verify  { email, code }                -> { ok: true }
//   POST /forgot/reset   { email, password, confirm }   -> { ok: true }. Every older login ends; the seller signs in again.
const forgotEmail = z.object({ email: z.string('Enter your email.').min(3, 'Enter your email.').max(200) });
const forgotCode = forgotEmail.extend({ code: z.string('Enter the 6-digit code.').min(1, 'Enter the 6-digit code.').max(12) });
const forgotReset = forgotEmail.extend({ password: z.string('Enter a new password.'), confirm: z.string('Type the new password again.') });
router.post('/forgot/code', limiter(8, 'Too many code requests. Please wait a few minutes.'), handle(async (req, res) => {
  res.json(await requestForgot(parseBody(forgotEmail, req.body).email));
}));
router.post('/forgot/verify', limiter(20, 'Too many tries. Please wait a few minutes.'), handle(async (req, res) => {
  const b = parseBody(forgotCode, req.body);
  res.json(await verifyForgot(b.email, b.code));
}));
router.post('/forgot/reset', limiter(8, 'Too many tries. Please wait a few minutes.'), handle(async (req, res) => {
  const b = parseBody(forgotReset, req.body);
  res.json(await completeForgot(b.email, { password: b.password, confirm: b.confirm }));
}));

router.get(
  '/me',
  requireSeller,
  handle(async (req, res) => {
    res.json({ seller: await getSeller(req.seller.id), shops: await listOwnShops(req.seller.id) });
  })
);

export default router;
