// For routes inside /api/seller/shops/:shopId/... : checks the shop belongs to the logged-in seller.
import { getOwnedShop } from '../services/seller.service.js';
import { httpError } from '../utils/httpError.js';
import { handle } from '../utils/routeHelpers.js';

export const requireOwnShop = handle(async (req, res, next) => {
  if (!/^\d+$/.test(req.params.shopId)) throw httpError(404, 'Shop not found.');
  const shop = await getOwnedShop(req.seller.id, req.params.shopId);
  if (!shop) throw httpError(404, 'Shop not found.');
  req.shop = shop;
  next();
});

// An order id in the address looks like VY-4KQ9ZD.
export function orderIdParam(req) {
  if (!/^VY-[A-Z0-9]{6}$/.test(req.params.orderId)) throw httpError(404, 'Order not found.');
  return req.params.orderId;
}
