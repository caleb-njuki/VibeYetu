import { useState } from "react";
import StatusBadge from "../../components/StatusBadge.jsx";
import { useEffect } from "react";
import { listAdminOrders } from "../../services/adminApi.js";
import { STATUS, formatWhen } from "../../lib/orders.js";
import { formatKES, fulfillmentLabel } from "../../lib/format.js";

const inputCls = "rounded-full border border-ink/20 bg-white px-4 py-2 text-sm";

export default function AdminOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");

  // Ask the server again when the filter changes (a short pause while typing).
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      listAdminOrders({ status, q: query })
        .then((list) => {
          if (live) {
            setOrders(list);
            setError("");
          }
        })
        .catch((err) => live && setError(err.message || "Could not load orders."));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [status, query]);

  const rows = (orders || []).map((o) => ({ o, status: o.status }));

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

      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      {orders === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-ivory-dark" aria-busy="true" />
      ) : rows.length === 0 ? (
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
