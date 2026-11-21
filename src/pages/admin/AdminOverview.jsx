import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getOverview } from "../../services/adminApi.js";
import { STATUS } from "../../lib/orders.js";
import { formatKES } from "../../lib/format.js";

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    getOverview()
      .then((o) => live && setData(o))
      .catch((err) => live && setError(err.message || "Could not load the overview."));
    return () => {
      live = false;
    };
  }, []);

  if (error) return <p role="alert" className="rounded-2xl bg-white p-6 font-semibold text-red-700 shadow-card">{error}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-2xl bg-ivory-dark" aria-busy="true" />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Overview</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders" value={data.orders} />
        <Stat label="Held in escrow" value={formatKES(data.escrow.total)} hint={`${data.escrow.count} orders`} />
        <Stat label="Released to sellers" value={formatKES(data.released.total)} hint={`${data.released.count} orders`} />
        <Stat label="Cases to decide" value={data.cases} hint="Past the 24-hour window" />
      </div>

      {data.cases > 0 && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.cases} {data.cases === 1 ? "case needs" : "cases need"} a decision.{" "}
          <Link to="/admin/cases" className="font-semibold underline">
            Open cases
          </Link>
        </p>
      )}
      {data.pendingReviews > 0 && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.pendingReviews} suspended {data.pendingReviews === 1 ? "shop is" : "shops are"} waiting for a review.{" "}
          <Link to="/admin/shops" className="font-semibold underline">
            Open shops
          </Link>
        </p>
      )}

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-card">
        <h2 className="text-lg font-extrabold">Orders by status</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {Object.keys(STATUS).map((key) => (
            <li key={key} className="flex justify-between rounded-xl bg-ivory px-3 py-2">
              <span>{STATUS[key].label}</span>
              <span className="font-extrabold">{data.byStatus[key] ?? 0}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
