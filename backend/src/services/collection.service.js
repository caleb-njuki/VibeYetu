// Taking money from buyers with M-Pesa (STK Push), and finishing the order when the money has arrived.
// In "simulated" mode (development) payment succeeds at once and no money moves.
//
// How a real payment goes:
//   1. The buyer taps Pay. We ask M-Pesa to show a PIN prompt on their phone (status "pending").
//   2. The buyer enters the PIN. Safaricom calls our callback address with the result.
//   3. We check the amount, mark the payment paid, start the orders and hold the money in escrow.
// If the callback never arrives, we ask M-Pesa for the result ourselves (reconcile).
import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { httpError } from '../utils/httpError.js';
import { normalizePhone } from '../utils/phone.js';
import { withTransaction } from '../utils/transaction.js';
import { stkPush, stkQuery } from './daraja.service.js';
import { expireGroup, getBuyerOrdersByIds, payCheckout, settleGroupPaid } from './order.service.js';

const REUSE_SECONDS = 90; // a payment prompt younger than this is reused if the buyer taps Pay again
const QUERY_AFTER_SECONDS = 45; // before this, the callback is still expected
const QUERY_EVERY_SECONDS = 15;
const GIVE_UP_MINUTES = 5; // a prompt with no answer after this long is closed as "timeout"

const isDaraja = () => config.payments.mode === 'daraja';

// What the buyer is told when a payment did not go through (the result codes are Safaricom's).
const FAILURE = {
  1: 'Your M-Pesa balance is too low. Please top up and try again.',
  1001: 'Your M-Pesa is busy with another transaction. Please wait a minute and try again.',
  1019: 'The payment took too long. Please try again.',
  1025: 'We could not send the prompt to your phone. Please try again.',
  1032: 'You cancelled the payment on your phone. You can try again.',
  1037: 'We did not get a reply from your phone. Please try again.',
  2001: 'The M-Pesa PIN was wrong. Please try again.',
};
const failureText = (code) => FAILURE[code] || 'The payment did not go through. You have not been charged.';

// ---- Step 1: the buyer taps Pay ----
export async function payForCheckout(buyerId, groupId, { method, phone }) {
  if (!isDaraja()) return { ...(await payCheckout(buyerId, groupId, { method, phone })), status: 'paid' };

  if (method !== 'mpesa') throw httpError(400, 'Card payments are not available yet. Please pay with M-Pesa.');
  const normalized = normalizePhone(String(phone ?? ''));
  if (!normalized || !normalized.startsWith('+254')) throw httpError(400, 'Enter the M-Pesa phone number you want to pay from.');
  const daraja = normalized.slice(1); // 254712345678

  const step = await withTransaction(async (c) => {
    const g = (await c.query(
      `SELECT *, (created_at <= now() - make_interval(secs => $3)) AS stale FROM checkout_groups WHERE id = $1 AND buyer_id = $2 FOR UPDATE`,
      [groupId, buyerId, 15 * 60]
    )).rows[0];
    if (!g) throw httpError(404, 'Checkout not found.');
    if (g.status === 'paid') return { already: true };
    if (g.status === 'expired') return { expired: true };
    const busy = (await c.query(
      `SELECT id FROM payments WHERE group_id = $1 AND status IN ('starting', 'pending') AND created_at > now() - make_interval(secs => $2) ORDER BY id DESC LIMIT 1`,
      [groupId, REUSE_SECONDS]
    )).rows[0];
    if (busy) return { reuse: busy.id };
    if (g.stale) {
      const live = await c.query(`SELECT 1 FROM payments WHERE group_id = $1 AND status IN ('starting', 'pending')`, [groupId]);
      if (!live.rows[0]) { await expireGroup(c, g.id); return { expired: true }; }
    }
    const inserted = await c.query(
      `INSERT INTO payments (purpose, group_id, buyer_id, amount, phone) VALUES ('checkout', $1, $2, $3, $4) RETURNING id`,
      [g.id, buyerId, g.total, daraja]
    );
    return { paymentId: inserted.rows[0].id, amount: g.total };
  });

  if (step.expired) throw httpError(409, 'This checkout expired because it was not paid in time. Please start again.');
  if (step.already) return { ok: true, ...(await checkoutStatus(buyerId, groupId)) };
  if (step.reuse) return { ok: true, status: 'pending', paymentId: String(step.reuse), message: 'Check your phone and enter your M-Pesa PIN.' };

  // The web call to Safaricom happens outside the database transaction.
  try {
    const sent = await stkPush({ phone: daraja, amount: step.amount, reference: groupId });
    await pool.query(
      `UPDATE payments SET status = 'pending', merchant_request_id = $2, checkout_request_id = $3 WHERE id = $1 AND status = 'starting'`,
      [step.paymentId, sent.merchantRequestId, sent.checkoutRequestId]
    );
  } catch (err) {
    await pool.query(`UPDATE payments SET status = 'failed', result_desc = $2, completed_at = now() WHERE id = $1 AND status = 'starting'`, [step.paymentId, String(err.message).slice(0, 200)]);
    throw err;
  }
  return { ok: true, status: 'pending', paymentId: String(step.paymentId), message: 'Check your phone and enter your M-Pesa PIN.' };
}

