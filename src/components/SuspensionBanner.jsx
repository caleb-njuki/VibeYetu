import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { STRIKE_LIMIT } from "../lib/strikes.js";
import { getShopFlags } from "../lib/shopFlags.js";
import { currentReport } from "../lib/suspensions.js";
import { formatWhen } from "../lib/orders.js";

// Shown at the top of My Shop while the current shop is suspended.
export default function SuspensionBanner({ shopId }) {
  const flags = getShopFlags(shopId);
  if (!flags.suspended) return null;
  const report = currentReport(shopId);
  const why =
    flags.suspendKind === "auto"
      ? `${(flags.suspendOrderIds || []).length || STRIKE_LIMIT} orders in a row were not fulfilled.`
      : "VibeYetu support suspended this shop.";

  let tone = "border-red-300 bg-red-50 text-red-900";
  let body = "Buyers cannot see your shop. Write your report so support can review it. Orders already in progress can still be completed.";
  let action = "Write my report";
  if (report?.status === "submitted") {
    tone = "border-amber-300 bg-amber-50 text-amber-900";
    body = `We received your report on ${formatWhen(report.at)}. Support is reviewing it. Your shop stays suspended until support verifies it.`;
    action = "View or update my report";
  } else if (report?.status === "more_info") {
    body = `Support needs more details: ${report.adminNote}`;
    action = "Update my report";
  }

  return (
    <div role="alert" className={`mb-6 flex flex-wrap items-start gap-3 rounded-2xl border p-4 ${tone}`}>
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-extrabold">This shop is suspended. {why}</p>
        <p className="text-sm">{body}</p>
      </div>
      <Link to="/my-shop/report" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-soft">
        {action}
      </Link>
    </div>
  );
}
