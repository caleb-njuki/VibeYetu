import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import Button from "../../components/Button.jsx";
import ImageUploader from "../../components/ImageUploader.jsx";
import ShopNameField from "../../components/ShopNameField.jsx";
import { deleteImage } from "../../lib/images.js";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { AREAS, TOWNS, findArea } from "../../lib/areas.js";
import { getShopSettings, saveShopSettings } from "../../lib/shopProfile.js";
import { SHOPS_CHANGED, checkShopName } from "../../lib/sellers.js";
import { localPhone, normalizePhone } from "../../lib/format.js";
import { getShop } from "../../services/api.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";

export default function SellerSettings() {
  const { seller } = useSeller();
  const [shop, setShop] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    setForm(null);
    setSaved(false);
    setError("");
    getShop(seller.shopId)
      .then((s) => {
        if (!live || !s) return;
        const priv = getShopSettings(seller.shopId).private;
        setShop(s);
        setForm({
          name: s.name,
          description: s.description || "",
          photo: s.photo ? [s.photo] : [],
          areaId: s.areaId || "",
          opens: s.opens || "08:00",
          closes: s.closes || "18:00",
          delivery: s.fulfillment.includes("delivery"),
          pickup: s.fulfillment.includes("pickup"),
          phone: priv.phone ? localPhone(priv.phone) : "",
          payout: priv.payout ? localPhone(priv.payout) : "",
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
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
    ["Your shop's area, so nearby buyers find you", Boolean(findArea(form.areaId))],
    ["Opening hours", form.opens < form.closes],
    ["Delivery or pickup chosen", form.delivery || form.pickup],
    ["A contact phone number", Boolean(normalizePhone(form.phone))],
    ["An M-Pesa number for payouts", Boolean(normalizePhone(form.payout))],
  ];
  const done = checklist.filter(([, ok]) => ok).length;

  function save(e) {
    e.preventDefault();
    const area = findArea(form.areaId);
    const nameCheck = checkShopName(form.name, { ignoreShopId: seller.shopId });
    if (!nameCheck.ok) return setError(nameCheck.message);
    if (!area) return setError("Choose the area your shop is in.");
    if (!(form.opens < form.closes)) return setError("The closing time must be after the opening time.");
    if (!form.delivery && !form.pickup) return setError("Choose delivery, pickup or both.");
    const phone = form.phone.trim() ? normalizePhone(form.phone) : "";
    const payout = form.payout.trim() ? normalizePhone(form.payout) : "";
    if (form.phone.trim() && !phone) return setError("Enter a valid contact number, for example 0712 345 678.");
    if (form.payout.trim() && !payout) return setError("Enter a valid M-Pesa number, for example 0712 345 678.");
    // Keep the shop's exact point unless the seller moved to a different area.
    const moved = form.areaId !== shop.areaId;
    saveShopSettings(seller.shopId, {
      public: {
        name: nameCheck.name,
        description: form.description.trim(),
        photo: form.photo[0] || "",
        areaId: area.id,
        area: area.name,
        town: area.town,
        lat: moved || typeof shop.lat !== "number" ? area.lat : shop.lat,
        lng: moved || typeof shop.lng !== "number" ? area.lng : shop.lng,
        opens: form.opens,
        closes: form.closes,
        fulfillment: [form.delivery && "delivery", form.pickup && "pickup"].filter(Boolean),
      },
      private: { phone, payout },
    });
    if (shop.photo && shop.photo !== form.photo[0]) deleteImage(shop.photo);
    setShop((s) => ({ ...s, areaId: area.id, photo: form.photo[0] || "" }));
    setForm((f) => ({ ...f, name: nameCheck.name }));
    window.dispatchEvent(new Event(SHOPS_CHANGED));
    setError("");
    setSaved(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold">Shop settings</h1>
          <p className="text-sm text-ink-mute">What buyers see about your shop, and how you get paid.</p>
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
          areaId={form.areaId}
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

        <div className="space-y-1.5">
          <label htmlFor="s-area" className="text-sm font-semibold">
            Where is your shop?
          </label>
          <select id="s-area" value={form.areaId} onChange={set("areaId")} className={inputCls}>
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
          <p className="text-xs text-ink-mute">Buyers near this area see your shop. Placing an exact pin on a map comes later.</p>
        </div>

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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.pickup} onChange={toggle("pickup")} className="accent-vibe" />
            Pickup at my shop
          </label>
        </fieldset>

        <h2 className="border-t border-ink/10 pt-5 text-lg font-extrabold">Private details</h2>
        <p className="-mt-3 text-sm text-ink-mute">Buyers never see these.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="s-phone" className="text-sm font-semibold">
              Contact phone
            </label>
            <input id="s-phone" type="tel" inputMode="tel" placeholder="0712 345 678" value={form.phone} onChange={set("phone")} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="s-payout" className="text-sm font-semibold">
              M-Pesa number for payouts
            </label>
            <input id="s-payout" type="tel" inputMode="tel" placeholder="0712 345 678" value={form.payout} onChange={set("payout")} className={inputCls} />
          </div>
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
        <Button type="submit">Save settings</Button>
      </form>
    </div>
  );
}
