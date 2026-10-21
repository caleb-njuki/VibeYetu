import { Link } from "react-router-dom";
import useNow from "../../hooks/useNow.js";
import { useOrders } from "../../context/OrdersContext.jsx";
import { STATUS, getStatus } from "../../lib/orders.js";
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
  const { orders } = useOrders();
  const now = useNow(60000);

  const rows = orders.map((o) => ({ o, status: getStatus(o, now) }));
  const sum = (list) => list.reduce((n, r) => n + r.o.total, 0);
  const inEscrow = rows.filter((r) => ["pending", "accepted", "dispatched"].includes(r.status));
  const completed = rows.filter((r) => r.status === "completed");
  const cases = rows.filter((r) => r.status === "review");
  const counts = Object.keys(STATUS).map((key) => [key, rows.filter((r) => r.status === key).length]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Overview</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders" value={orders.length} />
        <Stat label="Held in escrow" value={formatKES(sum(inEscrow))} hint={`${inEscrow.length} orders`} />
        <Stat label="Released to sellers" value={formatKES(sum(completed))} hint={`${completed.length} orders`} />
        <Stat label="Cases to decide" value={cases.length} hint="Past the 24-hour window" />
      </div>

      {cases.length > 0 && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {cases.length} {cases.length === 1 ? "case needs" : "cases need"} a decision.{" "}
          <Link to="/admin/cases" className="font-semibold underline">
            Open cases
          </Link>
        </p>
      )}

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-card">
        <h2 className="text-lg font-extrabold">Orders by status</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {counts.map(([key, n]) => (
            <li key={key} className="flex justify-between rounded-xl bg-ivory px-3 py-2">
              <span>{STATUS[key].label}</span>
              <span className="font-extrabold">{n}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
