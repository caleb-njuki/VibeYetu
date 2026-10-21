import { useEffect, useState } from "react";
import Button from "../../components/Button.jsx";
import useNow from "../../hooks/useNow.js";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { getShopCatalog } from "../../services/api.js";
import { listOffers, offerState, removeOffer, saveOffer } from "../../lib/offers.js";
import { formatWhen } from "../../lib/orders.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";
const TONES = {
  live: "bg-green-100 text-green-900",
  scheduled: "bg-vibe-light text-vibe-dark",
  paused: "bg-amber-100 text-amber-900",
  ended: "bg-ink/10 text-ink-soft",
};
const LABELS = { live: "Live", scheduled: "Scheduled", paused: "Paused", ended: "Ended" };

const pad = (n) => String(n).padStart(2, "0");
function toLocalInput(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SellerOffers() {
  const { seller } = useSeller();
  const now = useNow(60000);
  const [offers, setOffers] = useState(() => listOffers(seller.shopId));
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [percent, setPercent] = useState("10");
  const [scope, setScope] = useState("all");
  const [selected, setSelected] = useState([]);
  const [start, setStart] = useState(() => toLocalInput(Date.now()));
  const [end, setEnd] = useState(() => toLocalInput(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    getShopCatalog(seller.shopId)
      .then((list) => {
        if (live) setProducts(list.filter((p) => p.active !== false));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [seller.shopId]);

  const refresh = () => setOffers(listOffers(seller.shopId));

  function toggleProduct(id) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function create(e) {
    e.preventDefault();
    const pct = Number(percent);
    const startsAt = new Date(start).getTime();
    const endsAt = new Date(end).getTime();
    if (name.trim().length < 3) return setError("Give the offer a name, like Weekend sale.");
    if (!Number.isInteger(pct) || pct < 5 || pct > 70) return setError("The discount must be a whole number from 5 to 70.");
    if (Number.isNaN(startsAt) || Number.isNaN(endsAt) || endsAt <= startsAt) return setError("The end time must be after the start time.");
    if (scope === "some" && selected.length === 0) return setError("Choose at least one product, or apply the offer to all products.");
    saveOffer({
      id: "o" + Date.now().toString(36),
      shopId: seller.shopId,
      name: name.trim(),
      percent: pct,
      productIds: scope === "all" ? "all" : selected,
      startsAt,
      endsAt,
      active: true,
    });
    setError("");
    setName("");
    setSelected([]);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold">Offers</h1>
        <p className="text-sm text-ink-mute">Run a discount for a set time. Buyers see the old price crossed out.</p>
      </div>

      <form onSubmit={create} className="space-y-4 rounded-2xl bg-white p-5 shadow-card" noValidate>
        <h2 className="text-lg font-extrabold">Create an offer</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div className="space-y-1.5">
            <label htmlFor="o-name" className="text-sm font-semibold">
              Offer name
            </label>
            <input id="o-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="o-pct" className="text-sm font-semibold">
              Discount (%)
            </label>
            <input id="o-pct" inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value.replace(/\D/g, ""))} className={inputCls} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="o-start" className="text-sm font-semibold">
              Starts
            </label>
            <input id="o-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="o-end" className="text-sm font-semibold">
              Ends
            </label>
            <input id="o-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Applies to</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="scope" checked={scope === "all"} onChange={() => setScope("all")} className="accent-vibe" />
              All my products
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="scope" checked={scope === "some"} onChange={() => setScope("some")} className="accent-vibe" />
              Selected products
            </label>
          </div>
          {scope === "some" && (
            <div className="grid gap-1.5 rounded-xl border border-ink/15 p-3 sm:grid-cols-2">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleProduct(p.id)} className="accent-vibe" />
                  {p.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <Button type="submit">Create offer</Button>
      </form>

      <section aria-labelledby="your-offers" className="space-y-3">
        <h2 id="your-offers" className="text-lg font-extrabold">
          Your offers
        </h2>
        {offers.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-ink-mute shadow-card">No offers yet.</p>
        ) : (
          <ul className="space-y-3">
            {offers.map((o) => {
              const state = offerState(o, now);
              const count = o.productIds === "all" ? "All products" : `${o.productIds.length} selected`;
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {o.name} &middot; {o.percent}% off
                    </p>
                    <p className="text-sm text-ink-mute">
                      {count} &middot; {formatWhen(o.startsAt)} to {formatWhen(o.endsAt)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${TONES[state]}`}>{LABELS[state]}</span>
                  <div className="flex gap-1">
                    {state !== "ended" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          saveOffer({ ...o, active: !o.active });
                          refresh();
                        }}
                      >
                        {o.active ? "Pause" : "Resume"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        removeOffer(o.id);
                        refresh();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
