import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import Button from "../components/Button.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { requestOtp, verifyOtp } from "../services/api.js";
import { localPhone, normalizePhone } from "../lib/format.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-vibe";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const [step, setStep] = useState("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  useEffect(() => {
    if (step !== "code" || seconds <= 0) return undefined;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [step, seconds]);

  const phone = normalizePhone(phoneInput);

  async function sendCode(e) {
    e?.preventDefault();
    if (!phone) {
      setError("Enter a valid Kenyan number, for example 0712 345 678.");
      return;
    }
    if (!agreed) {
      setError("Please agree to the Terms of use to continue.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await requestOtp(phone);
      setStep("code");
      setCode("");
      setSeconds(30);
    } catch {
      setError("We could not send the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(e) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await verifyOtp(phone, code);
      login({ phone, termsAcceptedAt: Date.now() });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="space-y-6 rounded-3xl bg-white p-6 shadow-card sm:p-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">{step === "phone" ? "Sign in or sign up" : "Enter your code"}</h1>
          <p className="text-sm text-ink-mute">
            {step === "phone"
              ? "Use your phone number. We will send you a one-time code."
              : `We sent a 6-digit code to ${localPhone(phone)}.`}
          </p>
        </div>

        {step === "phone" ? (
          <form onSubmit={sendCode} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-sm font-semibold">
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0712 345 678"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className={inputCls}
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 accent-vibe" />
              <span>
                I agree to the{" "}
                <Link to="/terms" target="_blank" className="font-semibold text-vibe hover:underline">
                  Terms of use
                </Link>
                , including the escrow, refund and 24-hour review rules.
              </span>
            </label>
            {error && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Sending..." : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={confirmCode} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="code" className="text-sm font-semibold">
                6-digit code
              </label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={`${inputCls} text-center text-xl font-bold tracking-[0.5em]`}
              />
            </div>
            <p className="rounded-xl bg-vibe-light px-3 py-2 text-xs text-vibe-dark">
              Demo mode: use the code 123456.
            </p>
            {error && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Checking..." : "Confirm"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setError("");
                }}
                className="font-semibold text-vibe hover:underline"
              >
                Change number
              </button>
              <button
                type="button"
                onClick={sendCode}
                disabled={seconds > 0 || busy}
                className="font-semibold text-vibe hover:underline disabled:text-ink-mute disabled:no-underline"
              >
                {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <p className="flex items-start gap-2 text-xs text-ink-mute">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-vibe" aria-hidden="true" />
          Never share your code with anyone. VibeYetu will never ask for it by phone or chat.
        </p>
      </div>
    </div>
  );
}
