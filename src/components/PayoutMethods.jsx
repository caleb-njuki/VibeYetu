import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import Button from "./Button.jsx";
import { DEMO_ENABLED } from "../lib/sellers.js";
import { FEE_LABEL, netAfterFee } from "../lib/fees.js";
import { formatKES, localPhone } from "../lib/format.js";
import { formatWhen } from "../lib/orders.js";
import {
  OTP_LENGTH,
  PAYOUT_DEMO_CODE,
  PAYOUT_METHODS,
  describePayout,
  getPayout,
  methodLabel,
  requestPayoutOtp,
  samePayout,
  savePayout,
  validatePayout,
  verifyPayoutOtp,
} from "../lib/payouts.js";

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

// "Get paid": shows the payout method, lets the seller change it, and asks for a one-time
// code (sent to their phone) before the change is saved.
export default function PayoutMethods({ email, shopId, onChange }) {
  const [current, setCurrent] = useState(() => getPayout(shopId));
  const [mode, setMode] = useState("view"); // "view", "edit" or "otp"
  const [draft, setDraft] = useState(() => draftFrom(getPayout(shopId)));
  const [pending, setPending] = useState(null); // the clean value waiting for the code
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [tick, setTick] = useState(() => Date.now());
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

  // A clock for the "resend in 30s" button, only while the code box is open.
  useEffect(() => {
    if (mode !== "otp") return undefined;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [mode]);

  const secondsToResend = Math.max(0, Math.ceil((resendAt - tick) / 1000));
  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));
  const setDigits = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value.replace(/\D/g, "") }));

  function startEdit() {
    setDraft(draftFrom(current));
    setError("");
    setNotice("");
    setMode("edit");
  }

  function cancel() {
    setError("");
    setNotice("");
    setPending(null);
    setCode("");
    setMode("view");
  }

  async function sendCode(e) {
    e.preventDefault();
    if (busy) return;
    const checked = validatePayout(draft);
    if (!checked.ok) return setError(checked.message);
    if (current && samePayout(current, checked.value)) return setError("That is already your payout method.");
    setBusy(true);
    setError("");
    try {
      const result = await requestPayoutOtp(email, shopId);
      if (!alive.current) return;
      if (!result.ok) return setError(result.message);
      setPending(checked.value);
      setSentTo(result.phone);
      setCode("");
      setTick(Date.now());
      setResendAt(Date.now() + result.resendInMs);
      setMode("otp");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    if (busy) return;
    if (code.length !== OTP_LENGTH) return setError(`Enter the ${OTP_LENGTH}-digit code.`);
    setBusy(true);
    setError("");
    try {
      const result = await verifyPayoutOtp(shopId, code);
      if (!alive.current) return;
      if (!result.ok) {
        // After too many wrong codes the change is locked, so go back to the summary.
        if (result.locked) cancel();
        setError(result.message);
        return;
      }
      const saved = savePayout(shopId, pending);
      if (!saved.ok) return setError(saved.message);
      setCurrent(saved.payout);
      setPending(null);
      setCode("");
      setMode("view");
      setNotice("Payout method saved.");
      if (onChange) onChange(saved.payout);
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function resend() {
    if (busy || secondsToResend > 0) return;
    setBusy(true);
    setError("");
    try {
      const result = await requestPayoutOtp(email, shopId);
      if (!alive.current) return;
      if (!result.ok) return setError(result.message);
      setCode("");
      setTick(Date.now());
      setResendAt(Date.now() + result.resendInMs);
      setNotice("A new code is on its way.");
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
          <Button onClick={startEdit}>{current ? "Change payout method" : "Add payout method"}</Button>
        </div>
      )}

      {mode === "edit" && (
        <form onSubmit={sendCode} className="space-y-4" noValidate>
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
              <input id="po-phone" type="tel" inputMode="tel" autoComplete="off" placeholder="0712 345 678" value={draft.phone} onChange={set("phone")} className={inputCls} />
            </Field>
          )}

          <p className="flex items-start gap-2 text-xs text-ink-mute">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-vibe" aria-hidden="true" />
            To keep your money safe, we send a {OTP_LENGTH}-digit code to the phone you signed up with before any change is saved.
          </p>

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Sending code..." : "Send me a code"}
            </Button>
            <Button variant="ghost" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {mode === "otp" && (
        <form onSubmit={confirm} className="space-y-4" noValidate>
          <div className="space-y-1 rounded-xl border border-ink/15 px-4 py-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">You are changing your payout to</p>
            <p className="font-extrabold">{describePayout(pending, true)}</p>
          </div>
          <Field id="po-code" label={`Enter the ${OTP_LENGTH}-digit code we sent to ${sentTo}`} hint="The code works for 5 minutes.">
            <input
              id="po-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${inputCls} text-center text-lg font-extrabold tracking-[0.4em]`}
              data-autofocus
            />
          </Field>
          {DEMO_ENABLED && <p className="text-xs text-ink-mute">Demo mode: no SMS is sent. The code is {PAYOUT_DEMO_CODE}.</p>}

          {notice && (
            <p role="status" className="text-sm font-semibold text-green-800">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || code.length !== OTP_LENGTH}>
              {busy ? "Checking..." : "Confirm and save"}
            </Button>
            <Button variant="outline" onClick={resend} disabled={busy || secondsToResend > 0}>
              {secondsToResend > 0 ? `Send again in ${secondsToResend}s` : "Send a new code"}
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
