// Everything the staff pages ask the server. All calls use the staff token.
import { get, post } from "./http.js";

export const adminLogin = (email, password) => post("/auth/admin/login", { email, password });
export const getOverview = () => get("/admin/overview", "admin");
export const listAdminOrders = async ({ status = "", q = "" } = {}) => {
  const p = new URLSearchParams({ limit: "100" });
  if (status) p.set("status", status);
  if (q.trim()) p.set("q", q.trim());
  return (await get(`/admin/orders?${p}`, "admin")).orders;
};
export const listCases = async () => (await get("/admin/cases", "admin")).cases;
export const decideCase = (orderId, action) => post(`/admin/orders/${orderId}/${action}`, {}, "admin"); // "refund" | "release"
export const listAdminShops = async () => (await get("/admin/shops", "admin")).shops;
export const unverifyShop = (shopId) => post(`/admin/shops/${shopId}/verify`, { verified: false }, "admin");
export const suspendShopAdmin = (shopId) => post(`/admin/shops/${shopId}/suspend`, {}, "admin");
export const reopenShopAdmin = (shopId) => post(`/admin/shops/${shopId}/reopen`, {}, "admin");
export const reviewShop = (shopId, body) => post(`/admin/shops/${shopId}/review`, body, "admin"); // { action, note?, override? }
export const listAdminAds = async () => (await get("/admin/ads", "admin")).ads;
export const adminAdAction = (adId, action) => post(`/admin/ads/${adId}/${action}`, {}, "admin"); // activate | refund | stop
