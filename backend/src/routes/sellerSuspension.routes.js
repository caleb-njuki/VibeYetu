// A suspended seller's report. Needs the seller's token and the shop must be theirs.
//   GET  /api/seller/shops/:shopId/suspension          -> { suspended, kind, suspendedAt, orders, report, reasons }
//   POST /api/seller/shops/:shopId/suspension/report   { reason, details (30-1000), plan (20-500) }
import { Router } from 'express';
import { z } from 'zod';
import { requireSeller } from '../middleware/sellerAuth.js';
import { requireOwnShop } from '../middleware/shopAccess.js';
import { getSuspension, submitSuspensionReport } from '../services/suspension.service.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router({ mergeParams: true });
router.use(requireSeller, requireOwnShop);

const schema = z.object({
  reason: z.string('Choose what best explains what happened.'),
  details: z.string('Please explain what happened in at least 30 characters.'),
  plan: z.string('Please tell us how you will prevent it, in at least 20 characters.'),
});

router.get('/suspension', handle(async (req, res) => res.json(await getSuspension(req.shop.id))));
router.post('/suspension/report', limiter(30, 'Too many reports. Please wait a few minutes.'), handle(async (req, res) => {
  res.status(201).json(await submitSuspensionReport(req.shop.id, parseBody(schema, req.body)));
}));

export default router;
