// Resetting a forgotten password with a one-time code (OTP) sent to the phone the seller signed up with.
// Kept in the browser for the demo. On the backend the same rules run on the server: the code is sent by
// SMS, checked there, and the new password is hashed there (argon2). The code can never be read by the page.
import { maskPhone, normalizePhone } from "./format.js";
import { resetSellerPassword, sellerSummary } from "./sellers.js";
import { addNotice } from "./suspensions.js";

export const RESET_CODE_LENGTH = 6;
export const RESET_DEMO_CODE = "123456"; // Demo only. Real codes arrive by SMS with the backend.
const TTL_MS = 5 * 60 * 1000; // a code works for 5 minutes
const RESEND_MS = 30 * 1000; // wait before asking for another code
const MAX_TRIES = 5; // wrong codes allowed before resetting is locked
const LOCK_MS = 10 * 60 * 1000;
const CHANGE_MS = 5 * 60 * 1000; // time to choose the new password after the code is accepted
const LOCK_KEY = "vibeyetu_password_reset_lock"; // { [email]: unlockTimestamp }

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const challenges = new Map(); // email -> { sentAt, expiresAt, tries }
const verified = new Map(); // email -> time until which a new password may be saved

function readLocks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCK_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const lockedUntil = (email) => Number(readLocks()[email]) || 0;

function lock(email, until) {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify({ ...readLocks(), [email]: until }));
  } catch {
    // Without storage the in-memory limit below still applies.
  }
}

const minutesLeft = (until) => Math.max(1, Math.ceil((until - Date.now()) / 60000));
const lockedMessage = (until) => `Too many wrong codes. For your safety, try again in ${minutesLeft(until)} minutes.`;
const keyOf = (email) => String(email || "").trim().toLowerCase();

// The phone the seller signed up with. It cannot be edited in Settings, so someone using an open
// session cannot send the code to their own phone. Demo accounts have none.
export function resetPhoneFor(email) {
  return normalizePhone(sellerSummary(email)?.phone || "") || null;
}

export async function requestResetCode(emailRaw) {
  const email = keyOf(emailRaw);
  const phone = resetPhoneFor(email);
  if (!phone) {
    return {
      ok: false,
      message: "We have no phone number to send a code to for this account. Contact support to reset your password.",
    };
  }
  const until = lockedUntil(email);
  if (until > Date.now()) return { ok: false, message: lockedMessage(until) };
  const prev = challenges.get(email);
  if (prev && Date.now() - prev.sentAt < RESEND_MS) {
    const seconds = Math.ceil((RESEND_MS - (Date.now() - prev.sentAt)) / 1000);
    return { ok: false, message: `Please wait ${seconds} seconds before asking for another code.` };
  }
  await wait(500);
  const sentAt = Date.now();
  // A new code replaces the old one. Wrong tries carry over, so asking again does not reset the limit.
  challenges.set(email, { sentAt, expiresAt: sentAt + TTL_MS, tries: prev ? prev.tries : 0 });
  return { ok: true, phone: maskPhone(phone), resendInMs: RESEND_MS };
}

export async function verifyResetCode(emailRaw, code) {
  const email = keyOf(emailRaw);
  await wait(400);
  const now = Date.now();
  const until = lockedUntil(email);
  if (until > now) return { ok: false, locked: true, message: lockedMessage(until) };
  const c = challenges.get(email);
  if (!c) return { ok: false, expired: true, message: "Ask for a new code first." };
  if (now > c.expiresAt) {
    challenges.delete(email);
    return { ok: false, expired: true, message: "That code has expired. Ask for a new one." };
  }
  if (String(code || "").trim() !== RESET_DEMO_CODE) {
    c.tries += 1;
    if (c.tries >= MAX_TRIES) {
      challenges.delete(email);
      lock(email, now + LOCK_MS);
      return { ok: false, locked: true, message: "Too many wrong codes. For your safety, password reset is locked for 10 minutes." };
    }
    const left = MAX_TRIES - c.tries;
    return { ok: false, message: `That code is not correct. ${left} ${left === 1 ? "try" : "tries"} left.` };
  }
  challenges.delete(email); // a code works once
  verified.set(email, now + CHANGE_MS);
  return { ok: true };
}

// Saving only works right after a code was accepted. The backend enforces the same rule.
export async function completePasswordReset(emailRaw, newPassword, confirm, shopId) {
  const email = keyOf(emailRaw);
  const until = verified.get(email);
  if (!until || Date.now() > until) return { ok: false, expired: true, message: "Your code expired. Please start again." };
  const result = await resetSellerPassword(email, newPassword, confirm);
  if (!result.ok) return result;
  verified.delete(email);
  // The notice reaches the bell, so a seller notices a change they did not make.
  if (shopId) {
    addNotice(shopId, { text: "Your password was changed. If this was not you, contact support now.", href: "/my-shop/settings" });
  }
  return { ok: true };
}
