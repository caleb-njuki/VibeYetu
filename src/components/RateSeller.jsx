import { useState } from "react";
import Button from "./Button.jsx";
import StarInput, { Stars } from "./StarInput.jsx";
import { useOrders } from "../context/OrdersContext.jsx";
import { rateOrder, skipOrderRating } from "../services/api.js";

// Shown after an order is completed. Buyers can rate the seller or skip.
export default function RateSeller({ order }) {
  const { refresh } = useOrders();
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [skipped, setSkipped] = useState(Boolean(order.ratingSkipped));
  const existing = (order.ratings || []).find((x) => x.kind === "shop") || null;

  if (existing) {
    return (
      <div className="space-y-1 rounded-xl bg-ivory p-4 text-sm">
        <p className="font-bold">Thank you for rating {order.shopName}</p>
        <Stars value={existing.stars} className="h-5 w-5" />
        {existing.comment && <p className="text-ink-soft">{existing.comment}</p>}
      </div>
    );
  }

  if (skipped) {
    return (
      <button type="button" onClick={() => setSkipped(false)} className="text-sm font-semibold text-vibe hover:underline">
        Rate {order.shopName}
      </button>
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (stars === 0) {
      setError("Tap a star to rate.");
      return;
    }
    setBusy(true);
    try {
      await rateOrder(order.id, { kind: "shop", stars, comment: comment.trim() });
      setError("");
      await refresh();
    } catch (err) {
      setError(err.message || "Could not send your rating. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-ink/15 p-4" noValidate>
      <p className="font-bold">How was {order.shopName}?</p>
      <StarInput value={stars} onChange={setStars} label={`Rate ${order.shopName}`} />
      <label htmlFor="rate-comment" className="sr-only">
        Comment (optional)
      </label>
      <textarea
        id="rate-comment"
        rows={2}
        maxLength={200}
        placeholder="Tell others about your experience (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="w-full rounded-xl border border-ink/20 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe"
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          Send rating
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSkipped(true);
            skipOrderRating(order.id).catch(() => {});
          }}
        >
          Skip
        </Button>
      </div>
    </form>
  );
}
