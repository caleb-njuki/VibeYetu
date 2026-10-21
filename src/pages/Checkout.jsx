import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { CreditCard, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import Button from "../components/Button.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { DELIVERY_FEE, getShop, payOrders, placeOrders } from "../services/api.js";
import { formatKES, fulfillmentLabel, localPhone, normalizePhone } from "../lib/format.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";
const card = "space-y-4 rounded-2xl bg-white p-5 shadow-card";
const optionCls = (on) =>
  `flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
    on ? "border-vibe bg-vibe-light" : "border-ink/20 bg-white"
  }`;

export default function Checkout() {
  const { items, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [shops, setShops] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [modes, setModes] = useState({});
  const [form, setForm] = useState({ name: "", area: "", street: "" });
  const [method, setMethod] = useState("mpesa");
  const [mpesaPhone, setMpesaPhone] = useState(user?.phone ? localPhone(user.phone) : "");
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const attempt = useRef(0);
  const alive = useRef(true);
  const finished = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const shopKey = [...new Set(items.map((i) => i.shopId))].join(",");

  useEffect(() => {
    if (!shopKey) return undefined;
    let live = true;
    setShops(null);
    setLoadFailed(false);
    Promise.all(shopKey.split(",").map((id) => getShop(id)))
      .then((list) => {
        if (!live) return;
        if (list.some((s) => !s)) setLoadFailed(true);
        else setShops(list);
      })
      .catch(() => {
        if (live) setLoadFailed(true);
      });
    return () => {
      live = false;
    };
  }, [shopKey]);

  if (items.length === 0 && !finished.current) return <Navigate to="/cart" replace />;

  if (loadFailed) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-extrabold">We could not load your order</h1>
        <p className="text-ink-mute">A shop in your cart may no longer be available. Please review your cart.</p>
        <Button to="/cart">Back to cart</Button>
      </div>
    );
  }

  if (!shops) {
    return <div className="mx-auto h-96 max-w-6xl animate-pulse rounded-3xl bg-ivory-dark" aria-busy="true" />;
  }

  const groups = shops.map((shop) => {
    const its = items.filter((i) => i.shopId === shop.id);
    const subtotal = its.reduce((n, i) => n + i.price * i.qty, 0);
    const mode = modes[shop.id] ?? (shop.fulfillment.includes("delivery") ? "delivery" : "pickup");
    return { shop, items: its, subtotal, mode, fee: mode === "delivery" ? DELIVERY_FEE : 0 };
  });
  const needsAddress = groups.some((g) => g.mode === "delivery");
  const grand = groups.reduce((n, g) => n + g.subtotal + g.fee, 0);

  function validate() {
    if (needsAddress) {
      if (form.name.trim().length < 2) return "Enter the recipient's name.";
      if (form.area.trim().length < 2) return "Enter your area or estate.";
      if (form.street.trim().length < 3) return "Enter a street or landmark so the rider can find you.";
    }
    if (method === "mpesa" && !normalizePhone(mpesaPhone)) return "Enter a valid M-Pesa number, for example 0712 345 678.";
    return "";
  }

  async function handlePay() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    attempt.current += 1;
    const mine = attempt.current;
    setPaying(true);
    try {
      const group = await placeOrders({
        items,
        modes: Object.fromEntries(groups.map((g) => [g.shop.id, g.mode])),
      });
      const result = await payOrders({
        method,
        phone: normalizePhone(mpesaPhone),
        amount: group.total,
      });
      if (attempt.current !== mine || !alive.current) return;
      if (!result.ok) throw new Error(result.message || "Payment was not completed.");
      finished.current = true;
      clear();
      navigate("/checkout/success", { replace: true, state: { group } });
    } catch (e) {
      if (alive.current && attempt.current === mine) setError(e.message || "Something went wrong. Please try again.");
    } finally {
      if (alive.current && attempt.current === mine) setPaying(false);
    }
  }

  function cancelPayment() {
    attempt.current += 1;
    setPaying(false);
  }

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <h1 className="mb-6 text-3xl font-extrabold">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <section className={card} aria-labelledby="ful-title">
            <h2 id="ful-title" className="text-lg font-extrabold">
              1. Delivery or pickup
            </h2>
            {groups.map((g) => (
              <fieldset key={g.shop.id} className="space-y-2">
                <legend className="mb-1 text-sm font-bold">{g.shop.name}</legend>
                <div className="flex flex-wrap gap-2">
                  {g.shop.fulfillment.map((m) => (
                    <label key={m} className={optionCls(g.mode === m)}>
                      <input
                        type="radio"
                        name={`mode-${g.shop.id}`}
                        value={m}
                        checked={g.mode === m}
                        onChange={() => setModes((prev) => ({ ...prev, [g.shop.id]: m }))}
                        className="accent-vibe"
                      />
                      {fulfillmentLabel(m)}
                      {m === "delivery" && ` (+${formatKES(DELIVERY_FEE)})`}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </section>

          {needsAddress && (
            <section className={card} aria-labelledby="addr-title">
              <h2 id="addr-title" className="text-lg font-extrabold">
                2. Delivery details
              </h2>
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-semibold">
                  Recipient name
                </label>
                <input id="name" autoComplete="name" value={form.name} onChange={setField("name")} className={inputCls} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="area" className="text-sm font-semibold">
                    Area or estate
                  </label>
                  <input id="area" placeholder="e.g. Kilimani" value={form.area} onChange={setField("area")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="street" className="text-sm font-semibold">
                    Street or landmark
                  </label>
                  <input id="street" placeholder="e.g. Near Yaya Centre" value={form.street} onChange={setField("street")} className={inputCls} />
                </div>
              </div>
              <p className="text-xs text-ink-mute">The rider will call you on your sign-in number to find you.</p>
            </section>
          )}

          <section className={card} aria-labelledby="pay-title">
            <h2 id="pay-title" className="text-lg font-extrabold">
              {needsAddress ? "3" : "2"}. Payment
            </h2>
            <div className="flex flex-wrap gap-2">
              <label className={optionCls(method === "mpesa")}>
                <input type="radio" name="method" checked={method === "mpesa"} onChange={() => setMethod("mpesa")} className="accent-vibe" />
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                M-Pesa
              </label>
              <label className={optionCls(method === "card")}>
                <input type="radio" name="method" checked={method === "card"} onChange={() => setMethod("card")} className="accent-vibe" />
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Debit or credit card
              </label>
            </div>

            {method === "mpesa" ? (
              <div className="space-y-1.5">
                <label htmlFor="mpesa" className="text-sm font-semibold">
                  M-Pesa number
                </label>
                <input
                  id="mpesa"
                  type="tel"
                  inputMode="tel"
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-ink-mute">You will get a prompt on this phone. Enter your M-Pesa PIN to pay.</p>
              </div>
            ) : (
              <p className="rounded-xl bg-vibe-light px-4 py-3 text-sm text-vibe-dark">
                You will be taken to a secure payment page to enter your card details. VibeYetu never sees or stores your
                card number.
              </p>
            )}
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl bg-white p-5 shadow-card lg:sticky lg:top-24">
          <h2 className="text-lg font-extrabold">Order summary</h2>
          {groups.map((g) => (
            <div key={g.shop.id} className="space-y-1 border-b border-ink/10 pb-3 text-sm">
              <p className="font-bold">{g.shop.name}</p>
              <p className="flex justify-between text-ink-soft">
                <span>Items ({g.items.reduce((n, i) => n + i.qty, 0)})</span>
                <span>{formatKES(g.subtotal)}</span>
              </p>
              <p className="flex justify-between text-ink-soft">
                <span>{fulfillmentLabel(g.mode)}</span>
                <span>{g.fee ? formatKES(g.fee) : "Free"}</span>
              </p>
            </div>
          ))}
          <div className="flex justify-between text-lg font-extrabold">
            <span>Total</span>
            <span>{formatKES(grand)}</span>
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <Button size="lg" className="w-full" onClick={handlePay} disabled={paying}>
            Pay {formatKES(grand)}
          </Button>
          <p className="flex items-start gap-2 text-xs text-ink-mute">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-vibe" aria-hidden="true" />
            Your money is held in escrow. The seller is paid only after you and the seller both confirm.
          </p>
          <Link to="/cart" className="block text-center text-sm font-semibold text-vibe hover:underline">
            Back to cart
          </Link>
        </aside>
      </div>

      {paying && (
        <div role="alertdialog" aria-modal="true" aria-label="Payment in progress" className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/70 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-vibe" aria-hidden="true" />
            <h2 className="text-xl font-extrabold">{method === "mpesa" ? "Check your phone" : "Opening secure payment"}</h2>
            <p className="text-sm text-ink-mute">
              {method === "mpesa"
                ? `Enter your M-Pesa PIN on ${mpesaPhone} to pay ${formatKES(grand)}.`
                : "Please wait while we take you to the secure card page."}
            </p>
            <Button variant="outline" onClick={cancelPayment}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
