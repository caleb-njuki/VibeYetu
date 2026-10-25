import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Download, TriangleAlert } from "lucide-react";
import Button from "./Button.jsx";
import useDialog from "../hooks/useDialog.js";
import { useOrders } from "../context/OrdersContext.jsx";
import { useSeller } from "../context/SellerAuthContext.jsx";
import { getShopCatalog } from "../services/api.js";
import { SHOPS_CHANGED, ownedShops, signInSeller } from "../lib/sellers.js";
import { adState, listAds } from "../lib/ads.js";
import { listOffers, offerState } from "../lib/offers.js";
import { formatKES } from "../lib/format.js";
import { formatWhen } from "../lib/orders.js";
import { CLOSE_REASONS, OTHER_REASON, closeShopNow, closureBlockers, ordersToCsv, validateClosure } from "../lib/shopClosure.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";
const STEPS = ["Reason", "Check", "Confirm"];
const MAX_PASSWORD_TRIES = 5;

const slug = (s) =>
  String(s || "shop")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "shop";

// Closing a shop takes three steps: why, what happens, and a final check with the password.
// Open from the Inventory page. `onClose` just dismisses the box (nothing is closed until the last step).
export default function CloseShopFlow({ onClose }) {
  const { seller, switchShop, logout } = useSeller();
  const { orders } = useOrders();
  const navigate = useNavigate();
  const ref = useRef(null);
  const titleId = useId();

  const mine = ownedShops(seller.email);
  const [shopName] = useState(() => mine.find((s) => s.id === seller.shopId)?.name || "your shop");
  const others = mine.filter((s) => s.id !== seller.shopId);

  const [step, setStep] = useState(0); // 0 to 2, then 3 when done
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [fails, setFails] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(null); // what closing will switch off
  const [nextShop, setNextShop] = useState(null); // where to go after closing
  const alive = useRef(true);

  const finished = step === 3;
  // Once the shop is closed the only way out is the Continue button.
  useDialog(ref, () => {
    if (!busy && !finished) onClose();
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // When the step changes the button that was pressed may be gone, so put focus back inside the box.
  useEffect(() => {
    const node = ref.current;
    if (node) (node.querySelector("[data-autofocus]") || node).focus();
  }, [step]);

  useEffect(() => {
    let live = true;
    getShopCatalog(seller.shopId)
      .then((list) => {
        if (!live) return;
        setInfo({
          products: list.length,
          ads: listAds(seller.shopId).filter((a) => ["live", "scheduled", "attention"].includes(adState(a))).length,
          offers: listOffers(seller.shopId).filter((o) => offerState(o) !== "ended").length,
        });
      })
      .catch(() => {
        if (live) setInfo({ products: 0, ads: 0, offers: 0 });
      });
    return () => {
      live = false;
    };
  }, [seller.shopId]);

  const shopOrders = orders.filter((o) => o.shopId === seller.shopId);
  const blockers = closureBlockers(orders, seller.shopId);
  const locked = fails >= MAX_PASSWORD_TRIES;

  function next() {
    setError("");
    if (step === 0) {
      const problem = validateClosure({ reason, details });
      if (problem) return setError(problem);
      return setStep(1);
    }
    if (step === 1) {
      if (blockers.open.length > 0) return setError("Finish your open orders first. Then you can continue.");
      return setStep(2);
    }
    return undefined;
  }

  function back() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  function downloadOrders() {
    const csv = "﻿" + ordersToCsv(shopOrders);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug(shopName)}-orders.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function closeNow(e) {
    e.preventDefault();
    if (busy || locked) return;
    if (typed.trim().toLowerCase() !== shopName.trim().toLowerCase()) {
      return setError("Type the shop name exactly as shown to confirm.");
    }
    if (!password) return setError("Enter your password.");
    setBusy(true);
    setError("");
    try {
      // The same check as signing in. It only proves the person at the screen knows the password.
      const check = await signInSeller(seller.email, password);
      if (!alive.current) return;
      if (!check.ok) {
        const used = fails + 1;
        setFails(used);
        setPassword("");
        return setError(
          used >= MAX_PASSWORD_TRIES
            ? "Too many wrong passwords. Sign out and sign in again to continue."
            : `That password is not correct. ${MAX_PASSWORD_TRIES - used} ${MAX_PASSWORD_TRIES - used === 1 ? "try" : "tries"} left.`
        );
      }
      const result = closeShopNow({ shopId: seller.shopId, reason, details, orders });
      if (!result.ok) return setError(result.message);
      setNextShop(others[0] || null);
      setPassword("");
      setStep(3);
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  // The last step. Switching shops or signing out is done here, after the seller has read the result,
  // so the My Shop header does not lose its shop while this box is still on screen.
  function finish() {
    if (nextShop) {
      switchShop(nextShop.id);
      window.dispatchEvent(new Event(SHOPS_CHANGED));
      navigate("/my-shop", { replace: true });
    } else {
      logout();
      navigate("/", { replace: true });
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-3xl bg-white p-6 shadow-card outline-none"
      >
        <div className="space-y-1">
          <h2 id={titleId} className="text-2xl font-extrabold">
            {finished ? "Your shop is closed" : `Close ${shopName}`}
          </h2>
          {!finished && <p className="text-sm text-ink-mute">Nothing is closed until the last step.</p>}
        </div>

        {!finished && (
          <ol className="flex gap-2" aria-label="Progress">
            {STEPS.map((label, i) => (
              <li
                key={label}
                aria-current={i === step ? "step" : undefined}
                className={`flex-1 rounded-full px-3 py-1.5 text-center text-xs font-bold ${
                  i === step ? "bg-ink text-white" : i < step ? "bg-vibe-light text-vibe-dark" : "bg-ivory-dark text-ink-mute"
                }`}
              >
                {i + 1}. {label}
              </li>
            ))}
          </ol>
        )}

        {step === 0 && (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold">Why are you closing? This helps us improve.</legend>
              {CLOSE_REASONS.map((r, i) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
                    reason === r ? "border-vibe bg-vibe-light" : "border-ink/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="close-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-vibe"
                    data-autofocus={i === 0 ? true : undefined}
                  />
                  {r}
                </label>
              ))}
            </fieldset>
            <div className="space-y-1.5">
              <label htmlFor="close-details" className="text-sm font-semibold">
                {reason === OTHER_REASON ? "Tell us more" : "Anything else you want to tell us? (optional)"}
              </label>
              <textarea id="close-details" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} className={inputCls} />
            </div>
            <p className="rounded-xl bg-ivory px-4 py-3 text-sm text-ink-soft">
              <strong>Just need a break?</strong> You do not have to close. Hide your products from the list above and show them again
              whenever you are ready.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {blockers.open.length > 0 ? (
              <div role="alert" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="flex items-center gap-2 font-extrabold">
                  <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {blockers.open.length} open {blockers.open.length === 1 ? "order needs" : "orders need"} you first
                </p>
                <p>
                  {formatKES(blockers.held)} is still held in escrow for buyers who are waiting. Finish these orders, then come back. Your answers
                  here will need to be entered again.
                </p>
                <ul className="space-y-1">
                  {blockers.open.slice(0, 5).map((o) => (
                    <li key={o.id}>
                      <Link to={`/my-shop/orders/${o.id}`} className="font-semibold underline">
                        Order {o.id}
                      </Link>{" "}
                      <span className="text-amber-800">&middot; {formatWhen(o.createdAt)}</span>
                    </li>
                  ))}
                  {blockers.open.length > 5 && <li>and {blockers.open.length - 5} more</li>}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                No open orders. Nobody is waiting on you.
              </p>
            )}

            <div className="space-y-2 text-sm">
              <h3 className="font-bold">What happens when you close</h3>
              {info === null ? (
                <div className="h-20 animate-pulse rounded-xl bg-ivory-dark" aria-busy="true" />
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-ink-soft">
                  <li>
                    Your shop and its {info.products} {info.products === 1 ? "product" : "products"} disappear from search, the home page and shop
                    pages at once.
                  </li>
                  <li>
                    {info.ads > 0 ? `${info.ads} running or waiting ${info.ads === 1 ? "ad is" : "ads are"} stopped.` : "You have no running ads."}{" "}
                    {info.offers > 0 ? `${info.offers} ${info.offers === 1 ? "offer is" : "offers are"} removed.` : "You have no offers running."}
                  </li>
                  <li>Your payout details and order history stay on file, so we can settle anything still owed and help with disputes.</li>
                  <li>
                    {others.length > 0
                      ? `Your other ${others.length === 1 ? "shop" : "shops"} (${others.map((s) => s.name).join(", ")}) ${others.length === 1 ? "is" : "are"} not affected.`
                      : "This is your only shop. After closing you cannot open My Shop. Contact support if you want to reopen it."}
                  </li>
                  <li>Only support can reopen a closed shop. The shop name stays reserved for you.</li>
                </ul>
              )}
            </div>

            <div className="space-y-1 border-t border-ink/10 pt-3">
              <p className="text-sm font-semibold">Keep a copy of your orders</p>
              <Button variant="outline" size="sm" onClick={downloadOrders} disabled={shopOrders.length === 0}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Download orders (CSV)
              </Button>
              {shopOrders.length === 0 && <p className="text-xs text-ink-mute">This shop has no orders yet.</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <form id="close-form" onSubmit={closeNow} className="space-y-4" noValidate>
            <dl className="space-y-1 rounded-xl bg-ivory px-4 py-3 text-sm">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-ink-mute">Shop</dt>
                <dd className="font-semibold">{shopName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 text-ink-mute">Reason</dt>
                <dd className="min-w-0 break-words font-semibold">{reason}</dd>
              </div>
            </dl>
            <div className="space-y-1.5">
              <label htmlFor="close-type" className="text-sm font-semibold">
                Type <span className="font-extrabold">{shopName}</span> to confirm
              </label>
              <input
                id="close-type"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className={inputCls}
                data-autofocus
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="close-password" className="text-sm font-semibold">
                Your password
              </label>
              <input
                id="close-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={locked}
                className={inputCls}
              />
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm text-ink-soft">
            <p className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 font-semibold text-green-900">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              {shopName} is closed and no longer visible to buyers.
            </p>
            <p>
              {nextShop
                ? `You can keep working on ${nextShop.name}.`
                : "You will be signed out now. If you want to sell again, contact support and we will help you reopen."}
            </p>
            <p>Thank you for selling on VibeYetu.</p>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-ink/10 pt-4">
          {step === 3 ? (
            <Button onClick={finish} data-autofocus>
              {nextShop ? `Go to ${nextShop.name}` : "Sign out"}
            </Button>
          ) : (
            <>
              {step > 0 ? (
                <Button variant="outline" onClick={back} disabled={busy}>
                  Back
                </Button>
              ) : null}
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Keep my shop
              </Button>
              {step < 2 ? (
                <Button onClick={next} disabled={step === 1 && (info === null || blockers.open.length > 0)}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" form="close-form" variant="danger" disabled={busy || locked}>
                  {busy ? "Closing..." : "Close my shop"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
