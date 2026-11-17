// Resetting a password with a one-time code sent by email to the address the seller signed up with.
// The server sends the code, checks it and saves the new password. The page never sees the code.
// Two ways to use it:
//   account = false  the seller forgot the password and is not signed in      (/auth/seller/forgot/...)
//   account = true   the seller is signed in and is asked for a new password    (/seller/account/password/...)
import { ApiError, post, setToken } from "../services/http.js";

export const RESET_CODE_LENGTH = 6;

const fail = (err) => ({ ok: false, message: err.message, expired: err instanceof ApiError && err.status === 410 });

// Step 1: send the code.
export async function requestResetCode(email, account = false) {
  try {
    const data = account
      ? await post("/seller/account/password/code", {}, "seller")
      : await post("/auth/seller/forgot/code", { email: String(email || "").trim() });
    return { ok: true, sentTo: data.sentTo, resendInMs: data.resendInMs || 30000 };
  } catch (err) {
    return fail(err);
  }
}

// Step 2: check the code.
export async function verifyResetCode(email, code, account = false) {
  try {
    const body = { code: String(code || "").trim() };
    if (account) await post("/seller/account/password/verify", body, "seller");
    else await post("/auth/seller/forgot/verify", { email: String(email || "").trim(), ...body });
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// Step 3: save the new password. Every older login ends. A signed-in seller gets a new token and stays signed in.
export async function completePasswordReset(email, password, confirm, account = false) {
  try {
    if (account) {
      const data = await post("/seller/account/password/reset", { password, confirm }, "seller");
      if (data.token) setToken("seller", data.token);
    } else {
      await post("/auth/seller/forgot/reset", { email: String(email || "").trim(), password, confirm });
    }
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
