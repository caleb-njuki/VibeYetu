import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, Smartphone } from "lucide-react";
import Button from "../components/Button.jsx";
import ProductImage from "../components/ProductImage.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getCheckoutStatus, getShop, payCheckout, startCheckout } from "../services/api.js";
import { useOrders } from "../context/OrdersContext.jsx";
import { buyerModes, deliveryCost, rateText } from "../lib/delivery.js";
import { useUserLocation } from "../context/LocationContext.jsx";
import { formatKES, fulfillmentLabel, normalizePhone, phoneDigits } from "../lib/format.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";
const card = "space-y-4 rounded-2xl bg-white p-5 shadow-card";
const optionCls = (on) =>
  `flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
    on ? "border-vibe bg-vibe-light" : "border-ink/20 bg-white"
  }`;

export default function Checkout() {
  const { items, clear } = useCart();
  const { refresh } = useOrders();
  const place = useUserLocation();
  const navigate = useNavigate();

  const [shops, setShops] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [modes, setModes] = useState({});
  const [form, setForm] = useState({ name: "", phone: "", area: "", street: "" });
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const areaRef = useRef(null);
  const streetRef = useRef(null);
  const mpesaRef = useRef(null);
  const attempt = useRef(0);
  const held = useRef(null); // the checkout already made on the server, reused when the buyer taps Pay again
  const [waitText, setWaitText] = useState("");
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
    const offered = buyerModes(shop);
    const mode = offered.includes(modes[shop.id]) ? modes[shop.id] : offered.includes("delivery") ? "delivery" : "pickup";
    // Delivery is priced per kilometre from the buyer's real location, so it is known only once they share it.
    const cost = mode === "delivery" ? deliveryCost(shop, place.location) : null;
    return { shop, items: its, subtotal, mode, offered, cost, fee: cost && !cost.tooFar ? cost.fee : 0 };
  });
  const needsAddress = groups.some((g) => g.mode === "delivery");
  const needsLocation = groups.some((g) => g.mode === "delivery" && !g.cost);
  const tooFar = groups.find((g) => g.cost?.tooFar);
  const grand = groups.reduce((n, g) => n + g.subtotal + g.fee, 0);

  // Phones and browsers can autofill a box without telling React, so the typed text is read from
  // the boxes themselves at the moment of paying. The saved state is only a fallback.
  function readValues() {
    const pick = (ref, fallback) => (ref.current ? ref.current.value : fallback) || "";
    return {
      name: pick(nameRef, form.name),
      phone: pick(phoneRef, form.phone),
      area: pick(areaRef, form.area),
      street: pick(streetRef, form.street),
      mpesaPhone: pick(mpesaRef, mpesaPhone),
    };
  }

  // Returns { message, ref } for the first problem, or null when everything is fine.
  function validate(v) {
    if (v.name.trim().length < 2) return { message: "Enter your name so the seller knows who the order is for.", ref: nameRef };
    if (!normalizePhone(v.phone)) {
      return { message: "Enter a 10-digit phone number starting with 0 that the seller can reach you on, for example 0712345678.", ref: phoneRef };
    }
    if (needsLocation) return { message: "Share your location so we can work out the delivery fee, or choose pickup.", ref: nameRef };
    if (tooFar) return { message: `${tooFar.shop.name} is too far to deliver to you. Please choose pickup or another shop.`, ref: nameRef };
    if (needsAddress) {
      if (v.area.trim().length < 2) return { message: "Enter your area or estate.", ref: areaRef };
      if (v.street.trim().length < 3) return { message: "Enter a street or landmark so the rider can find you.", ref: streetRef };
    }
    if (!normalizePhone(v.mpesaPhone)) {
      return { message: "Enter a valid 10-digit M-Pesa number starting with 0, for example 0712345678.", ref: mpesaRef };
    }
    return null;
  }

  async function handlePay() {
    const v = readValues();
    const problem = validate(v);
    if (problem) {
      setError(problem.message);
      // Take the buyer to the box that needs fixing, since the summary can be far below it on a phone.
      problem.ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      problem.ref.current?.focus({ preventScroll: true });
      return;
    }
    setError("");
    setForm({ name: v.name, phone: v.phone, area: v.area, street: v.street });
    setMpesaPhone(v.mpesaPhone);
    attempt.current += 1;
    const mine = attempt.current;
    const stale = () => attempt.current !== mine || !alive.current;
    setPaying(true);
    setWaitText("Sending the M-Pesa request to your phone...");
    try {
      const modesNow = Object.fromEntries(groups.map((g) => [g.shop.id, g.mode]));
      const signature = JSON.stringify([items.map((i) => [i.key, i.qty]), modesNow, v.name, v.phone, v.area, v.street]);
      // The same cart and details reuse the checkout already made. A change makes a fresh one.
      if (!held.current || held.current.signature !== signature) {
        const made = await startCheckout({
          items,
          modes: modesNow,
          contact: {
            name: v.name.trim(),
            phone: v.phone,
            area: v.area.trim(),
            street: v.street.trim(),
            ...(needsAddress ? { lat: place.location.lat, lng: place.location.lng } : {}),
          },
        });
        held.current = { signature, checkout: made };
      }
      const group = held.current.checkout;
      let answer = await payCheckout(group.id, v.mpesaPhone);
      if (stale()) return;
      setWaitText("");
      // Ask the server every 3 seconds until the buyer has paid, the payment failed, or we have waited long enough.
      const stopAt = Date.now() + 150000;
      while (answer.status === "pending" || answer.status === "unpaid") {
        if (Date.now() > stopAt) {
          throw new Error("We have not heard back from M-Pesa yet. If money was taken from you, your order will appear in My orders within a few minutes. Otherwise tap Pay to try again.");
        }
        await new Promise((r) => setTimeout(r, 3000));
        if (stale()) return;
        answer = await getCheckoutStatus(group.id);
        if (stale()) return;
      }
      if (answer.status === "paid") {
        finished.current = true;
        held.current = null;
        clear();
        refresh();
        navigate("/checkout/success", { replace: true, state: { group: { id: group.id, total: answer.total ?? group.total, orders: answer.orders || group.orders } } });
        return;
      }
      if (answer.status === "expired") held.current = null;
      throw new Error(answer.message || "Payment was not completed.");
    } catch (e) {
      if (!stale()) setError(e.message || "Something went wrong. Please try again.");
    } finally {
      if (alive.current && attempt.current === mine) {
        setPaying(false);
        setWaitText("");
      }
    }
  }

  function cancelPayment() {
    attempt.current += 1;
    setPaying(false);
    setWaitText("");
    setError("Payment cancelled here. If you already entered your M-Pesa PIN, your order will appear in My orders.");
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
                  {g.offered.map((m) => (
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
                      {m === "delivery" && ` (${rateText(g.shop.deliveryFee)})`}
                    </label>
                  ))}
                </div>
                {g.mode === "delivery" && !g.cost && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                    Delivery is {rateText(g.shop.deliveryFee)}. We need your location to work out the fee.
                    <button type="button" onClick={place.openPicker} className="font-semibold text-vibe hover:underline">
                      Use my current location
                    </button>
                  </p>
                )}
                {g.cost && !g.cost.tooFar && (
                  <p className="text-sm text-ink-soft">
                    About {g.cost.km.toFixed(1)} km from you, so delivery is {formatKES(g.cost.fee)}.
                  </p>
                )}
                {g.cost?.tooFar && (
                  <p role="alert" className="text-sm font-semibold text-red-700">
                    This shop is {g.cost.km.toFixed(0)} km away, which is too far to deliver. Please choose pickup.
                  </p>
                )}
              </fieldset>
            ))}
          </section>

          <section className={card} aria-labelledby="addr-title">
            <h2 id="addr-title" className="text-lg font-extrabold">
              2. Your details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-semibold">
                  Your name
                </label>
                <input id="name" ref={nameRef} autoComplete="name" value={form.name} onChange={setField("name")} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="contact-phone" className="text-sm font-semibold">
                  Phone number for the seller
                </label>
                <input
                  id="contact-phone"
                  ref={phoneRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  placeholder="0712345678"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: phoneDigits(e.target.value) }))}
                  className={inputCls}
                />
              </div>
            </div>
            {needsAddress && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="area" className="text-sm font-semibold">
                    Area or estate
                  </label>
                  <input id="area" ref={areaRef} placeholder="e.g. Kilimani" value={form.area} onChange={setField("area")} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="street" className="text-sm font-semibold">
                    Street or landmark
                  </label>
                  <input id="street" ref={streetRef} placeholder="e.g. Near Yaya Centre" value={form.street} onChange={setField("street")} className={inputCls} />
                </div>
              </div>
            )}
            <p className="text-xs text-ink-mute">
              The seller sees your name, phone number{needsAddress ? " and location" : ""} for this order only, so they can{" "}
              {needsAddress ? "find you and call you when the rider is close" : "call you when your order is ready"}. You will see the seller&apos;s phone number on your order page.
            </p>
          </section>

          <section className={card} aria-labelledby="pay-title">
            <h2 id="pay-title" className="text-lg font-extrabold">
              3. Payment
            </h2>
            <div className="flex flex-wrap gap-2">
              <span className={optionCls(true)}>
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                M-Pesa
              </span>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mpesa" className="text-sm font-semibold">
                M-Pesa number
              </label>
              <input
                id="mpesa"
                ref={mpesaRef}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="0712345678"
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(phoneDigits(e.target.value))}
                className={inputCls}
              />
              <p className="text-xs text-ink-mute">You will get a prompt on this phone. Enter your M-Pesa PIN to pay.</p>
            </div>
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl bg-white p-5 shadow-card lg:sticky lg:top-24">
          <h2 className="text-lg font-extrabold">Order summary</h2>
          {groups.map((g) => (
            <div key={g.shop.id} className="space-y-1 border-b border-ink/10 pb-3 text-sm">
              <p className="font-bold">{g.shop.name}</p>
              <ul className="space-y-2 py-1">
                {g.items.map((i) => (
                  <li key={i.key || i.id} className="flex items-center gap-3">
                    <ProductImage product={{ ...i, emoji: i.emoji || "🛍️" }} alt="" className="h-12 w-12 shrink-0 overflow-hidden rounded-lg" emojiClass="text-xl" />
                    <span className="min-w-0 flex-1 truncate">{i.name} × {i.qty}</span>
                    <span className="shrink-0 text-ink-soft">{formatKES(i.price * i.qty)}</span>
                  </li>
                ))}
              </ul>
              <p className="flex justify-between text-ink-soft">
                <span>Items ({g.items.reduce((n, i) => n + i.qty, 0)})</span>
                <span>{formatKES(g.subtotal)}</span>
              </p>
              <p className="flex justify-between text-ink-soft">
                <span>{fulfillmentLabel(g.mode)}</span>
                <span>{g.mode === "delivery" && !g.cost ? "Share location" : g.fee ? formatKES(g.fee) : "Free"}</span>
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
            <h2 className="text-xl font-extrabold">{waitText ? "Please wait" : "Check your phone"}</h2>
            <p className="text-sm text-ink-mute">
              {waitText || `Enter your M-Pesa PIN on ${mpesaPhone} to pay ${formatKES(grand)}. This page continues by itself once you have paid.`}
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
