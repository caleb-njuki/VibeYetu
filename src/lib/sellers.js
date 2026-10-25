// Seller accounts, the shops sellers open, and the shop-name rules.
// Kept in the browser for the demo. The backend database owns all of this later,
// and then passwords are hashed on the server (bcrypt or argon2), never in the browser.
import { shops as baseShops } from "../data/mock.js";
import { findArea } from "./areas.js";
import { normalizePhone } from "./format.js";
import { isClosed, isSuspended } from "./shopFlags.js";
import { getShopSettings, saveShopSettings } from "./shopProfile.js";

const ACCOUNTS_KEY = "vibeyetu_sellers";
const SHOPS_KEY = "vibeyetu_custom_shops";
const OWNERS_KEY = "vibeyetu_shop_owners"; // { email: [shopId, ...] }

export const TERMS_VERSION = "2026-10-24"; // bumped when fees, payouts and closing a shop were added to the Terms
// Pages fire this event after a rename or a new branch so the My Shop header refreshes.
export const SHOPS_CHANGED = "vibeyetu:shops-changed";
export const MAX_SHOPS_PER_SELLER = 10; // a guard against abuse; the owner can ask support for more

// ---- Demo accounts for the four sample shops. Switched off in a production build
// unless VITE_SHOW_DEMO=true is set. Remove this block when the backend arrives. ----
export const DEMO_ENABLED = Boolean(import.meta.env?.DEV) || import.meta.env?.VITE_SHOW_DEMO === "true";
export const DEMO_PASSWORD = "Demo@1234";
export const DEMO_ACCOUNTS = [
  { email: "threads@demo.vibeyetu.ke", label: "Nairobi Threads", fullName: "Demo Seller One", shopIds: ["s1"] },
  { email: "techhub@demo.vibeyetu.ke", label: "Kilimani Tech Hub", fullName: "Demo Seller Two", shopIds: ["s2"] },
  { email: "crafts@demo.vibeyetu.ke", label: "Karen Crafts & Pantry", fullName: "Demo Seller Three", shopIds: ["s3"] },
  { email: "bazaar@demo.vibeyetu.ke", label: "Nyali Beach Bazaar", fullName: "Demo Seller Four", shopIds: ["s4"] },
];

// ---- Browser storage helpers ----
function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const asArray = (v) => (Array.isArray(v) ? v : []);
const asMap = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

const accounts = () => asArray(readJson(ACCOUNTS_KEY, [])).filter((a) => a && typeof a.email === "string");
const owners = () => asMap(readJson(OWNERS_KEY, {}));

export const customShops = () =>
  asArray(readJson(SHOPS_KEY, [])).filter((s) => s && typeof s.id === "string" && typeof s.name === "string");

export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const demoFor = (email) => (DEMO_ENABLED ? DEMO_ACCOUNTS.find((d) => d.email === normalizeEmail(email)) : undefined);

// ---- Shops owned by one seller (the main shop and every branch) ----
// Every shop the account ever had, including closed ones.
function allShopIdsFor(email) {
  const key = normalizeEmail(email);
  const extra = asArray(owners()[key]).filter((id) => typeof id === "string");
  return [...new Set([...(demoFor(key)?.shopIds || []), ...extra])];
}

// The shops the seller can work on now. A closed shop is not one of them.
export function shopIdsFor(email) {
  return allShopIdsFor(email).filter((id) => !isClosed(id));
}

export function ownerEmailOf(shopId) {
  const demo = DEMO_ACCOUNTS.find((d) => d.shopIds.includes(shopId));
  if (demo) return demo.email;
  const entry = Object.entries(owners()).find(([, ids]) => asArray(ids).includes(shopId));
  return entry ? entry[0] : null;
}

// ---- Shop names. The name works like a username, so it must be unique. ----
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 &'.-]*$/;
const RESERVED_CONTAINS = ["vibeyetu", "safaricom", "mpesa"];
const RESERVED_EXACT = ["admin", "support", "official", "help", "escrow", "kra"];

// "Nairobi  Threads!", "nairobi-threads" and "NAIROBI THREADS" all become "nairobithreads".
export function nameKey(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
}

// Every shop on the platform with its current name (sample shops, seller shops, renamed shops).
function allShops() {
  return [...baseShops, ...customShops()].map((s) => {
    const renamed = getShopSettings(s.id).public.name;
    return renamed ? { ...s, name: renamed } : s;
  });
}

