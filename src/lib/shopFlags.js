// Admin decisions about shops (verified badge, suspension), kept in the browser
// for the demo. The backend database owns this later.
const KEY = "vibeyetu_shop_flags";

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function setShopFlags(shopId, flags) {
  const all = read();
  all[shopId] = { ...(all[shopId] || {}), ...flags };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable: changes last only for this visit.
  }
}

export const isSuspended = (shopId) => Boolean(read()[shopId]?.suspended);

export function applyShopFlags(shop) {
  const flags = read()[shop.id];
  return flags ? { ...shop, ...flags } : shop;
}
