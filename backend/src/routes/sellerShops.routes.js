// The logged-in seller's own shops.
//   GET   /api/seller/shops        list my shops
//   POST  /api/seller/shops        open a branch
//   PATCH /api/seller/shops/:id    edit a shop (send only what changes)
import { Router } from 'express';
import { z } from 'zod';
import { requireSeller } from '../middleware/sellerAuth.js';
import { listOwnShops, createShop, updateShop } from '../services/seller.service.js';
import { handle, parseBody } from '../utils/routeHelpers.js';
import { httpError } from '../utils/httpError.js';

const router = Router();
router.use(requireSeller);

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a time like 08:00.');

const createSchema = z.object({
  name: z.string(),
  areaId: z.string(),
  description: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  areaId: z.string().optional(),
  opens: time.optional(),
  closes: time.optional(),
  fulfillment: z.array(z.enum(['delivery', 'pickup'])).optional(),
  deliveryFee: z
    .number('Enter the delivery fee in whole shillings, for example 200.')
    .int('Enter the delivery fee in whole shillings, for example 200.')
    .min(0, 'The delivery fee cannot be below 0.')
    .max(1000, 'The delivery fee can be at most KES 1,000.')
    .nullable()
    .optional(),
  phone: z.string().optional(),
  photo: z.string().min(1).max(200).nullable().optional(), // a photo id from the upload signature route; null removes it
});

router.get(
  '/',
  handle(async (req, res) => {
    res.json({ shops: await listOwnShops(req.seller.id) });
  })
);

router.post(
  '/',
  handle(async (req, res) => {
    const input = parseBody(createSchema, req.body, 'Enter a shop name and choose an area.');
    res.status(201).json({ shop: await createShop(req.seller.id, input) });
  })
);

router.patch(
  '/:id',
  handle(async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) throw httpError(404, 'Shop not found.');
    const changes = parseBody(updateSchema, req.body);
    res.json({ shop: await updateShop(req.seller.id, req.params.id, changes) });
  })
);

export default router;
