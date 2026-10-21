import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { WINDOW_MS, formatWhen, refundAmount } from "../lib/orders.js";
import { adjustStock } from "../lib/stock.js";
import { formatKES } from "../lib/format.js";

// Demo order store kept in the browser. The escrow rules below move to the
// backend later; the pages keep calling the same functions.
const OrdersContext = createContext(null);
const STORAGE_KEY = "vibeyetu_orders_v2";

function loadOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// One progress entry. The same event reads differently to each side, and
// `notify` says who gets a bell notification ("buyer", "seller", "both" or null).
const evt = (buyer, seller = buyer, notify = null) => ({ at: Date.now(), buyer, seller, notify });
const newCode = () => String(Math.floor(100000 + Math.random() * 900000));
const fail = (message) => ({ ok: false, message });
const OK = { ok: true };

function refunded(o) {
  const amount = refundAmount(o);
  const note = amount < o.total ? " The delivery fee is not refunded." : "";
  const text = `Refund of ${formatKES(amount)} sent to the account you paid from.${note}`;
  return {
    ...o,
    status: "refunded",
    refundAmount: amount,
    events: [...o.events, evt(text, `Order refunded to the buyer (${formatKES(amount)}).`, "both")],
  };
}

function codeProblem(o, wanted, code) {
  if (!o || o.status !== wanted) return "This order can no longer be updated.";
  if (Date.now() > o.acceptedAt + WINDOW_MS) return "The 24-hour window has ended. Please answer the review form.";
  if (String(code).trim() !== o.code) return "That code is not correct. Check it and try again.";
  return "";
}

const isOpenAndExpired = (o) =>
  o && (o.status === "accepted" || o.status === "dispatched") && Date.now() > o.acceptedAt + WINDOW_MS;

