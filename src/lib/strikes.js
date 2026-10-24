// The "unfulfilled orders in a row" rule. Pure functions, so the backend can reuse the same logic.
//
// An order counts as UNFULFILLED when the seller is at fault:
//   - the seller never answered a paid order in time,
//   - the seller agreed to fulfil it and then rejected it, or
//   - the seller agreed, never dispatched, and the 24-hour window ended
//     (unless support later rules in the seller's favour, then it is fulfilled).
// A COMPLETED order is fulfilled and resets the count.
// Everything else (rejected before agreeing, buyer rejected the item, still in progress)
// is neutral: it neither adds to the count nor resets it.
import { ACCEPT_WINDOW_MS, WINDOW_MS } from "./orders.js";

export const STRIKE_LIMIT = 3;

export function orderOutcome(o, now = Date.now()) {
  if (o.status === "completed") return "ok";
  if (o.unanswered) return "fail";
  if (o.status === "pending") return now > o.createdAt + ACCEPT_WINDOW_MS ? "fail" : null;
  if (o.rejectedBy === "seller") return o.acceptedAt ? "fail" : null;
  const neverDispatched = Boolean(o.acceptedAt) && !o.sellerConfirmed;
  if (neverDispatched && o.status === "refunded") return "fail";
  if (neverDispatched && o.status === "accepted" && now > o.acceptedAt + WINDOW_MS) return "fail";
  return null;
}

// `since` is when the shop was last reinstated, so a fresh start does not inherit old failures.
export function shopStrikes(orders, shopId, now = Date.now(), since = 0) {
  const mine = orders
    .filter((o) => o.shopId === shopId && o.createdAt > since)
    .sort((a, b) => a.createdAt - b.createdAt);
  let failedIds = [];
  for (const o of mine) {
    const result = orderOutcome(o, now);
    if (result === "ok") failedIds = [];
    else if (result === "fail") failedIds.push(o.id);
  }
  return { streak: failedIds.length, failedIds, limit: STRIKE_LIMIT, left: Math.max(0, STRIKE_LIMIT - failedIds.length) };
}
