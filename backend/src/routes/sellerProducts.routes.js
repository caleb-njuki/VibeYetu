// A seller's products, inside one of their shops. Needs the seller's token.
//   GET    /api/seller/shops/:shopId/products
//   POST   /api/seller/shops/:shopId/products
//   PATCH  /api/seller/shops/:shopId/products/:productId     (send only what changes; "active": false hides it)
//   DELETE /api/seller/shops/:shopId/products/:productId
//   POST   /api/seller/shops/:shopId/images/signature         (permission to upload one photo to Cloudinary)
import { Router } from 'express';
import { z } from 'zod';
import { requireSeller } from '../middleware/sellerAuth.js';
import { getOwnedShop } from '../services/seller.service.js';
import { listShopProducts, createProduct, updateProduct, deleteProduct } from '../services/product.service.js';
import { createUploadSignature } from '../services/cloudinary.service.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';
import { httpError } from '../utils/httpError.js';

const router = Router({ mergeParams: true });
router.use(requireSeller);

// Every route here works on one shop, and the shop must belong to the logged-in seller.
router.use(
  handle(async (req, res, next) => {
    if (!/^\d+$/.test(req.params.shopId)) throw httpError(404, 'Shop not found.');
    const shop = await getOwnedShop(req.seller.id, req.params.shopId);
    if (!shop) throw httpError(404, 'Shop not found.');
    req.shop = shop;
    next();
  })
);

const whole = (message) => z.number(message).int(message);

const productFields = {
  name: z.string(),
  price: whole('Enter a price in whole shillings, like 1500.'),
  stock: whole('Enter the stock as a whole number, 0 or more.').optional(),
  sizeType: z.enum(['none', 'clothing', 'shoes'], 'Choose a size type.').optional(),
  sizes: z.record(z.string(), z.number('Enter the stock for each size as a whole number.')).nullable().optional(),
  category: z.string(),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  active: z.boolean().optional(),
};

const createSchema = z.object(productFields);
const updateSchema = z.object(productFields).partial();

// A product id in the address must be a number.
function productId(req) {
  if (!/^\d+$/.test(req.params.productId)) throw httpError(404, 'This product no longer exists.');
  return req.params.productId;
}

router.get(
  '/products',
  handle(async (req, res) => {
    res.json({ products: await listShopProducts(req.shop.id) });
  })
);

router.post(
  '/products',
  handle(async (req, res) => {
    const input = parseBody(createSchema, req.body, 'Please fill in the product name, price and category.');
    res.status(201).json({ product: await createProduct(req.shop.id, input) });
  })
);

router.patch(
  '/products/:productId',
  handle(async (req, res) => {
    const id = productId(req);
    const changes = parseBody(updateSchema, req.body);
    res.json({ product: await updateProduct(req.shop.id, id, changes) });
  })
);

router.delete(
  '/products/:productId',
  handle(async (req, res) => {
    await deleteProduct(req.shop.id, productId(req));
    res.json({ message: 'Product deleted.' });
  })
);

router.post(
  '/images/signature',
  limiter(60, 'Too many photo uploads. Please try again later.'),
  handle(async (req, res) => {
    res.json(createUploadSignature(req.shop.id));
  })
);

export default router;
