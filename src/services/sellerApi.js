// Everything the My Shop pages ask the server. Needs the seller to be signed in.
import { del, get, patch, post, put } from "./http.js";

// ---- Account ----
export const registerSeller = (input) => post("/auth/seller/register", input);
export const loginSeller = (email, password) => post("/auth/seller/login", { email, password });
export const sendEmailCode = (email) => post("/auth/seller/email/code", { email });
export const checkEmailCode = (email, code) => post("/auth/seller/email/verify", { email, code });
export const getMe = () => get("/auth/seller/me", "seller");

// ---- Lists that need no sign-in ----
export const getCategories = async () => (await get("/categories")).categories;
export const getAreas = async () => (await get("/areas")).areas;
export const checkShopNameOnServer = (name, ignoreShopId) =>
  get(`/shop-names/check?name=${encodeURIComponent(name)}${ignoreShopId ? `&ignoreShopId=${ignoreShopId}` : ""}`);

// ---- Shops ----
export const createBranch = async (input) => (await post("/seller/shops", input, "seller")).shop;
export const updateShop = async (shopId, changes) => (await patch(`/seller/shops/${shopId}`, changes, "seller")).shop;

// ---- Products ----
export const listProducts = async (shopId) => (await get(`/seller/shops/${shopId}/products`, "seller")).products;
export const createProduct = async (shopId, data) => (await post(`/seller/shops/${shopId}/products`, data, "seller")).product;
export const updateProduct = async (shopId, id, changes) => (await patch(`/seller/shops/${shopId}/products/${id}`, changes, "seller")).product;
export const deleteProduct = (shopId, id) => del(`/seller/shops/${shopId}/products/${id}`, "seller");

// ---- Payout (typed twice to save; refused while orders are in progress) ----
export const getPayout = (shopId) => get(`/seller/shops/${shopId}/payout`, "seller");
export const savePayoutMethod = async (shopId, details, again) => (await put(`/seller/shops/${shopId}/payout`, { ...details, again }, "seller")).payout;

// ---- Orders of one shop ----
export const listShopOrders = (shopId) => get(`/seller/shops/${shopId}/orders`, "seller");
export const acceptOrder = (shopId, orderId, promise) => post(`/seller/shops/${shopId}/orders/${orderId}/accept`, { promise }, "seller");
export const rejectOrderAsSeller = (shopId, orderId, reason) => post(`/seller/shops/${shopId}/orders/${orderId}/reject`, { reason }, "seller");
export const dispatchOrder = (shopId, orderId, code) => post(`/seller/shops/${shopId}/orders/${orderId}/dispatch`, { code }, "seller");
export const confirmReturnOfOrder = (shopId, orderId) => post(`/seller/shops/${shopId}/orders/${orderId}/confirm-return`, {}, "seller");
export const sendSellerReport = (shopId, orderId, report) => post(`/seller/shops/${shopId}/orders/${orderId}/report`, report, "seller");

// ---- Bell and suspension ----
export const listShopNotifications = (shopId) => get(`/seller/shops/${shopId}/notifications`, "seller");
export const readShopNotifications = (shopId, body) => post(`/seller/shops/${shopId}/notifications/read`, body, "seller");
export const getSuspension = (shopId) => get(`/seller/shops/${shopId}/suspension`, "seller");
export const sendSuspensionReport = (shopId, report) => post(`/seller/shops/${shopId}/suspension/report`, report, "seller");

// ---- Shop verification ----
export const getVerification = (shopId) => get(`/seller/shops/${shopId}/verification`, "seller");
export const verifyMyShop = (shopId) => post(`/seller/shops/${shopId}/verify`, {}, "seller");

// ---- Offers ----
export const listOffers = async (shopId) => (await get(`/seller/shops/${shopId}/offers`, "seller")).offers;
export const createOfferApi = (shopId, offer) => post(`/seller/shops/${shopId}/offers`, offer, "seller");
export const toggleOfferApi = (shopId, offerId) => post(`/seller/shops/${shopId}/offers/${offerId}/toggle`, {}, "seller");
export const deleteOfferApi = (shopId, offerId) => del(`/seller/shops/${shopId}/offers/${offerId}`, "seller");

// ---- Ads ----
export const listMyAds = async (shopId) => (await get(`/seller/shops/${shopId}/ads`, "seller")).ads;
export const startAd = (shopId, ad) => post(`/seller/shops/${shopId}/ads`, ad, "seller");
export const getAdPayment = (shopId, adId) => get(`/seller/shops/${shopId}/ads/${adId}/payment`, "seller");
export const stopMyAd = (shopId, adId) => post(`/seller/shops/${shopId}/ads/${adId}/stop`, {}, "seller");

// ---- Closing the shop ----
export const getClosure = (shopId) => get(`/seller/shops/${shopId}/closure`, "seller");
export const closeShopApi = (shopId, body) => post(`/seller/shops/${shopId}/close`, body, "seller");
