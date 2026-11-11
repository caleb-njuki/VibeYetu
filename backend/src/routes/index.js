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
import checkoutRoutes from './checkout.routes.js';
import buyerOrdersRoutes from './buyerOrders.routes.js';
import sellerOrdersRoutes from './sellerOrders.routes.js';
import ratingsRoutes from './ratings.routes.js';
import assistantRoutes from './assistant.routes.js';
import adminAuthRoutes from './adminAuth.routes.js';
import adminRoutes from './admin.routes.js';
import sellerSuspensionRoutes from './sellerSuspension.routes.js';
import { buyerNotificationRoutes, sellerNotificationRoutes } from './notifications.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth/buyer', buyerAuthRoutes);
router.use('/auth/seller', sellerAuthRoutes);
router.use('/auth/admin', adminAuthRoutes);
router.use('/admin', adminRoutes);
router.use('/seller/shops', sellerShopsRoutes);
router.use('/seller/shops/:shopId', sellerProductsRoutes);
router.use('/seller/shops/:shopId', sellerOrdersRoutes);
router.use('/seller/shops/:shopId', sellerNotificationRoutes);
router.use('/seller/shops/:shopId', sellerSuspensionRoutes);
router.use('/favourites', favouritesRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/orders', buyerOrdersRoutes);
router.use('/notifications', buyerNotificationRoutes);
router.use('/', ratingsRoutes);
router.use('/assistant', assistantRoutes);
router.use('/', lookupRoutes);
router.use('/', publicRoutes);

export default router;
