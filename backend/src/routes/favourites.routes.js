// A logged-in buyer's saved products. Needs the buyer's token.
//   GET    /api/favourites            (add ?lat=&lng=&radiusKm= to get distances)
//   PUT    /api/favourites/:productId   save a product
//   DELETE /api/favourites/:productId   remove it
import { Router } from 'express';
import { requireBuyer } from '../middleware/auth.js';
import { listFavourites, addFavourite, removeFavourite } from '../services/public.service.js';
import { parseNear } from '../utils/near.js';
import { handle } from '../utils/routeHelpers.js';

const router = Router();
router.use(requireBuyer);

router.get(
  '/',
  handle(async (req, res) => {
    res.json({ products: await listFavourites(req.buyer.id, parseNear(req.query)) });
  })
);

router.put(
  '/:productId',
  handle(async (req, res) => {
    await addFavourite(req.buyer.id, req.params.productId);
    res.json({ favourite: true });
  })
);

router.delete(
  '/:productId',
  handle(async (req, res) => {
    await removeFavourite(req.buyer.id, req.params.productId);
    res.json({ favourite: false });
  })
);

export default router;
