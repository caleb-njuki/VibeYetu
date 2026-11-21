import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import Button from "./Button.jsx";
import { useOrders } from "../context/OrdersContext.jsx";
import { FEE_LABEL, netAfterFee } from "../lib/fees.js";
import { formatKES, localPhone, phoneDigits } from "../lib/format.js";
import { formatWhen } from "../lib/orders.js";
import { PAYOUT_METHODS, describePayout, methodLabel, samePayout, validatePayout } from "../lib/payouts.js";
import { getPayout, savePayoutMethod } from "../services/sellerApi.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";
const EXAMPLE = 1000;

const draftFrom = (p) => ({
  method: p?.method || "pochi",
  till: p?.till || "",
  paybill: p?.paybill || "",
  account: p?.account || "",
  phone: p?.phone ? localPhone(p.phone) : "",
});

function Field({ id, label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

const emptyAgain = { till: "", paybill: "", account: "", phone: "" };
const WORKING = ["pending", "accepted", "dispatched"];

// "Get paid": shows the payout method and lets the seller change it. The seller types the details twice,
// and the change is saved only when both entries match. It cannot change while orders are in progress.
export default function PayoutMethods({ shopId, onChange }) {
  const { shopOrders } = useOrders();
  const working = shopOrders.some((o) => WORKING.includes(o.status));
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("view"); // "view" or "edit"
  const [draft, setDraft] = useState(draftFrom(null));
  const [again, setAgain] = useState(emptyAgain);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    getPayout(shopId).then(
      (r) => {
        if (!alive.current) return;
        setCurrent(r.payout);
        setLoading(false);
      },
      () => alive.current && setLoading(false)
    );
  }, [shopId]);

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));
  const setDigits = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value.replace(/\D/g, "") }));
  const setAgainKey = (key) => (e) => setAgain((a) => ({ ...a, [key]: e.target.value }));
  const setAgainDigits = (key) => (e) => setAgain((a) => ({ ...a, [key]: e.target.value.replace(/\D/g, "") }));

  function startEdit() {
    setDraft(draftFrom(current));
    setAgain(emptyAgain);
    setError("");
    setNotice("");
    setMode("edit");
  }

  function cancel() {
    setError("");
    setNotice("");
    setMode("view");
  }

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const first = validatePayout(draft);
    if (!first.ok) return setError(first.message);
    const second = validatePayout({ ...again, method: draft.method });
    if (!second.ok || !samePayout(first.value, second.value)) {
      return setError("The two entries do not match. Please type the details again, carefully.");
    }
    if (current && samePayout(current, first.value)) return setError("That is already your payout method.");
    setBusy(true);
    setError("");
    try {
      const saved = await savePayoutMethod(shopId, draft, { ...again, method: draft.method });
      if (!alive.current) return;
      setCurrent(saved);
      setMode("view");
      setNotice("Payout method saved.");
      if (onChange) onChange(saved);
    } catch (err) {
      if (alive.current) setError(err.message || "Could not save. Please try again.");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl bg-white p-5 shadow-card" aria-labelledby="payout-title">
      <div className="space-y-1">
        <h2 id="payout-title" className="text-lg font-extrabold">
          How you get paid
        </h2>
        <p className="text-sm text-ink-mute">Buyers never see this. Your money is sent here when a buyer confirms an order.</p>
      </div>

      <div className="space-y-1 rounded-xl bg-vibe-light px-4 py-3 text-sm text-vibe-dark">
        <p className="font-bold">VibeYetu fee: {FEE_LABEL} of the item total, paid by you</p>
        <p>
          It is taken only when an order is completed. No listing fee and no monthly fee. Buyers pay nothing extra. For example, on{" "}
          {formatKES(EXAMPLE)} of items you keep {formatKES(netAfterFee(EXAMPLE))}, plus any delivery fee.
        </p>
      </div>

      {mode === "view" && (
        <div className="space-y-3">
          {current ? (
            <div className="space-y-1 rounded-xl border border-ink/15 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">{methodLabel(current.method)}</p>
              <p className="text-lg font-extrabold">{describePayout(current)}</p>
              {current.updatedAt && <p className="text-xs text-ink-mute">Last changed {formatWhen(current.updatedAt)}</p>}
              {current.legacy && (
                <p className="text-xs text-ink-mute">
                  Saved earlier as an M-Pesa number. You can switch to a Till, Paybill or Pochi la Biashara.
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No payout method yet. Add one so we know where to send your money.
            </p>
          )}
          {current && working && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              You can change your payout method when you have no orders in progress.
            </p>
          )}
          <Button onClick={startEdit} disabled={loading || Boolean(current && working)}>
            {current ? "Change payout method" : "Add payout method"}
          </Button>
        </div>
      )}

      {mode === "edit" && (
        <form onSubmit={save} className="space-y-4" noValidate>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">Where should we send your money?</legend>
            {PAYOUT_METHODS.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                  draft.method === m.id ? "border-vibe bg-vibe-light" : "border-ink/20"
                }`}
              >
                <input
                  type="radio"
                  name="payout-method"
                  value={m.id}
                  checked={draft.method === m.id}
                  onChange={() => setDraft((d) => ({ ...d, method: m.id }))}
                  className="mt-0.5 accent-vibe"
                />
                <span>
                  <span className="block font-semibold">{m.label}</span>
                  <span className="block text-xs text-ink-mute">{m.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {draft.method === "till" && (
            <Field id="po-till" label="Till number" hint="Check it on your M-Pesa till sticker or in the M-Pesa for Business app.">
              <input id="po-till" inputMode="numeric" autoComplete="off" maxLength={7} value={draft.till} onChange={setDigits("till")} className={inputCls} />
            </Field>
          )}
          {draft.method === "paybill" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="po-paybill" label="Paybill number">
                <input id="po-paybill" inputMode="numeric" autoComplete="off" maxLength={7} value={draft.paybill} onChange={setDigits("paybill")} className={inputCls} />
              </Field>
              <Field id="po-account" label="Account number" hint="The account the money is paid into.">
                <input id="po-account" autoComplete="off" maxLength={20} value={draft.account} onChange={set("account")} className={inputCls} />
              </Field>
            </div>
          )}
          {(draft.method === "pochi" || draft.method === "mpesa") && (
            <Field
              id="po-phone"
              label={draft.method === "pochi" ? "Pochi la Biashara phone number" : "M-Pesa phone number"}
              hint="Check the number twice. Money sent to a wrong number cannot be recalled by VibeYetu."
            >
              <input id="po-phone" type="tel" inputMode="numeric" autoComplete="off" maxLength={10} placeholder="0712345678" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: phoneDigits(e.target.value) }))} className={inputCls} />
            </Field>
          )}

          {draft.method === "till" && (
            <Field id="po-till2" label="Type the till number again">
              <input id="po-till2" inputMode="numeric" autoComplete="off" maxLength={7} value={again.till} onChange={setAgainDigits("till")} className={inputCls} />
            </Field>
          )}
          {draft.method === "paybill" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="po-paybill2" label="Type the paybill number again">
                <input id="po-paybill2" inputMode="numeric" autoComplete="off" maxLength={7} value={again.paybill} onChange={setAgainDigits("paybill")} className={inputCls} />
              </Field>
              <Field id="po-account2" label="Type the account number again">
                <input id="po-account2" autoComplete="off" maxLength={20} value={again.account} onChange={setAgainKey("account")} className={inputCls} />
              </Field>
            </div>
          )}
          {(draft.method === "pochi" || draft.method === "mpesa") && (
            <Field id="po-phone2" label="Type the phone number again">
              <input id="po-phone2" type="tel" inputMode="numeric" autoComplete="off" maxLength={10} placeholder="0712345678" value={again.phone} onChange={(e) => setAgain((a) => ({ ...a, phone: phoneDigits(e.target.value) }))} className={inputCls} />
            </Field>
          )}

          <p className="flex items-start gap-2 text-xs text-ink-mute">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-vibe" aria-hidden="true" />
            The details are saved only when both entries match. Your money is sent here, so check them carefully.
          </p>

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save payout method"}
            </Button>
            <Button variant="ghost" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {mode === "view" && notice && (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
          {notice}
        </p>
      )}
      {mode === "view" && error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
