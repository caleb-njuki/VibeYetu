import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button.jsx";
import PinPicker from "../../components/PinPicker.jsx";
import ShopNameField from "../../components/ShopNameField.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { MAX_SHOPS_PER_SELLER, checkShopName, createShop } from "../../lib/sellers.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";

export default function SellerBranchNew() {
  const { seller, addShop } = useSeller();
  const navigate = useNavigate();
  const mine = seller.shops;
  const current = mine.find((s) => s.id === seller.shopId);
  // Start from the current shop's name, so the seller only adds the town or branch.
  const [name, setName] = useState(current ? `${current.name} ` : "");
  const [pin, setPin] = useState(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const full = mine.length >= MAX_SHOPS_PER_SELLER;

  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const check = checkShopName(name);
    if (!check.ok) return setError(check.message);
    if (!pin) return setError("Place the pin on the map to show exactly where this branch is.");
    setBusy(true);
    const result = await createShop(seller.email, { name, description, lat: pin.lat, lng: pin.lng, placeName: pin.placeName, placeTown: pin.placeTown });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    addShop(result.shop);
    navigate("/my-shop/settings", { replace: true });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold">Add a branch</h1>
        <p className="text-sm text-ink-mute">
          A branch is another shop under the same seller details, for example in another town. It has its own products, orders and sales.
        </p>
      </div>

      <section className="space-y-2 rounded-2xl bg-white p-5 shadow-card" aria-labelledby="mine-title">
        <h2 id="mine-title" className="text-sm font-bold uppercase tracking-wider text-ink-mute">
          Your shops ({mine.length} of {MAX_SHOPS_PER_SELLER})
        </h2>
        <ul className="space-y-1 text-sm">
          {mine.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{s.name}</span>
              <span className="text-ink-mute">{s.area ? `${s.area}, ${s.town}` : s.town}</span>
              {s.suspended && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">Suspended</span>}
            </li>
          ))}
        </ul>
      </section>

      {full ? (
        <p className="rounded-2xl bg-amber-100 p-5 text-sm font-semibold text-amber-900">
          You have reached the limit of {MAX_SHOPS_PER_SELLER} shops. Contact support if you need more.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl bg-white p-5 shadow-card" noValidate>
          <ShopNameField id="b-name" label="Branch shop name" value={name} onChange={setName} place={pin?.placeName || ""} />
          <PinPicker value={pin} onChange={setPin} label="Place a pin on this branch" />
          <div className="space-y-1.5">
            <label htmlFor="b-desc" className="text-sm font-semibold">
              About this branch (optional)
            </label>
            <textarea id="b-desc" rows={3} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </div>

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={busy}>{busy ? "Creating..." : "Create branch"}</Button>
            <Button to="/my-shop/settings" variant="outline">
              Cancel
            </Button>
          </div>
        </form>
      )}

      <p className="text-xs text-ink-mute">
        Each branch is a separate shop on VibeYetu and follows the{" "}
        <Link to="/terms" target="_blank" className="font-semibold text-vibe hover:underline">
          Terms of use
        </Link>
        .
      </p>
    </div>
  );
}
