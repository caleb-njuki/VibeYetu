// A seller resetting their password with a code sent by SMS to the phone they signed up with.
// The seller must be signed in (this is used inside the Close shop box).
//   POST /api/seller/account/password/code      -> { phone: "07•• ••• 678", resendInMs }
//   POST /api/seller/account/password/verify    body: { code } -> { ok: true }
//        wrong code 400, expired or none 410, too many wrong codes 429 (locked for 10 minutes)
//   POST /api/seller/account/password/reset     body: { password, confirm }. Only works right after a code was accepted, and once.
import { Router } from 'express';
import { z } from 'zod';
import { requireSeller } from '../middleware/sellerAuth.js';
import { requestPasswordCode, resetPassword, verifyPasswordCode } from '../services/password.service.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router();
router.use(requireSeller);

const codeSchema = z.object({ code: z.string('Enter the 6-digit code.').min(1, 'Enter the 6-digit code.').max(12) });
const resetSchema = z.object({ password: z.string('Enter a new password.'), confirm: z.string('Type the new password again.') });

router.post('/password/code', limiter(10, 'Too many code requests. Please wait a few minutes.'), handle(async (req, res) => {
  res.json(await requestPasswordCode(req.seller.id));
}));
router.post('/password/verify', limiter(30, 'Too many tries. Please wait a few minutes.'), handle(async (req, res) => {
  res.json(await verifyPasswordCode(req.seller.id, parseBody(codeSchema, req.body).code));
}));
router.post('/password/reset', limiter(10, 'Too many tries. Please wait a few minutes.'), handle(async (req, res) => {
  res.json(await resetPassword(req.seller.id, parseBody(resetSchema, req.body)));
}));

export default router;
