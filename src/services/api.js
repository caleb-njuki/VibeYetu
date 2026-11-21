// What buyers see and do. Every function asks the real server (see http.js).
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

// ---- Sign in (email + one-time code sent by email) ----
export async function requestOtp(email) {
  return post("/auth/buyer/request-otp", { email });
}

// Returns { token, isNewBuyer, buyer: { id, email } }
export async function verifyOtp(email, code) {
  return post("/auth/buyer/verify-otp", { email, code });
}

// ---- Checkout and orders (the buyer must be signed in) ----
// Step 1: hold the items. Returns { id, total, expiresAt, orders:[...] }
export async function startCheckout({ items, modes, contact }) {
  const data = await post(
    "/checkout",
    {
      items: items.map((i) => ({ productId: String(i.id), qty: i.qty, ...(i.size ? { size: i.size } : {}) })),
      modes,
      contact,
    },
    "buyer"
  );
  return data.checkout;
}
// Step 2: send the M-Pesa prompt to the buyer's phone. Returns { status: "pending" | "paid", message }
export const payCheckout = (groupId, phone) => post(`/checkout/${groupId}/pay`, { method: "mpesa", phone }, "buyer");
// Step 3: ask how it went, every few seconds. { status: "unpaid" | "pending" | "paid" | "failed" | "expired", message, orders? }
export const getCheckoutStatus = (groupId) => get(`/checkout/${groupId}/status`, "buyer");

export const listBuyerNotifications = () => get("/notifications", "buyer");
export const readBuyerNotifications = (body) => post("/notifications/read", body, "buyer");
export const listMyOrders = async () => (await get("/orders", "buyer")).orders;
export const confirmReceipt = (orderId, code) => post(`/orders/${orderId}/confirm`, { code }, "buyer");
export const rejectDelivery = (orderId, reason) => post(`/orders/${orderId}/reject`, { reason }, "buyer");
export const askRefund = (orderId) => post(`/orders/${orderId}/refund`, {}, "buyer");
export const sendBuyerReport = (orderId, report) => post(`/orders/${orderId}/report`, report, "buyer");

// ---- Old names the My Shop and staff pages still import. Removed when those pages move over. ----
export const getShopCatalog = (shopId) => listProducts(shopId);
export async function listShops() {
  return [];
}
export async function listAllShops() {
  return [];
}

// ---- Ratings ----
export const rateOrder = (orderId, body) => post(`/orders/${orderId}/rating`, body, "buyer");
export const skipOrderRating = (orderId) => post(`/orders/${orderId}/rating-skip`, {}, "buyer");
export const getProductReviews = (productId) => get(`/products/${encodeURIComponent(productId)}/reviews?limit=8`);
