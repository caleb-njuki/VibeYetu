// Mock API. Later we replace the bodies of these functions with real calls
// to the backend (fetch("/api/...")). The pages will not need to change.
import { categories, shops as baseShops, products as baseProducts } from "../data/mock.js";
import { applyShopProfile } from "../lib/shopProfile.js";
import { applyDeliveryFee, buyerModes } from "../lib/delivery.js";
import { applyShopFlags, isClosed, isSuspended } from "../lib/shopFlags.js";
import { adjustStock, resetStock, withStock } from "../lib/stock.js";
import { formatSize, hasSizes, isSizeType, totalStock } from "../lib/sizes.js";
import { normalizePhone } from "../lib/format.js";
import { applyCatalog, createProduct, newProductId, removeProduct, updateProduct } from "../lib/catalog.js";
import { applyOffer, removeProductFromOffers } from "../lib/offers.js";
import { MAX_LIVE_ADS, adLink, listAds, liveAds, stopAd } from "../lib/ads.js";
import { deleteImage } from "../lib/images.js";
import { hasLocation, withDistance } from "../lib/geo.js";
import { soldCounts } from "../lib/sales.js";
import { withRatings } from "../lib/ratings.js";
import { customShops } from "../lib/sellers.js";

const DEMO_OTP = "123456"; // Demo only. Real SMS codes arrive with the backend.

const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// Mixes each shop's starting rating with real buyer ratings.
const applyShopRatings = (s) => {
  const r = withRatings(s.rating, s.reviews || 0, "shop", s.id);
  return { ...s, rating: r.rating, reviews: r.count };
};
// Sample shops plus the shops sellers opened. The owner's email stays private, so it is removed here.
const allShops = () => [...baseShops, ...customShops().map(({ ownerEmail, ...shop }) => shop)];
const shopList = () => allShops().map(applyShopProfile).map(applyDeliveryFee).map(applyShopFlags).map(applyShopRatings);
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
// `contact` is who the order is for: { name, phone, area, street }. The shop sees it on this order only.
export async function placeOrders({ items, modes, contact }) {
  await wait(400);
  const buyerName = String(contact?.name || "").replace(/\s+/g, " ").trim();
  const buyerPhone = normalizePhone(contact?.phone || "");
  if (buyerName.length < 2 || !buyerPhone) throw new Error("Enter your name and a phone number the seller can reach you on.");
  // A shop can be suspended after its items went into a cart. Stop before any payment is taken.
  if (items.some((i) => isSuspended(i.shopId))) {
    throw new Error("A shop in your cart is not taking orders right now. Please remove its items and try again.");
  }
  if (items.some((i) => isClosed(i.shopId))) {
    throw new Error("A shop in your cart has closed. Please remove its items and try again.");
  }
  // A product can be hidden or deleted after it went into a cart.
  const forSale = new Map(liveProducts().map((p) => [p.id, withStock(p)]));
  if (items.some((i) => !forSale.has(i.id))) {
    throw new Error("An item in your cart is no longer for sale. Please remove it and try again.");
  }
  // A product with sizes needs a size that the seller still has in stock, in the amount ordered.
  items.forEach((i) => {
    const p = forSale.get(i.id);
    if (!hasSizes(p)) return;
    if (!i.size || !(i.size in p.sizes)) {
      throw new Error(`${i.name} is sold in sizes. Please remove it from your cart and choose a size on its page.`);
    }
    if (p.sizes[i.size] < i.qty) {
      const left = p.sizes[i.size];
      throw new Error(
        left === 0
          ? `${i.name} in ${formatSize(p.sizeType, i.size)} is sold out. Please remove it from your cart.`
          : `Only ${left} of ${i.name} in ${formatSize(p.sizeType, i.size)} left. Please lower the quantity.`
      );
    }
  });
  const byShop = new Map();
  items.forEach((i) => {
    if (!byShop.has(i.shopId)) {
      byShop.set(i.shopId, { shopId: i.shopId, shopName: i.shopName || "Shop", subtotal: 0, items: [] });
    }
    const o = byShop.get(i.shopId);
    o.subtotal += i.price * i.qty;
    o.items.push({ productId: i.id, name: i.name, qty: i.qty, price: i.price, size: i.size || "", sizeType: i.size ? i.sizeType : "" });
  });
  const orders = [...byShop.values()].map((o) => {
    const mode = modes[o.shopId] || "pickup";
    // Each shop charges its own delivery fee. A shop that has not set one cannot be asked to deliver.
    const shop = shopList().find((s) => s.id === o.shopId);
    if (mode === "delivery" && !buyerModes(shop).includes("delivery")) {
      throw new Error(`${o.shopName} is not delivering right now. Please choose pickup for that shop.`);
    }
    const deliveryFee = mode === "delivery" ? shop.deliveryFee : 0;
    return {
      id: "VY-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      ...o,
      mode,
      deliveryFee,
      total: o.subtotal + deliveryFee,
      // The shop needs these to deliver and to reach the buyer. A pickup order has no address.
      buyer: { name: buyerName, phone: buyerPhone },
      address: mode === "delivery" ? { area: String(contact?.area || "").trim(), street: String(contact?.street || "").trim() } : null,
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
  // The product form always sends `sizes` (an object, or null when the product has no sizes). The numbers the
  // seller typed replace whatever orders changed before, so the new stock is exactly what was typed.
  if ("sizes" in fields) {
    const sized = isSizeType(fields.sizeType) && fields.sizes && Object.keys(fields.sizes).length > 0;
    resetStock(id);
    updateProduct(id, {
      ...fields,
      sizeType: sized ? fields.sizeType : "none",
      sizes: sized ? fields.sizes : null,
      stock: sized ? totalStock(fields.sizes) : Number(stock) || 0,
    });
    return true;
  }
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
