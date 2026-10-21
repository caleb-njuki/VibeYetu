export function formatKES(amount) {
  return "KES " + Number(amount).toLocaleString("en-KE");
}

const FULFILLMENT = { delivery: "Delivery", pickup: "Pickup at shop" };

export function fulfillmentLabel(mode) {
  return FULFILLMENT[mode] || mode;
}

// Accepts 0712345678, 712345678, +254712345678, 254 712 345 678 (07xx and 01xx).
// Returns 254712345678 or null when the number is not valid.
export function normalizePhone(input) {
  let n = String(input).replace(/[\s\-()]/g, "").replace(/^\+/, "");
  if (/^0[17]\d{8}$/.test(n)) n = "254" + n.slice(1);
  else if (/^[17]\d{8}$/.test(n)) n = "254" + n;
  return /^254[17]\d{8}$/.test(n) ? n : null;
}

// 254712345678 -> 0712345678
export function localPhone(normalized) {
  return "0" + String(normalized).slice(3);
}

// 254712345678 -> 07•• ••• 678
export function maskPhone(normalized) {
  const local = localPhone(normalized);
  return `${local.slice(0, 2)}•• ••• ${local.slice(-3)}`;
}
