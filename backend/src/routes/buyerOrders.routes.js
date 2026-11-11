// A buyer's orders. Needs the buyer's token.
//   GET  /api/orders                       all my orders (newest first) + serverTime
//   GET  /api/orders/:orderId
//   POST /api/orders/:orderId/confirm      body: { code }     I received it: releases the payment to the seller
//   POST /api/orders/:orderId/reject       body: { reason }   I reject the item (after dispatch)
//   POST /api/orders/:orderId/refund                          ask for my money back (after a rejection)
//   POST /api/orders/:orderId/report       body: { reason, details }   the review form after the 24-hour window
import { Router } from 'express';
import { z } from 'zod';
import { requireBuyer } from '../middleware/auth.js';
import { orderIdParam } from '../middleware/shopAccess.js';
import {
  BUYER_REJECT_REASONS, buyerConfirm, buyerReject, buyerRequestRefund, getBuyerOrder, listBuyerOrders, submitReport,
} from '../services/order.service.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router();
router.use(requireBuyer);
const acts = limiter(200, 'Too many requests. Please wait a few minutes and try again.');

const codeSchema = z.object({ code: z.string('Enter your 6-digit code.').regex(/^\d{6}$/, 'Enter your 6-digit code.') });
const rejectSchema = z.object({ reason: z.enum(BUYER_REJECT_REASONS, 'Choose a reason.') });
const reportSchema = z.object({ reason: z.string('Choose a reason.'), details: z.string('Please tell us what happened in a few words.') });

router.get('/', handle(async (req, res) => res.json(await listBuyerOrders(req.buyer.id))));
router.get('/:orderId', handle(async (req, res) => res.json(await getBuyerOrder(req.buyer.id, orderIdParam(req)))));

router.post('/:orderId/confirm', acts, handle(async (req, res) => {
  const { code } = parseBody(codeSchema, req.body);
  res.json(await buyerConfirm(req.buyer.id, orderIdParam(req), code));
}));
router.post('/:orderId/reject', acts, handle(async (req, res) => {
  const { reason } = parseBody(rejectSchema, req.body, 'Choose a reason.');
  res.json(await buyerReject(req.buyer.id, orderIdParam(req), reason));
}));
router.post('/:orderId/refund', acts, handle(async (req, res) => {
  res.json(await buyerRequestRefund(req.buyer.id, orderIdParam(req)));
}));
router.post('/:orderId/report', acts, handle(async (req, res) => {
  res.json(await submitReport('buyer', req.buyer.id, orderIdParam(req), parseBody(reportSchema, req.body)));
}));

export default router;
