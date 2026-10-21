import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { listShops } from "../../services/api.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-vibe";

export default function SellerLogin() {
  const { seller, login } = useSeller();
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shops, setShops] = useState([]);
  const [shopId, setShopId] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (seller) navigate("/my-shop", { replace: true });
  }, [seller, navigate]);

  useEffect(() => {
    let live = true;
    listShops()
      .then((list) => {
        if (!live) return;
        setShops(list);
        setShopId((cur) => cur || list[0]?.id || "");
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  function onSubmit(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Your password must have at least 8 characters.");
      return;
    }
    if (mode === "signup" && !agreed) {
      setError("Please agree to the Terms of use to create your account.");
      return;
    }
    if (!shopId) {
      setError("Please wait for the shops to load.");
      return;
    }
    login({ email: email.trim().toLowerCase(), shopId, termsAcceptedAt: Date.now() });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={onSubmit} className="space-y-5 rounded-3xl bg-white p-6 shadow-card sm:p-8" noValidate>
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">{mode === "signin" ? "My Shop sign in" : "Create your seller account"}</h1>
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
          <input
            id="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="shop" className="text-sm font-semibold">
            Demo: shop to open
          </label>
          <select id="shop" value={shopId} onChange={(e) => setShopId(e.target.value)} className={inputCls}>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.town})
              </option>
            ))}
          </select>
        </div>

        {mode === "signup" && (
          <label className="flex items-start gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 accent-vibe" />
            <span>
              I agree to the{" "}
              <Link to="/terms" target="_blank" className="font-semibold text-vibe hover:underline">
                Terms of use
              </Link>
              , including my promise to fulfil accepted orders on time.
            </span>
          </label>
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full">
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
          }}
          className="w-full text-center text-sm font-semibold text-vibe hover:underline"
        >
          {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
