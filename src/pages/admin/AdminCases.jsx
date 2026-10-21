import { useState } from "react";
import Button from "../../components/Button.jsx";
import useNow from "../../hooks/useNow.js";
import { useOrders } from "../../context/OrdersContext.jsx";
import { formatCountdown, formatWhen, getStatus, refundAmount, supportDeadline } from "../../lib/orders.js";
import { formatKES } from "../../lib/format.js";

function Answers({ title, report }) {
  return (
    <div className="space-y-1 rounded-xl bg-ivory p-4 text-sm">
      <p className="font-bold">{title}</p>
      {report ? (
        <>
          <p className="font-semibold">{report.reason}</p>
          <p className="text-ink-soft">{report.details}</p>
          <p className="text-xs text-ink-mute">Sent {formatWhen(report.at)}</p>
        </>
      ) : (
        <p className="text-ink-mute">Has not answered yet.</p>
      )}
    </div>
  );
}

export default function AdminCases() {
  const { orders, supportRefund, supportRelease } = useOrders();
  const now = useNow(60000);
  const [confirming, setConfirming] = useState(null); // { id, action }

  const cases = orders
    .filter((o) => (o.status === "accepted" || o.status === "dispatched") && getStatus(o, now) === "review")
    .sort((a, b) => supportDeadline(a) - supportDeadline(b));

  function decide() {
    if (!confirming) return;
    if (confirming.action === "refund") supportRefund(confirming.id);
    else supportRelease(confirming.id);
    setConfirming(null);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold">Cases</h1>
        <p className="text-sm text-ink-mute">
          Orders that passed the 24-hour window without both sides confirming. Decide within 72 hours. The money stays in escrow until you do.
        </p>
      </div>

      {cases.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-ink-mute shadow-card">No cases need a decision right now.</p>
      ) : (
        <ul className="space-y-4">
          {cases.map((o) => {
            const left = supportDeadline(o) - now;
            const refundTo = refundAmount(o);
            const asking = confirming?.id === o.id ? confirming.action : null;
            return (
              <li key={o.id} className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold">
                      Order {o.id} &middot; {o.shopName}
                    </h2>
                    <p className="text-sm text-ink-mute">
                      {formatKES(o.total)} &middot; {o.sellerConfirmed ? "Seller dispatched it" : "Seller never dispatched it"} &middot; Accepted {formatWhen(o.acceptedAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${left <= 0 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}
                  >
                    {left <= 0 ? "Past the 72-hour deadline" : `Decide within ${formatCountdown(left)}`}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Answers title="Buyer's answers" report={o.reports?.buyer} />
                  <Answers title="Seller's answers" report={o.reports?.seller} />
                </div>

                {asking ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/15 p-3 text-sm">
                    <span className="font-semibold">
                      {asking === "refund" ? `Refund ${formatKES(refundTo)} to the buyer?` : `Release ${formatKES(o.total)} to the seller?`} This cannot be undone.
                    </span>
                    <Button size="sm" variant="dark" onClick={decide}>
                      Yes, confirm
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setConfirming({ id: o.id, action: "refund" })}>Refund buyer ({formatKES(refundTo)})</Button>
                    <Button variant="outline" onClick={() => setConfirming({ id: o.id, action: "release" })}>
                      Release to seller ({formatKES(o.total)})
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
