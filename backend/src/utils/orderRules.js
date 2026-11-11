// The order and escrow rules. Same numbers and wording as the frontend (src/lib/orders.js, fees.js).

// VibeYetu's service fee. The seller pays it, out of the item total. Buyers are never charged extra.
// The delivery fee goes to the seller in full. Each order remembers the fee it was placed under.
export const PLATFORM_FEE_PERCENT = 5.5;

export const MAX_QTY_PER_ITEM = 10; // the cart limit
export const ACCEPT_WINDOW_SECONDS = 60 * 60; // a seller has 1 hour to answer a paid order
export const WINDOW_SECONDS = 24 * 60 * 60; // 24 hours to finish the code steps once the seller agrees
export const UNPAID_EXPIRY_SECONDS = 15 * 60; // an unpaid checkout is cancelled after 15 minutes
export const MAX_OPEN_CHECKOUTS = 5; // unpaid checkouts one buyer may have at a time

// When the seller agrees, they say when the order will be with the buyer.
export const PROMISES = { '1h': 60 * 60, '3h': 3 * 60 * 60, '6h': 6 * 60 * 60 };

// Whole shillings, rounded to the nearest one.
export function platformFee(subtotal, percent = PLATFORM_FEE_PERCENT) {
  const n = Number(subtotal);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round((n * Number(percent)) / 100);
}

// The delivery fee is refunded only when nothing was dispatched.
export const refundAmount = (order) =>
  order.rejected_by === 'seller' || !order.seller_confirmed ? order.total : order.subtotal;

export const formatKES = (amount) => `KES ${Number(amount).toLocaleString('en-KE')}`;

export const formatSize = (type, size) => (!size ? '' : type === 'shoes' ? `EU ${size}` : String(size));

export const formatWhen = (date) =>
  new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nairobi' }).format(
    new Date(date)
  );
