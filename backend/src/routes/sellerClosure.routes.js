// A seller closing their shop. Needs the seller's token, and the shop must be the seller's own.
//   GET  /api/seller/shops/:shopId/closure   what closing would switch off, and any open orders that block it
//   POST /api/seller/shops/:shopId/close     { reason, details?, password }
//        reply: { ok: true, nextShopId }  (nextShopId is null when this was the seller's last open shop)
import { Router } from 'express';
import { z } from 'zod';
import { requireSeller } from '../middleware/sellerAuth.js';
import { requireOwnShop } from '../middleware/shopAccess.js';
import { closeShop, getClosureInfo } from '../services/closure.service.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router({ mergeParams: true });
router.use(requireSeller, requireOwnShop);

const schema = z.object({
  reason: z.string('Choose the reason that fits best.'),
  details: z.string().max(500, 'Keep the details under 500 characters.').optional(),
  password: z.string('Enter your password.').min(1, 'Enter your password.').max(200),
});

router.get('/closure', handle(async (req, res) => res.json(await getClosureInfo(req.shop.id))));
// The password is checked here, so wrong guesses are limited.
router.post('/close', limiter(8, 'Too many tries. Please wait a few minutes.'), handle(async (req, res) => {
  res.json(await closeShop(req.seller.id, req.shop.id, parseBody(schema, req.body)));
}));

export default router;
