import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/Button.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import useNow from "../hooks/useNow.js";
import useNotifications from "../hooks/useNotifications.js";
import { useOrders } from "../context/OrdersContext.jsx";
import { formatWhen, getStatus } from "../lib/orders.js";
import { formatKES, fulfillmentLabel } from "../lib/format.js";
import { formatSize } from "../lib/sizes.js";

const ACTIVE = ["pending", "accepted", "dispatched", "review"];
const FILTERS = [
  ["all", "All"],
  ["active", "In progress"],
  ["completed", "Completed"],
  ["closed", "Rejected or refunded"],
];
const MATCH = {
  all: () => true,
  active: (status) => ACTIVE.includes(status),
  completed: (status) => status === "completed",
  closed: (status) => status === "rejected" || status === "refunded",
};

const chip = (active) =>
  `rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-ink text-white" : "bg-white shadow-card hover:bg-vibe-light"}`;

export default function Orders() {
  const { orders } = useOrders();
  const now = useNow(60000);
  const { unreadOrderIds } = useNotifications("buyer");
  const [filter, setFilter] = useState("all");

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-3xl font-extrabold">No orders yet</h1>
        <p className="text-ink-mute">When you place an order, you can follow it here.</p>
        <Button to="/search">Start shopping</Button>
      </div>
    );
  }

  const rows = orders.map((o) => ({ o, status: getStatus(o, now) }));
  const shown = rows.filter((r) => MATCH[filter](r.status));
  const countFor = (key) => rows.filter((r) => MATCH[key](r.status)).length;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8">
      <h1 className="mb-2 text-3xl font-extrabold">My orders</h1>
      <p className="mb-5 text-sm text-ink-mute">Your order history, newest first.</p>

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter orders">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} className={chip(filter === key)} onClick={() => setFilter(key)}>
            {label} ({countFor(key)})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-ink-mute shadow-card">No orders in this list.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map(({ o, status }) => {
            const count = (o.items || []).reduce((n, i) => n + i.qty, 0);
            return (
              <li key={o.id}>
                <Link to={`/orders/${o.id}`} className="block space-y-2 rounded-2xl bg-white p-4 shadow-card hover:bg-vibe-light">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{o.shopName}</p>
                      <p className="text-sm text-ink-mute">
                        Order {o.id} &middot; {formatWhen(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadOrderIds.has(o.id) && <span role="img" aria-label="New update" className="h-2.5 w-2.5 rounded-full bg-red-600" />}
                      <StatusBadge status={status} />
                    </div>
                  </div>
                  <p className="line-clamp-2 text-sm text-ink-soft">
                    {(o.items || []).map((i) => `${i.name}${i.size ? ` (${formatSize(i.sizeType, i.size)})` : ""} × ${i.qty}`).join(", ")}
                  </p>
                  <p className="flex justify-between text-sm text-ink-soft">
                    <span>
                      {count} {count === 1 ? "item" : "items"} &middot; {fulfillmentLabel(o.mode)}
                    </span>
                    <span className="font-extrabold text-ink">{formatKES(o.total)}</span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
