// Public lists the sign-up and shop screens need. No login required.
//   GET /api/areas
//   GET /api/shop-names/check?name=Nairobi%20Threads&ignoreShopId=12
import { Router } from 'express';
import { listAreas, checkShopName } from '../services/seller.service.js';
import { handle, limiter } from '../utils/routeHelpers.js';

const router = Router();

router.get(
  '/areas',
  handle(async (req, res) => {
    res.json({ areas: await listAreas() });
  })
);

router.get(
  '/shop-names/check',
  limiter(120, 'Too many name checks. Please try again later.'),
  handle(async (req, res) => {
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    const ignore = typeof req.query.ignoreShopId === 'string' ? req.query.ignoreShopId : undefined;
    res.json(await checkShopName(name, ignore));
  })
);

export default router;