export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState(loadOrders);
  const stockDone = useRef(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      // Storage unavailable: orders stay for this visit only.
    }
  }, [orders]);

  const addOrders = useCallback((list) => {
    setOrders((prev) => {
      const known = new Set(prev.map((o) => o.id));
      const fresh = list
        .filter((o) => !known.has(o.id))
        .map((o) => ({
          ...o,
          status: "pending",
          createdAt: Date.now(),
          code: null,
          acceptedAt: null,
          promisedBy: null,
          sellerConfirmed: false,
          buyerConfirmed: false,
          rejectedBy: null,
          rejectReason: "",
          returnConfirmed: false,
          refundRequested: false,
          refundAmount: null,
          reports: {},
          events: [
            evt("Payment received. Your money is held in escrow.", `New order ${o.id} for ${formatKES(o.total)}. Agree to fulfil it.`, "seller"),
          ],
        }));
      return fresh.length ? [...fresh, ...prev] : prev;
    });
  }, []);

  const value = useMemo(() => {
    const find = (id) => orders.find((o) => o.id === id);
    const patch = (id, fn) => setOrders((prev) => prev.map((o) => (o.id === id ? fn(o) : o)));
    // Moves stock once per order and direction, even if a button is pressed twice.
    const moveStock = (o, sign, tag) => {
      const key = `${o.id}:${tag}`;
      if (stockDone.current.has(key)) return;
      stockDone.current.add(key);
      (o.items || []).forEach((i) => {
        if (i.productId) adjustStock(i.productId, sign * i.qty);
      });
    };

    return {
      orders,
      addOrders,

      // ---- Seller actions ----
      sellerAccept: (id, promiseMs) => {
        const o = find(id);
        if (!o || o.status !== "pending") return fail("This order can no longer be accepted.");
        const now = Date.now();
        const by = formatWhen(now + promiseMs);
        patch(id, (cur) =>
          cur.status !== "pending"
            ? cur
            : {
                ...cur,
                status: "accepted",
                code: newCode(),
                acceptedAt: now,
                promisedBy: now + promiseMs,
                events: [
                  ...cur.events,
                  evt(`Seller agreed to fulfil your order by ${by}.`, `You agreed to fulfil this order by ${by}.`, "buyer"),
                ],
              }
        );
        return OK;
      },
      sellerReject: (id, reason) => {
        const o = find(id);
        if (!o || (o.status !== "pending" && o.status !== "accepted")) return fail("This order can no longer be rejected.");
        patch(id, (cur) =>
          cur.status !== "pending" && cur.status !== "accepted"
            ? cur
            : {
                ...cur,
                status: "rejected",
                rejectedBy: "seller",
                rejectReason: reason,
                events: [...cur.events, evt(`Seller rejected the order: ${reason}.`, `You rejected the order: ${reason}.`, "buyer")],
              }
        );
        return OK;
      },
      sellerDispatch: (id, code) => {
        const o = find(id);
        const problem = codeProblem(o, "accepted", code);
        if (problem) return fail(problem);
        moveStock(o, -1, "out");
        patch(id, (cur) =>
          cur.status !== "accepted"
            ? cur
            : {
                ...cur,
                status: "dispatched",
                sellerConfirmed: true,
                events: [
                  ...cur.events,
                  evt(
                    "Seller entered the code. Your order has left. Enter your code when it arrives.",
                    "You entered the code. The order has left your shop.",
                    "buyer"
                  ),
                ],
              }
        );
        return OK;
      },
      sellerConfirmReturn: (id) => {
        const o = find(id);
        if (!o || o.status !== "rejected" || o.rejectedBy !== "buyer" || o.returnConfirmed) {
          return fail("There is no return to confirm for this order.");
        }
        moveStock(o, 1, "in");
        patch(id, (cur) => {
          const next = {
            ...cur,
            returnConfirmed: true,
            events: [
              ...cur.events,
              evt("Seller confirmed the returned item.", "You confirmed the returned item. Inventory updated.", "buyer"),
            ],
          };
          return next.refundRequested ? refunded(next) : next;
        });
        return OK;
      },

      // ---- Buyer actions ----
      buyerConfirm: (id, code) => {
        const o = find(id);
        const problem = codeProblem(o, "dispatched", code);
        if (problem) return fail(problem);
        patch(id, (cur) =>
          cur.status !== "dispatched"
            ? cur
            : {
                ...cur,
                status: "completed",
                completedAt: Date.now(),
                buyerConfirmed: true,
                events: [
                  ...cur.events,
                  evt("You confirmed receipt.", "Buyer confirmed receipt.", "seller"),
                  evt("Funds released to the seller.", "Payment released to you.", "seller"),
                ],
              }
        );
        return OK;
      },
      buyerReject: (id, reason) => {
        const o = find(id);
        if (!o || o.status !== "dispatched") return fail("This order can no longer be rejected.");
        if (Date.now() > o.acceptedAt + WINDOW_MS) return fail("The 24-hour window has ended. Please answer the review form.");
        patch(id, (cur) =>
          cur.status !== "dispatched"
            ? cur
            : {
                ...cur,
                status: "rejected",
                rejectedBy: "buyer",
                rejectReason: reason,
                events: [
                  ...cur.events,
                  evt(
                    `You rejected the item: ${reason}. Please return it to the seller.`,
                    `Buyer rejected the item: ${reason}. Expect it back, then confirm the return.`,
                    "seller"
                  ),
                ],
              }
        );
        return OK;
      },
      requestRefund: (id) => {
        const o = find(id);
        if (!o || o.status !== "rejected" || o.refundRequested) return fail("A refund cannot be requested for this order.");
        patch(id, (cur) => {
          if (cur.status !== "rejected" || cur.refundRequested) return cur;
          const next = {
            ...cur,
            refundRequested: true,
            events: [...cur.events, evt("You requested a refund.", "Buyer requested a refund.", "seller")],
          };
          return cur.rejectedBy === "seller" || cur.returnConfirmed ? refunded(next) : next;
        });
        return OK;
      },

      // ---- Both: the form after the 24-hour window ----
      submitReport: (id, role, report) => {
        const o = find(id);
        if (!isOpenAndExpired(o)) return fail("This order is not waiting for a review form.");
        patch(id, (cur) => ({
          ...cur,
          reports: { ...cur.reports, [role]: { ...report, at: Date.now() } },
          events: [
            ...cur.events,
            role === "buyer"
              ? evt("You answered the review form.", "Buyer answered the review form.", "seller")
              : evt("Seller answered the review form.", "You answered the review form.", "buyer"),
          ],
        }));
        return OK;
      },

      // ---- Demo helpers: these stand in for time passing and for our support team ----
      expireNow: (id) =>
        patch(id, (o) =>
          o.status === "accepted" || o.status === "dispatched" ? { ...o, acceptedAt: Date.now() - WINDOW_MS - 60000 } : o
        ),
      supportRefund: (id) => {
        if (!isOpenAndExpired(find(id))) return;
        patch(id, (cur) =>
          cur.status === "accepted" || cur.status === "dispatched"
            ? refunded({
                ...cur,
                events: [...cur.events, evt("Support reviewed the order and approved a refund.", undefined, "both")],
              })
            : cur
        );
      },
      supportRelease: (id) => {
        if (!isOpenAndExpired(find(id))) return;
        patch(id, (cur) =>
          cur.status === "accepted" || cur.status === "dispatched"
            ? {
                ...cur,
                status: "completed",
                completedAt: Date.now(),
                events: [
                  ...cur.events,
                  evt("Support reviewed the order and released the funds to the seller.", undefined, "both"),
                ],
              }
            : cur
        );
      },
    };
  }, [orders, addOrders]);

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used inside OrdersProvider");
  return ctx;
}
