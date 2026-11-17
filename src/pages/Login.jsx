import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import Button from "../components/Button.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { requestOtp, verifyOtp } from "../services/api.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-vibe";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const [step, setStep] = useState("email");
  const [emailInput, setEmailInput] = useState("");
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

  const email = emailInput.trim().toLowerCase();

  async function sendCode(e) {
    e?.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!agreed) {
      setError("Please agree to the Terms of use to continue.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await requestOtp(email);
      setStep("code");
      setCode("");
      setSeconds(30);
    } catch (err) {
      setError(err.message || "We could not send the code. Please try again.");
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
      const data = await verifyOtp(email, code);
      login({ id: data.buyer.id, email, termsAcceptedAt: Date.now() }, data.token);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="space-y-6 rounded-3xl bg-white p-6 shadow-card sm:p-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">{step === "email" ? "Sign in or sign up" : "Enter your code"}</h1>
          <p className="text-sm text-ink-mute">
            {step === "email"
              ? "Use your email address. We will send you a one-time code."
              : `We emailed a 6-digit code to ${email}. Check your inbox and spam folder.`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold">
                Email address
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
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
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={`${inputCls} text-center text-xl font-bold tracking-[0.5em]`}
              />
            </div>
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
                  setStep("email");
                  setError("");
                }}
                className="font-semibold text-vibe hover:underline"
              >
                Change email
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
