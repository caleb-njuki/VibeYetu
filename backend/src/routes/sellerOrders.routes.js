// A shop's orders. Needs the seller's token, and the shop must be the seller's own.
//   GET  /api/seller/shops/:shopId/orders
//   GET  /api/seller/shops/:shopId/orders/:orderId
//   POST .../:orderId/accept          body: { promise: "1h"|"3h"|"6h" }   agree to fulfil
//   POST .../:orderId/reject          body: { reason }
//   POST .../:orderId/dispatch        body: { code }                      the order has left the shop
//   POST .../:orderId/confirm-return                                      the buyer's rejected item came back
//   POST .../:orderId/report          body: { reason, details }           the review form after the 24-hour window
import { Router } from 'express';
import { z } from 'zod';
import { requireSeller } from '../middleware/sellerAuth.js';
import { orderIdParam, requireOwnShop } from '../middleware/shopAccess.js';
import {
  SELLER_REJECT_REASONS, getShopOrder, listShopOrders, sellerAccept, sellerConfirmReturn, sellerDispatch, sellerReject, submitReport,
} from '../services/order.service.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router({ mergeParams: true });
router.use(requireSeller, requireOwnShop);
const acts = limiter(300, 'Too many requests. Please wait a few minutes and try again.');

const acceptSchema = z.object({ promise: z.enum(['1h', '3h', '6h'], 'Choose when the order will be ready.') });
const rejectSchema = z.object({ reason: z.enum(SELLER_REJECT_REASONS, 'Choose a reason.') });
const codeSchema = z.object({ code: z.string('Enter the 6-digit code.').regex(/^\d{6}$/, 'Enter the 6-digit code.') });
const reportSchema = z.object({ reason: z.string('Choose a reason.'), details: z.string('Please tell us what happened in a few words.') });

router.get('/orders', handle(async (req, res) => res.json(await listShopOrders(req.shop.id))));
router.get('/orders/:orderId', handle(async (req, res) => res.json(await getShopOrder(req.shop.id, orderIdParam(req)))));

router.post('/orders/:orderId/accept', acts, handle(async (req, res) => {
  const { promise } = parseBody(acceptSchema, req.body, 'Choose when the order will be ready.');
  res.json(await sellerAccept(req.shop.id, orderIdParam(req), promise));
}));
router.post('/orders/:orderId/reject', acts, handle(async (req, res) => {
  const { reason } = parseBody(rejectSchema, req.body, 'Choose a reason.');
  res.json(await sellerReject(req.shop.id, orderIdParam(req), reason));
}));
router.post('/orders/:orderId/dispatch', acts, handle(async (req, res) => {
  const { code } = parseBody(codeSchema, req.body);
  res.json(await sellerDispatch(req.shop.id, orderIdParam(req), code));
}));
router.post('/orders/:orderId/confirm-return', acts, handle(async (req, res) => {
  res.json(await sellerConfirmReturn(req.shop.id, orderIdParam(req)));
}));
router.post('/orders/:orderId/report', acts, handle(async (req, res) => {
  res.json(await submitReport('seller', req.shop.id, orderIdParam(req), parseBody(reportSchema, req.body)));
}));

export default router;
