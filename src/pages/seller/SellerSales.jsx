import { useMemo, useState } from "react";
import useNow from "../../hooks/useNow.js";
import { useOrders } from "../../context/OrdersContext.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { formatKES } from "../../lib/format.js";
import { FEE_LABEL, platformFee } from "../../lib/fees.js";

const PERIODS = [
  ["today", "Today"],
  ["week", "This week"],
  ["month", "This month"],
  ["year", "This year"],
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A period is split into buckets. Bucket i covers [at(i), at(i + 1)).
function buildRange(period, now) {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const weekStartDay = day - ((d.getDay() + 6) % 7); // weeks start on Monday
  return {
    today: { n: 24, at: (i) => new Date(y, m, day, i).getTime(), label: (i) => String(i).padStart(2, "0") },
    week: { n: 7, at: (i) => new Date(y, m, weekStartDay + i).getTime(), label: (i) => DAYS[i] },
    month: { n: new Date(y, m + 1, 0).getDate(), at: (i) => new Date(y, m, 1 + i).getTime(), label: (i) => String(i + 1) },
    year: { n: 12, at: (i) => new Date(y, i, 1).getTime(), label: (i) => MONTHS[i] },
  }[period];
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

export default function SellerSales() {
  const { seller } = useSeller();
  const { orders } = useOrders();
  const now = useNow(60000);
  const [period, setPeriod] = useState("today");

  const data = useMemo(() => {
    const range = buildRange(period, now);
    const start = range.at(0);
    const end = range.at(range.n);
    const sales = orders
      .filter((o) => o.shopId === seller.shopId && o.status === "completed")
      .map((o) => ({ ...o, when: o.completedAt ?? o.events[o.events.length - 1]?.at ?? o.createdAt }))
      .filter((o) => o.when >= start && o.when < end);

    const buckets = Array.from({ length: range.n }, (_, i) => ({ label: range.label(i), value: 0 }));
    sales.forEach((o) => {
      for (let i = 0; i < range.n; i += 1) {
        if (o.when >= range.at(i) && o.when < range.at(i + 1)) {
          buckets[i].value += o.subtotal;
          break;
        }
      }
    });

    const top = new Map();
    sales.forEach((o) =>
      (o.items || []).forEach((i) => {
        const cur = top.get(i.name) || { name: i.name, qty: 0, revenue: 0 };
        cur.qty += i.qty;
        cur.revenue += i.price * i.qty;
        top.set(i.name, cur);
      })
    );

    const revenue = sales.reduce((n, o) => n + o.subtotal, 0);
    // The fee is worked out order by order, the way it is taken when each order pays out.
    const fees = sales.reduce((n, o) => n + platformFee(o.subtotal), 0);
    return {
      buckets,
      revenue,
      fees,
      net: revenue - fees,
      count: sales.length,
      items: sales.reduce((n, o) => n + (o.items || []).reduce((k, i) => k + i.qty, 0), 0),
      average: sales.length ? Math.round(revenue / sales.length) : 0,
      top: [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    };
  }, [orders, seller.shopId, period, now]);

  const heldOrders = orders.filter((o) => o.shopId === seller.shopId && ["pending", "accepted", "dispatched"].includes(o.status));
  const held = heldOrders.reduce((n, o) => n + o.subtotal, 0);
  const heldFee = heldOrders.reduce((n, o) => n + platformFee(o.subtotal), 0);
  const max = Math.max(...data.buckets.map((b) => b.value), 1);
  const step = data.buckets.length > 12 ? Math.ceil(data.buckets.length / 6) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Sales</h1>
        <div>
          <label htmlFor="period" className="sr-only">
            Period
          </label>
          <select
            id="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-full border border-ink/20 bg-white px-4 py-2 text-sm font-semibold"
          >
            {PERIODS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Sales" value={formatKES(data.revenue)} />
        <Stat label={`VibeYetu fee (${FEE_LABEL})`} value={formatKES(data.fees)} />
        <Stat label="You keep" value={formatKES(data.net)} />
        <Stat label="Orders completed" value={data.count} />
        <Stat label="Items sold" value={data.items} />
        <Stat label="Average order" value={formatKES(data.average)} />
      </div>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-card" aria-label="Sales chart">
        <h2 className="text-lg font-extrabold">Sales over time</h2>
        <div className="flex h-44 items-end gap-1">
          {data.buckets.map((b, i) => (
            <div key={i} className="flex h-full flex-1 items-end" title={`${b.label}: ${formatKES(b.value)}`}>
              <div
                className="w-full rounded-t bg-vibe"
                style={{ height: b.value > 0 ? `${Math.max((b.value / max) * 100, 4)}%` : "0%" }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1 text-xs text-ink-mute" aria-hidden="true">
          {data.buckets.map((b, i) => (
            <span key={i} className="flex-1 text-center">
              {i % step === 0 ? b.label : ""}
            </span>
          ))}
        </div>
        {data.revenue === 0 && <p className="text-sm text-ink-mute">No completed sales in this period yet.</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-lg font-extrabold">Best sellers</h2>
          {data.top.length === 0 ? (
            <p className="text-sm text-ink-mute">Nothing sold in this period.</p>
          ) : (
            <ul className="divide-y divide-ink/10 text-sm">
              {data.top.map((t) => (
                <li key={t.name} className="flex justify-between gap-3 py-2">
                  <span>
                    {t.name} <span className="text-ink-mute">&times; {t.qty}</span>
                  </span>
                  <span className="font-semibold">{formatKES(t.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-2 rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-lg font-extrabold">Held in escrow</h2>
          <p className="text-3xl font-extrabold">{formatKES(held)}</p>
          <p className="text-sm text-ink-mute">
            Paid by buyers for orders still in progress. It is released to you when each buyer confirms. VibeYetu&apos;s {FEE_LABEL} fee
            ({formatKES(heldFee)} on this amount) is taken then, so you will get {formatKES(held - heldFee)} for the items.
          </p>
        </section>
      </div>
    </div>
  );
}
