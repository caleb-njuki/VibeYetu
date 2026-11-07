// Every API route is listed here. app.js mounts this whole list under /api.
// A new feature adds one line below.
import { Router } from 'express';
import healthRoutes from './health.routes.js';
import buyerAuthRoutes from './buyerAuth.routes.js';
import sellerAuthRoutes from './sellerAuth.routes.js';
import sellerShopsRoutes from './sellerShops.routes.js';
import sellerProductsRoutes from './sellerProducts.routes.js';
import favouritesRoutes from './favourites.routes.js';
import lookupRoutes from './lookup.routes.js';
import publicRoutes from './public.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth/buyer', buyerAuthRoutes);
router.use('/auth/seller', sellerAuthRoutes);
router.use('/seller/shops', sellerShopsRoutes);
router.use('/seller/shops/:shopId', sellerProductsRoutes);
router.use('/favourites', favouritesRoutes);
router.use('/', lookupRoutes);
router.use('/', publicRoutes);

export default router;
