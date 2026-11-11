// The "unfulfilled orders in a row" rule. Same rule as the frontend (src/lib/strikes.js).
//
// An order is UNFULFILLED when the seller is at fault:
//   - the seller never answered a paid order in time,
//   - the seller agreed to fulfil it and then rejected it, or
//   - the seller agreed, never dispatched, and the 24-hour window ended
//     (unless support later rules in the seller's favour: then it is completed).
// A COMPLETED order is fulfilled and resets the count. Anything else is neutral.
import { ACCEPT_WINDOW_SECONDS, WINDOW_SECONDS } from './orderRules.js';

export const STRIKE_LIMIT = 3;

// o: { status, unanswered, rejected_by, seller_confirmed, paid_ms, accepted_ms }. Returns 'ok', 'fail' or null.
export function orderOutcome(o, nowMs = Date.now()) {
  if (o.status === 'completed') return 'ok';
  if (o.unanswered) return 'fail';
  if (o.status === 'pending') return nowMs > o.paid_ms + ACCEPT_WINDOW_SECONDS * 1000 ? 'fail' : null;
  if (o.rejected_by === 'seller') return o.accepted_ms ? 'fail' : null;
  const neverDispatched = Boolean(o.accepted_ms) && !o.seller_confirmed;
  if (neverDispatched && o.status === 'refunded') return 'fail';
  if (neverDispatched && o.status === 'accepted' && nowMs > o.accepted_ms + WINDOW_SECONDS * 1000) return 'fail';
  return null;
}

// orders must be oldest first.
export function streakOf(orders, nowMs = Date.now()) {
  let failedIds = [];
  for (const o of orders) {
    const result = orderOutcome(o, nowMs);
    if (result === 'ok') failedIds = [];
    else if (result === 'fail') failedIds.push(o.id);
  }
  return { streak: failedIds.length, failedIds };
}
