// Seller sign-up, sign-in and the shop-name rules. The server owns the accounts and the shops;
// this file checks what can be checked in the browser first, so mistakes show before anything is sent.
import { inKenya } from "./geo.js";
import { normalizePhone } from "./format.js";
import { checkShopNameOnServer, loginSeller, registerSeller as sendRegistration, createBranch } from "../services/sellerApi.js";

export const TERMS_VERSION = "2026-10-30";
// Pages fire this event after a rename, a new branch or a closed shop so the shop list refreshes.
export const SHOPS_CHANGED = "vibeyetu:shops-changed";
export const MAX_SHOPS_PER_SELLER = 10; // a guard against abuse; the owner can ask support for more

export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

// ---- Shop names. The name works like a username, so it must be unique. ----
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 &'.-]*$/;
const RESERVED_CONTAINS = ["vibeyetu", "safaricom", "mpesa"];
const RESERVED_EXACT = ["admin", "support", "official", "help", "escrow", "kra"];

// "Nairobi  Threads!", "nairobi-threads" and "NAIROBI THREADS" all become "nairobithreads".
export function nameKey(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
}

// The rules that need no server. Whether the name is already taken is asked with checkShopNameFree.
export function checkShopName(raw) {
  const name = String(raw || "").replace(/\s+/g, " ").trim();
  if (name.length < 3) return { ok: false, message: "A shop name needs at least 3 characters." };
  if (name.length > 40) return { ok: false, message: "A shop name can have at most 40 characters." };
  if (!NAME_RE.test(name)) return { ok: false, message: "Use letters, numbers, spaces and & ' . - only." };
  const key = nameKey(name);
  if (key.length < 3) return { ok: false, message: "A shop name needs at least 3 letters or numbers." };
  if (RESERVED_EXACT.includes(key) || RESERVED_CONTAINS.some((w) => key.includes(w))) {
    return { ok: false, message: "That name is reserved. Please choose another." };
  }
  return { ok: true, name };
}

// Asks the server if the name is free. If the server cannot be reached, the name passes here and the save will say.
export async function checkShopNameFree(raw, { ignoreShopId } = {}) {
  const local = checkShopName(raw);
  if (!local.ok) return local;
  try {
    return await checkShopNameOnServer(local.name, ignoreShopId);
  } catch {
    return local;
  }
}

// For a branch: "Nairobi Threads" becomes "Nairobi Threads Westlands", and so on.
export function suggestShopNames(raw, place) {
  const base = String(raw || "").replace(/\s+/g, " ").trim();
  if (!base) return [];
  const suffixes = [place, "Branch 2"].filter(Boolean);
  return suffixes
    .map((s) => `${base} ${s}`)
    .filter((n, i, all) => all.indexOf(n) === i && checkShopName(n).ok)
    .slice(0, 3);
}

// ---- Validation, shared by the screens ----
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_RE = /^\d{7,8}$/; // Kenyan national ID numbers have 7 or 8 digits
const KRA_RE = /^[AP]\d{9}[A-Z]$/i; // A for individuals, P for companies

export function validateAccountStep({ email, password, confirm }) {
  if (!EMAIL_RE.test(normalizeEmail(email))) return "Enter a valid email address.";
  if (String(password || "").length < 8) return "Your password must have at least 8 characters.";
  if (password !== confirm) return "The two passwords do not match.";
  return "";
}

export function validateDetailsStep(d) {
  const fullName = String(d.fullName || "").replace(/\s+/g, " ").trim();
  if (fullName.length < 5 || !fullName.includes(" ")) return "Enter your full name as it appears on your ID.";
  if (!ID_RE.test(String(d.idNumber || "").trim())) return "Enter your national ID number (7 or 8 digits).";
  if (d.kraPin && !KRA_RE.test(String(d.kraPin).trim())) return "A KRA PIN looks like A123456789B. Leave it empty if you do not have one.";
  if (!normalizePhone(d.phone || "")) return "Enter a valid phone number, for example 0712 345 678.";
  if (d.businessType !== "individual" && d.businessType !== "registered") return "Choose how you sell.";
  if (d.businessType === "registered") {
    if (String(d.businessName || "").trim().length < 3) return "Enter your registered business name.";
    if (String(d.businessRegNo || "").trim().length < 3) return "Enter your business registration number.";
  }
  return "";
}

// The pin and the place name the map gave for it.
const pinOf = (shop) =>
  inKenya(shop?.lat, shop?.lng)
    ? { lat: shop.lat, lng: shop.lng, placeName: String(shop.placeName || ""), placeTown: String(shop.placeTown || "") }
    : null;

// ---- Create an account and its first shop ----
// Returns { ok: true, session: { seller, shops, token } } for useSeller().login, or { ok: false, message }.
export async function registerSeller({ account, details, shop, consent }) {
  const fail = (message) => ({ ok: false, message });
  const problem = validateAccountStep(account) || validateDetailsStep(details);
  if (problem) return fail(problem);
  if (!consent?.terms || !consent?.data || !consent?.accurate) return fail("Please tick all three agreements to continue.");
  const nameCheck = checkShopName(shop?.name);
  if (!nameCheck.ok) return fail(nameCheck.message);
  const pin = pinOf(shop);
  if (!pin) return fail("Place the pin on the map to show exactly where your shop is.");
  try {
    const data = await sendRegistration({
      account: { email: normalizeEmail(account.email), password: account.password, emailProof: String(account.emailProof || "") },
      details: { ...details, phone: String(details.phone).trim() },
      shop: { name: nameCheck.name, description: String(shop.description || "").trim(), ...pin },
      consent: { terms: true, data: true, accurate: true },
    });
    return { ok: true, session: { seller: data.seller, shops: [data.shop], token: data.token } };
  } catch (err) {
    return fail(err.message);
  }
}

// ---- Open another shop (a branch) ----
export async function createShop(_ownerEmail, { name, description = "", lat, lng, placeName = "", placeTown = "" }) {
  const check = checkShopName(name);
  if (!check.ok) return { ok: false, message: check.message };
  if (!inKenya(lat, lng)) return { ok: false, message: "Place the pin on the map to show exactly where your shop is." };
  try {
    return { ok: true, shop: await createBranch({ name: check.name, description: String(description).trim(), lat, lng, placeName, placeTown }) };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

// ---- Sign in ----
// Returns { ok: true, session: { seller, shops, token } } or { ok: false, message }.
export async function signInSeller(emailRaw, password) {
  try {
    const data = await loginSeller(normalizeEmail(emailRaw), String(password || ""));
    return { ok: true, session: { seller: data.seller, shops: data.shops, token: data.token } };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

export const maskNationalId = (id) => {
  const s = String(id || "");
  return s ? "•".repeat(Math.max(0, s.length - 3)) + s.slice(-3) : "";
};

// ---- Old names still used by pages that have not been moved to the server yet. Removed in a later batch. ----
export const customShops = () => [];
export const ownerEmailOf = () => null;
export const sellerSummary = () => null;
export const ownedShops = () => [];
