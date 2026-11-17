// Everything the My Shop pages ask the server. Needs the seller to be signed in.
import { del, get, patch, post } from "./http.js";

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

// ---- Payout (read only here; changing it needs a code, see the Payments tab) ----
export const getPayout = (shopId) => get(`/seller/shops/${shopId}/payout`, "seller");
