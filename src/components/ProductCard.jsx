import { Link } from "react-router-dom";
import { BadgeCheck, MapPin, ShoppingBag, Star } from "lucide-react";
import Button from "./Button.jsx";
import { useCart } from "../context/CartContext.jsx";
import { formatKES } from "../lib/format.js";
import ProductImage from "./ProductImage.jsx";
import { formatDistance } from "../lib/geo.js";
import { hasSizes, sizeRange } from "../lib/sizes.js";
import { buyerModes } from "../lib/delivery.js";

export default function ProductCard({ product }) {
  const { add } = useCart();

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-card">
      <Link to={`/product/${product.id}`} className="block" aria-label={product.name}>
        <div className="relative aspect-square overflow-hidden">
          <ProductImage product={product} alt="" className="h-full w-full" />
          {product.discountPercent && (
            <span className="absolute left-2 top-2 rounded-full bg-vibe px-2 py-0.5 text-xs font-bold text-white">
              -{product.discountPercent}%
            </span>
          )}
        </div>
      </Link>
      <div className="space-y-1.5 p-3">
        <Link to={`/product/${product.id}`} className="line-clamp-1 font-semibold hover:text-vibe">
          {product.name}
        </Link>
        {product.shop && (
          <>
            <p className="flex items-center gap-1 text-xs text-ink-mute">
              {product.shop.verified && <BadgeCheck className="h-3.5 w-3.5 text-vibe" aria-label="Verified shop" />}
              <span className="truncate">{product.shop.name}</span>
            </p>
            {product.shop.distanceKm !== undefined && (
              <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-soft">
                <MapPin className="h-3.5 w-3.5 text-vibe" aria-hidden="true" />
                <span className="font-semibold">{formatDistance(product.shop.distanceKm)}</span>
                <span>{buyerModes(product.shop).includes("delivery") ? `\u00b7 ~${product.shop.etaMinutes} min` : "\u00b7 Pickup"}</span>
                {product.shop.openNow === false && <span className="font-semibold text-red-700">{"\u00b7 Closed"}</span>}
              </p>
            )}
          </>
        )}
        {hasSizes(product) && <p className="text-xs text-ink-mute">Sizes {sizeRange(product)}</p>}
        <p className="flex items-center gap-1 text-xs text-ink-soft">
          <Star className="h-3.5 w-3.5 fill-vibe text-vibe" aria-hidden="true" />
          {product.rating ? product.rating.toFixed(1) : "New"}
          {product.sold > 0 && <span className="text-ink-mute">{`\u00b7 ${product.sold} sold`}</span>}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="font-extrabold">
            {formatKES(product.price)}
            {product.originalPrice && (
              <span className="ml-1.5 text-xs font-medium text-ink-mute line-through">{formatKES(product.originalPrice)}</span>
            )}
          </span>
          {hasSizes(product) ? (
            // The buyer must pick a size first, so go to the product page.
            <Button to={`/product/${product.id}`} size="sm" variant="dark" aria-label={`Choose a size for ${product.name}`}>
              Choose size
            </Button>
          ) : (
            <Button size="sm" variant="dark" onClick={() => add(product)} aria-label={`Add ${product.name} to cart`}>
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              Add
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
