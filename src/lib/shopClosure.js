// Closing a shop, and the rules around it. Kept in the browser for the demo.
// The backend runs the same checks on the server later.
import { isClosed, setShopFlags } from "./shopFlags.js";
import { listAds, stopAd } from "./ads.js";
import { listOffers, removeOffer } from "./offers.js";
import { platformFee } from "./fees.js";

export const CLOSE_REASONS = [
  "Not enough sales",
  "Too much work or not enough time",
  "I am moving or changing my business",
  "I found another place to sell",
  "The fees are too high",
  "Problems with orders or buyers",
  "Something else",
];

export const OTHER_REASON = "Something else";
const MIN_OTHER_DETAILS = 10;
const MAX_DETAILS = 500;

// An order is still open while money or goods are on the move, or a returned item waits to be confirmed.
export const isOpenOrder = (o) =>
  Boolean(o) &&
  (o.status === "pending" ||
    o.status === "accepted" ||
    o.status === "dispatched" ||
    (o.status === "rejected" && o.rejectedBy === "buyer" && !o.returnConfirmed));

// Orders that stop a shop from closing, and the money still in escrow for them.
export function closureBlockers(orders, shopId) {
  const open = (orders || []).filter((o) => o.shopId === shopId && isOpenOrder(o));
  return { open, held: open.reduce((n, o) => n + (Number(o.subtotal) || 0), 0) };
}

// Returns a sentence describing the problem, or "" when the answers are fine.
export function validateClosure({ reason, details }) {
  if (!CLOSE_REASONS.includes(reason)) return "Choose the reason that fits best.";
  const d = String(details || "").trim();
  if (reason === OTHER_REASON && d.length < MIN_OTHER_DETAILS) return "Please tell us a little more, at least 10 characters.";
  if (d.length > MAX_DETAILS) return "Keep the details under 500 characters.";
  return "";
}

// Closes the shop. Running ads stop and offers are removed. Products, orders and payout
// details stay on file, because orders may still need support, and the owner may ask to reopen.
export function closeShopNow({ shopId, reason, details = "", orders }) {
  const problem = validateClosure({ reason, details });
  if (problem) return { ok: false, message: problem };
  if (isClosed(shopId)) return { ok: false, message: "This shop is already closed." };
  if (closureBlockers(orders, shopId).open.length > 0) {
    return { ok: false, message: "Finish your open orders first. Then you can close the shop." };
  }
  setShopFlags(shopId, {
    closed: true,
    closedAt: Date.now(),
    closeReason: reason,
    closeDetails: String(details).trim().slice(0, MAX_DETAILS),
  });
  // setShopFlags cannot report a blocked browser store, so check that the flag stuck.
  if (!isClosed(shopId)) return { ok: false, message: "Your browser blocked saving. Allow site data and try again." };
  listAds(shopId).forEach((ad) => stopAd(ad.id));
  listOffers(shopId).forEach((offer) => removeOffer(offer.id));
  return { ok: true };
}

// ---- A copy of the shop's orders, offered before closing ----
// A cell that starts with = + - or @ could run as a formula in a spreadsheet, so it gets a leading '.
const cell = (value) => {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export function ordersToCsv(orders) {
  const header = ["Order", "Date", "Status", "Items", "Item total (KES)", "Delivery fee (KES)", "VibeYetu fee (KES)"];
  const rows = (orders || []).map((o) => [
    o.id,
    new Date(o.createdAt).toISOString(),
    o.status,
    (o.items || []).map((i) => `${i.name} x${i.qty}`).join("; "),
    Number(o.subtotal) || 0,
    Number(o.deliveryFee) || 0,
    o.status === "completed" ? platformFee(o.subtotal) : 0,
  ]);
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
