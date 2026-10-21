import { useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../../components/StatusBadge.jsx";
import useNow from "../../hooks/useNow.js";
import useNotifications from "../../hooks/useNotifications.js";
import { getShopSettings } from "../../lib/shopProfile.js";
import { useOrders } from "../../context/OrdersContext.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { formatWhen, getStatus, sellerAction } from "../../lib/orders.js";
import { formatKES, fulfillmentLabel } from "../../lib/format.js";

const chip = (active) =>
  `rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-ink text-white" : "bg-white shadow-card hover:bg-vibe-light"}`;

export default function SellerOrders() {
  const { seller } = useSeller();
  const { orders } = useOrders();
  const now = useNow(60000);
  const { unreadOrderIds } = useNotifications("seller", seller.shopId);
  const [filter, setFilter] = useState("all");

  const rows = orders
    .filter((o) => o.shopId === seller.shopId)
    .map((o) => {
      const status = getStatus(o, now);
      return { o, status, action: sellerAction(o, status) };
    });
  const shown = filter === "action" ? rows.filter((r) => r.action) : rows;
  const needAction = rows.filter((r) => r.action).length;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold">Orders</h1>

      {!getShopSettings(seller.shopId).private.payout && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add your M-Pesa number in{" "}
          <Link to="/my-shop/settings" className="font-semibold underline">
            Settings
          </Link>{" "}
          so we know where to pay you.
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" className={chip(filter === "all")} onClick={() => setFilter("all")}>
          All ({rows.length})
        </button>
        <button type="button" className={chip(filter === "action")} onClick={() => setFilter("action")}>
          Needs action ({needAction})
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-ink-mute shadow-card">
          {rows.length === 0 ? "No orders for your shop yet. New orders appear here once buyers pay." : "Nothing needs your action right now."}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map(({ o, status, action }) => (
            <li key={o.id}>
              <Link to={`/my-shop/orders/${o.id}`} className="block space-y-2 rounded-2xl bg-white p-4 shadow-card hover:bg-vibe-light">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">Order {o.id}</p>
                    <p className="text-sm text-ink-mute">
                      {formatWhen(o.createdAt)} &middot; {fulfillmentLabel(o.mode)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadOrderIds.has(o.id) && <span role="img" aria-label="New update" className="h-2.5 w-2.5 rounded-full bg-red-600" />}
                    <StatusBadge status={status} />
                  </div>
                </div>
                <p className="flex justify-between text-sm">
                  <span className="font-semibold text-vibe-dark">{action || ""}</span>
                  <span className="font-extrabold">{formatKES(o.total)}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
