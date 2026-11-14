// Talking to Safaricom Daraja (M-Pesa). Only this file knows how the Daraja web calls look.
// Secrets are read from config and never printed.
import { constants, publicEncrypt, X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

// ---- Money OUT: B2C (to a phone) and B2B (to a Till or Paybill) ----

// Safaricom wants the initiator's password locked with its public certificate (RSA). The certificate file comes
// from the Daraja portal (sandbox) or from Safaricom (live).
let cachedCredential = null;
function securityCredential() {
  if (config.payouts.securityCredential) return config.payouts.securityCredential; // pasted from the Daraja portal
  const { initiatorPassword, certPath } = config.payouts;
  if (cachedCredential?.key === `${certPath}|${initiatorPassword}`) return cachedCredential.value;
  const cert = new X509Certificate(readFileSync(certPath)); // accepts the .cer (binary) and the .pem (text) forms
  const value = publicEncrypt({ key: cert.publicKey, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(initiatorPassword)).toString('base64');
  cachedCredential = { key: `${certPath}|${initiatorPassword}`, value };
  return value;
}

const resultUrl = () => `${config.payments.daraja.baseCallbackUrl}/result/${config.payments.daraja.callbackSecret}`;
const timeoutUrl = () => `${config.payments.daraja.baseCallbackUrl}/timeout/${config.payments.daraja.callbackSecret}`;

// Sends a payout request. On failure the error says whether M-Pesa could have accepted it:
//   err.refused = true   the request was NOT accepted (safe to try again)
//   err.unknown = true   we cannot tell (a network failure after sending): do NOT send again without checking
async function sendPayout(path, body) {
  let token;
  try {
    token = await getToken();
    body = { ...body, SecurityCredential: securityCredential() };
  } catch (err) {
    err.refused = true; // nothing was sent yet
    throw err;
  }
  let r;
  try {
    r = await call(path, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
  } catch (err) {
    err.unknown = true;
    throw err;
  }
  if (!r.ok || String(r.data?.ResponseCode) !== '0' || !r.data?.ConversationID) {
    const err = httpError(502, `M-Pesa did not accept the payout: ${r.data?.errorMessage || r.data?.ResponseDescription || 'HTTP ' + r.status}`);
    err.refused = r.status >= 400 && r.status < 500 ? true : false;
    err.unknown = !err.refused;
    console.error('Daraja: payout request refused. HTTP status:', r.status, 'code:', r.data?.errorCode || r.data?.ResponseCode, r.data?.errorMessage || r.data?.ResponseDescription || '');
    throw err;
  }
  return { conversationId: r.data.ConversationID, originatorConversationId: r.data.OriginatorConversationID };
}

// To a phone. phone: "254712345678".
export const b2cPay = ({ phone, amount, remarks = 'VibeYetu payout' }) =>
  sendPayout('/mpesa/b2c/v1/paymentrequest', {
    InitiatorName: config.payouts.initiatorName,
    CommandID: 'BusinessPayment',
    Amount: amount,
    PartyA: config.payouts.shortcode,
    PartyB: phone,
    Remarks: String(remarks).slice(0, 100),
    QueueTimeOutURL: timeoutUrl(),
    ResultURL: resultUrl(),
    Occasion: 'VibeYetu',
  });

// To a Till (BusinessBuyGoods) or a Paybill (BusinessPayBill).
export const b2bPay = ({ kind, number, account, amount, remarks = 'VibeYetu payout' }) =>
  sendPayout('/mpesa/b2b/v1/paymentrequest', {
    Initiator: config.payouts.initiatorName,
    CommandID: kind === 'paybill' ? 'BusinessPayBill' : 'BusinessBuyGoods',
    SenderIdentifierType: '4',
    RecieverIdentifierType: '4',
    Amount: amount,
    PartyA: config.payouts.shortcode,
    PartyB: number,
    AccountReference: String(account || 'VibeYetu').slice(0, 20),
    Remarks: String(remarks).slice(0, 100),
    QueueTimeOutURL: timeoutUrl(),
    ResultURL: resultUrl(),
  });