// `ignoreShopId` lets a shop keep its own name when its owner edits settings.
export function checkShopName(raw, { ignoreShopId } = {}) {
  const name = String(raw || "").replace(/\s+/g, " ").trim();
  if (name.length < 3) return { ok: false, message: "A shop name needs at least 3 characters." };
  if (name.length > 40) return { ok: false, message: "A shop name can have at most 40 characters." };
  if (!NAME_RE.test(name)) return { ok: false, message: "Use letters, numbers, spaces and & ' . - only." };
  const key = nameKey(name);
  if (key.length < 3) return { ok: false, message: "A shop name needs at least 3 letters or numbers." };
  if (RESERVED_EXACT.includes(key) || RESERVED_CONTAINS.some((w) => key.includes(w))) {
    return { ok: false, message: "That name is reserved. Please choose another." };
  }
  if (allShops().some((s) => s.id !== ignoreShopId && nameKey(s.name) === key)) {
    return { ok: false, taken: true, message: "That shop name is already taken." };
  }
  return { ok: true, name };
}

// For a branch: "Nairobi Threads" becomes "Nairobi Threads Westlands", and so on.
export function suggestShopNames(raw, areaId) {
  const base = String(raw || "").replace(/\s+/g, " ").trim();
  if (!base) return [];
  const area = findArea(areaId);
  const suffixes = [area?.name, area?.town, "Branch 2"].filter(Boolean);
  return suffixes
    .map((s) => `${base} ${s}`)
    .filter((n, i, all) => all.indexOf(n) === i && checkShopName(n).ok)
    .slice(0, 3);
}

// ---- Validation, shared by the screens and by the save functions ----
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_RE = /^\d{7,8}$/; // Kenyan national ID numbers have 7 or 8 digits
const KRA_RE = /^[AP]\d{9}[A-Z]$/i; // A for individuals, P for companies

export function validateAccountStep({ email, password, confirm }) {
  const key = normalizeEmail(email);
  if (!EMAIL_RE.test(key)) return "Enter a valid email address.";
  if (demoFor(key) || accounts().some((a) => a.email === key)) {
    return "An account with this email already exists. Please sign in instead.";
  }
  if (String(password || "").length < 8) return "Your password must have at least 8 characters.";
  if (password !== confirm) return "The two passwords do not match.";
  return "";
}

export function validateDetailsStep(d) {
  const fullName = String(d.fullName || "").replace(/\s+/g, " ").trim();
  if (fullName.length < 5 || !fullName.includes(" ")) return "Enter your full name as it appears on your ID.";
  const id = String(d.idNumber || "").trim();
  if (!ID_RE.test(id)) return "Enter your national ID number (7 or 8 digits).";
  // The same ID number may be used for several accounts and shops. Only the shop name must be unique.
  if (d.kraPin && !KRA_RE.test(String(d.kraPin).trim())) return "A KRA PIN looks like A123456789B. Leave it empty if you do not have one.";
  if (!normalizePhone(d.phone || "")) return "Enter a valid phone number, for example 0712 345 678.";
  if (d.businessType !== "individual" && d.businessType !== "registered") return "Choose how you sell.";
  if (d.businessType === "registered") {
    if (String(d.businessName || "").trim().length < 3) return "Enter your registered business name.";
    if (String(d.businessRegNo || "").trim().length < 3) return "Enter your business registration number.";
  }
  return "";
}

// ---- Opening a shop (the first shop at sign-up, or a branch later) ----
export function createShop(ownerEmail, { name, areaId, description = "" }) {
  const email = normalizeEmail(ownerEmail);
  if (!shopIdsFor(email).length && !accounts().some((a) => a.email === email)) {
    return { ok: false, message: "Please sign in again." };
  }
  if (shopIdsFor(email).length >= MAX_SHOPS_PER_SELLER) {
    return { ok: false, message: `You can run up to ${MAX_SHOPS_PER_SELLER} shops. Contact support if you need more.` };
  }
  const check = checkShopName(name);
  if (!check.ok) return { ok: false, message: check.message };
  const area = findArea(areaId);
  if (!area) return { ok: false, message: "Choose the area your shop is in." };

  const shop = {
    id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: check.name,
    areaId: area.id,
    area: area.name,
    town: area.town,
    lat: area.lat,
    lng: area.lng,
    opens: "08:00",
    closes: "18:00",
    verified: false,
    rating: 0,
    reviews: 0,
    since: new Date().getFullYear(),
    description: String(description || "").trim().slice(0, 300),
    fulfillment: ["delivery", "pickup"],
    ownerEmail: email,
    createdAt: Date.now(),
  };
  const map = owners();
  const savedShop = writeJson(SHOPS_KEY, [...customShops(), shop]);
  const savedOwner = writeJson(OWNERS_KEY, { ...map, [email]: [...asArray(map[email]), shop.id] });
  if (!savedShop || !savedOwner) {
    return { ok: false, message: "Your browser blocked saving. Allow site data and try again." };
  }
  // The seller's phone becomes the shop's private contact number. Buyers never see it.
  const phone = accounts().find((a) => a.email === email)?.phone;
  if (phone) saveShopSettings(shop.id, { public: {}, private: { phone, payout: "" } });
  return { ok: true, shop };
}

