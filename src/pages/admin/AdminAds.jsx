import { useState } from "react";
import Button from "../../components/Button.jsx";
import AdSlide from "../../components/AdSlide.jsx";
import useNow from "../../hooks/useNow.js";
import { activateAd, adState, listAds, refundAd, stopAd } from "../../lib/ads.js";
import { shops } from "../../data/mock.js";
import { formatWhen } from "../../lib/orders.js";
import { formatKES } from "../../lib/format.js";

const LABELS = { attention: "Needs attention", scheduled: "Scheduled", live: "Live", ended: "Ended", refunded: "Refunded", stopped: "Stopped" };
const shopName = (id) => shops.find((s) => s.id === id)?.name || "Shop";

export default function AdminAds() {
  const now = useNow(60000);
  const [ads, setAds] = useState(() => listAds());

  const refresh = () => setAds(listAds());
  const rows = ads.map((a) => ({ a, state: adState(a, now) }));
  const attention = rows.filter((r) => r.state === "attention");
  const running = rows.filter((r) => r.state === "live" || r.state === "scheduled");
  const history = rows.filter((r) => ["ended", "stopped", "refunded"].includes(r.state));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold">Ads</h1>
        <p className="text-sm text-ink-mute">
          Ads go live by themselves once they are paid and pass the automatic checks. Only problems appear here.
        </p>
      </div>

      <section aria-labelledby="attention-ads" className="space-y-3">
        <h2 id="attention-ads" className="text-lg font-extrabold">
          Needs attention ({attention.length})
        </h2>
        {attention.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-ink-mute shadow-card">No ads need attention.</p>
        ) : (
          <ul className="space-y-4">
            {attention.map(({ a }) => (
              <li key={a.id} className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
                <p className="text-sm text-ink-mute">
                  <span className="font-bold text-ink">{shopName(a.shopId)}</span> &middot; {a.days} {a.days === 1 ? "day" : "days"} &middot; Paid {formatKES(a.total)} &middot; Sent{" "}
                  {formatWhen(a.createdAt)}
                </p>
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                  Problem: {a.issue}
                  {(a.reports || []).length > 0 && ` Reported by ${(a.reports || []).length} buyers (${[...new Set(a.reports.map((r) => r.reason))].join(", ")}).`}
                </p>
                <div className="max-w-lg">
                  <AdSlide ad={{ ...a, shopName: shopName(a.shopId) }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      activateAd(a.id);
                      refresh();
                    }}
                  >
                    Put it live
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      refundAd(a.id);
                      refresh();
                    }}
                  >
                    Refund and close
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      stopAd(a.id);
                      refresh();
                    }}
                  >
                    Remove without refund
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="running-ads" className="space-y-3">
        <h2 id="running-ads" className="text-lg font-extrabold">
          Live and scheduled ({running.length})
        </h2>
        {running.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-ink-mute shadow-card">No ads are running.</p>
        ) : (
          <ul className="divide-y divide-ink/10 rounded-2xl bg-white shadow-card">
            {running.map(({ a, state }) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{a.headline}</p>
                  <p className="text-sm text-ink-mute">
                    {shopName(a.shopId)} &middot; Until {formatWhen(a.endsAt)}
                    {(a.reports || []).length > 0 && ` \u00b7 ${a.reports.length} ${a.reports.length === 1 ? "report" : "reports"}`}
                  </p>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-900">{LABELS[state]}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    stopAd(a.id);
                    refresh();
                  }}
                >
                  Take down
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section aria-labelledby="history-ads" className="space-y-3">
          <h2 id="history-ads" className="text-lg font-extrabold">
            History
          </h2>
          <ul className="divide-y divide-ink/10 rounded-2xl bg-white shadow-card">
            {history.map(({ a, state }) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{a.headline}</p>
                  <p className="text-sm text-ink-mute">
                    {shopName(a.shopId)} &middot; {formatKES(a.total)}
                  </p>
                </div>
                <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-bold">{LABELS[state]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
