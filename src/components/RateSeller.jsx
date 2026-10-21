import { useState } from "react";
import Button from "./Button.jsx";
import StarInput, { Stars } from "./StarInput.jsx";
import { addRating, findRating, skipRating, wasSkipped } from "../lib/ratings.js";

// Shown after an order is completed. Buyers can rate the seller or skip.
export default function RateSeller({ order }) {
  const [, setVersion] = useState(0);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [skipped, setSkipped] = useState(() => wasSkipped(order.id));
  const existing = findRating(order.id, "shop", order.shopId);

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

  function submit(e) {
    e.preventDefault();
    if (stars === 0) {
      setError("Tap a star to rate.");
      return;
    }
    addRating({ orderId: order.id, kind: "shop", targetId: order.shopId, stars, comment });
    setVersion((v) => v + 1);
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
        <Button type="submit" size="sm">
          Send rating
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            skipRating(order.id);
            setSkipped(true);
          }}
        >
          Skip
        </Button>
      </div>
    </form>
  );
}
