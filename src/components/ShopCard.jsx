import { Link } from "react-router-dom";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import { formatDistance } from "../lib/geo.js";
import ShopAvatar from "./ShopAvatar.jsx";

export default function ShopCard({ shop }) {
  const delivers = shop.fulfillment?.includes("delivery");
  return (
    <Link
      to={`/shop/${shop.id}`}
      className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card transition-colors hover:bg-vibe-light"
    >
      <ShopAvatar shop={shop} />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex items-center gap-1 font-bold">
          <span className="truncate">{shop.name}</span>
          {shop.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-vibe" aria-label="Verified shop" />}
        </span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft">
          <MapPin className="h-3.5 w-3.5 text-vibe" aria-hidden="true" />
          <span className="font-semibold">
            {shop.distanceKm !== undefined ? formatDistance(shop.distanceKm) : shop.area || shop.town}
          </span>
          <span>{delivers && shop.etaMinutes ? `\u00b7 ~${shop.etaMinutes} min` : "\u00b7 Pickup"}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-mute">
          <Star className="h-3.5 w-3.5 fill-vibe text-vibe" aria-hidden="true" />
          <span>{shop.rating ? `${shop.rating.toFixed(1)} (${shop.reviews})` : "New shop"}</span>
          {shop.openNow === true && <span className="font-semibold text-green-800">{"\u00b7 Open"}</span>}
          {shop.openNow === false && <span className="font-semibold text-red-700">{"\u00b7 Closed"}</span>}
        </span>
      </span>
    </Link>
  );
}
