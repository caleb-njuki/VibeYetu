import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/Button.jsx";
import { useOrders } from "../../context/OrdersContext.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { STRIKE_LIMIT } from "../../lib/strikes.js";
import { getShopFlags } from "../../lib/shopFlags.js";
import { REPORT_REASONS, currentReport, submitSuspensionReport } from "../../lib/suspensions.js";
import { SHOPS_CHANGED } from "../../lib/sellers.js";
import { formatWhen } from "../../lib/orders.js";
import { formatKES } from "../../lib/format.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";

export default function SellerSuspension() {
  const { seller } = useSeller();
  const { orders } = useOrders();
  const flags = getShopFlags(seller.shopId);
  const report = currentReport(seller.shopId);
  const [reason, setReason] = useState(report?.reason || "");
  const [details, setDetails] = useState(report?.details || "");
  const [plan, setPlan] = useState(report?.plan || "");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [, refresh] = useState(0);

  if (!flags.suspended) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">This shop is not suspended</h1>
        <p className="text-sm text-ink-mute">You have nothing to report right now.</p>
        <Button to="/my-shop">Back to orders</Button>
      </div>
    );
  }

  const failed = (flags.suspendOrderIds || []).map((id) => orders.find((o) => o.id === id)).filter(Boolean);

  function onSubmit(e) {
    e.preventDefault();
    const result = submitSuspensionReport(seller.shopId, { reason, details, plan });
    if (!result.ok) return setError(result.message);
    setError("");
    setSent(true);
    refresh((n) => n + 1);
    window.dispatchEvent(new Event(SHOPS_CHANGED));
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold">Suspension report</h1>
        <p className="text-sm text-ink-mute">
          {flags.suspendKind === "auto"
            ? `Your shop was suspended automatically because ${failed.length || STRIKE_LIMIT} orders in a row were not fulfilled.`
            : "VibeYetu support suspended your shop."}{" "}
          Tell us what happened. Your shop goes live again once support has read your report and verified it.
        </p>
      </div>

      {failed.length > 0 && (
        <section className="space-y-2 rounded-2xl bg-white p-5 shadow-card" aria-labelledby="failed-title">
          <h2 id="failed-title" className="text-sm font-bold uppercase tracking-wider text-ink-mute">
            The orders involved
          </h2>
          <ul className="divide-y divide-ink/10 text-sm">
            {failed.map((o) => (
              <li key={o.id} className="flex flex-wrap justify-between gap-2 py-2">
                <Link to={`/my-shop/orders/${o.id}`} className="font-semibold text-vibe hover:underline">
                  Order {o.id}
                </Link>
                <span className="text-ink-mute">
                  {formatWhen(o.createdAt)} &middot; {formatKES(o.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report?.status === "more_info" && (
        <p role="status" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">
          Support needs more details: {report.adminNote}
        </p>
      )}
      {(sent || report?.status === "submitted") && (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
          Your report was sent{report ? ` on ${formatWhen(report.at)}` : ""}. Support will review it. You can add more detail below and send it again.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl bg-white p-5 shadow-card" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="rep-reason" className="text-sm font-semibold">
            What best explains what happened?
          </label>
          <select id="rep-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
            <option value="">Choose one</option>
            {REPORT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rep-details" className="text-sm font-semibold">
            Tell us what happened
          </label>
          <textarea id="rep-details" rows={5} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} className={inputCls} />
          <p className="text-xs text-ink-mute">Be honest and specific. Include dates and anything that helps us understand.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rep-plan" className="text-sm font-semibold">
            How will you stop it happening again?
          </label>
          <textarea id="rep-plan" rows={3} maxLength={500} value={plan} onChange={(e) => setPlan(e.target.value)} className={inputCls} />
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <Button type="submit">{report ? "Send updated report" : "Send report"}</Button>
      </form>
    </div>
  );
}
