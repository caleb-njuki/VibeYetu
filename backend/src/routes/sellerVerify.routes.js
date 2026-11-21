// A shop verifies itself. Needs the seller's token, and the shop must be the seller's own.
//   GET  /api/seller/shops/:shopId/verification  -> { verified, blocked, ready, checks:[{id,label,ok,where}], warning }
//   POST /api/seller/shops/:shopId/verify         works only when every check is ok. -> the same as GET
import { Router } from 'express';
import { requireSeller } from '../middleware/sellerAuth.js';
import { requireOwnShop } from '../middleware/shopAccess.js';
import { getVerification, verifyShop } from '../services/verification.service.js';
import { handle, limiter } from '../utils/routeHelpers.js';

const router = Router({ mergeParams: true });
router.use(requireSeller, requireOwnShop);

router.get('/verification', handle(async (req, res) => res.json(await getVerification(req.shop.id))));
router.post('/verify', limiter(30, 'Too many tries. Please wait a few minutes.'), handle(async (req, res) => res.json(await verifyShop(req.shop.id))));

export default router;
