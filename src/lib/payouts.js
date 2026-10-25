// Where a shop's money is paid, and the one-time code (OTP) needed to change it.
// Kept in the browser for the demo. On the backend the same rules run on the server:
// the code is sent by SMS, checked there, and the payout record is saved there.
import { localPhone, maskPhone, normalizePhone } from "./format.js";
import { getShopSettings } from "./shopProfile.js";
import { sellerSummary } from "./sellers.js";
import { addNotice } from "./suspensions.js";

const KEY = "vibeyetu_payout_methods"; // { [shopId]: { method, ...fields, updatedAt } }
const LOCK_KEY = "vibeyetu_payout_otp_lock"; // { [shopId]: unlockTimestamp }

export const PAYOUT_METHODS = [
  { id: "till", label: "Till number (Buy Goods)", hint: "Your Lipa na M-Pesa till. It has 5 to 7 digits." },
  { id: "paybill", label: "Paybill", hint: "Your business number and the account number to pay into." },
  { id: "pochi", label: "Pochi la Biashara", hint: "Paid to the phone number your Pochi la Biashara is on." },
  { id: "mpesa", label: "M-Pesa number", hint: "A personal M-Pesa number." },
];

export const OTP_LENGTH = 6;
export const PAYOUT_DEMO_CODE = "123456"; // Demo only. Real codes arrive by SMS with the backend.
const OTP_TTL_MS = 5 * 60 * 1000; // a code works for 5 minutes
const RESEND_MS = 30 * 1000; // wait before asking for another code
const MAX_TRIES = 5; // wrong codes allowed before the change is locked
const LOCK_MS = 10 * 60 * 1000;
const VERIFIED_MS = 2 * 60 * 1000; // time to save after the code is accepted

const TILL_RE = /^\d{5,7}$/;
const PAYBILL_RE = /^\d{5,7}$/;
const ACCOUNT_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,19}$/;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const compact = (v) => String(v || "").replace(/\s+/g, "");

