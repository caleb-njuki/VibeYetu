import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { DEMO_ACCOUNTS, DEMO_ENABLED, DEMO_PASSWORD, signInSeller } from "../../lib/sellers.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-vibe";

export default function SellerLogin() {
  const { seller, login } = useSeller();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seller) navigate("/my-shop", { replace: true });
  }, [seller, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    setError("");
    try {
      const result = await signInSeller(email, password);
      if (!result.ok) return setError(result.message);
      login(result.seller);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={onSubmit} className="space-y-5 rounded-3xl bg-white p-6 shadow-card sm:p-8" noValidate>
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">My Shop sign in</h1>
          <p className="text-sm text-ink-mute">Sell to buyers in your city. Your payments are protected by escrow.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-semibold">
            Email
          </label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-semibold">
            Password
          </label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </Button>

        <Link to="/my-shop/register" className="block text-center text-sm font-semibold text-vibe hover:underline">
          No shop yet? Open one
        </Link>

        {DEMO_ENABLED && (
          <div className="space-y-2 rounded-2xl bg-ivory-dark p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Demo shops (testing only)</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(DEMO_PASSWORD);
                    setError("");
                  }}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-card hover:bg-vibe-light"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
