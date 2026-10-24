import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import Button from "../components/Button.jsx";
import ProductCard from "../components/ProductCard.jsx";
import ShopAvatar from "../components/ShopAvatar.jsx";
import { getShop } from "../services/api.js";
import { fulfillmentLabel } from "../lib/format.js";
import { formatDistance } from "../lib/geo.js";
import { useUserLocation } from "../context/LocationContext.jsx";

export default function Shop() {
  const { id } = useParams();
  const { near } = useUserLocation();
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getShop(id, near)
      .then((s) => {
        if (live) setShop(s);
      })
      .catch(() => {
        if (live) setShop(null);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, near]);

  if (loading) {
    return <div className="mx-auto h-64 max-w-7xl animate-pulse rounded-3xl bg-ivory-dark" aria-busy="true" />;
  }

  if (!shop) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-3xl font-extrabold">Shop not found</h1>
        <Button to="/search">Browse products</Button>
      </div>
    );
  }

  if (shop.suspended) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-3xl font-extrabold">This shop is not available right now</h1>
        <p className="text-ink-mute">Please check back later, or browse other shops near you.</p>
        <Button to="/search">Browse products</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pt-8">
      <section className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-card sm:flex-row sm:items-center">
        <ShopAvatar shop={shop} className="h-20 w-20 text-3xl" />
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            {shop.name}
            {shop.verified && <BadgeCheck className="h-6 w-6 text-vibe" aria-label="Verified shop" />}
          </h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {shop.area ? `${shop.area}, ${shop.town}` : shop.town}
              {shop.distanceKm !== undefined && ` \u00b7 ${formatDistance(shop.distanceKm)} away`}
            </span>
            {shop.opens && (
              <span>
                Open {shop.opens} to {shop.closes}
                {shop.openNow === false && " (closed now)"}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-vibe text-vibe" aria-hidden="true" />
              {shop.rating.toFixed(1)} ({shop.reviews} reviews)
            </span>
            <span>On VibeYetu since {shop.since}</span>
          </p>
          <p className="text-ink-soft">{shop.description}</p>
          <div className="flex flex-wrap gap-2">
            {shop.fulfillment.map((m) => (
              <span key={m} className="rounded-full bg-vibe-light px-3 py-1 text-xs font-bold text-vibe-dark">
                {fulfillmentLabel(m)}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="shop-products">
        <h2 id="shop-products" className="mb-4 text-2xl font-extrabold">
          Products ({shop.products.length})
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {shop.products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