// ---- Passwords (demo only) ----
async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Very weak fallback for pages opened over plain http. The backend replaces all of this.
  let h = 5381;
  data.forEach((b) => {
    h = ((h * 33) ^ b) >>> 0;
  });
  return "weak-" + h.toString(16);
}

const newSalt = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// ---- Create an account and its first shop ----
// input: { account: {email, password, confirm}, details: {...}, shop: {name, areaId, description},
//          consent: {terms, data, accurate} }
export async function registerSeller({ account, details, shop, consent }) {
  const fail = (message) => ({ ok: false, message });
  const problem = validateAccountStep(account) || validateDetailsStep(details);
  if (problem) return fail(problem);
  if (!consent?.terms || !consent?.data || !consent?.accurate) return fail("Please tick all three agreements to continue.");
  const nameCheck = checkShopName(shop?.name);
  if (!nameCheck.ok) return fail(nameCheck.message);
  if (!findArea(shop?.areaId)) return fail("Choose the area your shop is in.");

  const email = normalizeEmail(account.email);
  const salt = newSalt();
  const record = {
    email,
    salt,
    passwordHash: await hashPassword(account.password, salt),
    fullName: String(details.fullName).replace(/\s+/g, " ").trim(),
    idNumber: String(details.idNumber).trim(),
    kraPin: details.kraPin ? String(details.kraPin).trim().toUpperCase() : "",
    phone: normalizePhone(details.phone),
    businessType: details.businessType,
    businessName: details.businessType === "registered" ? String(details.businessName).trim() : "",
    businessRegNo: details.businessType === "registered" ? String(details.businessRegNo).trim() : "",
    // Each agreement is recorded separately, with the time and the version of the terms.
    consent: { termsVersion: TERMS_VERSION, at: Date.now(), terms: true, dataUse: true, accuracy: true },
    createdAt: Date.now(),
  };

  // Re-check after the (async) hashing so two tabs cannot both take the same email.
  if (accounts().some((a) => a.email === email)) return fail("An account with this email already exists. Please sign in instead.");

  if (!writeJson(ACCOUNTS_KEY, [...accounts(), record])) {
    return fail("Your browser blocked saving. Allow site data and try again.");
  }
  const made = createShop(email, shop);
  if (!made.ok) {
    // Roll back the account so the person can fix the shop details and try again.
    writeJson(
      ACCOUNTS_KEY,
      accounts().filter((a) => a.email !== email)
    );
    return fail(made.message);
  }
  return { ok: true, seller: { email, shopId: made.shop.id } };
}

// ---- Sign in ----
export async function signInSeller(emailRaw, password) {
  const email = normalizeEmail(emailRaw);
  let valid = false;
  const demo = demoFor(email);
  if (demo) {
    valid = password === DEMO_PASSWORD;
  } else {
    const acc = accounts().find((a) => a.email === email);
    if (acc) valid = (await hashPassword(String(password || ""), acc.salt)) === acc.passwordHash;
  }
  // The same message for a wrong email and a wrong password, so nobody can probe for accounts.
  if (!valid) return { ok: false, message: "The email or password is not correct." };
  const ids = shopIdsFor(email);
  if (!ids.length) {
    // The password was right, so it is safe to say why there is nothing to open.
    return {
      ok: false,
      message: allShopIdsFor(email).length
        ? "Your shop is closed. Contact support if you want to reopen it."
        : "This account has no shop yet. Please contact support.",
    };
  }
  return { ok: true, seller: { email, shopId: ids[0] } };
}

// ---- Reading back ----
export function ownedShops(email) {
  const ids = shopIdsFor(email);
  const byId = new Map(allShops().map((s) => [s.id, s]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((s) => ({ id: s.id, name: s.name, town: s.town, area: s.area, suspended: isSuspended(s.id) }));
}

export const maskNationalId = (id) => {
  const s = String(id || "");
  return s ? "•".repeat(Math.max(0, s.length - 3)) + s.slice(-3) : "";
};

// What admin sees about a seller. The ID is masked here; the backend will show the full
// number only to authorised staff and will log every time it is opened.
export function sellerSummary(email) {
  const key = normalizeEmail(email);
  if (!key) return null;
  const branchCount = shopIdsFor(key).length;
  const demo = demoFor(key);
  if (demo) return { email: key, fullName: demo.fullName, demo: true, branchCount };
  const a = accounts().find((x) => x.email === key);
  if (!a) return null;
  return {
    email: a.email,
    fullName: a.fullName,
    phone: a.phone,
    idMasked: maskNationalId(a.idNumber),
    kraPin: a.kraPin || "",
    businessType: a.businessType,
    businessName: a.businessName || "",
    businessRegNo: a.businessRegNo || "",
    consentAt: a.consent?.at,
    termsVersion: a.consent?.termsVersion,
    branchCount,
  };
}
