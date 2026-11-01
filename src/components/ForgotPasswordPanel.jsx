import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Button from "./Button.jsx";
import { DEMO_ENABLED } from "../lib/sellers.js";
import {
  RESET_CODE_LENGTH,
  RESET_DEMO_CODE,
  completePasswordReset,
  requestResetCode,
  verifyResetCode,
} from "../lib/passwordReset.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";

// Three small steps inside the Close shop box: send a code, enter it, choose a new password.
// `onDone` is called after the new password is saved. `onCancel` goes back to the password box.
export default function ForgotPasswordPanel({ email, shopId, onDone, onCancel }) {
  const [stage, setStage] = useState("send"); // "send" | "code" | "new"
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waitSeconds, setWaitSeconds] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (waitSeconds <= 0) return undefined;
    const timer = setTimeout(() => setWaitSeconds((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  async function sendCode() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await requestResetCode(email);
      if (!alive.current) return;
      if (!result.ok) return setError(result.message);
      setSentTo(result.phone);
      setCode("");
      setWaitSeconds(Math.round(result.resendInMs / 1000));
      setStage("code");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function checkCode(e) {
    e.preventDefault();
    if (busy) return;
    if (code.trim().length !== RESET_CODE_LENGTH) return setError(`Enter the ${RESET_CODE_LENGTH}-digit code from the SMS.`);
    setBusy(true);
    setError("");
    try {
      const result = await verifyResetCode(email, code);
      if (!alive.current) return;
      if (!result.ok) {
        setCode("");
        if (result.expired) setStage("send");
        return setError(result.message);
      }
      setStage("new");
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) return setError("Your password must have at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    setError("");
    try {
      const result = await completePasswordReset(email, password, confirm, shopId);
      if (!alive.current) return;
      if (!result.ok) {
        if (result.expired) setStage("send");
        return setError(result.message);
      }
      setPassword("");
      setConfirm("");
      onDone();
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <CheckCircle2 className="h-4 w-4 text-vibe" aria-hidden="true" />
        Reset your password
      </p>

      {stage === "send" && (
        <div className="space-y-3 text-sm text-ink-soft">
          <p>
            We will send a {RESET_CODE_LENGTH}-digit code by SMS to the phone number you signed up with. Then you can choose a new
            password.
          </p>
          <Button onClick={sendCode} disabled={busy} data-autofocus>
            {busy ? "Sending..." : "Send me a code"}
          </Button>
        </div>
      )}

      {stage === "code" && (
        <form onSubmit={checkCode} className="space-y-3" noValidate>
          <p className="text-sm text-ink-soft">
            We sent a code to <strong>{sentTo}</strong>. It works for 5 minutes.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="reset-code" className="text-sm font-semibold">
              Code from the SMS
            </label>
            <input
              id="reset-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={RESET_CODE_LENGTH}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={inputCls}
              data-autofocus
            />
          </div>
          {DEMO_ENABLED && <p className="text-xs text-ink-mute">Demo mode: no SMS is sent. The code is {RESET_DEMO_CODE}.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Checking..." : "Check code"}
            </Button>
            <Button variant="ghost" onClick={sendCode} disabled={busy || waitSeconds > 0}>
              {waitSeconds > 0 ? `Send again in ${waitSeconds}s` : "Send again"}
            </Button>
          </div>
        </form>
      )}

      {stage === "new" && (
        <form onSubmit={savePassword} className="space-y-3" noValidate>
          <p className="text-sm text-ink-soft">Code accepted. Choose a new password with at least 8 characters.</p>
          <div className="space-y-1.5">
            <label htmlFor="reset-new" className="text-sm font-semibold">
              New password
            </label>
            <input
              id="reset-new"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              data-autofocus
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reset-confirm" className="text-sm font-semibold">
              Type it again
            </label>
            <input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save new password"}
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <button type="button" onClick={onCancel} disabled={busy} className="text-sm font-semibold text-vibe hover:underline">
        Back to closing my shop
      </button>
    </div>
  );
}
