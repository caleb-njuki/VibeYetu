// Staff tools. Every route needs a staff token.
//   GET  /api/admin/overview
//   GET  /api/admin/orders?status=&q=&limit=&offset=
//   GET  /api/admin/cases                          orders past the 24-hour window, oldest first
//   POST /api/admin/orders/:orderId/refund         refund the buyer
//   POST /api/admin/orders/:orderId/release        release the money to the seller
//   GET  /api/admin/shops
//   POST /api/admin/shops/:shopId/verify           { verified: true|false }
//   POST /api/admin/shops/:shopId/suspend
//   POST /api/admin/shops/:shopId/reopen           put back a shop its owner closed
//   GET  /api/admin/ads                            every ad, with its state and buyer reports
//   POST /api/admin/ads/:adId/activate             put an ad that needs attention live
//   POST /api/admin/ads/:adId/refund               close an ad that could not run and refund the seller
//   POST /api/admin/ads/:adId/stop                 take an ad down without a refund
//   POST /api/admin/shops/:shopId/review           { action: "more_info", note } or { action: "reinstate", override? }
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/adminAuth.js';
import { orderIdParam } from '../middleware/shopAccess.js';
import { decideCase, listCases, listOrders, listShops, overview, reopenShop, reviewSuspension, setVerified, suspendShop } from '../services/admin.service.js';
import { listPaymentProblems } from '../services/collection.service.js';
import { adminActivate, adminListAds, adminRefund, adminStop } from '../services/ad.service.js';
import { parsePaging } from '../utils/near.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router();
router.use(requireAdmin, limiter(600, 'Too many requests. Please wait a few minutes.'));

const STATUSES = ['pending', 'accepted', 'dispatched', 'review', 'completed', 'rejected', 'refunded'];
const verifySchema = z.object({ verified: z.boolean('Choose verified or not verified.') });
const reviewSchema = z.object({
  action: z.enum(['more_info', 'reinstate'], 'Choose an action.'),
  note: z.string().max(500).optional(),
  override: z.boolean().optional(),
});

router.get('/overview', handle(async (req, res) => res.json(await overview())));

router.get('/orders', handle(async (req, res) => {
  const { limit, offset } = parsePaging(req.query);
  const status = STATUSES.includes(req.query.status) ? req.query.status : undefined;
  res.json(await listOrders({ status, q: typeof req.query.q === 'string' ? req.query.q : '', limit: Math.min(limit, 100), offset }));
}));

router.get('/cases', handle(async (req, res) => res.json(await listCases())));
router.post('/orders/:orderId/refund', handle(async (req, res) => res.json(await decideCase(req.admin.id, orderIdParam(req), 'refund'))));
router.post('/orders/:orderId/release', handle(async (req, res) => res.json(await decideCase(req.admin.id, orderIdParam(req), 'release'))));

router.get('/shops', handle(async (req, res) => res.json(await listShops())));
router.post('/shops/:shopId/verify', handle(async (req, res) => {
  const { verified } = parseBody(verifySchema, req.body);
  res.json(await setVerified(req.admin.id, req.params.shopId, verified));
}));
router.post('/shops/:shopId/reopen', handle(async (req, res) => res.json(await reopenShop(req.admin.id, req.params.shopId))));
router.post('/shops/:shopId/suspend', handle(async (req, res) => res.json(await suspendShop(req.admin.id, req.params.shopId))));
router.post('/shops/:shopId/review', handle(async (req, res) => {
  res.json(await reviewSuspension(req.admin.id, req.params.shopId, parseBody(reviewSchema, req.body, 'Choose an action.')));
}));

// Money that arrived but could not be used (to refund), amounts that did not match, and stuck payment prompts.
router.get('/payments/problems', handle(async (req, res) => res.json(await listPaymentProblems())));
router.get('/ads', handle(async (req, res) => res.json(await adminListAds())));
router.post('/ads/:adId/activate', handle(async (req, res) => res.json(await adminActivate(req.admin.id, req.params.adId))));
router.post('/ads/:adId/refund', handle(async (req, res) => res.json(await adminRefund(req.admin.id, req.params.adId))));
router.post('/ads/:adId/stop', handle(async (req, res) => res.json(await adminStop(req.admin.id, req.params.adId))));

export default router;
