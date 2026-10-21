import { useEffect, useState } from "react";
import Button from "../../components/Button.jsx";
import { useOrders } from "../../context/OrdersContext.jsx";
import { listAllShops } from "../../services/api.js";
import { setShopFlags } from "../../lib/shopFlags.js";

export default function AdminShops() {
  const { orders } = useOrders();
  const [shops, setShops] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    listAllShops()
      .then((list) => {
        if (live) setShops(list);
      })
      .catch(() => {
        if (live) setShops([]);
      });
    return () => {
      live = false;
    };
  }, [reload]);

  function change(shopId, flags) {
    setShopFlags(shopId, flags);
    setReload((n) => n + 1);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold">Shops</h1>
        <p className="text-sm text-ink-mute">A suspended shop is hidden from buyers. Its products no longer appear in search or on shop pages.</p>
      </div>

      {shops === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-ivory-dark" aria-busy="true" />
      ) : shops.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-ink-mute shadow-card">No shops yet.</p>
      ) : (
        <ul className="divide-y divide-ink/10 rounded-2xl bg-white shadow-card">
          {shops.map((s) => {
            const count = orders.filter((o) => o.shopId === s.id).length;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {s.name}
                    {s.suspended && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">Suspended</span>}
                    {s.verified && !s.suspended && <span className="ml-2 rounded-full bg-vibe-light px-2 py-0.5 text-xs font-bold text-vibe-dark">Verified</span>}
                  </p>
                  <p className="text-sm text-ink-mute">
                    {s.town} &middot; {count} {count === 1 ? "order" : "orders"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => change(s.id, { verified: !s.verified })}>
                    {s.verified ? "Remove verified badge" : "Mark verified"}
                  </Button>
                  <Button variant={s.suspended ? "primary" : "ghost"} size="sm" onClick={() => change(s.id, { suspended: !s.suspended })}>
                    {s.suspended ? "Restore shop" : "Suspend"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
