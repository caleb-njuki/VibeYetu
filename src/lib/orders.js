export const WINDOW_MS = 24 * 60 * 60 * 1000; // time to finish the code steps
export const SUPPORT_MS = 72 * 60 * 60 * 1000; // support decision deadline
export const ACCEPT_WINDOW_MS = 60 * 60 * 1000; // time a seller has to answer a new paid order

export const PROMISES = [
  { id: "1h", label: "Within 1 hour", ms: 60 * 60 * 1000 },
  { id: "3h", label: "Within 3 hours", ms: 3 * 60 * 60 * 1000 },
  { id: "6h", label: "Same day (within 6 hours)", ms: 6 * 60 * 60 * 1000 },
];

export const STATUS = {
  pending: { label: "Awaiting seller", tone: "amber" },
  accepted: { label: "Seller preparing", tone: "blue" },
  dispatched: { label: "On the way", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
  rejected: { label: "Order rejected", tone: "red" },
  refunded: { label: "Refunded", tone: "green" },
  review: { label: "Under review", tone: "amber" },
};

export const TONES = {
  amber: "bg-amber-100 text-amber-900",
  blue: "bg-vibe-light text-vibe-dark",
  green: "bg-green-100 text-green-900",
  red: "bg-red-100 text-red-800",
};

// If 24 hours pass after the seller accepts and the order is not finished,
// it moves to review (both sides answer a form, support decides).
export function getStatus(order, now) {
  const open = order.status === "accepted" || order.status === "dispatched";
  if (open && order.acceptedAt && now > order.acceptedAt + WINDOW_MS) return "review";
  return order.status;
}

// The delivery fee is refunded only when nothing was dispatched.
export function refundAmount(order) {
  return order.rejectedBy === "seller" || !order.sellerConfirmed ? order.total : order.subtotal;
}

// A paid order the seller has not answered by this time is refunded in full.
export function acceptDeadline(order) {
  return order.createdAt + ACCEPT_WINDOW_MS;
}

export function supportDeadline(order) {
  return order.acceptedAt + WINDOW_MS + SUPPORT_MS;
}

export function sellerAction(order, status) {
  if (status === "pending") return "Agree to fulfil this order";
  if (status === "accepted") return "Dispatch and enter the code";
  if (status === "rejected" && order.rejectedBy === "buyer" && !order.returnConfirmed) return "Confirm the returned item";
  if (status === "review" && !order.reports?.seller) return "Answer the review form";
  return null;
}

export function formatCountdown(ms) {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatWhen(timestamp) {
  return new Date(timestamp).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

// Progress entries show different wording to the buyer and the seller.
// Older saved entries only have `text`, which both sides share.
export function eventText(event, role) {
  if (role in event) return event[role];
  return event.text ?? null;
}

// Notifications for one side, newest first. A notification is an event that
// the other side caused, plus a reminder when the 24-hour window ends.
export function buildNotifications(orders, role, shopId, now) {
  const out = [];
  orders.forEach((o) => {
    if (role === "seller" && o.shopId !== shopId) return;
    o.events.forEach((e, i) => {
      const text = eventText(e, role);
      if (text && (e.notify === role || e.notify === "both")) {
        out.push({ id: `${o.id}:${i}`, orderId: o.id, at: e.at, text });
      }
    });
    if ((o.status === "accepted" || o.status === "dispatched") && getStatus(o, now) === "review") {
      out.push({
        id: `${o.id}:expired`,
        orderId: o.id,
        at: o.acceptedAt + WINDOW_MS,
        text: "The 24-hour window ended. Please answer the review form.",
      });
    }
  });
  return out.sort((a, b) => b.at - a.at);
}
