// What buyers see. No login needed. Add the buyer's place to any of them with
//   ?lat=-1.2864&lng=36.8172&radiusKm=15
//   GET /api/home
//   GET /api/products?q=dress&category=fashion&sort=relevance|price-asc|price-desc|rating&limit=60&offset=0
//   GET /api/products/:id
//   GET /api/products/:id/related
//   GET /api/shops/:id
import { Router } from 'express';
import { getHome, searchProducts, getProduct, getRelated, getShop } from '../services/public.service.js';
import { parseNear, parsePaging } from '../utils/near.js';
import { handle } from '../utils/routeHelpers.js';
import { httpError } from '../utils/httpError.js';

const router = Router();

const text = (value) => (typeof value === 'string' ? value : '');

router.get(
  '/home',
  handle(async (req, res) => {
    res.json(await getHome(parseNear(req.query)));
  })
);

router.get(
  '/products',
  handle(async (req, res) => {
    const result = await searchProducts({
      q: text(req.query.q),
      category: text(req.query.category),
      sort: text(req.query.sort) || 'relevance',
      near: parseNear(req.query),
      ...parsePaging(req.query),
    });
    res.json(result);
  })
);

router.get(
  '/products/:id',
  handle(async (req, res) => {
    const product = await getProduct(req.params.id, parseNear(req.query));
    if (!product) throw httpError(404, 'This product is not available.');
    res.json({ product });
  })
);

router.get(
  '/products/:id/related',
  handle(async (req, res) => {
    const related = await getRelated(req.params.id, parseNear(req.query));
    if (!related) throw httpError(404, 'This product is not available.');
    res.json(related);
  })
);

router.get(
  '/shops/:id',
  handle(async (req, res) => {
    const shop = await getShop(req.params.id, parseNear(req.query));
    if (!shop) throw httpError(404, 'This shop is not available.');
    res.json({ shop });
  })
);

export default router;
