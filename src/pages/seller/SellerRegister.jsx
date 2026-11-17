import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Button from "../../components/Button.jsx";
import PinPicker from "../../components/PinPicker.jsx";
import ShopNameField from "../../components/ShopNameField.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { sendEmailCode, checkEmailCode } from "../../services/sellerApi.js";
import { checkShopName, normalizeEmail, registerSeller, validateAccountStep, validateDetailsStep } from "../../lib/sellers.js";
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
  // The email must be proved with a code we send to it, before the account can be made.
  const [account, setAccount] = useState({ email: "", password: "", confirm: "" });
  const [mail, setMail] = useState({ sent: false, code: "", proof: "", proofFor: "", wait: 0 });
  const mailNow = normalizeEmail(account.email);
  const mailOk = Boolean(mail.proof) && mail.proofFor === mailNow;

  useEffect(() => {
    if (mail.wait <= 0) return undefined;
    const t = setTimeout(() => setMail((m) => ({ ...m, wait: m.wait - 1 })), 1000);
    return () => clearTimeout(t);
  }, [mail.wait]);

  async function sendCode() {
    setBusy(true);
    setError("");
    try {
      const data = await sendEmailCode(mailNow);
      setMail((m) => ({ ...m, sent: true, code: "", wait: Math.round((data.resendInMs || 30000) / 1000) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const [details, setDetails] = useState({
    fullName: "",
    idNumber: "",
    kraPin: "",
    phone: "",
    businessType: "individual",
    businessName: "",
    businessRegNo: "",
  });
  const [shop, setShop] = useState({ name: "", description: "", lat: null, lng: null, placeName: "", placeTown: "" });
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
      if (mailOk) return setStep(1);
      if (!mail.sent) return sendCode();
      if (mail.code.trim().length !== 6) return setError("Enter the 6-digit code we emailed you.");
      setBusy(true);
      try {
        const data = await checkEmailCode(mailNow, mail.code.trim());
        setMail((m) => ({ ...m, proof: data.proof, proofFor: mailNow }));
        setStep(1);
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return undefined;
    }
    if (step === 1) {
      const problem = validateDetailsStep(details);
      if (problem) return setError(problem);
      setError("");
      return setStep(2);
    }

    const name = checkShopName(shop.name);
    if (!name.ok) return setError(name.message);
    if (shop.lat === null) return setError("Place the pin on the map to show exactly where your shop is.");
    if (!consent.terms || !consent.data || !consent.accurate) return setError("Please tick all three agreements to continue.");

    setBusy(true);
    setError("");
    try {
      const result = await registerSeller({ account: { ...account, emailProof: mail.proof }, details, shop, consent });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      finished.current = true;
      login(result.session);
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
              <input
                id="r-email"
                type="email"
                autoComplete="email"
                value={account.email}
                onChange={(e) => {
                  setA("email")(e);
                  setMail((m) => ({ ...m, sent: false, code: "" }));
                }}
                className={inputCls}
              />
            </Field>
            {mailOk && <p className="text-xs font-semibold text-green-800">Email verified.</p>}
            {!mailOk && mail.sent && (
              <Field id="r-mailcode" label="Code from your email" why={`We sent a 6-digit code to ${mailNow}. Check your inbox and spam folder.`}>
                <div className="flex gap-2">
                  <input
                    id="r-mailcode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mail.code}
                    onChange={(e) => setMail((m) => ({ ...m, code: e.target.value.replace(/\D/g, "") }))}
                    className={inputCls}
                  />
                  <Button variant="outline" onClick={sendCode} disabled={busy || mail.wait > 0}>
                    {mail.wait > 0 ? `${mail.wait}s` : "Send again"}
                  </Button>
                </div>
              </Field>
            )}
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
            <Field id="r-phone" label="Phone number" why="So support can reach you. Buyers who order from you also see it on their order page. It is not shown on your shop page.">
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
            <ShopNameField id="r-shop" value={shop.name} onChange={(name) => setShop((s) => ({ ...s, name }))} place={shop.placeName} />
            <PinPicker
              value={shop.lat === null ? null : { lat: shop.lat, lng: shop.lng, placeName: shop.placeName, placeTown: shop.placeTown }}
              onChange={(p) => setShop((s) => ({ ...s, lat: p.lat, lng: p.lng, placeName: p.placeName || "", placeTown: p.placeTown || "" }))}
            />
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
            {step === 0 ? (mailOk ? "Continue" : mail.sent ? "Verify and continue" : "Send me a code") : step === 1 ? "Continue" : busy ? "Creating your shop..." : "Create my shop"}
          </Button>
        </div>

        <Link to="/my-shop/login" className="block text-center text-sm font-semibold text-vibe hover:underline">
          Already have an account? Sign in
        </Link>
      </form>
    </div>
  );
}
