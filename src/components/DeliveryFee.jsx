import { useState } from "react";
import { Truck } from "lucide-react";
import Button from "./Button.jsx";
import { useSeller } from "../context/SellerAuthContext.jsx";
import { MAX_RATE_PER_KM, rateText, validateRate } from "../lib/delivery.js";
import { SHOPS_CHANGED } from "../lib/sellers.js";
import { formatKES } from "../lib/format.js";
import { updateShop } from "../services/sellerApi.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";

// The delivery fee this shop charges per kilometre. `delivers` says whether delivery is switched on in Settings.
export default function DeliveryFee({ shopId, delivers }) {
  const { shop, patchShop } = useSeller();
  const current = shop?.deliveryFee ?? null;
  const [value, setValue] = useState(() => (current === null ? "" : String(current)));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setSaved(false);
    const checked = validateRate(value);
    if (!checked.ok) return setError(checked.message);
    setBusy(true);
    setError("");
    try {
      const updated = await updateShop(shopId, { deliveryFee: checked.rate });
      patchShop(updated);
      setValue(String(checked.rate));
      setSaved(true);
      window.dispatchEvent(new Event(SHOPS_CHANGED));
    } catch (err) {
      setError(err.message || "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-card" aria-labelledby="fee-title">
      <div className="space-y-1">
        <h2 id="fee-title" className="flex items-center gap-2 text-lg font-extrabold">
          <Truck className="h-5 w-5 text-vibe" aria-hidden="true" />
          Delivery fee per kilometre
        </h2>
        <p className="text-sm text-ink-mute">
          The buyer pays this amount for every kilometre from your shop to where they are. It goes to you in full, and VibeYetu takes
          nothing from it.
        </p>
      </div>

      {current === null ? (
        <p className="rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
          No delivery fee set yet. Until you set one, buyers can only choose pickup from your shop.
        </p>
      ) : (
        <p className="rounded-xl bg-vibe-light px-4 py-3 text-sm font-semibold text-vibe-dark">
          Buyers pay {current === 0 ? "nothing, delivery is free" : `${rateText(current)}. A buyer 20 km away pays ${formatKES(current * 20)}`}.
        </p>
      )}
      {!delivers && (
        <p className="text-sm text-ink-soft">Delivery is switched off for your shop. Turn it on in Settings so buyers can choose it.</p>
      )}

      <form onSubmit={save} className="space-y-3" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="delivery-fee" className="text-sm font-semibold">
            Delivery fee per kilometre (KES)
          </label>
          <input
            id="delivery-fee"
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 10"
            value={value}
            onChange={(e) => {
              setSaved(false);
              setValue(e.target.value.replace(/[^\d]/g, ""));
            }}
            className={inputCls}
          />
          <p className="text-xs text-ink-mute">
            Whole shillings, up to {formatKES(MAX_RATE_PER_KM)} per km. For example, at 10 a buyer 20 km away pays 200. Type 0 for free
            delivery. A new fee applies to orders placed after you save it.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
            Delivery fee saved: {rateText(current ?? Number(value))}.
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Save delivery fee"}
        </Button>
      </form>
    </section>
  );
}
