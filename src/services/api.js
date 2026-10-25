// Mock API. Later we replace the bodies of these functions with real calls
// to the backend (fetch("/api/...")). The pages will not need to change.
import { categories, shops as baseShops, products as baseProducts } from "../data/mock.js";
import { applyShopProfile } from "../lib/shopProfile.js";
import { applyShopFlags, isClosed, isSuspended } from "../lib/shopFlags.js";
import { adjustStock, withStock } from "../lib/stock.js";
import { applyCatalog, createProduct, newProductId, removeProduct, updateProduct } from "../lib/catalog.js";
import { applyOffer, removeProductFromOffers } from "../lib/offers.js";
import { MAX_LIVE_ADS, adLink, listAds, liveAds, stopAd } from "../lib/ads.js";
import { deleteImage } from "../lib/images.js";
import { hasLocation, withDistance } from "../lib/geo.js";
import { soldCounts } from "../lib/sales.js";
import { withRatings } from "../lib/ratings.js";
import { customShops } from "../lib/sellers.js";

export const DELIVERY_FEE = 150;
const DEMO_OTP = "123456"; // Demo only. Real SMS codes arrive with the backend.

const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// Mixes each shop's starting rating with real buyer ratings.
const applyShopRatings = (s) => {
  const r = withRatings(s.rating, s.reviews || 0, "shop", s.id);
  return { ...s, rating: r.rating, reviews: r.count };
};
// Sample shops plus the shops sellers opened. The owner's email stays private, so it is removed here.
const allShops = () => [...baseShops, ...customShops().map(({ ownerEmail, ...shop }) => shop)];
const shopList = () => allShops().map(applyShopProfile).map(applyShopFlags).map(applyShopRatings);
const catalog = () => applyCatalog(baseProducts);
const liveProducts = () => catalog().filter((p) => p.active !== false && !isSuspended(p.shopId) && !isClosed(p.shopId));

// `near` is the buyer's point: { lat, lng, radiusKm }. When it is given, shops get
// their distance, delivery time and open or closed, and far shops are left out.
const placeShop = (shop, near) => (shop && near && hasLocation(shop) ? withDistance(shop, near) : shop);
const withShop = (p, near) => {
  const r = withRatings(p.rating, p.ratingCount ?? (p.rating ? 10 : 0), "product", p.id);
  return {
    ...applyOffer(withStock(p)),
    rating: r.rating,
    ratingCount: r.count,
    shop: placeShop(shopList().find((s) => s.id === p.shopId), near),
  };
};
const isNear = (shop, near) => !near || (shop?.distanceKm !== undefined && shop.distanceKm <= near.radiusKm);
const byDistance = (a, b) => (a.shop?.distanceKm ?? 1e9) - (b.shop?.distanceKm ?? 1e9);

export async function getCategories() {
  await wait();
  return categories;
}

export async function getFeaturedProducts(near) {
  await wait();
  return liveProducts()
    .map((p) => withShop(p, near))
    .filter((p) => isNear(p.shop, near))
    .sort(byDistance);
}

export async function searchProducts({ q = "", category = "", sort = "relevance", near } = {}) {
  await wait(250);
  const term = q.trim().toLowerCase();
  let list = liveProducts()
    .map((p) => withShop(p, near))
    .filter(
      (p) =>
        isNear(p.shop, near) &&
        (!category || p.category === category) &&
        (!term ||
          p.name.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term) ||
          p.shop?.name.toLowerCase().includes(term))
    );
  if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
  else if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
  else list = [...list].sort(byDistance);
  return list;
}

export async function getProduct(id, near) {
  await wait();
  const p = liveProducts().find((x) => x.id === id);
  return p ? withShop(p, near) : null;
}

export async function getShop(id, near) {
  await wait();
  const shop = shopList().find((s) => s.id === id);
  // A shop its owner closed is gone for buyers, as if it never existed.
  if (!shop || shop.closed) return null;
  return {
    ...placeShop(shop, near),
    products: liveProducts()
      .filter((p) => p.shopId === id)
      .map((p) => withShop(p, near)),
  };
}

// ---- Sign in (phone + OTP) ----
export async function requestOtp(phone) {
  await wait(500);
  return { sent: true, phone };
}

export async function verifyOtp(phone, code) {
  await wait(500);
  if (code !== DEMO_OTP) throw new Error("That code is not correct. Please try again.");
  return { phone };
}