// ---- Step 2: Safaricom tells us the result ----
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// `body` is what Safaricom posted. Never throws: Safaricom only needs to know it arrived.
export async function handleCallback(body) {
  try {
    const cb = body?.Body?.stkCallback;
    const checkoutRequestId = cb?.CheckoutRequestID;
    if (typeof checkoutRequestId !== 'string' || !checkoutRequestId) return;

    // A very fast callback can arrive before we saved the request id: wait a moment.
    let payment = null;
    for (let i = 0; i < 4 && !payment; i++) {
      payment = (await pool.query('SELECT id FROM payments WHERE checkout_request_id = $1', [checkoutRequestId])).rows[0];
      if (!payment && i < 3) await sleep(600);
    }
    if (!payment) {
      console.error('M-Pesa callback for a payment we do not know:', checkoutRequestId);
      return;
    }
    const items = Array.isArray(cb.CallbackMetadata?.Item) ? cb.CallbackMetadata.Item : [];
    const meta = Object.fromEntries(items.filter((i) => i && typeof i.Name === 'string').map((i) => [i.Name, i.Value]));
    await applyResult(payment.id, {
      resultCode: Number(cb.ResultCode),
      resultDesc: String(cb.ResultDesc ?? '').slice(0, 200),
      receipt: meta.MpesaReceiptNumber ? String(meta.MpesaReceiptNumber) : null,
      amount: meta.Amount === undefined ? null : Number(meta.Amount),
      source: 'callback',
      raw: body,
    });
  } catch (err) {
    console.error('M-Pesa callback could not be processed:', err.message);
  }
}

// Records how a payment ended. Safe to call more than once for the same payment: only the first answer counts.
async function applyResult(paymentId, r) {
  await withTransaction(async (c) => {
    const p = (await c.query('SELECT * FROM payments WHERE id = $1 FOR UPDATE', [paymentId])).rows[0];
    if (!p || (p.status !== 'starting' && p.status !== 'pending')) return;

    const base = [paymentId, r.resultCode, r.resultDesc, r.source, r.raw ? JSON.stringify(r.raw) : null];
    const finish = (status, receipt = null) =>
      c.query(
        `UPDATE payments SET status = $6, result_code = $2, result_desc = $3, source = $4, callback_raw = $5::jsonb, mpesa_receipt = $7, completed_at = now() WHERE id = $1`,
        [...base, status, receipt]
      );

    if (r.resultCode !== 0) {
      await finish(r.resultCode === 1032 ? 'cancelled' : r.resultCode === 1037 ? 'timeout' : 'failed');
      return;
    }
    // The money was taken. A callback also tells us the amount: it must be what we asked for.
    if (r.source === 'callback' && r.amount !== p.amount) {
      console.error(`M-Pesa amount mismatch on payment ${p.id}: asked ${p.amount}, got ${r.amount}`);
      await finish('mismatch', r.receipt);
      return;
    }
    const g = (await c.query('SELECT * FROM checkout_groups WHERE id = $1 FOR UPDATE', [p.group_id])).rows[0];
    if (g && g.status === 'awaiting_payment') {
      await settleGroupPaid(c, g, { method: 'mpesa', phone: `+${p.phone}`, provider: 'mpesa' });
      await finish('paid', r.receipt);
    } else {
      // The checkout already expired or was paid by another attempt: keep the record, staff must refund this money.
      console.error(`M-Pesa money received for payment ${p.id} but checkout ${p.group_id} is ${g?.status}. It must be refunded.`);
      await finish('late', r.receipt);
    }
  });
}

