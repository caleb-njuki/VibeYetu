// Money OUT: paying sellers and refunding buyers through M-Pesa.
//
// The escrow ledger (escrow.service.js) decides who gets what. In the same database transaction it calls queuePayout(),
// which adds a row here. A worker (processPayouts, run every 30 seconds) then sends each row to M-Pesa, and Safaricom
// reports the result to /hooks/mpesa/result/<secret>. Nothing is ever sent twice: one row per order and kind, and a
// request whose outcome we cannot tell goes to staff ("review") instead of being sent again.
import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { httpError } from '../utils/httpError.js';
import { withTransaction } from '../utils/transaction.js';
import { b2bPay, b2cPay } from './daraja.service.js';
import { addShopNotice } from './notification.service.js';
import { formatKES } from '../utils/orderRules.js';

const MAX_REFUSED_ATTEMPTS = 3; // a request M-Pesa clearly refused is tried again a few times, 5 minutes apart
const STUCK_MINUTES = 15; // "sent" with no result for this long is shown to staff

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const money = (n) => formatKES(n);

// ---- Called by the escrow ledger, inside its transaction `c` ----
// kind: 'seller_payout' | 'buyer_refund'. `order` is the order row.
export async function queuePayout(c, order, kind, amount) {
  if (!(amount > 0)) return;
  const info = (await c.query(
    `SELECT g.payment_provider, g.payment_phone FROM orders o JOIN checkout_groups g ON g.id = o.group_id WHERE o.id = $1`,
    [order.id]
  )).rows[0];

  let status = 'queued';
  let note = null;
  let phone = null;
  if (!info || info.payment_provider !== 'mpesa') {
    status = 'skipped'; // the buyer's payment was simulated: no real money exists to move
    note = 'The buyer payment was simulated, so no real money was moved.';
  } else if (kind === 'buyer_refund') {
    phone = info.payment_phone ? info.payment_phone.replace(/^\+/, '') : null;
    if (!phone) { status = 'review'; note = 'No phone number to refund to.'; }
  } else {
    const has = (await c.query('SELECT 1 FROM payout_methods WHERE shop_id = $1', [order.shop_id])).rows[0];
    if (!has) status = 'waiting_method';
  }
  await c.query(
    `INSERT INTO payouts (kind, order_id, shop_id, amount, status, phone, last_error) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [kind, order.id, kind === 'seller_payout' ? order.shop_id : null, amount, status, phone, note]
  );
  if (status === 'waiting_method') {
    await addShopNotice(order.shop_id, `You have ${money(amount)} to receive for order ${order.id}. Add a payout method so we can pay you.`, '/my-shop/settings', c);
  }
}

// The refund of an ad goes back to the phone that paid for it. `ad` is the ad row (id, shop_id, total, payment_provider).
export async function queueAdRefund(c, ad, phone) {
  let status = 'queued';
  let note = null;
  if (ad.payment_provider !== 'mpesa') {
    status = 'skipped';
    note = 'The ad payment was simulated, so no real money was moved.';
  } else if (!phone) {
    status = 'review';
    note = 'No phone number to refund to.';
  }
  await c.query(
    `INSERT INTO payouts (kind, ad_id, shop_id, amount, status, phone, last_error) VALUES ('ad_refund', $1, $2, $3, $4, $5, $6)`,
    [ad.id, ad.shop_id, ad.total, status, phone ?? null, note]
  );
}

// When a seller adds a payout method, everything that was waiting for it can go.
export async function releaseWaitingPayouts(c, shopId) {
  await c.query(`UPDATE payouts SET status = 'queued', next_attempt_at = now() WHERE shop_id = $1 AND status = 'waiting_method'`, [shopId]);
}

// ---- The worker: sends queued payouts to M-Pesa ----
export async function processPayouts({ limit = 10 } = {}) {
  if (config.payouts.mode !== 'daraja') return 0;

  // Claim a few rows. SKIP LOCKED means two workers never take the same row.
  const claimed = await withTransaction(async (c) => {
    const rows = (await c.query(
      `SELECT * FROM payouts WHERE status = 'queued' AND next_attempt_at <= now() ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED`, [limit]
    )).rows;
    const ready = [];
    for (const p of rows) {
      let dest = { method: 'phone', phone: p.phone };
      if (p.kind === 'seller_payout') {
        const m = (await c.query('SELECT * FROM payout_methods WHERE shop_id = $1', [p.shop_id])).rows[0];
        if (!m) { await c.query(`UPDATE payouts SET status = 'waiting_method' WHERE id = $1`, [p.id]); continue; }
        dest = { method: m.method, till: m.till, paybill: m.paybill, account: m.account, phone: m.phone ? m.phone.replace(/^\+/, '') : null };
      }
      await c.query(
        `UPDATE payouts SET status = 'sending', attempts = attempts + 1, method = $2, till = $3, paybill = $4, account = $5, phone = $6 WHERE id = $1`,
        [p.id, dest.method, dest.till ?? null, dest.paybill ?? null, dest.account ?? null, dest.phone ?? null]
      );
      ready.push({ ...p, ...dest, attempts: p.attempts + 1 });
    }
    return ready;
  });

  for (const p of claimed) {
    try {
      const sent = p.method === 'till' || p.method === 'paybill'
        ? await b2bPay({ kind: p.method, number: p.method === 'till' ? p.till : p.paybill, account: p.account || p.order_id || p.ad_id, amount: p.amount, remarks: `Order ${p.order_id ?? p.ad_id}` })
        : await b2cPay({ phone: p.phone, amount: p.amount, remarks: `${p.kind === 'seller_payout' ? 'Payout' : 'Refund'} ${p.order_id ?? p.ad_id}` });
      await pool.query(
        `UPDATE payouts SET status = 'sent', conversation_id = $2, originator_conversation_id = $3, sent_at = now(), last_error = NULL WHERE id = $1 AND status = 'sending'`,
        [p.id, sent.conversationId, sent.originatorConversationId]
      );
    } catch (err) {
      const msg = String(err.message).slice(0, 300);
      if (err.refused && p.attempts < MAX_REFUSED_ATTEMPTS) {
        await pool.query(`UPDATE payouts SET status = 'queued', last_error = $2, next_attempt_at = now() + make_interval(mins => 5) WHERE id = $1 AND status = 'sending'`, [p.id, msg]);
      } else {
        // Refused too often, or we cannot tell whether M-Pesa accepted it: a person checks. Never sent twice on a guess.
        const why = err.unknown ? `Unknown whether M-Pesa accepted this. Check M-Pesa before retrying. (${msg})` : msg;
        await pool.query(`UPDATE payouts SET status = 'review', last_error = $2 WHERE id = $1 AND status = 'sending'`, [p.id, why]);
      }
    }
  }
  return claimed.length;
}

// ---- Safaricom reports the result ----
async function findSent(conversationId, originatorId) {
  for (let i = 0; i < 4; i++) {
    const row = (await pool.query(
      `SELECT * FROM payouts WHERE conversation_id = $1 OR originator_conversation_id = $2 LIMIT 1`, [conversationId ?? null, originatorId ?? null]
    )).rows[0];
    if (row) return row;
    if (i < 3) await sleep(600); // a very fast result can arrive before we saved the ids
  }
  return null;
}

// `body` is what Safaricom posted. Never throws.
export async function handlePayoutResult(body) {
  try {
    const r = body?.Result;
    if (!r || (!r.ConversationID && !r.OriginatorConversationID)) return;
    const p = await findSent(String(r.ConversationID ?? ''), String(r.OriginatorConversationID ?? ''));
    if (!p) { console.error('M-Pesa result for a payout we do not know:', r.ConversationID); return; }
    const params = Array.isArray(r.ResultParameters?.ResultParameter) ? r.ResultParameters.ResultParameter : [];
    const meta = Object.fromEntries(params.filter((x) => x && typeof x.Key === 'string').map((x) => [x.Key, x.Value]));
    const code = Number(r.ResultCode);
    const receipt = r.TransactionID ? String(r.TransactionID) : meta.TransactionReceipt ? String(meta.TransactionReceipt) : null;

    const finished = await withTransaction(async (c) => {
      const row = (await c.query('SELECT * FROM payouts WHERE id = $1 FOR UPDATE', [p.id])).rows[0];
      if (!row || (row.status !== 'sent' && row.status !== 'sending')) return null; // an answer we already have: ignore repeats
      if (code === 0) {
        await c.query(`UPDATE payouts SET status = 'paid', result_code = 0, result_desc = $2, mpesa_receipt = $3, raw = $4::jsonb, completed_at = now() WHERE id = $1`, [row.id, String(r.ResultDesc ?? '').slice(0, 200), receipt, JSON.stringify(body)]);
      } else {
        await c.query(`UPDATE payouts SET status = 'review', result_code = $2, result_desc = $3, last_error = $3, raw = $4::jsonb WHERE id = $1`, [row.id, code, String(r.ResultDesc ?? '').slice(0, 200), JSON.stringify(body)]);
      }
      return { row, paid: code === 0 };
    });
    if (finished?.paid && finished.row.kind === 'seller_payout') {
      await addShopNotice(finished.row.shop_id, `We paid ${money(finished.row.amount)} for order ${finished.row.order_id} to your payout method.`, '/my-shop/report');
    }
    if (finished?.paid && finished.row.kind === 'ad_refund') {
      await addShopNotice(finished.row.shop_id, `We refunded ${money(finished.row.amount)} for your ad ${finished.row.ad_id} to the phone that paid.`, '/my-shop/ads');
    }
    if (finished && !finished.paid) console.error(`Payout ${p.id} failed at M-Pesa: ${r.ResultDesc}`);
  } catch (err) {
    console.error('M-Pesa payout result could not be processed:', err.message);
  }
}

// M-Pesa gave up waiting in its own queue. It may still go through, so staff check before retrying.
export async function handlePayoutTimeout(body) {
  try {
    const r = body?.Result;
    const p = r && (await findSent(String(r.ConversationID ?? ''), String(r.OriginatorConversationID ?? '')));
    if (!p) return;
    await pool.query(`UPDATE payouts SET status = 'review', last_error = 'M-Pesa timed out. It may still go through: check M-Pesa before retrying.' WHERE id = $1 AND status IN ('sent', 'sending')`, [p.id]);
  } catch (err) {
    console.error('M-Pesa payout timeout could not be processed:', err.message);
  }
}

// ---- For staff ----
const shape = (r) => ({
  id: String(r.id), kind: r.kind, orderId: r.order_id, adId: r.ad_id, shopId: r.shop_id ? String(r.shop_id) : null, amount: r.amount, status: r.status,
  to: r.method === 'till' ? `Till ${r.till}` : r.method === 'paybill' ? `Paybill ${r.paybill}, account ${r.account}` : r.phone ? `+${r.phone}` : '',
  receipt: r.mpesa_receipt || '', note: r.last_error || r.result_desc || '', attempts: r.attempts, at: new Date(r.created_at).getTime(),
});

// Payouts that need a person: failed or unclear ones, ones waiting for a payout method, and ones stuck with no answer.
export async function listPayoutProblems() {
  const { rows } = await pool.query(
    `SELECT * FROM payouts WHERE status IN ('review', 'waiting_method')
        OR (status = 'sent' AND sent_at < now() - make_interval(mins => $1))
        OR (status IN ('sending', 'queued') AND created_at < now() - interval '1 hour' AND $2::boolean)
     ORDER BY id DESC LIMIT 200`,
    [STUCK_MINUTES, config.payouts.mode === 'daraja']
  );
  return { payouts: rows.map(shape) };
}

async function audit(c, adminId, action, payoutId, note) {
  await c.query(`INSERT INTO admin_actions (admin_id, action, target_type, target_id, note) VALUES ($1, $2, 'payout', $3, $4)`, [adminId, action, String(payoutId), note ?? '']);
}

// Try again (after staff checked M-Pesa and nothing was paid).
export const retryPayout = (adminId, payoutId) =>
  withTransaction(async (c) => {
    if (!/^\d{1,18}$/.test(String(payoutId))) throw httpError(404, 'Payout not found.');
    const p = (await c.query('SELECT status FROM payouts WHERE id = $1 FOR UPDATE', [payoutId])).rows[0];
    if (!p) throw httpError(404, 'Payout not found.');
    if (p.status !== 'review') throw httpError(409, 'Only a payout that needs review can be retried.');
    await c.query(`UPDATE payouts SET status = 'queued', attempts = 0, last_error = NULL, next_attempt_at = now() WHERE id = $1`, [payoutId]);
    await audit(c, adminId, 'retry_payout', payoutId);
    return { ok: true };
  });

// Staff paid it by hand (or saw in M-Pesa that it went through): record it so it is never sent again.
export const markPayoutPaid = (adminId, payoutId, receipt) =>
  withTransaction(async (c) => {
    if (!/^\d{1,18}$/.test(String(payoutId))) throw httpError(404, 'Payout not found.');
    const code = String(receipt ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{8,12}$/.test(code)) throw httpError(400, 'Enter the M-Pesa receipt number (8 to 12 letters and numbers).');
    const p = (await c.query('SELECT status FROM payouts WHERE id = $1 FOR UPDATE', [payoutId])).rows[0];
    if (!p) throw httpError(404, 'Payout not found.');
    if (!['review', 'sent', 'waiting_method', 'queued'].includes(p.status)) throw httpError(409, 'This payout is already finished.');
    await c.query(`UPDATE payouts SET status = 'paid', mpesa_receipt = $2, last_error = 'Marked paid by staff', completed_at = now() WHERE id = $1`, [payoutId, code]);
    await audit(c, adminId, 'mark_payout_paid', payoutId, code);
    return { ok: true };
  });
