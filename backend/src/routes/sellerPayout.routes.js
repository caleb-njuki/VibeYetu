// How a shop gets paid. Needs the seller's token, and the shop must be the seller's own.
//   GET /api/seller/shops/:shopId/payout   -> { payout: { method, till | paybill+account | phone, updatedAt } | null }
//   PUT /api/seller/shops/:shopId/payout   body: { method: "till"|"paybill"|"pochi"|"mpesa", till | paybill+account | phone,
//                                                  again: the same details typed a second time }
//        Saved only when both entries match. Changing an existing method is refused while orders are in progress (409).
//        -> { payout }
import { Router } from 'express';
import { z } from 'zod';
import { requireSeller } from '../middleware/sellerAuth.js';
import { requireOwnShop } from '../middleware/shopAccess.js';
import { getPayout, savePayout } from '../services/payout.service.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router({ mergeParams: true });
router.use(requireSeller, requireOwnShop);

const text = z.union([z.string(), z.number().transform(String)]).optional();
const entry = z.object({ method: z.string('Choose how you want to be paid.'), till: text, paybill: text, account: text, phone: text });
const details = entry.extend({ again: entry.optional() });

router.get('/payout', handle(async (req, res) => res.json(await getPayout(req.shop.id))));
router.put('/payout', limiter(20, 'Too many tries. Please wait a few minutes.'), handle(async (req, res) => {
  const { again, ...first } = parseBody(details, req.body);
  res.json(await savePayout(req.seller.id, req.shop.id, first, again));
}));

export default router;
