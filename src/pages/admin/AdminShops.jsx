import { useEffect, useState } from "react";
import Button from "../../components/Button.jsx";
import { useOrders } from "../../context/OrdersContext.jsx";
import { listAllShops } from "../../services/api.js";
import { getShopFlags, setShopFlags, suspendShop } from "../../lib/shopFlags.js";
import { SHOPS_CHANGED, ownerEmailOf, sellerSummary, ownedShops } from "../../lib/sellers.js";
import { addNotice, currentReport, reviewSuspension } from "../../lib/suspensions.js";
import { formatWhen } from "../../lib/orders.js";
import { localPhone } from "../../lib/format.js";

const row = (label, value) =>
  value ? (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-ink-mute">{label}</dt>
      <dd className="min-w-0 break-words font-semibold">{value}</dd>
    </div>
  ) : null;

// What support may see about the seller behind a shop. The ID number is masked here.
function SellerDetails({ shopId }) {
  const email = ownerEmailOf(shopId);
  const info = email ? sellerSummary(email) : null;
  if (!info) return <p className="text-xs text-ink-mute">No seller details on file (sample shop).</p>;
  const others = ownedShops(email).filter((x) => x.id !== shopId);
  return (
    <dl className="space-y-1 text-xs">
      {row("Seller", info.fullName)}
      {row("Email", info.email)}
      {row("Phone", info.phone ? localPhone(info.phone) : "")}
      {row("National ID", info.idMasked)}
      {row("KRA PIN", info.kraPin)}
      {row("Sells as", info.businessType ? (info.businessType === "registered" ? "Registered business" : "Individual trader") : "")}
      {row("Business name", info.businessName)}
      {row("Registration no.", info.businessRegNo)}
      {row("Agreed to terms", info.consentAt ? `${new Date(info.consentAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })} (version ${info.termsVersion})` : "")}
      {row("Other shops", others.map((x) => x.name).join(", "))}
    </dl>
  );
}

// Support reviews a suspended shop here. A shop goes live again only after the seller's report
// has been read and verified. "Restore without a report" is for suspensions made by mistake.
function SuspensionReview({ shopId, onDone }) {
  const flags = getShopFlags(shopId);
  const report = currentReport(shopId);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(null); // "reinstate" | "override"
  const [error, setError] = useState("");
  const ids = flags.suspendOrderIds || [];

  function run(action, opts) {
    const result = reviewSuspension(shopId, action, opts);
    if (!result.ok) return setError(result.message);
    setError("");
    setAsking(false);
    setConfirm(null);
    setNote("");
    window.dispatchEvent(new Event(SHOPS_CHANGED));
    onDone();
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
      <p className="font-bold text-red-900">
        Suspended {flags.suspendedAt ? formatWhen(flags.suspendedAt) : ""} &middot;{" "}
        {flags.suspendKind === "auto" ? `automatically, after ${ids.length || 3} unfulfilled orders in a row` : "by support"}
      </p>
      {ids.length > 0 && <p className="text-xs text-red-900">Orders involved: {ids.join(", ")}</p>}

      {report ? (
        <div className="space-y-1 rounded-lg bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">
            Seller&apos;s report &middot; {report.status === "submitted" ? "waiting for your review" : report.status === "more_info" ? "you asked for more details" : report.status}
          </p>
          <p className="font-semibold">{report.reason}</p>
          <p className="whitespace-pre-wrap text-ink-soft">{report.details}</p>
          <p className="text-xs font-semibold">How they will prevent it:</p>
          <p className="whitespace-pre-wrap text-ink-soft">{report.plan}</p>
          <p className="text-xs text-ink-mute">Sent {formatWhen(report.at)}</p>
          {report.adminNote && <p className="text-xs text-ink-mute">Your note: {report.adminNote}</p>}
        </div>
      ) : (
        <p className="rounded-lg bg-white p-3 text-ink-mute">The seller has not written a report yet. The shop stays suspended until they do.</p>
      )}

      {error && (
        <p role="alert" className="font-semibold text-red-800">
          {error}
        </p>
      )}

      {asking && (
        <div className="space-y-2">
          <label htmlFor={`note-${shopId}`} className="font-semibold">
            What do you need from the seller?
          </label>
          <textarea
            id={`note-${shopId}`}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-ink/20 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-vibe"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="dark" onClick={() => run("more_info", { note })}>
              Send to seller
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {confirm ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink/15 bg-white p-3">
          <span className="font-semibold">
            {confirm === "reinstate" ? "Verified the report? The shop goes live now." : "Restore this shop without a report?"}
          </span>
          <Button size="sm" variant="dark" onClick={() => run("reinstate", { override: confirm === "override" })}>
            Yes, restore
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        !asking && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={!report} onClick={() => setConfirm("reinstate")}>
              Verify and reinstate
            </Button>
            <Button size="sm" variant="outline" disabled={!report} onClick={() => setAsking(true)}>
              Ask for more details
            </Button>
            <button type="button" onClick={() => setConfirm("override")} className="text-xs font-semibold text-ink-mute underline">
              Suspended by mistake? Restore without a report
            </button>
          </div>
        )
      )}
    </div>
  );
}

export default function AdminShops() {
  const { orders } = useOrders();
  const [shops, setShops] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    listAllShops()
      .then((list) => {
        if (live) setShops(list);
      })
      .catch(() => {
        if (live) setShops([]);
      });
    return () => {
      live = false;
    };
  }, [reload]);

  function change(shopId, flags) {
    setShopFlags(shopId, flags);
    setReload((n) => n + 1);
  }

  function suspend(shopId) {
    suspendShop(shopId, "admin");
    addNotice(shopId, { text: "VibeYetu support suspended your shop. Write your report so support can review it." });
    window.dispatchEvent(new Event(SHOPS_CHANGED));
    setReload((n) => n + 1);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold">Shops</h1>
        <p className="text-sm text-ink-mute">A suspended shop is hidden from buyers. It goes live again only after the seller writes a report and you verify it. Shops are suspended automatically after 3 unfulfilled orders in a row.</p>
      </div>

      {shops === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-ivory-dark" aria-busy="true" />
      ) : shops.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-ink-mute shadow-card">No shops yet.</p>
      ) : (
        <ul className="divide-y divide-ink/10 rounded-2xl bg-white shadow-card">
          {shops.map((s) => {
            const count = orders.filter((o) => o.shopId === s.id).length;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {s.name}
                    {s.suspended && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">Suspended</span>}
                    {s.verified && !s.suspended && <span className="ml-2 rounded-full bg-vibe-light px-2 py-0.5 text-xs font-bold text-vibe-dark">Verified</span>}
                  </p>
                  <p className="text-sm text-ink-mute">
                    {s.town} &middot; {count} {count === 1 ? "order" : "orders"}
                  </p>
                  {s.suspended && <SuspensionReview shopId={s.id} onDone={() => setReload((n) => n + 1)} />}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-vibe">Seller details</summary>
                    <div className="mt-2 rounded-xl bg-ivory-dark p-3">
                      <SellerDetails shopId={s.id} />
                    </div>
                  </details>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => change(s.id, { verified: !s.verified })}>
                    {s.verified ? "Remove verified badge" : "Mark verified"}
                  </Button>
                  {!s.suspended && (
                    <Button variant="ghost" size="sm" onClick={() => suspend(s.id)}>
                      Suspend
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
