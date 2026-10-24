import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, ShieldCheck } from "lucide-react";
import Button from "../components/Button.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import ReviewForm from "../components/ReviewForm.jsx";
import RateSeller from "../components/RateSeller.jsx";
import useNow from "../hooks/useNow.js";
import useNotifications from "../hooks/useNotifications.js";
import { useOrders } from "../context/OrdersContext.jsx";
import { WINDOW_MS, eventText, formatCountdown, formatWhen, getStatus, refundAmount, supportDeadline } from "../lib/orders.js";
import { formatKES, fulfillmentLabel } from "../lib/format.js";

const REJECT_REASONS = ["Item is faulty", "Wrong item", "Not as described", "Damaged in transit"];
const card = "space-y-4 rounded-2xl bg-white p-5 shadow-card";
const demoBtn = "rounded-full border border-ink/30 bg-white px-4 py-2 text-sm font-semibold hover:bg-ink/5";

export default function OrderDetail() {
  const { id } = useParams();
  const { orders, buyerConfirm, buyerReject, requestRefund, submitReport, expireNow, expirePendingNow, supportRefund, supportRelease } = useOrders();
  const now = useNow(1000);
  const { unreadOrderIds, markOrderRead } = useNotifications("buyer");

  // Opening an order clears its notifications.
  useEffect(() => {
    if (unreadOrderIds.has(id)) markOrderRead(id);
  }, [id, unreadOrderIds, markOrderRead]);
  const [codeInput, setCodeInput] = useState("");
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);

  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-3xl font-extrabold">Order not found</h1>
        <Button to="/orders">Back to my orders</Button>
      </div>
    );
  }

  const status = getStatus(order, now);
  const bySeller = order.rejectedBy === "seller";
  const windowLeft = formatCountdown(order.acceptedAt + WINDOW_MS - now);

  function onConfirm(e) {
    e.preventDefault();
    const result = buyerConfirm(order.id, codeInput);
    setError(result.ok ? "" : result.message);
    if (result.ok) setCodeInput("");
  }

  function onReject() {
    const result = buyerReject(order.id, reason);
    if (!result.ok) setError(result.message);
    else setRejecting(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pt-8">
      <Link to="/orders" className="text-sm font-semibold text-vibe hover:underline">
        &larr; My orders
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold">Order {order.id}</h1>
          <p className="text-sm text-ink-mute">
            <Link to={`/shop/${order.shopId}`} className="font-semibold hover:text-vibe">
              {order.shopName}
            </Link>{" "}
            &middot; {formatWhen(order.createdAt)}
          </p>
        </div>
        <StatusBadge status={status} />
      </header>

      {status === "pending" && (
        <section className={card}>
          <h2 className="text-lg font-extrabold">Waiting for the seller</h2>
          <p className="text-sm text-ink-soft">
            {order.shopName} must agree to fulfil your order on time before it is accepted. Your {formatKES(order.total)}{" "}
            is held safely in escrow meanwhile.
          </p>
        </section>
      )}

      {status === "accepted" && (
        <section className={card}>
          <h2 className="text-lg font-extrabold">Seller is preparing your order</h2>
          <p className="text-sm text-ink-soft">
            {order.shopName} agreed to fulfil your order by <strong>{formatWhen(order.promisedBy)}</strong>. We will tell
            you here as soon as it leaves.
          </p>
          <p className="flex items-center gap-1 text-sm font-semibold text-vibe-dark">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {windowLeft} left in the 24-hour window
          </p>
        </section>
      )}

      {status === "dispatched" && (
        <section className={card}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold">Your order is on the way</h2>
            <span className="flex items-center gap-1 text-sm font-semibold text-vibe-dark">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {windowLeft} left
            </span>
          </div>
          <p className="text-sm text-ink-soft">
            The seller has dispatched your order. When it arrives, check it carefully. If it is fine, enter your receipt
            code to release the payment to the seller.
          </p>

          {showCode ? (
            <p className="rounded-xl bg-ivory py-3 text-center text-3xl font-extrabold tracking-[0.4em]" aria-label="Receipt code">
              {order.code}
            </p>
          ) : (
            <Button variant="outline" onClick={() => setShowCode(true)}>
              Show my code
            </Button>
          )}

          <form onSubmit={onConfirm} className="space-y-3" noValidate>
            <label htmlFor="code" className="text-sm font-semibold">
              Enter code after you have received and checked the item
            </label>
            <div className="flex gap-2">
              <input
                id="code"
                inputMode="numeric"
                maxLength={6}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                className="w-full rounded-xl border border-ink/20 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe"
              />
              <Button type="submit" disabled={codeInput.length !== 6}>
                Confirm
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
          </form>

          {rejecting ? (
            <div className="space-y-3 rounded-xl border border-ink/15 p-4">
              <label htmlFor="reason" className="text-sm font-semibold">
                Why are you rejecting the item?
              </label>
              <select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm"
              >
                {REJECT_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button variant="dark" size="sm" onClick={onReject}>
                  Reject item
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setRejecting(true)} className="text-sm font-semibold text-red-700 hover:underline">
              The item is faulty or wrong? Reject it
            </button>
          )}
        </section>
      )}

      {status === "completed" && (
        <section className={card}>
          <h2 className="text-lg font-extrabold">Order complete</h2>
          \1
          <RateSeller order={order} />
        </section>
      )}

      {status === "rejected" && (
        <section className={`${card} border border-red-200`}>
          <h2 className="text-lg font-extrabold text-red-800">{bySeller ? "Order rejected by the seller" : "You rejected this item"}</h2>
          <p className="text-sm text-ink-soft">
            {bySeller
              ? `${order.shopName} could not fulfil this order${order.rejectReason ? `: ${order.rejectReason}` : ""}. Nothing was delivered, so you get back everything, including the delivery fee.`
              : `Please return the item to ${order.shopName}. Once the seller confirms it is back, ${formatKES(refundAmount(order))} is refunded to the account you paid from.${order.deliveryFee ? ` The delivery fee of ${formatKES(order.deliveryFee)} is not refunded.` : ""}`}
          </p>
          {order.refundRequested ? (
            <p className="rounded-xl bg-vibe-light px-4 py-3 text-sm text-vibe-dark">
              Refund requested. It will be sent as soon as the seller confirms the returned item.
            </p>
          ) : (
            <Button onClick={() => requestRefund(order.id)}>Request refund</Button>
          )}
        </section>
      )}

      {status === "refunded" && (
        <section className={card}>
          <h2 className="text-lg font-extrabold">Refund sent</h2>
          <p className="text-sm text-ink-soft">
            {formatKES(order.refundAmount)} has been returned to the account you paid from.
            {order.refundAmount < order.total && " The delivery fee is not refunded."}
          </p>
        </section>
      )}

      {status === "review" && (
        <section className={card}>
          <h2 className="text-lg font-extrabold">We need to know what happened</h2>
          <p className="text-sm text-ink-soft">
            The 24-hour window ended before the order was finished. You and the seller each answer a short form. Our
            support team will decide by <strong>{formatWhen(supportDeadline(order))}</strong>, often much sooner. Your
            money stays in escrow until then. If it is cleared, you get your refund.
          </p>
          <ReviewForm role="buyer" report={order.reports?.buyer} onSubmit={(r) => submitReport(order.id, "buyer", r)} />
          <p className="text-xs text-ink-mute">
            {order.reports?.seller ? "The seller has answered." : "We are still waiting for the seller's answers."}
          </p>
        </section>
      )}

      <section className={card} aria-labelledby="items-title">
        <h2 id="items-title" className="text-lg font-extrabold">
          Items
        </h2>
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
        <div className="space-y-1 border-t border-ink/10 pt-3 text-sm">
          <p className="flex justify-between text-ink-soft">
            <span>{fulfillmentLabel(order.mode)}</span>
            <span>{order.deliveryFee ? formatKES(order.deliveryFee) : "Free"}</span>
          </p>
          <p className="flex justify-between text-base font-extrabold">
            <span>Total</span>
            <span>{formatKES(order.total)}</span>
          </p>
        </div>
        <p className="flex items-start gap-2 text-xs text-ink-mute">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-vibe" aria-hidden="true" />
          Protected by VibeYetu escrow.
        </p>
      </section>

      <section className={card} aria-labelledby="time-title">
        <h2 id="time-title" className="text-lg font-extrabold">
          Progress
        </h2>
        <ol className="space-y-2 text-sm">
          {order.events.filter((e) => eventText(e, "buyer")).map((e, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{eventText(e, "buyer")}</span>
              <span className="shrink-0 text-ink-mute">{formatWhen(e.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      {["pending", "accepted", "dispatched", "review"].includes(status) && (
        <section className="space-y-3 rounded-2xl border-2 border-dashed border-ink/30 p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-ink-mute">Demo controls (removed before launch)</h2>
          <div className="flex flex-wrap gap-2">
            {status === "pending" && (
              <>
                <Link to="/my-shop" className={demoBtn}>
                  Open My Shop to accept this order
                </Link>
                <button type="button" className={demoBtn} onClick={() => expirePendingNow(order.id)}>
                  Fast-forward 1 hour (seller does not respond)
                </button>
              </>
            )}
            {(status === "accepted" || status === "dispatched") && (
              <button type="button" className={demoBtn} onClick={() => expireNow(order.id)}>
                Fast-forward 24 hours
              </button>
            )}
            {status === "review" && (
              <>
                <button type="button" className={demoBtn} onClick={() => supportRefund(order.id)}>
                  Support: refund the buyer
                </button>
                <button type="button" className={demoBtn} onClick={() => supportRelease(order.id)}>
                  Support: release to seller
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
