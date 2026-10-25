import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock } from "lucide-react";
import Button from "../../components/Button.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import ReviewForm from "../../components/ReviewForm.jsx";
import { Stars } from "../../components/StarInput.jsx";
import { findRating } from "../../lib/ratings.js";
import useNow from "../../hooks/useNow.js";
import useNotifications from "../../hooks/useNotifications.js";
import { useOrders } from "../../context/OrdersContext.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { PROMISES, WINDOW_MS, acceptDeadline, eventText, formatCountdown, formatWhen, getStatus, supportDeadline } from "../../lib/orders.js";
import { formatKES, fulfillmentLabel } from "../../lib/format.js";
import { FEE_LABEL, payoutBreakdown } from "../../lib/fees.js";

const REJECT_REASONS = ["Out of stock", "Item is faulty", "Cannot deliver in time", "Other"];
const card = "space-y-4 rounded-2xl bg-white p-5 shadow-card";

export default function SellerOrderDetail() {
  const { id } = useParams();
  const { seller } = useSeller();
  const { orders, sellerAccept, sellerReject, sellerDispatch, sellerConfirmReturn, submitReport } = useOrders();
  const now = useNow(1000);
  const { unreadOrderIds, markOrderRead } = useNotifications("seller", seller.shopId);

  // Opening an order clears its notifications.
  useEffect(() => {
    if (unreadOrderIds.has(id)) markOrderRead(id);
  }, [id, unreadOrderIds, markOrderRead]);
  const [promiseId, setPromiseId] = useState(PROMISES[1].id);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");

  const order = orders.find((o) => o.id === id && o.shopId === seller.shopId);

  if (!order) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Order not found</h1>
        <Button to="/my-shop">Back to orders</Button>
      </div>
    );
  }

  const status = getStatus(order, now);
  const canReject = status === "pending" || status === "accepted";
  const money = payoutBreakdown(order);
  // The fee is taken only when an order pays out. Rejected and refunded orders pay nothing.
  const pays = ["pending", "accepted", "dispatched", "review", "completed"].includes(status);

  function onAccept() {
    const promise = PROMISES.find((p) => p.id === promiseId) || PROMISES[0];
    const result = sellerAccept(order.id, promise.ms);
    setError(result.ok ? "" : result.message);
  }

  function onDispatch(e) {
    e.preventDefault();
    const result = sellerDispatch(order.id, codeInput);
    setError(result.ok ? "" : result.message);
    if (result.ok) setCodeInput("");
  }

  function onReject() {
    const result = sellerReject(order.id, rejectReason);
    if (result.ok) setRejecting(false);
    else setError(result.message);
  }

  const rejectBlock = canReject && (
    <div className="border-t border-ink/10 pt-4">
      {rejecting ? (
        <div className="space-y-3">
          <label htmlFor="reject-reason" className="text-sm font-semibold">
            Why are you rejecting this order?
          </label>
          <select
            id="reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm"
          >
            {REJECT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <p className="text-xs text-ink-mute">The buyer will be refunded in full, including the delivery fee.</p>
          <div className="flex gap-2">
            <Button variant="dark" size="sm" onClick={onReject}>
              Reject order
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setRejecting(true)} className="text-sm font-semibold text-red-700 hover:underline">
          I cannot fulfil this order
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <Link to="/my-shop" className="text-sm font-semibold text-vibe hover:underline">
        &larr; Orders
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Order {order.id}</h1>
          <p className="text-sm text-ink-mute">
            {formatWhen(order.createdAt)} &middot; {fulfillmentLabel(order.mode)}
          </p>
        </div>
        <StatusBadge status={status} />
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}

      {status === "pending" && (
        <section className={card}>
          <h2 className="text-lg font-extrabold">Agree to fulfil this order</h2>
          <p className="text-sm text-ink-soft">
            The buyer has paid and the money is held in escrow. Choose when you will have the order with the buyer. Once you
            agree, you receive the receipt code and the 24-hour window starts.
          </p>
          <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            Respond within {formatCountdown(acceptDeadline(order) - now)}. After that the buyer is refunded and the order counts as unfulfilled.
          </p>
          <fieldset className="space-y-2">
            <legend className="sr-only">Delivery promise</legend>
            {PROMISES.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
                  promiseId === p.id ? "border-vibe bg-vibe-light" : "border-ink/20"
                }`}
              >
                <input type="radio" name="promise" checked={promiseId === p.id} onChange={() => setPromiseId(p.id)} className="accent-vibe" />
                {p.label}
              </label>
            ))}
          </fieldset>
          <Button size="lg" onClick={onAccept}>
            I agree to fulfil this order
          </Button>
          {rejectBlock}
        </section>
      )}

      {status === "accepted" && (
        <section className={card}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold">Dispatch the order</h2>
            <span className="flex items-center gap-1 text-sm font-semibold text-vibe-dark">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatCountdown(order.acceptedAt + WINDOW_MS - now)} left
            </span>
          </div>
          <p className="text-sm text-ink-soft">
            You promised this order by <strong>{formatWhen(order.promisedBy)}</strong>. When it leaves your shop, enter the
            code below. The buyer is told it is on the way.
          </p>
          <p className="rounded-xl bg-ivory py-3 text-center text-3xl font-extrabold tracking-[0.4em]" aria-label="Receipt code">
            {order.code}
          </p>
          <form onSubmit={onDispatch} className="space-y-3" noValidate>
            <label htmlFor="dispatch-code" className="text-sm font-semibold">
              Enter the code to confirm dispatch
            </label>
            <div className="flex gap-2">
              <input
                id="dispatch-code"
                inputMode="numeric"
                maxLength={6}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                className="w-full rounded-xl border border-ink/20 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe"
              />
              <Button type="submit" disabled={codeInput.length !== 6}>
                Dispatch
              </Button>
            </div>
          </form>
          {rejectBlock}
        </section>
      )}

      {status === "dispatched" && (
        <section className={card}>
          <h2 className="text-lg font-extrabold">On the way to the buyer</h2>
          <p className="text-sm text-ink-soft">
            The buyer will check the item and enter the code. Your payment is released when they do. The window ends in{" "}
            {formatCountdown(order.acceptedAt + WINDOW_MS - now)}.
          </p>
        </section>
      )}

      {status === "completed" && (
        <section className={card}>
          <h2 className="text-lg font-extrabold">Payment released</h2>
          <p className="text-sm text-ink-soft">
            The buyer confirmed receipt. You receive {formatKES(money.net)} after VibeYetu&apos;s {FEE_LABEL} fee.
          </p>
          {(() => {
            const r = findRating(order.id, "shop", order.shopId);
            return r ? (
              <div className="space-y-1 rounded-xl bg-ivory p-4 text-sm">
                <p className="font-bold">The buyer rated you</p>
                <Stars value={r.stars} className="h-5 w-5" />
                {r.comment && <p className="text-ink-soft">{r.comment}</p>}
              </div>
            ) : null;
          })()}
        </section>
      )}

      {status === "rejected" && (
        <section className={card}>
          {order.rejectedBy === "seller" ? (
            <>
              <h2 className="text-lg font-extrabold">You rejected this order</h2>
              <p className="text-sm text-ink-soft">The buyer can request a full refund. Nothing else is needed from you.</p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-extrabold">The buyer rejected the item</h2>
              <p className="text-sm text-ink-soft">Reason: {order.rejectReason || "Not given"}. When the item is back in your shop, confirm the return below. Your inventory updates automatically.</p>
              {order.returnConfirmed ? (
                <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">Return confirmed. Stock has been updated.</p>
              ) : (
                <Button
                  onClick={() => {
                    const result = sellerConfirmReturn(order.id);
                    setError(result.ok ? "" : result.message);
                  }}
                >
                  Confirm the item is back in my shop
                </Button>
              )}
            </>
          )}
        </section>
      )}

      {status === "refunded" && (
        <section className={card}>
          <h2 className="text-lg font-extrabold">Order refunded</h2>
          <p className="text-sm text-ink-soft">This order was refunded to the buyer.</p>
        </section>
      )}

      {status === "review" && (
        <section className={card}>
          <h2 className="text-lg font-extrabold">We need to know what happened</h2>
          <p className="text-sm text-ink-soft">
            The 24-hour window ended before the order was finished. Please answer this short form. Our support team will decide
            by <strong>{formatWhen(supportDeadline(order))}</strong>, often much sooner. The money stays in escrow until then.
          </p>
          <ReviewForm role="seller" report={order.reports?.seller} onSubmit={(r) => submitReport(order.id, "seller", r)} />
          <p className="text-xs text-ink-mute">
            {order.reports?.buyer ? "The buyer has answered." : "We are still waiting for the buyer's answers."}
          </p>
        </section>
      )}

      <section className={card}>
        <h2 className="text-lg font-extrabold">Items</h2>
        <ul className="divide-y divide-ink/10 text-sm">
          {(order.items || []).map((i) => (
            <li key={i.name} className="flex justify-between py-2">
              <span>
                {i.name} &times; {i.qty}
              </span>
              <span className="font-semibold">{formatKES(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-ink/10 pt-3 font-extrabold">
          <span>Total paid</span>
          <span>{formatKES(order.total)}</span>
        </p>
      </section>

      {pays && (
        <section className={card} aria-labelledby="money-title">
          <h2 id="money-title" className="text-lg font-extrabold">
            {status === "completed" ? "What you received" : "What you receive"}
          </h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Items</dt>
              <dd className="font-semibold">{formatKES(money.items)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">VibeYetu fee ({FEE_LABEL} of items)</dt>
              <dd className="font-semibold text-red-700">&minus; {formatKES(money.fee)}</dd>
            </div>
            {money.delivery > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-soft">Delivery fee (yours, no fee taken)</dt>
                <dd className="font-semibold">{formatKES(money.delivery)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-ink/10 pt-2 text-base font-extrabold">
              <dt>
                {status === "completed"
                  ? "Paid to you"
                  : status === "review"
                    ? "You get if support releases the money"
                    : "You get when the buyer confirms"}
              </dt>
              <dd>{formatKES(money.net)}</dd>
            </div>
          </dl>
        </section>
      )}
      {status === "refunded" && (
        <p className="rounded-xl bg-ivory px-4 py-3 text-sm text-ink-soft">No VibeYetu fee is taken on a refunded order.</p>
      )}

      <section className={card}>
        <h2 className="text-lg font-extrabold">Progress</h2>
        <ol className="space-y-2 text-sm">
          {order.events.filter((e) => eventText(e, "seller")).map((e, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{eventText(e, "seller")}</span>
              <span className="shrink-0 text-ink-mute">{formatWhen(e.at)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
