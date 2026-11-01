import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import Button from "../../components/Button.jsx";
import CloseShopFlow from "../../components/CloseShopFlow.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { MAX_SHOPS_PER_SELLER, SHOPS_CHANGED, ownedShops } from "../../lib/sellers.js";

// The "Shop" tab of My Shop: the seller's shops and branches, adding a branch and closing a shop.
export default function SellerShop() {
  const { seller, switchShop } = useSeller();
  const [closing, setClosing] = useState(false);
  const [, refresh] = useState(0);

  useEffect(() => {
    const bump = () => refresh((n) => n + 1);
    window.addEventListener(SHOPS_CHANGED, bump);
    return () => window.removeEventListener(SHOPS_CHANGED, bump);
  }, []);

  const mine = ownedShops(seller.email);
  const current = mine.find((s) => s.id === seller.shopId);
  const full = mine.length >= MAX_SHOPS_PER_SELLER;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold">Shop</h1>
        <p className="text-sm text-ink-mute">Manage your shops and branches, and close a shop you no longer run.</p>
      </div>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-card" aria-labelledby="mine-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="mine-title" className="text-lg font-extrabold">
            Your shops ({mine.length} of {MAX_SHOPS_PER_SELLER})
          </h2>
          {!full && (
            <Link to="/my-shop/branches/new" className="flex items-center gap-1 text-sm font-semibold text-vibe hover:underline">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add branch
            </Link>
          )}
        </div>
        <ul className="divide-y divide-ink/10">
          {mine.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
              <span className="font-semibold">{s.name}</span>
              <span className="text-ink-mute">{s.area ? `${s.area}, ${s.town}` : s.town}</span>
              {s.suspended && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">Suspended</span>}
              {s.id === seller.shopId ? (
                <span className="ml-auto rounded-full bg-vibe-light px-3 py-1 text-xs font-bold text-vibe-dark">Working on this</span>
              ) : (
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => switchShop(s.id)}>
                  Switch to this shop
                </Button>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-mute">
          A branch is another shop under the same seller details, for example in another town. It has its own products, orders and
          sales.
          {full && ` You have reached the limit of ${MAX_SHOPS_PER_SELLER} shops. Contact support if you need more.`}
        </p>
      </section>

      <section aria-labelledby="close-title" className="space-y-3 rounded-2xl border border-red-200 bg-white p-5">
        <h2 id="close-title" className="text-lg font-extrabold text-red-800">
          Close this shop
        </h2>
        <p className="text-sm text-ink-soft">
          Closing removes <strong>{current?.name || "this shop"}</strong> and all its products from VibeYetu. We will ask why, check
          that no orders are waiting, and confirm with your password. Just need a break? Hide your products in Inventory instead.
        </p>
        <Button variant="danger" onClick={() => setClosing(true)}>
          Close shop
        </Button>
      </section>

      {closing && <CloseShopFlow onClose={() => setClosing(false)} />}
    </div>
  );
}
