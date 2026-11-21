export function formatKES(amount) {
  return "KES " + Number(amount).toLocaleString("en-KE");
}

const FULFILLMENT = { delivery: "Delivery", pickup: "Pickup at shop" };

export function fulfillmentLabel(mode) {
  return FULFILLMENT[mode] || mode;
}

// Accepts 0712345678, 712345678, +254712345678, 254 712 345 678 (07xx and 01xx).
// Returns 254712345678 or null when the number is not valid.
// What a person types in a phone box: digits only, at most 10 (0712345678).
export const phoneDigits = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 10);

// A phone number typed as 10 digits starting with 0 (07... or 01...) becomes 254712345678.
// A number that is already saved in the 254 form is accepted as it is. Anything else is not a valid number.
export function normalizePhone(input) {
  const n = String(input ?? "").replace(/[\s\-()]/g, "").replace(/^\+/, "");
  if (/^0[17]\d{8}$/.test(n)) return "254" + n.slice(1);
  return /^254[17]\d{8}$/.test(n) ? n : null;
}

// +254712345678, 254712345678 or 0712345678 -> 0712345678
export function localPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("254")) return "0" + digits.slice(3);
  if (digits.length === 9) return "0" + digits;
  return digits;
}

export function maskPhone(normalized) {
  const local = localPhone(normalized);
  return `${local.slice(0, 2)}•• ••• ${local.slice(-3)}`;
}