// ---- If the callback does not arrive: ask M-Pesa ----
export async function reconcilePayment(paymentId) {
  const p = (await pool.query(
    `SELECT id, checkout_request_id, status, (created_at < now() - make_interval(mins => $2)) AS old,
            (last_query_at IS NULL OR last_query_at < now() - make_interval(secs => $3)) AS can_query
     FROM payments WHERE id = $1`,
    [paymentId, GIVE_UP_MINUTES, QUERY_EVERY_SECONDS]
  )).rows[0];
  if (!p || p.status !== 'pending' || !p.checkout_request_id || !p.can_query) return;
  await pool.query('UPDATE payments SET last_query_at = now() WHERE id = $1', [p.id]);
  let answer;
  try {
    answer = await stkQuery(p.checkout_request_id);
  } catch (err) {
    console.error('M-Pesa status check failed for payment', p.id, err.message);
    return;
  }
  if (answer.done) await applyResult(p.id, { ...answer, receipt: null, amount: null, source: 'query', raw: null });
  else if (p.old) await applyResult(p.id, { resultCode: 1037, resultDesc: 'No answer from the phone', receipt: null, amount: null, source: 'query', raw: null });
}

// Called by the 30 second sweeper: closes payments whose callback never came.
export async function reconcileOpenPayments() {
  if (!isDaraja()) return 0;
  const { rows } = await pool.query(
    `SELECT id FROM payments WHERE status = 'pending' AND created_at < now() - make_interval(secs => $1) ORDER BY id LIMIT 50`,
    [QUERY_AFTER_SECONDS]
  );
  for (const { id } of rows) await reconcilePayment(id);
  // A prompt that never got a request id (we crashed after the insert) is closed after a while.
  await pool.query(`UPDATE payments SET status = 'failed', result_desc = 'Never sent', completed_at = now() WHERE status = 'starting' AND created_at < now() - interval '2 minutes'`);
  return rows.length;
}

// ---- Step 3: the app asks how it went (it polls every few seconds) ----
// -> { status: "unpaid" | "pending" | "paid" | "failed" | "expired", message, orders? }
export async function checkoutStatus(buyerId, groupId) {
  const load = async () => {
    const g = (await pool.query('SELECT id, status, total FROM checkout_groups WHERE id = $1 AND buyer_id = $2', [groupId, buyerId])).rows[0];
    if (!g) throw httpError(404, 'Checkout not found.');
    const last = (await pool.query('SELECT * FROM payments WHERE group_id = $1 ORDER BY id DESC LIMIT 1', [groupId])).rows[0];
    return { g, last };
  };
  let { g, last } = await load();

  // The callback is slow or lost: ask Safaricom once, then look again.
  if (g.status !== 'paid' && last?.status === 'pending' && Date.now() - new Date(last.created_at).getTime() > QUERY_AFTER_SECONDS * 1000) {
    await reconcilePayment(last.id);
    ({ g, last } = await load());
  }

  if (g.status === 'paid') {
    const ids = (await pool.query('SELECT id FROM orders WHERE group_id = $1 ORDER BY id', [groupId])).rows.map((r) => r.id);
    return { status: 'paid', groupId, total: g.total, orders: await getBuyerOrdersByIds(buyerId, ids), message: 'Payment received.' };
  }
  if (g.status === 'expired') {
    const money = last && (last.status === 'late' || last.status === 'mismatch');
    return { status: 'expired', message: money ? 'We received your payment after this checkout expired. We will refund it. Please contact support if it is not back soon.' : 'This checkout expired because it was not paid in time. Please start again.' };
  }
  if (!last) return { status: 'unpaid', message: 'Not paid yet.' };
  if (last.status === 'starting' || last.status === 'pending') return { status: 'pending', message: 'Check your phone and enter your M-Pesa PIN.' };
  if (last.status === 'late' || last.status === 'mismatch') return { status: 'failed', message: 'We received a payment but could not match it to this checkout. Support will sort it out. Please do not pay again.' };
  return { status: 'failed', message: failureText(last.result_code) };
}

// ---- For staff ----
// Payments that need a human: money that arrived but could not be used, and prompts stuck for a long time.
export async function listPaymentProblems() {
  const { rows } = await pool.query(
    `SELECT id, purpose, group_id, amount, phone, status, result_desc, mpesa_receipt, created_at, completed_at FROM payments
     WHERE status IN ('mismatch', 'late') OR (status IN ('starting', 'pending') AND created_at < now() - interval '30 minutes')
     ORDER BY id DESC LIMIT 200`
  );
  return {
    payments: rows.map((r) => ({
      id: String(r.id), purpose: r.purpose, groupId: r.group_id, amount: r.amount, phone: r.phone, status: r.status,
      note: r.result_desc || '', receipt: r.mpesa_receipt || '', at: new Date(r.created_at).getTime(),
    })),
  };
}
