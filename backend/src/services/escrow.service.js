// The escrow ledger. Money in, money out, each exactly once.
// Every function here must be called inside a transaction that already holds the lock on the order row.
import { formatKES, platformFee, refundAmount } from '../utils/orderRules.js';
import { restockOrder } from './stock.service.js';

export async function addEvent(client, orderId, buyerText, sellerText, notify = null) {
  await client.query('INSERT INTO order_events (order_id, buyer_text, seller_text, notify) VALUES ($1, $2, $3, $4)', [
    orderId,
    buyerText,
    sellerText ?? buyerText,
    notify,
  ]);
}

async function ledger(client, orderId, kind, amount, note) {
  if (amount <= 0) return;
  // UNIQUE (order_id, kind): if this ever ran twice, the database refuses the second time.
  await client.query('INSERT INTO ledger_entries (order_id, kind, amount, note) VALUES ($1, $2, $3, $4)', [
    orderId,
    kind,
    amount,
    note,
  ]);
}

export const holdPayment = (client, order) => ledger(client, order.id, 'escrow_in', order.total, 'Payment received');

// Money goes back to the buyer. The delivery fee stays with the seller if the item had already left.
export async function refundOrder(client, order, { unanswered = false, extraEvents = [] } = {}) {
  const amount = unanswered ? order.total : refundAmount(order);
  const remainder = order.total - amount;
  await ledger(client, order.id, 'refund_out', amount, unanswered ? 'Seller did not answer' : 'Refund to buyer');
  await ledger(client, order.id, 'seller_out', remainder, 'Delivery fee kept by the seller');
  await client.query(
    `UPDATE orders SET status = 'refunded', refund_amount = $2, unanswered = $3, updated_at = now() WHERE id = $1`,
    [order.id, amount, unanswered]
  );
  // Items that never left the shop go back on the shelf.
  if (unanswered || !order.seller_confirmed) await restockOrder(client, order.id);

  if (unanswered) {
    await addEvent(
      client,
      order.id,
      `The seller did not respond in time. Your full payment of ${formatKES(order.total)} was refunded to the account you paid from.`,
      `You did not respond to this order in time. The buyer was refunded ${formatKES(order.total)}. This counts as an unfulfilled order.`,
      'both'
    );
  } else {
    const note = amount < order.total ? ' The delivery fee is not refunded.' : '';
    for (const [b, s, n] of extraEvents) await addEvent(client, order.id, b, s, n);
    await addEvent(
      client,
      order.id,
      `Refund of ${formatKES(amount)} sent to the account you paid from.${note}`,
      `Order refunded to the buyer (${formatKES(amount)}).`,
      'both'
    );
  }
  return amount;
}

// Money goes to the seller, minus VibeYetu's fee (taken from the item total; delivery is the seller's in full).
export async function releaseOrder(client, order) {
  const fee = platformFee(order.subtotal, order.fee_percent);
  await ledger(client, order.id, 'seller_out', order.total - fee, 'Payout to seller');
  await ledger(client, order.id, 'fee_out', fee, `Service fee ${order.fee_percent}%`);
  await client.query(`UPDATE orders SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = $1`, [
    order.id,
  ]);
  return { fee, payout: order.total - fee };
}
