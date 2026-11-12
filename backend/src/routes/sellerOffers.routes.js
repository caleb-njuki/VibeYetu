// A shop's offers (percentage discounts). Needs the seller's token, and the shop must be the seller's own.
//   GET    /api/seller/shops/:shopId/offers
//   POST   /api/seller/shops/:shopId/offers
//          body: { name (3-40), percent (5-70), productIds: "all" | [ids], startsAt, endsAt }   times in milliseconds
//   POST   /api/seller/shops/:shopId/offers/:offerId/toggle     pause or resume
//   DELETE /api/seller/shops/:shopId/offers/:offerId
import { Router } from 'express';
import { z } from 'zod';
import { requireSeller } from '../middleware/sellerAuth.js';
import { requireOwnShop } from '../middleware/shopAccess.js';
import { createOffer, deleteOffer, listShopOffers, toggleOffer } from '../services/offer.service.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router({ mergeParams: true });
router.use(requireSeller, requireOwnShop);

const schema = z.object({
  name: z.string('Give the offer a name, like Weekend sale.'),
  percent: z.number('The discount must be a whole number from 5 to 70.'),
  productIds: z.union([z.literal('all'), z.array(z.union([z.string(), z.number()]).transform(String))], 'Choose which products the offer applies to.'),
  startsAt: z.number('Choose when the offer starts.'),
  endsAt: z.number('Choose when the offer ends.'),
});

router.get('/offers', handle(async (req, res) => res.json(await listShopOffers(req.shop.id))));
router.post('/offers', limiter(30, 'Too many offers. Please wait a few minutes.'), handle(async (req, res) => {
  res.status(201).json(await createOffer(req.shop.id, parseBody(schema, req.body)));
}));
router.post('/offers/:offerId/toggle', handle(async (req, res) => res.json(await toggleOffer(req.shop.id, req.params.offerId))));
router.delete('/offers/:offerId', handle(async (req, res) => res.json(await deleteOffer(req.shop.id, req.params.offerId))));

export default router;
