// How a shop gets paid. Needs the seller's token, and the shop must be the seller's own.
//   GET /api/seller/shops/:shopId/payout           -> { payout: { method, till | paybill+account | phone, updatedAt } | null }
//   POST /api/seller/shops/:shopId/payout/code     body: the new details (same as PUT). Sends a 6-digit code by SMS.
//        -> { phone: "07•• ••• 678", resendInMs }
//   POST /api/seller/shops/:shopId/payout/verify   body: { code }  -> { ok: true }
//        wrong code 400, expired or none 410, too many wrong codes 429 (locked for 10 minutes)
//   PUT  /api/seller/shops/:shopId/payout          body: { method: "till"|"paybill"|"pochi"|"mpesa", till | paybill+account | phone }
//        Only works right after a code was accepted, and once. -> { payout }
import { Router } from 'express';
import { z } from 'zod';
import { requireSeller } from '../middleware/sellerAuth.js';
import { requireOwnShop } from '../middleware/shopAccess.js';
import { getPayout, requestPayoutCode, savePayout, verifyPayoutCode } from '../services/payout.service.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router({ mergeParams: true });
router.use(requireSeller, requireOwnShop);

const text = z.union([z.string(), z.number().transform(String)]).optional();
const details = z.object({ method: z.string('Choose how you want to be paid.'), till: text, paybill: text, account: text, phone: text });
const codeSchema = z.object({ code: z.string('Enter the 6-digit code.').min(1, 'Enter the 6-digit code.').max(12) });

router.get('/payout', handle(async (req, res) => res.json(await getPayout(req.shop.id))));
router.post('/payout/code', limiter(20, 'Too many code requests. Please wait a few minutes.'), handle(async (req, res) => {
  res.json(await requestPayoutCode(req.seller.id, req.shop.id, parseBody(details, req.body)));
}));
router.post('/payout/verify', limiter(30, 'Too many tries. Please wait a few minutes.'), handle(async (req, res) => {
  res.json(await verifyPayoutCode(req.seller.id, req.shop.id, parseBody(codeSchema, req.body).code));
}));
router.put('/payout', limiter(20, 'Too many tries. Please wait a few minutes.'), handle(async (req, res) => {
  res.json(await savePayout(req.seller.id, req.shop.id, parseBody(details, req.body)));
}));

export default router;
