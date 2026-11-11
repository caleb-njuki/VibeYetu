// Staff sign in.  POST /api/auth/admin/login { email, password } -> { token, admin }   GET /api/auth/admin/me
// Staff accounts are made with:  node scripts/create-admin.js   (never through the website)
import { Router } from 'express';
import { z } from 'zod';
import { loginAdmin } from '../services/admin.service.js';
import { requireAdmin, signAdminToken } from '../middleware/adminAuth.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router();
const loginSchema = z.object({ email: z.string('Enter your email.'), password: z.string('Enter your password.') });

router.post('/login', limiter(10, 'Too many sign-in attempts. Please try again in a few minutes.'), handle(async (req, res) => {
  const { email, password } = parseBody(loginSchema, req.body, 'Enter your email and password.');
  const admin = await loginAdmin(email, password);
  res.json({ token: signAdminToken(admin), admin });
}));

router.get('/me', requireAdmin, handle(async (req, res) => {
  res.json({ admin: { id: req.admin.id, email: req.admin.email, fullName: req.admin.full_name } });
}));

export default router;
