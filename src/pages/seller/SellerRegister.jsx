import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Button from "../../components/Button.jsx";
import ShopNameField from "../../components/ShopNameField.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { AREAS, TOWNS } from "../../lib/areas.js";
import { checkShopName, registerSeller, validateAccountStep, validateDetailsStep } from "../../lib/sellers.js";
import { FEE_LABEL } from "../../lib/fees.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";
const STEPS = ["Account", "Your details", "Your shop"];

function Field({ id, label, why, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {why && <p className="text-xs text-ink-mute">{why}</p>}
    </div>
  );
}

export default function SellerRegister() {
  const { seller, login } = useSeller();
  const navigate = useNavigate();
  const finished = useRef(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [account, setAccount] = useState({ email: "", password: "", confirm: "" });
  const [details, setDetails] = useState({
    fullName: "",
    idNumber: "",
    kraPin: "",
    phone: "",
    businessType: "individual",
    businessName: "",
    businessRegNo: "",
  });
  const [shop, setShop] = useState({ name: "", areaId: "", description: "" });
  const [consent, setConsent] = useState({ terms: false, data: false, accurate: false });

  // Someone who is already signed in goes to their shop, except right after registering.
  useEffect(() => {
    if (seller && !finished.current) navigate("/my-shop", { replace: true });
  }, [seller, navigate]);

  const setA = (key) => (e) => setAccount((a) => ({ ...a, [key]: e.target.value }));
  const setD = (key) => (e) => setDetails((d) => ({ ...d, [key]: e.target.value }));
  const setC = (key) => (e) => setConsent((c) => ({ ...c, [key]: e.target.checked }));

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;

    if (step === 0) {
      const problem = validateAccountStep(account);
      if (problem) return setError(problem);
      setError("");
      return setStep(1);
    }
    if (step === 1) {
      const problem = validateDetailsStep(details);
      if (problem) return setError(problem);
      setError("");
      return setStep(2);
    }

    const name = checkShopName(shop.name);
    if (!name.ok) return setError(name.message);
    if (!shop.areaId) return setError("Choose the area your shop is in.");
    if (!consent.terms || !consent.data || !consent.accurate) return setError("Please tick all three agreements to continue.");

    setBusy(true);
    setError("");
    try {
      const result = await registerSeller({ account, details, shop, consent });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      finished.current = true;
      login(result.seller);
      navigate("/my-shop/settings", { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <form onSubmit={onSubmit} className="space-y-5 rounded-3xl bg-white p-6 shadow-card sm:p-8" noValidate>
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">Open your shop</h1>
          <p className="text-sm text-ink-mute">Sell to buyers near you. Your payments are protected by escrow.</p>
        </div>

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

        {step === 0 && (
          <>
            <Field id="r-email" label="Email">
              <input id="r-email" type="email" autoComplete="email" value={account.email} onChange={setA("email")} className={inputCls} />
            </Field>
            <Field id="r-password" label="Password" why="At least 8 characters.">
              <div className="relative">
                <input
                  id="r-password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={account.password}
                  onChange={setA("password")}
                  className={`${inputCls} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-mute hover:bg-ink/5"
                >
                  {showPw ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </Field>
            <Field id="r-confirm" label="Confirm password">
              <input
                id="r-confirm"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={account.confirm}
                onChange={setA("confirm")}
                className={inputCls}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <p className="rounded-xl bg-vibe-light px-4 py-3 text-xs text-vibe-dark">
              We ask for these details to confirm you are a real seller and to protect buyers and sellers from fraud. Only our support team can see them. Buyers never do.{" "}
              <Link to="/privacy" target="_blank" className="font-bold underline">
                Read how we use them
              </Link>
              .
            </p>
            <Field id="r-name" label="Full name" why="As it appears on your national ID.">
              <input id="r-name" autoComplete="name" value={details.fullName} onChange={setD("fullName")} className={inputCls} />
            </Field>
            <Field id="r-id" label="National ID number" why="Used to verify you and to handle fraud claims.">
              <input
                id="r-id"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={details.idNumber}
                onChange={(e) => setDetails((d) => ({ ...d, idNumber: e.target.value.replace(/\D/g, "") }))}
                className={inputCls}
              />
            </Field>
            <Field id="r-phone" label="Phone number" why="So support can reach you about orders. Buyers do not see it.">
              <input id="r-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={details.phone} onChange={setD("phone")} className={inputCls} />
            </Field>
            <Field id="r-kra" label="KRA PIN (optional)" why="Helps us confirm a registered trader. Leave empty if you do not have one.">
              <input id="r-kra" autoComplete="off" maxLength={11} placeholder="A123456789B" value={details.kraPin} onChange={setD("kraPin")} className={`${inputCls} uppercase`} />
            </Field>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">How do you sell?</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="businessType"
                  value="individual"
                  checked={details.businessType === "individual"}
                  onChange={setD("businessType")}
                  className="accent-vibe"
                />
                As an individual trader
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="businessType"
                  value="registered"
                  checked={details.businessType === "registered"}
                  onChange={setD("businessType")}
                  className="accent-vibe"
                />
                As a registered business
              </label>
            </fieldset>

            {details.businessType === "registered" && (
              <>
                <Field id="r-bname" label="Registered business name">
                  <input id="r-bname" value={details.businessName} onChange={setD("businessName")} className={inputCls} />
                </Field>
                <Field id="r-breg" label="Business registration number">
                  <input id="r-breg" autoComplete="off" value={details.businessRegNo} onChange={setD("businessRegNo")} className={inputCls} />
                </Field>
              </>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <ShopNameField id="r-shop" value={shop.name} onChange={(name) => setShop((s) => ({ ...s, name }))} areaId={shop.areaId} />
            <Field id="r-area" label="Where is your shop?" why="Buyers near this area will see your shop.">
              <select id="r-area" value={shop.areaId} onChange={(e) => setShop((s) => ({ ...s, areaId: e.target.value }))} className={inputCls}>
                <option value="">Choose your area</option>
                {TOWNS.map((town) => (
                  <optgroup key={town} label={town}>
                    {AREAS.filter((a) => a.town === town).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field id="r-desc" label="About your shop (optional)">
              <textarea
                id="r-desc"
                rows={3}
                maxLength={300}
                value={shop.description}
                onChange={(e) => setShop((s) => ({ ...s, description: e.target.value }))}
                className={inputCls}
              />
            </Field>

            <p className="rounded-xl bg-vibe-light px-4 py-3 text-sm text-vibe-dark">
              <strong>Fees:</strong> opening a shop and listing products is free. VibeYetu keeps {FEE_LABEL} of the item total when an order
              is completed, and nothing if you do not sell. Buyers pay nothing extra.
            </p>

            <div className="space-y-2.5 border-t border-ink/10 pt-4">
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={consent.terms} onChange={setC("terms")} className="mt-1 accent-vibe" />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" target="_blank" className="font-semibold text-vibe hover:underline">
                    Terms of use
                  </Link>
                  , including my promise to fulfil accepted orders on time.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={consent.data} onChange={setC("data")} className="mt-1 accent-vibe" />
                <span>
                  I agree that VibeYetu may keep and use my details to verify me and to handle fraud claims, as explained in the{" "}
                  <Link to="/privacy" target="_blank" className="font-semibold text-vibe hover:underline">
                    Privacy policy
                  </Link>
                  .
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={consent.accurate} onChange={setC("accurate")} className="mt-1 accent-vibe" />
                <span>The details I gave are true and belong to me.</span>
              </label>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() => {
                setError("");
                setStep((s) => s - 1);
              }}
            >
              Back
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" disabled={busy}>
            {step < 2 ? "Continue" : busy ? "Creating your shop..." : "Create my shop"}
          </Button>
        </div>

        <Link to="/my-shop/login" className="block text-center text-sm font-semibold text-vibe hover:underline">
          Already have an account? Sign in
        </Link>
      </form>
    </div>
  );
}
