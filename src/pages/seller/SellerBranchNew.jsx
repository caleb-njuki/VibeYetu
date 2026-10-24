import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button.jsx";
import ShopNameField from "../../components/ShopNameField.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { AREAS, TOWNS } from "../../lib/areas.js";
import { MAX_SHOPS_PER_SELLER, SHOPS_CHANGED, checkShopName, createShop, ownedShops } from "../../lib/sellers.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";

export default function SellerBranchNew() {
  const { seller, switchShop } = useSeller();
  const navigate = useNavigate();
  const mine = ownedShops(seller.email);
  const current = mine.find((s) => s.id === seller.shopId);
  // Start from the current shop's name, so the seller only adds the town or branch.
  const [name, setName] = useState(current ? `${current.name} ` : "");
  const [areaId, setAreaId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const full = mine.length >= MAX_SHOPS_PER_SELLER;

  function onSubmit(e) {
    e.preventDefault();
    const check = checkShopName(name);
    if (!check.ok) return setError(check.message);
    if (!areaId) return setError("Choose the area of this branch.");
    const result = createShop(seller.email, { name, areaId, description });
    if (!result.ok) return setError(result.message);
    switchShop(result.shop.id);
    window.dispatchEvent(new Event(SHOPS_CHANGED));
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
          <ShopNameField id="b-name" label="Branch shop name" value={name} onChange={setName} areaId={areaId} />
          <div className="space-y-1.5">
            <label htmlFor="b-area" className="text-sm font-semibold">
              Where is this branch?
            </label>
            <select id="b-area" value={areaId} onChange={(e) => setAreaId(e.target.value)} className={inputCls}>
              <option value="">Choose the area</option>
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
          </div>
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
            <Button type="submit">Create branch</Button>
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
