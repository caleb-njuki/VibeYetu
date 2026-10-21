import { Link } from "react-router-dom";
import Button from "../components/Button.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import useNow from "../hooks/useNow.js";
import useNotifications from "../hooks/useNotifications.js";
import { useOrders } from "../context/OrdersContext.jsx";
import { formatWhen, getStatus } from "../lib/orders.js";
import { formatKES, fulfillmentLabel } from "../lib/format.js";

export default function Orders() {
  const { orders } = useOrders();
  const now = useNow(60000);
  const { unreadOrderIds } = useNotifications("buyer");

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-3xl font-extrabold">No orders yet</h1>
        <p className="text-ink-mute">When you place an order, you can follow it here.</p>
        <Button to="/search">Start shopping</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8">
      <h1 className="mb-6 text-3xl font-extrabold">My orders</h1>
      <ul className="space-y-3">
        {orders.map((o) => {
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
                    <StatusBadge status={getStatus(o, now)} />
                  </div>
                </div>
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
    </div>
  );
}
