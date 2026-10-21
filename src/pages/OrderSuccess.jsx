import { useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import Button from "../components/Button.jsx";
import { useOrders } from "../context/OrdersContext.jsx";
import { formatKES, fulfillmentLabel } from "../lib/format.js";

export default function OrderSuccess() {
  const group = useLocation().state?.group;
  const { addOrders } = useOrders();

  // Saves the new orders to My Orders. Safe to run twice: known orders are skipped.
  useEffect(() => {
    if (group) addOrders(group.orders);
  }, [group, addOrders]);

  if (!group) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pt-12 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-vibe" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold">Payment received</h1>
        <p className="text-ink-soft">
          Your {formatKES(group.total)} is held safely in escrow. Each seller has been notified. Once a seller agrees to fulfil your order, you will see the update on your order page.
        </p>
      </div>

      <ul className="space-y-3 text-left">
        {group.orders.map((o) => (
          <li key={o.id}>
            <Link to={`/orders/${o.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card hover:bg-vibe-light">
              <div>
                <p className="font-bold">{o.shopName}</p>
                <p className="text-sm text-ink-mute">
                  Order {o.id} &middot; {fulfillmentLabel(o.mode)}
                </p>
              </div>
              <span className="font-extrabold">{formatKES(o.total)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap justify-center gap-3">
        <Button to="/orders">View my orders</Button>
        <Button to="/search" variant="outline">
          Continue shopping
        </Button>
      </div>
    </div>
  );
}
