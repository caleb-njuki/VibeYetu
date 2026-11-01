// The delivery fee each shop charges. The seller sets it; there is no default amount.
// Until a shop sets a fee, buyers cannot choose delivery from it (pickup still works).
// Kept in the browser for the demo. On the backend the fee is a column on the shop.
import { formatKES } from "./format.js";

const KEY = "vibeyetu_delivery_fees"; // { [shopId]: whole shillings }
export const MAX_DELIVERY_FEE = 1000;

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const isFee = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_DELIVERY_FEE;

// The fee the seller saved, or null when none was set.
export function getDeliveryFee(shopId) {
  const saved = read()[shopId];
  return isFee(saved) ? saved : null;
}

// Whole shillings from 0 to MAX_DELIVERY_FEE. 0 means free delivery.
export function validateDeliveryFee(input) {
  const text = String(input ?? "").replace(/[,\s]/g, "");
  if (!text) return { ok: false, message: "Enter your delivery fee. Type 0 for free delivery." };
  if (!/^\d+$/.test(text)) return { ok: false, message: "Enter the fee in whole shillings, for example 200." };
  const fee = Number(text);
  if (fee > MAX_DELIVERY_FEE) return { ok: false, message: `The delivery fee can be at most ${formatKES(MAX_DELIVERY_FEE)}.` };
  return { ok: true, fee };
}

export function saveDeliveryFee(shopId, fee) {
  if (!isFee(fee)) return { ok: false, message: "That is not a valid delivery fee." };
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [shopId]: fee }));
  } catch {
    return { ok: false, message: "Your browser blocked saving. Allow site data and try again." };
  }
  return { ok: true, fee };
}

// Puts `deliveryFee` (a number, or null when not set) on a shop. The sample shops carry their own.
export function applyDeliveryFee(shop) {
  const saved = getDeliveryFee(shop.id);
  const own = isFee(shop.deliveryFee) ? shop.deliveryFee : null;
  return { ...shop, deliveryFee: saved ?? own };
}

// What a buyer can pick at this shop: delivery only when the shop has set a fee.
export function buyerModes(shop) {
  const modes = (shop?.fulfillment || []).filter((m) => m !== "delivery" || isFee(shop.deliveryFee));
  return modes.length ? modes : ["pickup"];
}

export const feeText = (fee) => (fee === 0 ? "free" : formatKES(fee));
