import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button.jsx";
import Logo from "../../components/Logo.jsx";
import { useAdmin } from "../../context/AdminAuthContext.jsx";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-vibe";
const DEMO_EMAIL = "admin@vibeyetu.co.ke";
const DEMO_PASSWORD = "admin12345";

export default function AdminLogin() {
  const { admin, login } = useAdmin();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (admin) navigate("/admin", { replace: true });
  }, [admin, navigate]);

  function onSubmit(e) {
    e.preventDefault();
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      setError("Wrong email or password.");
      return;
    }
    login({ email: DEMO_EMAIL });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <form onSubmit={onSubmit} className="space-y-5 rounded-3xl bg-white p-6 shadow-card sm:p-8" noValidate>
        <div className="space-y-2">
          <Logo className="text-xl" />
          <h1 className="text-2xl font-extrabold">Admin sign in</h1>
          <p className="text-sm text-ink-mute">For VibeYetu staff only.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="a-email" className="text-sm font-semibold">
            Email
          </label>
          <input id="a-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="a-pass" className="text-sm font-semibold">
            Password
          </label>
          <input id="a-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </div>
        <p className="rounded-xl bg-vibe-light px-3 py-2 text-xs text-vibe-dark">
          Demo mode: {DEMO_EMAIL} / {DEMO_PASSWORD}
        </p>
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full">
          Sign in
        </Button>
      </form>
    </div>
  );
}
