import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import Button from "../../components/Button.jsx";
import ImageUploader from "../../components/ImageUploader.jsx";
import PinPicker from "../../components/PinPicker.jsx";
import ShopNameField from "../../components/ShopNameField.jsx";
import { imageId } from "../../lib/images.js";
import { getPayout, updateShop } from "../../services/sellerApi.js";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { checkShopNameFree } from "../../lib/sellers.js";
import { localPhone, normalizePhone } from "../../lib/format.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";

export default function SellerSettings() {
  const { seller, shop, patchShop } = useSeller();
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  // Both are set on the Payments tab. The fee is part of the shop; the payout is asked from the server.
  const [payout, setPayout] = useState(null);
  const deliveryFee = shop?.deliveryFee ?? null;

  useEffect(() => {
    let live = true;
    getPayout(seller.shopId)
      .then((d) => live && setPayout(d.payout || null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [seller.shopId]);

  useEffect(() => {
    const s = shop;
    setSaved(false);
    setError("");
    if (!s) return;
    setForm({
      name: s.name,
      description: s.description || "",
      photo: s.photo ? [s.photo] : [],
      pin: typeof s.lat === "number" && typeof s.lng === "number" ? { lat: s.lat, lng: s.lng, placeName: s.area || "", placeTown: s.town || "" } : null,
      opens: s.opens || "08:00",
      closes: s.closes || "18:00",
      delivery: (s.fulfillment || []).includes("delivery"),
      pickup: (s.fulfillment || []).includes("pickup"),
      phone: s.contactPhone ? localPhone(s.contactPhone) : "",
    });
    // Only when the shop being edited changes, not after each save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller.shopId]);

  if (!form) return <div className="h-64 animate-pulse rounded-2xl bg-ivory-dark" aria-busy="true" />;

  const set = (key) => (e) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };
  const toggle = (key) => (e) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: e.target.checked }));
  };

  const checklist = [
    ["A shop photo", form.photo.length > 0],
    ["A shop description of at least 20 characters", form.description.trim().length >= 20],
    ["A pin on the map, so nearby buyers find you", Boolean(form.pin)],
    ["Opening hours", form.opens < form.closes],
    ["Delivery or pickup chosen", form.delivery || form.pickup],
    ["A contact phone number", Boolean(normalizePhone(form.phone))],
    ["A payout method (Till, Paybill, Pochi la Biashara or M-Pesa), set on the Payments tab", Boolean(payout)],
    ["A delivery fee, set on the Payments tab (not needed if you only offer pickup)", !form.delivery || deliveryFee !== null],
  ];
  const done = checklist.filter(([, ok]) => ok).length;

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const nameCheck = await checkShopNameFree(form.name, { ignoreShopId: seller.shopId });
    if (!nameCheck.ok) return setError(nameCheck.message);
    if (!form.pin) return setError("Place the pin on the map to show exactly where your shop is.");
    if (!(form.opens < form.closes)) return setError("The closing time must be after the opening time.");
    if (!form.delivery && !form.pickup) return setError("Choose delivery, pickup or both.");
    const phone = form.phone.trim() ? normalizePhone(form.phone) : "";
    if (form.phone.trim() && !phone) return setError("Enter a valid contact number, for example 0712 345 678.");
    setBusy(true);
    setError("");
    try {
      const updated = await updateShop(seller.shopId, {
        name: nameCheck.name,
        description: form.description.trim(),
        photo: form.photo[0] ? imageId(form.photo[0]) : null,
        placeName: form.pin.placeName || "",
        placeTown: form.pin.placeTown || "",
        lat: Math.round(form.pin.lat * 1e6) / 1e6,
        lng: Math.round(form.pin.lng * 1e6) / 1e6,
        opens: form.opens,
        closes: form.closes,
        fulfillment: [form.delivery && "delivery", form.pickup && "pickup"].filter(Boolean),
        ...(phone ? { phone } : {}),
      });
      patchShop(updated);
      setForm((f) => ({ ...f, name: nameCheck.name }));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold">Shop settings</h1>
          <p className="text-sm text-ink-mute">What buyers see about your shop. Payout methods and your delivery fee are on the Payments tab.</p>
        </div>
        <Link to={`/shop/${seller.shopId}`} className="text-sm font-semibold text-vibe hover:underline">
          View my shop as a buyer
        </Link>
      </div>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-card" aria-labelledby="setup-title">
        <h2 id="setup-title" className="text-lg font-extrabold">
          Shop setup: {done} of {checklist.length} done
        </h2>
        <ul className="space-y-1.5">
          {checklist.map(([label, ok]) => {
            const Icon = ok ? CheckCircle2 : Circle;
            return (
              <li key={label} className={`flex items-center gap-2 text-sm ${ok ? "font-semibold text-green-800" : "text-ink-mute"}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </li>
            );
          })}
        </ul>
      </section>

      <form onSubmit={save} className="space-y-5 rounded-2xl bg-white p-5 shadow-card" noValidate>
        <h2 className="text-lg font-extrabold">Shop profile</h2>
        <ImageUploader
          label="Shop photo"
          value={form.photo}
          max={1}
          onChange={(ids) => {
            setSaved(false);
            setForm((f) => ({ ...f, photo: ids }));
          }}
        />
        <ShopNameField
          id="s-name"
          value={form.name}
          place={form.pin?.placeName || ""}
          ignoreShopId={seller.shopId}
          onChange={(name) => {
            setSaved(false);
            setForm((f) => ({ ...f, name }));
          }}
          hint="Buyers know you by this name, so change it only if you must. It must stay unique."
        />
        <div className="space-y-1.5">
          <label htmlFor="s-desc" className="text-sm font-semibold">
            About your shop
          </label>
          <textarea id="s-desc" rows={3} value={form.description} onChange={set("description")} className={inputCls} />
        </div>

        <PinPicker value={form.pin} onChange={(p) => { setSaved(false); setForm((f) => ({ ...f, pin: p })); }} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="s-opens" className="text-sm font-semibold">
              Opens at
            </label>
            <input id="s-opens" type="time" value={form.opens} onChange={set("opens")} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="s-closes" className="text-sm font-semibold">
              Closes at
            </label>
            <input id="s-closes" type="time" value={form.closes} onChange={set("closes")} className={inputCls} />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">How buyers get their orders</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.delivery} onChange={toggle("delivery")} className="accent-vibe" />
            Delivery
          </label>
          {form.delivery && deliveryFee === null && (
            <p className="text-xs font-semibold text-amber-900">
              You have not set a delivery fee yet, so buyers cannot choose delivery.{" "}
              <Link to="/my-shop/payments" className="text-vibe underline">
                Set it on the Payments tab
              </Link>
              .
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.pickup} onChange={toggle("pickup")} className="accent-vibe" />
            Pickup at my shop
          </label>
        </fieldset>

        <h2 className="border-t border-ink/10 pt-5 text-lg font-extrabold">Private details</h2>
        <p className="-mt-3 text-sm text-ink-mute">Not shown on your shop page. Your contact phone is shown to buyers who have an order with you, so they can reach you.</p>
        <div className="space-y-1.5 sm:max-w-sm">
          <label htmlFor="s-phone" className="text-sm font-semibold">
            Contact phone
          </label>
          <input id="s-phone" type="tel" inputMode="tel" placeholder="0712 345 678" value={form.phone} onChange={set("phone")} className={inputCls} />
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
            Settings saved.
          </p>
        )}
        <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save settings"}</Button>
      </form>

      <section className="space-y-2 rounded-2xl bg-white p-5 shadow-card" aria-labelledby="pay-title">
        <h2 id="pay-title" className="text-lg font-extrabold">
          Payments
        </h2>
        <p className="text-sm text-ink-soft">
          {payout ? "Your payout method is saved." : "You have not added a payout method yet, so you cannot be paid."} Add or change
          it, and set your delivery fee, on the{" "}
          <Link to="/my-shop/payments" className="font-semibold text-vibe underline">
            Payments tab
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
