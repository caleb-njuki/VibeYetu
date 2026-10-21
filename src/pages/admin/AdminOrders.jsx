import { useState } from "react";
import StatusBadge from "../../components/StatusBadge.jsx";
import useNow from "../../hooks/useNow.js";
import { useOrders } from "../../context/OrdersContext.jsx";
import { STATUS, formatWhen, getStatus } from "../../lib/orders.js";
import { formatKES, fulfillmentLabel } from "../../lib/format.js";

const inputCls = "rounded-full border border-ink/20 bg-white px-4 py-2 text-sm";

export default function AdminOrders() {
  const { orders } = useOrders();
  const now = useNow(60000);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const rows = orders
    .map((o) => ({ o, status: getStatus(o, now) }))
    .filter((r) => (!status || r.status === status) && (!q || r.o.id.toLowerCase().includes(q) || r.o.shopName.toLowerCase().includes(q)));

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold">Orders</h1>

      <div className="flex flex-wrap gap-3">
        <label htmlFor="o-status" className="sr-only">
          Status
        </label>
        <select id="o-status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </select>
        <label htmlFor="o-search" className="sr-only">
          Search orders
        </label>
        <input
          id="o-search"
          type="search"
          placeholder="Search by order or shop"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${inputCls} w-full sm:w-72`}
        />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-ink-mute shadow-card">No orders match.</p>
      ) : (
        <ul className="divide-y divide-ink/10 rounded-2xl bg-white shadow-card">
          {rows.slice(0, 100).map(({ o, status: s }) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-bold">
                  {o.id} &middot; {o.shopName}
                </p>
                <p className="text-sm text-ink-mute">
                  {formatWhen(o.createdAt)} &middot; {fulfillmentLabel(o.mode)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-extrabold">{formatKES(o.total)}</span>
                <StatusBadge status={s} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
