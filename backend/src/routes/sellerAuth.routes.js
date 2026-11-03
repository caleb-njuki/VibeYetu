// Seller sign up and sign in: email + password, then a JWT.
//   POST /api/auth/seller/register   (account, details, shop, consent)
//   POST /api/auth/seller/login      { "email": "...", "password": "..." }
//   GET  /api/auth/seller/me         (needs the token)
import { Router } from 'express';
import { z } from 'zod';
import { registerSeller, loginSeller, getSeller, listOwnShops } from '../services/seller.service.js';
import { signSellerToken, requireSeller } from '../middleware/sellerAuth.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

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
    res.status(201).json({ token: signSellerToken(seller), seller, shop });
  })
);

router.post(
  '/login',
  limiter(10, 'Too many sign-in attempts. Please try again later.'),
  handle(async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body, 'Enter your email and password.');
    const { seller, shops } = await loginSeller(email, password);
    res.json({ token: signSellerToken(seller), seller, shops });
  })
);

router.get(
  '/me',
  requireSeller,
  handle(async (req, res) => {
    res.json({ seller: await getSeller(req.seller.id), shops: await listOwnShops(req.seller.id) });
  })
);

export default router;
