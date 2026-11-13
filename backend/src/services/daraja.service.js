// Talking to Safaricom Daraja (M-Pesa). Only this file knows how the Daraja web calls look.
// Secrets are read from config and never printed.
import { config } from '../config/env.js';
import { httpError } from '../utils/httpError.js';

const TIMEOUT_MS = 15000;
let cachedToken = null; // { value, expiresAt }

const cfg = () => config.payments.daraja;

// Daraja wants the time in Kenya (EAT, UTC+3) as YYYYMMDDHHmmss.
export function timestamp(now = Date.now()) {
  return new Date(now + 3 * 3600 * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

async function call(path, { method = 'GET', headers = {}, body } = {}) {
  let response;
  try {
    response = await fetch(`${cfg().baseUrl}${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error('Daraja request failed:', path, err.name);
    throw httpError(502, 'We could not reach M-Pesa. You have not been charged. Please try again.');
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Not JSON: treated as an error below.
  }
  return { status: response.status, ok: response.ok, data };
}

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.value;
  const basic = Buffer.from(`${cfg().consumerKey}:${cfg().consumerSecret}`).toString('base64');
  const r = await call('/oauth/v1/generate?grant_type=client_credentials', { headers: { Authorization: `Basic ${basic}` } });
  if (!r.ok || !r.data?.access_token) {
    console.error('Daraja: could not get an access token. HTTP status:', r.status, '- check DARAJA_CONSUMER_KEY and DARAJA_CONSUMER_SECRET');
    throw httpError(502, 'We could not reach M-Pesa. You have not been charged. Please try again.');
  }
  cachedToken = { value: r.data.access_token, expiresAt: Date.now() + (Number(r.data.expires_in) || 3000) * 1000 };
  return cachedToken.value;
}

export const clearTokenCache = () => { cachedToken = null; };

const password = (ts) => Buffer.from(`${cfg().shortcode}${cfg().passkey}${ts}`).toString('base64');

// Asks M-Pesa to show the PIN prompt on the buyer's phone. phone: "254712345678". amount: whole shillings.
export async function stkPush({ phone, amount, reference, description = 'VibeYetu order' }) {
  const token = await getToken();
  const ts = timestamp();
  const r = await call('/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      BusinessShortCode: cfg().shortcode,
      Password: password(ts),
      Timestamp: ts,
      TransactionType: cfg().transactionType,
      Amount: amount,
      PartyA: phone,
      PartyB: cfg().partyB,
      PhoneNumber: phone,
      CallBackURL: cfg().callbackUrl,
      AccountReference: String(reference).slice(0, 12),
      TransactionDesc: String(description).slice(0, 20),
    },
  });
  if (!r.ok || String(r.data?.ResponseCode) !== '0' || !r.data?.CheckoutRequestID) {
    console.error('Daraja: the payment request was refused. HTTP status:', r.status, 'code:', r.data?.errorCode || r.data?.ResponseCode, r.data?.errorMessage || r.data?.ResponseDescription || '');
    throw httpError(502, 'M-Pesa did not accept the payment request. You have not been charged. Please check the number and try again.');
  }
  return { merchantRequestId: r.data.MerchantRequestID, checkoutRequestId: r.data.CheckoutRequestID };
}

// Asks M-Pesa how a payment ended, for when the callback did not arrive.
// Returns { done: false } while it is still being processed, or { done: true, resultCode, resultDesc }.
export async function stkQuery(checkoutRequestId) {
  const token = await getToken();
  const ts = timestamp();
  const r = await call('/mpesa/stkpushquery/v1/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { BusinessShortCode: cfg().shortcode, Password: password(ts), Timestamp: ts, CheckoutRequestID: checkoutRequestId },
  });
  // While a payment is still being processed Daraja answers with an error ("The transaction is being processed").
  if (r.data && r.data.ResultCode !== undefined && r.data.ResultCode !== null && r.data.ResultCode !== '') {
    return { done: true, resultCode: Number(r.data.ResultCode), resultDesc: String(r.data.ResultDesc || '') };
  }
  return { done: false };
}