// ---- Checkout ----
// Creates one order per shop with its items. The order is saved to My Orders
// once payment succeeds.
export async function placeOrders({ items, modes }) {
  await wait(400);
  // A shop can be suspended after its items went into a cart. Stop before any payment is taken.
  if (items.some((i) => isSuspended(i.shopId))) {
    throw new Error("A shop in your cart is not taking orders right now. Please remove its items and try again.");
  }
  if (items.some((i) => isClosed(i.shopId))) {
    throw new Error("A shop in your cart has closed. Please remove its items and try again.");
  }
  // A product can be hidden or deleted after it went into a cart.
  const forSale = new Set(liveProducts().map((p) => p.id));
  if (items.some((i) => !forSale.has(i.id))) {
    throw new Error("An item in your cart is no longer for sale. Please remove it and try again.");
  }
  const byShop = new Map();
  items.forEach((i) => {
    if (!byShop.has(i.shopId)) {
      byShop.set(i.shopId, { shopId: i.shopId, shopName: i.shopName || "Shop", subtotal: 0, items: [] });
    }
    const o = byShop.get(i.shopId);
    o.subtotal += i.price * i.qty;
    o.items.push({ productId: i.id, name: i.name, qty: i.qty, price: i.price });
  });
  const orders = [...byShop.values()].map((o) => {
    const mode = modes[o.shopId] || "pickup";
    const deliveryFee = mode === "delivery" ? DELIVERY_FEE : 0;
    return {
      id: "VY-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      ...o,
      mode,
      deliveryFee,
      total: o.subtotal + deliveryFee,
    };
  });
  return {
    id: "G-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    orders,
    total: orders.reduce((n, o) => n + o.total, 0),
  };
}

// Simulates M-Pesa STK Push or the hosted card page. Always succeeds in demo mode.
export async function payOrders({ method, phone, amount }) {
  await wait(3500);
  return { ok: true, method, phone, amount };
}

// ---- Demo seller sign in ----
export async function listShops() {
  await wait(100);
  return shopList().map(({ id, name, town }) => ({ id, name, town }));
}

// ---- Seller product management ----
export async function getShopCatalog(shopId) {
  await wait(200);
  return catalog()
    .filter((p) => p.shopId === shopId)
    .map(withStock);
}

export async function createShopProduct(shopId, data) {
  await wait(300);
  const product = { id: newProductId(), shopId, rating: 0, active: true, createdAt: Date.now(), ...data };
  createProduct(product);
  return product;
}

export async function updateShopProduct(id, changes) {
  await wait(300);
  const found = catalog().find((p) => p.id === id);
  if (!found) throw new Error("This product no longer exists.");
  const { stock, ...fields } = changes;
  if (Object.keys(fields).length) updateProduct(id, fields);
  if (typeof stock === "number") adjustStock(id, stock - withStock(found).stock);
  return true;
}

// Deletes one of the shop's own products for good. Past orders keep the item's name and price.
// The product also leaves any offers, and ads that pointed at it are stopped.
export async function deleteShopProduct(shopId, id) {
  await wait(300);
  const found = catalog().find((p) => p.id === id);
  if (!found) throw new Error("This product no longer exists.");
  if (found.shopId !== shopId) throw new Error("This product does not belong to your shop.");
  removeProduct(id);
  (found.images || []).forEach(deleteImage);
  removeProductFromOffers(id);
  listAds()
    .filter((a) => a.target === "product" && a.productId === id)
    .forEach((a) => stopAd(a.id));
  return true;
}

// ---- Admin ----
export async function listAllShops() {
  await wait(150);
  return shopList();
}

// ---- Ads ----
const shuffled = (list) =>
  list
    .map((value) => ({ value, key: Math.random() }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.value);

// Only ads from shops near the buyer. There is room for a few slides, so the
// ads shown are picked at random each visit, which gives every seller a fair turn.
export async function getLiveAds(near) {
  await wait(150);
  const eligible = liveAds()
    .filter((a) => !isSuspended(a.shopId) && !isClosed(a.shopId))
    .map((a) => ({ ...a, shop: placeShop(shopList().find((s) => s.id === a.shopId), near) }))
    .filter((a) => isNear(a.shop, near));
  return shuffled(eligible)
    .slice(0, MAX_LIVE_ADS)
    .map(({ shop, ...a }) => ({ ...a, to: adLink(a), shopName: shop?.name || "" }));
}

// ---- Related products for the product page ----
export async function getRelated(product, near) {
  await wait(150);
  const others = liveProducts()
    .filter((p) => p.id !== product.id)
    .map((p) => withShop(p, near))
    .filter((p) => isNear(p.shop, near))
    .sort(byDistance);
  return {
    fromShop: others.filter((p) => p.shopId === product.shopId).slice(0, 4),
    similar: others.filter((p) => p.shopId !== product.shopId && p.category === product.category).slice(0, 4),
  };
}

// ---- Home page sections, all limited to shops near the buyer ----
export async function getHome(near) {
  await wait();
  const counts = soldCounts();
  const nearby = liveProducts()
    .map((p) => ({ ...withShop(p, near), sold: (p.sold || 0) + (counts[p.id] || 0) }))
    .filter((p) => isNear(p.shop, near))
    .sort(byDistance);
  const shops = shopList()
    .filter((s) => !s.suspended && !s.closed)
    .map((s) => placeShop(s, near))
    .filter((s) => isNear(s, near) && nearby.some((p) => p.shopId === s.id))
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  const addedAt = (p) => p.createdAt ?? p.addedAt ?? 0;
  return {
    total: nearby.length,
    offers: nearby.filter((p) => p.discountPercent).sort((a, b) => b.discountPercent - a.discountPercent).slice(0, 8),
    newArrivals: [...nearby].sort((a, b) => addedAt(b) - addedAt(a)).slice(0, 8),
    bestSellers: nearby.filter((p) => p.sold > 0).sort((a, b) => b.sold - a.sold).slice(0, 8),
    shops,
  };
}