// ---- Browser storage ----
function readMap(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ---- Checking what the seller typed ----
// Returns { ok: true, value } with clean fields, or { ok: false, message }.
export function validatePayout(draft) {
  const method = draft?.method;
  if (method === "till") {
    const till = compact(draft.till);
    if (!TILL_RE.test(till)) return { ok: false, message: "A till number has 5 to 7 digits, for example 5123456." };
    return { ok: true, value: { method, till } };
  }
  if (method === "paybill") {
    const paybill = compact(draft.paybill);
    const account = String(draft.account || "").replace(/\s+/g, " ").trim();
    if (!PAYBILL_RE.test(paybill)) return { ok: false, message: "A paybill number has 5 to 7 digits, for example 247247." };
    if (!ACCOUNT_RE.test(account)) {
      return { ok: false, message: "Enter the account number: letters and numbers only, up to 20 characters." };
    }
    return { ok: true, value: { method, paybill, account } };
  }
  if (method === "pochi" || method === "mpesa") {
    const phone = normalizePhone(draft.phone || "");
    if (!phone) return { ok: false, message: "Enter a valid phone number, for example 0712 345 678." };
    return { ok: true, value: { method, phone } };
  }
  return { ok: false, message: "Choose how you want to be paid." };
}

export function samePayout(a, b) {
  if (!a || !b || a.method !== b.method) return false;
  return a.till === b.till && a.paybill === b.paybill && a.account === b.account && a.phone === b.phone;
}

const maskDigits = (s) => {
  const v = String(s || "");
  return "•".repeat(Math.max(0, v.length - 3)) + v.slice(-3);
};

export const methodLabel = (id) => PAYOUT_METHODS.find((m) => m.id === id)?.label || "Payout method";

// A short sentence for screens and notices. Numbers are hidden unless `full` is true.
export function describePayout(p, full = false) {
  if (!p) return "";
  if (p.method === "till") return `Till ${full ? p.till : maskDigits(p.till)}`;
  if (p.method === "paybill") return `Paybill ${full ? p.paybill : maskDigits(p.paybill)}, account ${full ? p.account : maskDigits(p.account)}`;
  const number = full ? localPhone(p.phone) : maskPhone(p.phone);
  return `${p.method === "pochi" ? "Pochi la Biashara" : "M-Pesa"} ${number}`;
}

// ---- Reading and saving ----
// A shop saved before payout methods existed only has an M-Pesa number. It still counts.
export function getPayout(shopId) {
  const saved = readMap(KEY)[shopId];
  if (saved) {
    const checked = validatePayout(saved);
    if (checked.ok) return { ...checked.value, updatedAt: saved.updatedAt };
  }
  const legacy = normalizePhone(getShopSettings(shopId).private.payout || "");
  return legacy ? { method: "mpesa", phone: legacy, legacy: true } : null;
}

export const hasPayout = (shopId) => Boolean(getPayout(shopId));

// ---- The one-time code ----
// The code goes to the phone the seller signed up with. That number cannot be edited in Settings,
// so someone who borrows an open session cannot send the code to their own phone.
// Sample shops have no sign-up phone, so they use the shop's contact phone.
export function otpPhoneFor(email, shopId) {
  const signUpPhone = normalizePhone(sellerSummary(email)?.phone || "");
  return signUpPhone || normalizePhone(getShopSettings(shopId).private.phone || "") || null;
}

const challenges = new Map(); // shopId -> { sentAt, expiresAt, tries }
const verified = new Map(); // shopId -> time until which a save is allowed

const lockedUntil = (shopId) => Number(readMap(LOCK_KEY)[shopId]) || 0;

function lockShop(shopId, until) {
  const all = readMap(LOCK_KEY);
  all[shopId] = until;
  writeMap(LOCK_KEY, all);
}

const minutesLeft = (until) => Math.max(1, Math.ceil((until - Date.now()) / 60000));

export async function requestPayoutOtp(email, shopId) {
  const phone = otpPhoneFor(email, shopId);
  if (!phone) {
    return {
      ok: false,
      message: "We have no phone number to send the code to. Add your contact phone above, save it, then try again.",
    };
  }
  const lock = lockedUntil(shopId);
  if (lock > Date.now()) {
    return { ok: false, message: `Too many wrong codes. For your safety, try again in ${minutesLeft(lock)} minutes.` };
  }
  const prev = challenges.get(shopId);
  if (prev && Date.now() - prev.sentAt < RESEND_MS) {
    const seconds = Math.ceil((RESEND_MS - (Date.now() - prev.sentAt)) / 1000);
    return { ok: false, message: `Please wait ${seconds} seconds before asking for another code.` };
  }
  await wait(500);
  const sentAt = Date.now();
  // A new code replaces the old one. Wrong tries carry over, so asking again does not reset the limit.
  challenges.set(shopId, { sentAt, expiresAt: sentAt + OTP_TTL_MS, tries: prev ? prev.tries : 0 });
  return { ok: true, phone: maskPhone(phone), resendInMs: RESEND_MS };
}

export async function verifyPayoutOtp(shopId, code) {
  await wait(400);
  const now = Date.now();
  const lock = lockedUntil(shopId);
  if (lock > now) {
    return { ok: false, locked: true, message: `Too many wrong codes. For your safety, try again in ${minutesLeft(lock)} minutes.` };
  }
  const c = challenges.get(shopId);
  if (!c) return { ok: false, expired: true, message: "Ask for a new code first." };
  if (now > c.expiresAt) {
    challenges.delete(shopId);
    return { ok: false, expired: true, message: "That code has expired. Ask for a new one." };
  }
  if (String(code || "").trim() !== PAYOUT_DEMO_CODE) {
    c.tries += 1;
    if (c.tries >= MAX_TRIES) {
      challenges.delete(shopId);
      lockShop(shopId, now + LOCK_MS);
      return { ok: false, locked: true, message: "Too many wrong codes. For your safety, payout changes are locked for 10 minutes." };
    }
    const left = MAX_TRIES - c.tries;
    return { ok: false, message: `That code is not correct. ${left} ${left === 1 ? "try" : "tries"} left.` };
  }
  challenges.delete(shopId); // a code works once
  verified.set(shopId, now + VERIFIED_MS);
  return { ok: true };
}

// Saving only works right after a code was accepted. The backend enforces the same rule.
export function savePayout(shopId, value) {
  const until = verified.get(shopId);
  if (!until || Date.now() > until) return { ok: false, message: "Your code expired. Please start the change again." };
  const checked = validatePayout(value);
  if (!checked.ok) return checked;
  const all = readMap(KEY);
  all[shopId] = { ...checked.value, updatedAt: Date.now() };
  if (!writeMap(KEY, all)) return { ok: false, message: "Your browser blocked saving. Allow site data and try again." };
  verified.delete(shopId);
  // The notice reaches the bell, so a seller notices a change they did not make.
  addNotice(shopId, {
    text: `Your payout method was changed to ${describePayout(checked.value)}. If this was not you, contact support now.`,
    href: "/my-shop/settings",
  });
  return { ok: true, payout: getPayout(shopId) };
}
