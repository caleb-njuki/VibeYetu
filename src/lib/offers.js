// Seller offers (percentage discounts), kept in the browser for the demo.
const KEY = "vibeyetu_offers";

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable: changes last only for this visit.
  }
}

export const listOffers = (shopId) => read().filter((o) => o.shopId === shopId);

export function saveOffer(offer) {
  write([offer, ...read().filter((o) => o.id !== offer.id)]);
}

export function removeOffer(id) {
  write(read().filter((o) => o.id !== id));
}

// A deleted product leaves every offer that listed it. An offer left with no products is removed.
// Offers for "all" products are not touched.
export function removeProductFromOffers(productId) {
  const next = [];
  read().forEach((o) => {
    if (Array.isArray(o.productIds) && o.productIds.includes(productId)) {
      const rest = o.productIds.filter((id) => id !== productId);
      if (rest.length > 0) next.push({ ...o, productIds: rest });
    } else {
      next.push(o);
    }
  });
  write(next);
}

export function offerState(offer, now = Date.now()) {
  if (!offer.active) return "paused";
  if (now < offer.startsAt) return "scheduled";
  if (now > offer.endsAt) return "ended";
  return "live";
}

// Returns the product with the best live discount applied, if any.
export function applyOffer(product, now = Date.now()) {
  const best = read()
    .filter(
      (o) =>
        o.shopId === product.shopId &&
        offerState(o, now) === "live" &&
        (o.productIds === "all" || (Array.isArray(o.productIds) && o.productIds.includes(product.id)))
    )
    .reduce((max, o) => Math.max(max, o.percent), 0);
  if (!best) return product;
  return {
    ...product,
    originalPrice: product.price,
    price: Math.round(product.price * (1 - best / 100)),
    discountPercent: best,
  };
}
