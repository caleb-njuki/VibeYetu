import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/Button.jsx";
import ForgotPasswordPanel from "../../components/ForgotPasswordPanel.jsx";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-vibe";

// "Forgot your password?" from the sign-in page. The seller types their email, gets a code by email,
// then chooses a new password and signs in again.
export default function SellerForgot() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(useLocation().state?.email || "");
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");

  function start(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter the email you signed up with.");
    setError("");
    setStarted(true);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="space-y-5 rounded-3xl bg-white p-6 shadow-card sm:p-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">Forgot your password?</h1>
          <p className="text-sm text-ink-mute">We will send a code to the email you signed up with.</p>
        </div>

        {!started ? (
          <form onSubmit={start} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="fp-email" className="text-sm font-semibold">
                Email
              </label>
              <input id="fp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} data-autofocus />
            </div>
            {error && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full">
              Continue
            </Button>
          </form>
        ) : (
          <ForgotPasswordPanel
            email={email.trim()}
            onDone={() => navigate("/my-shop/login", { replace: true, state: { notice: "Your password was changed. Sign in with your new password." } })}
            onCancel={() => setStarted(false)}
            backLabel="Use a different email"
          />
        )}

        <Link to="/my-shop/login" className="block text-center text-sm font-semibold text-vibe hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
