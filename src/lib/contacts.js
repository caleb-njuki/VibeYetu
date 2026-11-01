// Who may see whose phone number, in one place.
// - A buyer's name, phone and delivery location are shown to the shop they ordered from, on that order only.
// - A shop's contact phone is shown to buyers who have an order with that shop, on that order only.
// Kept in the browser for the demo. On the backend the same two rules are enforced on the server,
// so the number is only sent to the person who is allowed to see it.
import { getShopSettings } from "./shopProfile.js";
import { localPhone, normalizePhone } from "./format.js";

// Demo only: the four sample shops have no saved phone number. Remove this when the backend arrives.
const DEMO_SHOP_PHONES = { s1: "254700000001", s2: "254700000002", s3: "254700000003", s4: "254700000004" };

// The number buyers call for this shop, or null when the seller has not added one.
export function sellerPhoneFor(shopId) {
  return normalizePhone(getShopSettings(shopId).private.phone || "") || DEMO_SHOP_PHONES[shopId] || null;
}

// A normalized number as a link target: 254712345678 -> tel:+254712345678
export const telHref = (normalized) => `tel:+${String(normalized).replace(/\D/g, "")}`;

// 254712345678 -> 0712 345 678
export function displayPhone(normalized) {
  const local = localPhone(normalized);
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

// Where the order goes. "Westlands, near Yaya Centre", or the pickup note.
export function orderLocation(order) {
  if (order?.mode !== "delivery") return "Pickup at the shop";
  const area = order.address?.area?.trim();
  const street = order.address?.street?.trim();
  if (area && street) return `${area}, ${street}`;
  return area || street || "";
}

// Orders placed before buyer details were saved have no `buyer`.
export const hasBuyerDetails = (order) => Boolean(order?.buyer?.name || order?.buyer?.phone);
