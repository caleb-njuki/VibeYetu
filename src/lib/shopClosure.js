// The rules around closing a shop. The server runs the same checks and does the closing.
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
