// A buyer checks out and pays. Needs the buyer's token.
//   POST /api/checkout                 body: { items:[{productId,qty,size?}], modes:{shopId:"delivery"|"pickup"}, contact:{name,phone,area?,street?} }
//                                      -> holds the stock and returns the checkout (one order per shop)
//   POST /api/checkout/:groupId/pay    body: { method:"mpesa"|"card", phone? }   (payment is simulated for now)
import { Router } from 'express';
import { z } from 'zod';
import { requireBuyer } from '../middleware/auth.js';
import { createCheckout, payCheckout } from '../services/order.service.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';
import { httpError } from '../utils/httpError.js';

const router = Router();
router.use(requireBuyer);

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.union([z.string(), z.number()]).transform(String),
        qty: z.number('Enter a quantity from 1 to 10.').int('Enter a quantity from 1 to 10.').min(1, 'Enter a quantity from 1 to 10.').max(10, 'You can order at most 10 of one item.'),
        size: z.string().max(20).optional(),
      }),
      'Your cart is empty.'
    )
    .min(1, 'Your cart is empty.')
    .max(50, 'Your cart has too many items.'),
  modes: z.record(z.string(), z.enum(['delivery', 'pickup'])).optional(),
  contact: z.object({
    name: z.string('Enter your name.'),
    phone: z.string('Enter a phone number the seller can reach you on.'),
    area: z.string().optional(),
    street: z.string().optional(),
  }, 'Enter your name and a phone number the seller can reach you on.'),
});

const paySchema = z.object({
  method: z.enum(['mpesa', 'card'], 'Choose how to pay.'),
  phone: z.string().optional(),
});

router.post(
  '/',
  limiter(40, 'Too many checkouts. Please wait a few minutes and try again.'),
  handle(async (req, res) => {
    const body = parseBody(checkoutSchema, req.body);
    res.status(201).json({ checkout: await createCheckout(req.buyer.id, body) });
  })
);

router.post(
  '/:groupId/pay',
  limiter(40, 'Too many payment attempts. Please wait a few minutes and try again.'),
  handle(async (req, res) => {
    if (!/^G-[A-Z0-9]{6}$/.test(req.params.groupId)) throw httpError(404, 'Checkout not found.');
    const body = parseBody(paySchema, req.body);
    res.json(await payCheckout(req.buyer.id, req.params.groupId, body));
  })
);

export default router;
