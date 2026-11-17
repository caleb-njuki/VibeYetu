// What buyers see and do. Every function asks the real server (see http.js).
// Checkout and orders are connected in the next batch (placeOrders and payOrders below).
import { ApiError, get, nearQuery, post } from "./http.js";
import { listProducts } from "./sellerApi.js";

// ?lat=..&lng=..&radiusKm=.. (or nothing when the buyer's place is not known)
const withNear = (path, near) => {
  const q = nearQuery(near);
  return q ? `${path}${path.includes("?") ? "&" : "?"}${q}` : path;
};

// A 404 means "not for sale / not found": pages show their own "not found" text, so give them null.
const orNull = async (work) => {
  try {
    return await work();
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
};

export async function getCategories() {
  return (await get("/categories")).categories;
}

export async function getFeaturedProducts(near) {
  return (await get(withNear("/products", near))).products;
}

export async function searchProducts({ q = "", category = "", sort = "relevance", near } = {}) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);
  return (await get(withNear(`/products?${params}`, near))).products;
}

export const getProduct = (id, near) => orNull(async () => (await get(withNear(`/products/${encodeURIComponent(id)}`, near))).product);

// A shop its owner closed is gone for buyers: the server answers 404 and the page shows "not found".
export const getShop = (id, near) => orNull(async () => (await get(withNear(`/shops/${encodeURIComponent(id)}`, near))).shop);

// Ads from shops near the buyer. The server picks them at random and gives each one its link in `to`.
export async function getLiveAds(near) {
  return (await get(withNear("/ads", near))).ads;
}

// More from the same shop, and similar products from other shops.
export async function getRelated(product, near) {
  return (await get(withNear(`/products/${encodeURIComponent(product.id)}/related`, near))) || { fromShop: [], similar: [] };
}

// Home page sections, all limited to shops near the buyer.
export async function getHome(near) {
  return get(withNear("/home", near));
}

// ---- Sign in (phone + one-time code by SMS) ----
export async function requestOtp(phone) {
  return post("/auth/buyer/request-otp", { phone });
}

// Returns { token, isNewBuyer, buyer: { id, phone } }
export async function verifyOtp(phone, code) {
  return post("/auth/buyer/verify-otp", { phone, code });
}

// ---- Checkout: connected in the next batch ----
const NEXT = "Checkout is being connected to M-Pesa. Please try again after the next update.";
export async function placeOrders() {
  throw new Error(NEXT);
}
export async function payOrders() {
  throw new Error(NEXT);
}

// ---- Old names the My Shop and staff pages still import. Removed when those pages move over. ----
export const getShopCatalog = (shopId) => listProducts(shopId);
export async function listShops() {
  return [];
}
export async function listAllShops() {
  return [];
}
