// A shop's ads. Needs the seller's token, and the shop must be the seller's own.
//   GET  /api/seller/shops/:shopId/ads
//   POST /api/seller/shops/:shopId/ads
//        body: { headline (5-40), subtext? (max 90), image? (a photo id from the upload signature route), darken?,
//                headlineColor, subtextColor ("#rrggbb"), target: "shop"|"product", productId?, days: 1|3|7|14 }
//        The price is worked out here (KES 20 a day). The payment is simulated for now.
//   POST /api/seller/shops/:shopId/ads/:adId/stop
import { Router } from 'express';
import { z } from 'zod';
import { requireSeller } from '../middleware/sellerAuth.js';
import { requireOwnShop } from '../middleware/shopAccess.js';
import { createAd, listShopAds, stopShopAd } from '../services/ad.service.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router({ mergeParams: true });
router.use(requireSeller, requireOwnShop);

const schema = z.object({
  headline: z.string('The headline must have 5 to 40 characters.'),
  subtext: z.string().optional(),
  image: z.string().max(200).optional(),
  darken: z.boolean().optional(),
  headlineColor: z.string('The text colour is not valid.'),
  subtextColor: z.string('The text colour is not valid.'),
  target: z.enum(['shop', 'product'], 'Choose where the ad should lead.'),
  productId: z.union([z.string(), z.number()]).transform(String).optional(),
  days: z.number('Choose how many days the ad runs.').int('Choose how many days the ad runs.'),
});

router.get('/ads', handle(async (req, res) => res.json(await listShopAds(req.shop.id))));
router.post('/ads', limiter(20, 'Too many ads. Please wait a few minutes.'), handle(async (req, res) => {
  res.status(201).json(await createAd(req.shop.id, parseBody(schema, req.body)));
}));
router.post('/ads/:adId/stop', handle(async (req, res) => res.json(await stopShopAd(req.shop.id, req.params.adId))));

export default router;
