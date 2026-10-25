// VibeYetu's service fee. The seller pays it. Buyers are never charged extra.
// It is taken from the item total when the buyer confirms and the money is released.
// The delivery fee goes to the seller in full. The backend reads this same rate later.
export const PLATFORM_FEE_PERCENT = 1.5;
export const FEE_LABEL = `${PLATFORM_FEE_PERCENT}%`;

// Whole shillings, rounded to the nearest one.
export function platformFee(subtotal) {
  const n = Number(subtotal);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round((n * PLATFORM_FEE_PERCENT) / 100);
}

// What the seller keeps from the items after the fee.
export const netAfterFee = (subtotal) => (Number(subtotal) || 0) - platformFee(subtotal);

// The money picture for one order, from the seller's side.
// A refunded order has no fee, so callers only show this for orders that can still pay out.
export function payoutBreakdown(order) {
  const items = Number(order?.subtotal) || 0;
  const delivery = Number(order?.deliveryFee) || 0;
  const fee = platformFee(items);
  return { items, fee, delivery, net: items - fee + delivery };
}
