import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BadgeCheck, Clock, MapPin, Share2, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import Button from "../components/Button.jsx";
import ProductCard from "../components/ProductCard.jsx";
import ProductImage from "../components/ProductImage.jsx";
import QtyStepper from "../components/QtyStepper.jsx";
import ShopAvatar from "../components/ShopAvatar.jsx";
import StarInput, { Stars } from "../components/StarInput.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useOrders } from "../context/OrdersContext.jsx";
import { useUserLocation } from "../context/LocationContext.jsx";
import { DELIVERY_FEE, getProduct, getRelated } from "../services/api.js";
import { addRating, findRating, ratingsFor } from "../lib/ratings.js";
import { imageSrc } from "../lib/images.js";
import { formatKES, fulfillmentLabel } from "../lib/format.js";
import { formatDistance } from "../lib/geo.js";
import { formatWhen } from "../lib/orders.js";

function Fact({ icon: Icon, children }) {
  return (
    <li className="flex items-start gap-2 text-sm text-ink-soft">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-vibe" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

export default function Product() {
  const { id } = useParams();
  const { add } = useCart();
  const { orders } = useOrders();
  const { near } = useUserLocation();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState({ fromShop: [], similar: [] });
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [active, setActive] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [rateError, setRateError] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setQty(1);
    setAdded(false);
    setActive(0);
    setStars(0);
    setComment("");
    setRateError("");
    getProduct(id, near)
      .then((p) => {
        if (live) setProduct(p);
      })
      .catch(() => {
        if (live) setProduct(null);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, near]);

  // After a new rating, update the average without showing the loading screen again.
  useEffect(() => {
    if (refresh === 0) return undefined;
    let live = true;
    getProduct(id, near).then((p) => {
      if (live && p) setProduct(p);
    });
    return () => {
      live = false;
    };
  }, [refresh, id, near]);

  useEffect(() => {
    if (!product) return undefined;
    let live = true;
    getRelated(product, near)
      .then((r) => {
        if (live) setRelated(r);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [product?.id, near]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="mx-auto h-96 max-w-6xl animate-pulse rounded-3xl bg-ivory-dark" aria-busy="true" />;
  }

  if (!product) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-3xl font-extrabold">Product not found</h1>
        <p className="text-ink-mute">It may have been removed by the seller.</p>
        <Button to="/search">Browse products</Button>
      </div>
    );
  }

  const { shop } = product;
  const soldOut = product.stock <= 0;
  const maxQty = Math.min(10, Math.max(product.stock, 1));
  const photos = (product.images || []).filter((imgId) => imageSrc(imgId));
  const reviews = ratingsFor("product", product.id);
  const eligibleOrder = orders.find(
    (o) => o.status === "completed" && (o.items || []).some((i) => i.productId === product.id) && !findRating(o.id, "product", product.id)
  );
  const delivers = shop?.fulfillment.includes("delivery");
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(`${product.name} on VibeYetu: ${window.location.href}`)}`;

  function submitRating(e) {
    e.preventDefault();
    if (stars === 0) {
      setRateError("Tap a star to rate.");
      return;
    }
    addRating({ orderId: eligibleOrder.id, kind: "product", targetId: product.id, stars, comment });
    setStars(0);
    setComment("");
    setRateError("");
    setRefresh((n) => n + 1);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pt-8">
      <div>
        <nav className="mb-4 text-sm text-ink-mute" aria-label="Breadcrumb">
          <Link to="/search" className="hover:underline">
            All products
          </Link>
          {" / "}
          <Link to={`/search?category=${product.category}`} className="capitalize hover:underline">
            {product.category}
          </Link>
        </nav>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <ProductImage product={product} index={active} className="aspect-square w-full overflow-hidden rounded-3xl" emojiClass="text-[9rem]" />
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Product photos">
                {photos.map((imgId, i) => (
                  <button
                    key={imgId}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Photo ${i + 1} of ${photos.length}`}
                    aria-current={i === active}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${i === active ? "border-vibe" : "border-transparent"}`}
                  >
                    <img src={imageSrc(imgId)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold">{product.name}</h1>
              <a href="#reviews" className="flex items-center gap-2 text-sm text-ink-soft hover:underline">
                {product.rating ? (
                  <>
                    <Stars value={product.rating} className="h-5 w-5" />
                    <span className="font-semibold">{product.rating.toFixed(1)}</span>
                    <span>({product.ratingCount} ratings)</span>
                  </>
                ) : (
                  <span>No ratings yet</span>
                )}
              </a>
              <p className="flex items-baseline gap-2 text-3xl font-extrabold text-vibe">
                {formatKES(product.price)}
                {product.originalPrice && <span className="text-base font-medium text-ink-mute line-through">{formatKES(product.originalPrice)}</span>}
                {product.discountPercent && <span className="rounded-full bg-vibe px-2 py-0.5 text-xs font-bold text-white">-{product.discountPercent}%</span>}
              </p>
            </div>

            <p className="text-ink-soft">{product.description}</p>

            {shop && (
              <Link to={`/shop/${shop.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card hover:bg-vibe-light">
                <ShopAvatar shop={shop} className="h-11 w-11" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-bold">
                    <span className="truncate">{shop.name}</span>
                    {shop.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-vibe" aria-label="Verified shop" />}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-ink-mute">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {shop.area || shop.town}
                    {shop.distanceKm !== undefined && ` \u00b7 ${formatDistance(shop.distanceKm)} away`}
                  </span>
                </span>
                <span className="text-sm font-semibold text-vibe">Visit shop</span>
              </Link>
            )}

            {soldOut ? (
              <p className="font-bold text-red-700">Out of stock</p>
            ) : (
              <div className="space-y-3">
                {product.stock <= 5 && <p className="text-sm font-semibold text-red-700">Only {product.stock} left</p>}
                <div className="flex flex-wrap items-center gap-3">
                  <QtyStepper value={qty} onChange={(n) => setQty(Math.max(1, Math.min(maxQty, n)))} max={maxQty} />
                  <Button
                    size="lg"
                    onClick={() => {
                      add(product, qty);
                      setAdded(true);
                    }}
                  >
                    <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                    Add to cart
                  </Button>
                </div>
                {added && (
                  <p className="text-sm font-semibold text-vibe-dark" role="status">
                    Added to your cart.{" "}
                    <Link to="/cart" className="underline">
                      View cart
                    </Link>
                  </p>
                )}
              </div>
            )}

            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-vibe hover:underline"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share on WhatsApp
            </a>

            <ul className="space-y-2 rounded-2xl bg-white p-4 shadow-card">
              {shop && (
                <Fact icon={Truck}>
                  {delivers && shop.etaMinutes
                    ? `Delivery in about ${shop.etaMinutes} minutes for ${formatKES(DELIVERY_FEE)}.`
                    : `${shop.fulfillment.map(fulfillmentLabel).join(" and ")} only.`}
                  {delivers && shop.fulfillment.includes("pickup") && " Pickup is free."}
                </Fact>
              )}
              {shop?.opens && (
                <Fact icon={Clock}>
                  Shop open {shop.opens} to {shop.closes}
                  {shop.openNow === false && " (closed now)"}
                </Fact>
              )}
              <Fact icon={ShieldCheck}>Escrow protected. Your money is released only after you and the seller both confirm.</Fact>
            </ul>
          </div>
        </div>
      </div>

      <section id="reviews" aria-labelledby="reviews-title" className="space-y-4 scroll-mt-24">
        <h2 id="reviews-title" className="text-2xl font-extrabold">
          Ratings and reviews
        </h2>

        {eligibleOrder && (
          <form onSubmit={submitRating} className="space-y-3 rounded-2xl bg-white p-5 shadow-card" noValidate>
            <p className="font-bold">You bought this. How is it?</p>
            <StarInput value={stars} onChange={setStars} label="Rate this product" />
            <label htmlFor="p-comment" className="sr-only">
              Review (optional)
            </label>
            <textarea
              id="p-comment"
              rows={2}
              maxLength={200}
              placeholder="Write a short review (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-xl border border-ink/20 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe"
            />
            {rateError && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {rateError}
              </p>
            )}
            <Button type="submit" size="sm">
              Send rating
            </Button>
          </form>
        )}

        {reviews.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-sm text-ink-mute shadow-card">
            No reviews yet. Only buyers who received this product can rate it.
          </p>
        ) : (
          <ul className="space-y-3">
            {reviews.slice(0, 8).map((r) => (
              <li key={`${r.orderId}-${r.at}`} className="space-y-1 rounded-2xl bg-white p-4 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <Stars value={r.stars} />
                  <span className="text-xs text-ink-mute">{formatWhen(r.at)}</span>
                </div>
                {r.comment && <p className="text-sm text-ink-soft">{r.comment}</p>}
                <p className="text-xs font-semibold text-vibe-dark">Verified buyer</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.fromShop.length > 0 && (
        <section aria-labelledby="more-shop" className="space-y-4">
          <h2 id="more-shop" className="text-2xl font-extrabold">
            More from {shop?.name}
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.fromShop.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {related.similar.length > 0 && (
        <section aria-labelledby="similar" className="space-y-4">
          <h2 id="similar" className="text-2xl font-extrabold">
            Similar products near you
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.similar.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
