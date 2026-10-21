import { Link } from "react-router-dom";
import { ShieldCheck, Trash2 } from "lucide-react";
import Button from "../components/Button.jsx";
import QtyStepper from "../components/QtyStepper.jsx";
import { useCart } from "../context/CartContext.jsx";
import { formatKES } from "../lib/format.js";

export default function Cart() {
  const { items, total, count, setQty, remove } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-3xl font-extrabold">Your cart is empty</h1>
        <p className="text-ink-mute">Find something you like and add it here.</p>
        <Button to="/search">Start shopping</Button>
      </div>
    );
  }

  // Group items by shop, because each shop gets its own order.
  const groups = [];
  items.forEach((item) => {
    let group = groups.find((g) => g.shopId === item.shopId);
    if (!group) {
      group = { shopId: item.shopId, shopName: item.shopName || "Shop", items: [] };
      groups.push(group);
    }
    group.items.push(item);
  });

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <h1 className="mb-6 text-3xl font-extrabold">Your cart ({count})</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.shopId} className="rounded-2xl bg-white p-4 shadow-card" aria-label={g.shopName}>
              <h2 className="mb-3 font-bold">
                <Link to={`/shop/${g.shopId}`} className="hover:text-vibe">
                  {g.shopName}
                </Link>
              </h2>
              <ul className="divide-y divide-ink/10">
                {g.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <Link
                      to={`/product/${item.id}`}
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-3xl"
                      style={{ background: `hsl(${item.hue ?? 220} 60% 90%)` }}
                      aria-label={item.name}
                    >
                      {item.emoji || "🛍️"}
                    </Link>
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link to={`/product/${item.id}`} className="line-clamp-1 font-semibold hover:text-vibe">
                        {item.name}
                      </Link>
                      <p className="text-sm text-ink-mute">{formatKES(item.price)}</p>
                      <QtyStepper value={item.qty} onChange={(n) => setQty(item.id, n)} />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="font-extrabold">{formatKES(item.price * item.qty)}</span>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="rounded-full p-2 text-ink-mute hover:bg-ink/5 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="h-fit space-y-4 rounded-2xl bg-white p-5 shadow-card lg:sticky lg:top-24">
          <h2 className="text-lg font-extrabold">Order summary</h2>
          <div className="flex justify-between text-sm">
            <span className="text-ink-soft">Subtotal</span>
            <span className="font-semibold">{formatKES(total)}</span>
          </div>
          <p className="text-xs text-ink-mute">
            Delivery fees are added at checkout. You are ordering from {groups.length}{" "}
            {groups.length === 1 ? "shop" : "shops"}, so you will get {groups.length}{" "}
            {groups.length === 1 ? "order" : "separate orders"}.
          </p>
          <div className="flex justify-between border-t border-ink/10 pt-3 text-lg font-extrabold">
            <span>Total</span>
            <span>{formatKES(total)}</span>
          </div>
          <Button to="/checkout" size="lg" className="w-full">
            Checkout
          </Button>
          <p className="flex items-start gap-2 text-xs text-ink-mute">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-vibe" aria-hidden="true" />
            Your payment is held in escrow until you confirm your items.
          </p>
        </aside>
      </div>
    </div>
  );
}
