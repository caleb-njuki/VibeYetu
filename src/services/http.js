// The one place that talks to the backend. Every page goes through request().
// In development, Vite forwards /api to the backend on port 5000 (see vite.config.js).
// For a built site, set VITE_API_URL to the backend address, for example https://api.example.com
// A trailing "/api" in VITE_API_URL is ignored, so both http://localhost:5000 and http://localhost:5000/api work.
const BASE = `${(import.meta.env?.VITE_API_URL || "").replace(/\/+$/, "").replace(/\/api$/, "")}/api`;

// Each kind of person has their own saved token.
const KEYS = { buyer: "vibeyetu_token_buyer", seller: "vibeyetu_token_seller", admin: "vibeyetu_token_admin" };
export const SESSION_EXPIRED = "vibeyetu:session-expired"; // fired with { detail: "buyer" | "seller" | "admin" }

export function getToken(kind) {
  try {
    return localStorage.getItem(KEYS[kind]) || "";
  } catch {
    return "";
  }
}
export function setToken(kind, token) {
  try {
    if (token) localStorage.setItem(KEYS[kind], token);
    else localStorage.removeItem(KEYS[kind]);
  } catch {
    // Storage blocked: the person stays signed in until the page is closed.
    memory[kind] = token || "";
  }
}
const memory = { buyer: "", seller: "", admin: "" };
const tokenFor = (kind) => getToken(kind) || memory[kind];

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// request("GET", "/products?q=dress")                      public
// request("POST", "/checkout", { auth: "buyer", body })     with the buyer's token
// request("GET", "/seller/shops", { auth: "seller" })
export async function request(method, path, { body, auth } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = tokenFor(auth);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("We could not reach the server. Check your internet connection and try again.", 0, null);
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    // The reply had no JSON.
  }
  if (!response.ok) {
    // A saved login that the server no longer accepts: sign the person out everywhere on this page.
    if (response.status === 401 && auth && tokenFor(auth)) {
      setToken(auth, "");
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED, { detail: auth }));
    }
    const message =
      (data && typeof data.error === "string" && data.error) ||
      (response.status === 429 ? "Too many tries. Please wait a few minutes and try again." : "Something went wrong. Please try again.");
    throw new ApiError(message, response.status, data);
  }
  return data;
}

export const get = (path, auth) => request("GET", path, { auth });
export const post = (path, body, auth) => request("POST", path, { body: body ?? {}, auth });
export const put = (path, body, auth) => request("PUT", path, { body: body ?? {}, auth });
export const patch = (path, body, auth) => request("PATCH", path, { body: body ?? {}, auth });
export const del = (path, auth) => request("DELETE", path, { auth });

// "?lat=..&lng=..&radiusKm=.." for the buyer's place. Empty when there is none.
export function nearQuery(near) {
  if (!near) return "";
  return `lat=${near.lat}&lng=${near.lng}&radiusKm=${near.radiusKm}`;
}
