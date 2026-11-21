// Delivery is priced per kilometre. The seller saves a rate (for example KES 10 per km) and the buyer pays the rate times
// the distance from the shop to the buyer's pin. The server works out the final amount; the numbers here are for showing it.
// Until a shop saves a rate, buyers cannot choose delivery from it (pickup still works).
import { formatKES } from "./format.js";

export const MAX_RATE_PER_KM = 200;
export const MAX_DELIVERY_KM = 40;

const isRate = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_RATE_PER_KM;

// Whole shillings per kilometre, from 0 to MAX_RATE_PER_KM. 0 means free delivery.
export function validateRate(input) {
  const text = String(input ?? "").replace(/[,\s]/g, "");
  if (!text) return { ok: false, message: "Enter your delivery fee per kilometre. Type 0 for free delivery." };
  if (!/^\d+$/.test(text)) return { ok: false, message: "Enter the fee in whole shillings per kilometre, for example 10." };
  const rate = Number(text);
  if (rate > MAX_RATE_PER_KM) return { ok: false, message: `The delivery fee can be at most ${formatKES(MAX_RATE_PER_KM)} per kilometre.` };
  return { ok: true, rate };
}

// What a buyer can pick at this shop: delivery only when the shop has saved a rate.
export function buyerModes(shop) {
  const modes = (shop?.fulfillment || []).filter((m) => m !== "delivery" || isRate(shop.deliveryFee));
  return modes.length ? modes : ["pickup"];
}

// "KES 10 per km", or "free".
export const rateText = (rate) => (rate === 0 ? "free" : `${formatKES(rate)} per km`);

// Straight-line kilometres between two map points.
export function kmBetween(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// The delivery cost to the buyer's pin, or null when it cannot be worked out (no real location yet, or no rate).
// A location that is only the default search centre does not count: delivery needs the buyer's real position.
export function deliveryCost(shop, place) {
  if (!isRate(shop?.deliveryFee) || place?.source !== "gps") return null;
  if (typeof shop.lat !== "number" || typeof shop.lng !== "number") return null;
  const km = kmBetween(place.lat, place.lng, shop.lat, shop.lng);
  return { km, tooFar: km > MAX_DELIVERY_KM, fee: Math.round(shop.deliveryFee * km) };
}
