import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Check, Circle, ShieldAlert } from "lucide-react";
import Button from "./Button.jsx";
import { useSeller } from "../context/SellerAuthContext.jsx";
import { SHOPS_CHANGED } from "../lib/sellers.js";
import { getVerification, verifyMyShop } from "../services/sellerApi.js";

const PAGE = { Settings: "/my-shop/settings", Payments: "/my-shop/payments", Inventory: "/my-shop/inventory" };

// "Verify my shop": the shop is verified when its settings are complete and it has enough products.
// Pressing the button checks everything on the server. After that, a warning explains that verification can be taken away.
export default function VerifyShop() {
  const { seller, refresh } = useSeller();
  const shopId = seller.shopId;
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justVerified, setJustVerified] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await getVerification(shopId));
    } catch (err) {
      setError(err.message || "Could not load the checklist.");
    }
  }, [shopId]);

  useEffect(() => {
    setState(null);
    setJustVerified(false);
    setError("");
    load();
    // The seller may fix something on another page and come back.
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(SHOPS_CHANGED, onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(SHOPS_CHANGED, onFocus);
    };
  }, [load]);

  async function verify() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setState(await verifyMyShop(shopId));
      setJustVerified(true);
      refresh();
    } catch (err) {
      setError(err.message || "Could not verify your shop. Please try again.");
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return error ? (
      <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
        {error}
      </p>
    ) : (
      <div className="h-40 animate-pulse rounded-2xl bg-ivory-dark" aria-busy="true" />
    );
  }

  const warning = (
    <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong>Please note:</strong> VibeYetu can take away your verification if we find irregularities. In serious cases your shop can
        also be suspended, or closed completely.
      </span>
    </p>
  );

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-card" aria-labelledby="verify-title">
      <h2 id="verify-title" className="flex items-center gap-2 text-lg font-extrabold">
        <BadgeCheck className="h-5 w-5 text-vibe" aria-hidden="true" />
        Shop verification
      </h2>

      {state.verified ? (
        <>
          <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
            {justVerified ? "Your shop is now verified. Buyers see the verified mark on your shop." : "Your shop is verified. Buyers see the verified mark on your shop."}
          </p>
          {warning}
        </>
      ) : (
        <>
          <p className="text-sm text-ink-mute">
            A verified shop shows a mark that buyers trust. Complete everything below, then press Verify. It takes seconds and needs no
            one to approve it.
          </p>
          <ul className="space-y-2 text-sm">
            {state.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                {c.ok ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700" aria-label="Done" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" aria-label="Not done" />
                )}
                <span className={c.ok ? "text-ink-soft" : "font-semibold"}>
                  {c.label}
                  {!c.ok && PAGE[c.where] && (
                    <>
                      {" "}
                      <Link to={PAGE[c.where]} className="font-semibold text-vibe hover:underline">
                        Go to {c.where}
                      </Link>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {state.blocked && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              {state.blocked === "suspended" ? "A suspended shop cannot be verified." : "A closed shop cannot be verified."}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <Button onClick={verify} disabled={busy || !state.ready || Boolean(state.blocked)}>
            {busy ? "Verifying..." : "Verify my shop"}
          </Button>
          {!state.ready && <p className="text-xs text-ink-mute">The button works once every item above is done.</p>}
        </>
      )}
    </section>
  );
}
