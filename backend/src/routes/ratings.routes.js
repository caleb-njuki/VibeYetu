// Ratings.
//   GET  /api/products/:id/reviews?limit=&offset=     public: stars, comment, date (no names)
//   GET  /api/shops/:id/reviews?limit=&offset=        public
//   POST /api/orders/:orderId/rating       buyer, after the order is completed
//        body: { kind:"shop" }  or  { kind:"product", productId }  plus  { stars:1-5, comment? (max 200) }
//   POST /api/orders/:orderId/rating-skip  buyer pressed "Skip"
import { Router } from 'express';
import { z } from 'zod';
import { requireBuyer } from '../middleware/auth.js';
import { orderIdParam } from '../middleware/shopAccess.js';
import { listReviews, rateOrder, skipRating } from '../services/rating.service.js';
import { parsePaging } from '../utils/near.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router();

const ratingSchema = z.object({
  kind: z.enum(['shop', 'product'], 'Choose what you are rating.'),
  productId: z.union([z.string(), z.number()]).transform(String).optional(),
  stars: z.number('Tap a star to rate.').int('Tap a star to rate.').min(1, 'Tap a star to rate.').max(5, 'Tap a star to rate.'),
  comment: z.string().max(400).optional(),
});

router.get('/products/:id/reviews', handle(async (req, res) => {
  const { limit, offset } = parsePaging(req.query);
  res.json(await listReviews('product', req.params.id, Math.min(limit, 50), offset));
}));
router.get('/shops/:id/reviews', handle(async (req, res) => {
  const { limit, offset } = parsePaging(req.query);
  res.json(await listReviews('shop', req.params.id, Math.min(limit, 50), offset));
}));

router.post('/orders/:orderId/rating', requireBuyer, limiter(100, 'Too many requests. Please wait a few minutes and try again.'), handle(async (req, res) => {
  const body = parseBody(ratingSchema, req.body);
  res.status(201).json(await rateOrder(req.buyer.id, orderIdParam(req), body));
}));
router.post('/orders/:orderId/rating-skip', requireBuyer, handle(async (req, res) => {
  res.json(await skipRating(req.buyer.id, orderIdParam(req)));
}));

export default router;
