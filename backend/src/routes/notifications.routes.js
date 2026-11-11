// The notification bell.
//   Buyer:   GET  /api/notifications                        POST /api/notifications/read
//   Seller:  GET  /api/seller/shops/:shopId/notifications   POST /api/seller/shops/:shopId/notifications/read
//   The read body is { ids:["e12","VY-AB12CD:expired"] } or { all:true }.
//   Each item: { id, orderId, at, text, read, href? }. The reply also has unreadCount.
import { Router } from 'express';
import { z } from 'zod';
import { requireBuyer } from '../middleware/auth.js';
import { requireSeller } from '../middleware/sellerAuth.js';
import { requireOwnShop } from '../middleware/shopAccess.js';
import { listNotifications, markNotificationsRead } from '../services/notification.service.js';
import { handle, parseBody } from '../utils/routeHelpers.js';
import { httpError } from '../utils/httpError.js';

const readSchema = z.object({
  ids: z.array(z.string().regex(/^(e\d{1,18}|n\d{1,18}|VY-[A-Z0-9]{6}:expired)$/, 'That notification is not valid.')).max(100).optional(),
  all: z.boolean().optional(),
});

function readBody(body) {
  const data = parseBody(readSchema, body);
  if (!data.all && !data.ids?.length) throw httpError(400, 'Choose which notifications to mark as read.');
  return data;
}

export const buyerNotificationRoutes = Router();
buyerNotificationRoutes.use(requireBuyer);
buyerNotificationRoutes.get('/', handle(async (req, res) => res.json(await listNotifications('buyer', req.buyer.id))));
buyerNotificationRoutes.post('/read', handle(async (req, res) => res.json(await markNotificationsRead('buyer', req.buyer.id, readBody(req.body)))));

export const sellerNotificationRoutes = Router({ mergeParams: true });
sellerNotificationRoutes.use(requireSeller, requireOwnShop);
sellerNotificationRoutes.get('/notifications', handle(async (req, res) => res.json(await listNotifications('seller', req.shop.id))));
sellerNotificationRoutes.post('/notifications/read', handle(async (req, res) => res.json(await markNotificationsRead('seller', req.shop.id, readBody(req.body)))));
