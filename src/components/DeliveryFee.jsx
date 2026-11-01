import { useState } from "react";
import { Truck } from "lucide-react";
import Button from "./Button.jsx";
import { MAX_DELIVERY_FEE, feeText, getDeliveryFee, saveDeliveryFee, validateDeliveryFee } from "../lib/delivery.js";
import { SHOPS_CHANGED } from "../lib/sellers.js";
import { formatKES } from "../lib/format.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";

// The delivery fee this shop charges. `delivers` says whether delivery is switched on in Settings.
export default function DeliveryFee({ shopId, delivers, onChange }) {
  const [current, setCurrent] = useState(() => getDeliveryFee(shopId));
  const [value, setValue] = useState(() => {
    const fee = getDeliveryFee(shopId);
    return fee === null ? "" : String(fee);
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function save(e) {
    e.preventDefault();
    setSaved(false);
    const checked = validateDeliveryFee(value);
    if (!checked.ok) return setError(checked.message);
    const result = saveDeliveryFee(shopId, checked.fee);
    if (!result.ok) return setError(result.message);
    setError("");
    setCurrent(result.fee);
    setValue(String(result.fee));
    setSaved(true);
    window.dispatchEvent(new Event(SHOPS_CHANGED));
    if (onChange) onChange(result.fee);
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-card" aria-labelledby="fee-title">
      <div className="space-y-1">
        <h2 id="fee-title" className="flex items-center gap-2 text-lg font-extrabold">
          <Truck className="h-5 w-5 text-vibe" aria-hidden="true" />
          Delivery fee
        </h2>
        <p className="text-sm text-ink-mute">
          The amount a buyer pays you to have an order delivered. It goes to you in full, and VibeYetu takes nothing from it.
        </p>
      </div>

      {current === null ? (
        <p className="rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
          No delivery fee set yet. Until you set one, buyers can only choose pickup from your shop.
        </p>
      ) : (
        <p className="rounded-xl bg-vibe-light px-4 py-3 text-sm font-semibold text-vibe-dark">
          Buyers pay {current === 0 ? "nothing, delivery is free" : formatKES(current)} for delivery.
        </p>
      )}
      {!delivers && (
        <p className="text-sm text-ink-soft">
          Delivery is switched off for your shop. Turn it on in Settings so buyers can choose it.
        </p>
      )}

      <form onSubmit={save} className="space-y-3" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="delivery-fee" className="text-sm font-semibold">
            Delivery fee (KES)
          </label>
          <input
            id="delivery-fee"
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 200"
            value={value}
            onChange={(e) => {
              setSaved(false);
              setValue(e.target.value.replace(/[^\d]/g, ""));
            }}
            className={inputCls}
          />
          <p className="text-xs text-ink-mute">
            Whole shillings, up to {formatKES(MAX_DELIVERY_FEE)}. Type 0 for free delivery. A new fee applies to orders placed after you
            save it.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
            Delivery fee saved. Buyers now pay {feeText(current)} for delivery.
          </p>
        )}
        <Button type="submit">Save delivery fee</Button>
      </form>
    </section>
  );
}
