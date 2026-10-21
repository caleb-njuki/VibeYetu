// Ratings from buyers who completed an order, kept in the browser for the demo.
// The backend database owns this later; the pages keep calling the same functions.
const KEY = "vibeyetu_ratings";
const SKIP_KEY = "vibeyetu_rating_skips";

function readList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Storage unavailable: the change lasts only for this visit.
  }
}

// kind is "shop" or "product". One rating per order, kind and target.
export function addRating({ orderId, kind, targetId, stars, comment = "" }) {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return false;
  const list = readList(KEY);
  if (list.some((r) => r.orderId === orderId && r.kind === kind && r.targetId === targetId)) return false;
  writeList(KEY, [{ orderId, kind, targetId, stars, comment: comment.trim().slice(0, 200), at: Date.now() }, ...list]);
  return true;
}

export const findRating = (orderId, kind, targetId) =>
  readList(KEY).find((r) => r.orderId === orderId && r.kind === kind && r.targetId === targetId) || null;

export const ratingsFor = (kind, targetId) => readList(KEY).filter((r) => r.kind === kind && r.targetId === targetId);

// Mixes the starting rating with real buyer ratings.
export function withRatings(baseRating, baseCount, kind, targetId) {
  const list = ratingsFor(kind, targetId);
  if (list.length === 0) return { rating: baseRating, count: baseCount };
  const sum = list.reduce((n, r) => n + r.stars, 0);
  const count = baseCount + list.length;
  return { rating: ((baseRating || 0) * baseCount + sum) / count, count };
}

export function skipRating(orderId) {
  const list = readList(SKIP_KEY);
  if (!list.includes(orderId)) writeList(SKIP_KEY, [...list, orderId]);
}

export const wasSkipped = (orderId) => readList(SKIP_KEY).includes(orderId);
