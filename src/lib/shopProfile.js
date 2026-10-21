// Shop settings kept in the browser for the demo. "public" fields show on the
// storefront. "private" fields (contact and payout numbers) never do.
const KEY = "vibeyetu_shop_settings";

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function getShopSettings(shopId) {
  const s = read()[shopId] || {};
  return { public: s.public || {}, private: s.private || {} };
}

export function saveShopSettings(shopId, settings) {
  const all = read();
  all[shopId] = settings;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable: changes last only for this visit.
  }
}

export function applyShopProfile(shop) {
  const pub = getShopSettings(shop.id).public;
  return Object.keys(pub).length ? { ...shop, ...pub } : shop;
}
