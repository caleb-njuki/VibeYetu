// Seller ads, kept in the browser for the demo. The backend database owns this later.
// An ad goes live by itself once it is paid and passes the automatic checks.
// Only problems reach the admin ("attention").
const KEY = "vibeyetu_ads";

export const PRICE_PER_DAY = 200;
export const DURATIONS = [1, 3, 7, 14];
export const REPORT_LIMIT = 3; // different buyers who must report an ad before it hides itself
export const MAX_LIVE_ADS = 6; // slides shown at once
const DAY_MS = 24 * 60 * 60 * 1000;
const BLOCKED_WORDS = ["scam", "fake", "free money", "get rich", "guaranteed win", "casino", "betting"];

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

// Newest first. Pass a shopId for one shop, or nothing for every ad (admin).
export function listAds(shopId) {
  return read()
    .filter((a) => !shopId || a.shopId === shopId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function saveAd(ad) {
  write([ad, ...read().filter((a) => a.id !== ad.id)]);
}

export function adState(ad, now = Date.now()) {
  if (ad.status === "stopped") return "stopped";
  if (ad.status === "refunded" || ad.status === "rejected") return "refunded";
  if (ad.status === "attention" || ad.status === "pending") return "attention";
  if (now < ad.startsAt) return "scheduled";
  if (now > ad.endsAt) return "ended";
  return "live";
}

export function adLink(ad) {
  return ad.target === "product" && ad.productId ? `/product/${ad.productId}` : `/shop/${ad.shopId}`;
}

export const liveAds = (now = Date.now()) => read().filter((a) => adState(a, now) === "live");

// The automatic checks. Returns a sentence describing the problem, or null when the ad is fine.
// `shop` is the seller's shop with its live products.
export function checkAd(ad, shop) {
  if (!shop || shop.suspended) return "The shop is not active.";
  const text = `${ad.headline} ${ad.subtext}`.toLowerCase();
  if (BLOCKED_WORDS.some((w) => text.includes(w))) return "The text has a word that is not allowed in ads.";
  if (/(https?:|www\.|\.com|\.co\.ke)/.test(text) || /\d[\d\s-]{7,}\d/.test(text)) return "Ads cannot contain links or phone numbers.";
  if (!shop.products || shop.products.length === 0) return "The shop has no products to show yet.";
  if (ad.target === "product" && !shop.products.some((p) => p.id === ad.productId)) return "The product chosen is not available.";
  return null;
}

// Saves a paid ad. With no issue it goes live right away for the days the seller paid for.
export function createAd(ad, issue) {
  const now = Date.now();
  saveAd(
    issue
      ? { ...ad, status: "attention", issue }
      : { ...ad, status: "approved", startsAt: now, endsAt: now + ad.days * DAY_MS, issue: "" }
  );
}

// Admin: put an ad that needs attention live. Time already used is not given back twice.
export function activateAd(id) {
  const ad = read().find((a) => a.id === id);
  if (!ad || adState(ad) !== "attention") return;
  const now = Date.now();
  const remaining = ad.pausedAt && ad.endsAt ? Math.max(ad.endsAt - ad.pausedAt, 0) : ad.days * DAY_MS;
  saveAd({ ...ad, status: "approved", startsAt: now, endsAt: now + remaining, issue: "", reports: [], pausedAt: null });
}

// Seller or admin stops an ad that is waiting, scheduled or live.
export function stopAd(id) {
  const ad = read().find((a) => a.id === id);
  if (!ad) return;
  const state = adState(ad);
  if (state === "attention" || state === "scheduled" || state === "live") saveAd({ ...ad, status: "stopped" });
}

// Admin: close an ad that could not go live and give the money back.
export function refundAd(id) {
  const ad = read().find((a) => a.id === id);
  if (ad && adState(ad) === "attention") saveAd({ ...ad, status: "refunded" });
}

// A signed-in buyer reports an ad. Enough different buyers hide it until an admin looks.
export function reportAd(id, reporter, reason) {
  const ad = read().find((a) => a.id === id);
  if (!ad) return { ok: false, message: "This ad is no longer running." };
  const reports = ad.reports || [];
  if (reports.some((r) => r.by === reporter)) return { ok: false, message: "You already reported this ad." };
  const next = { ...ad, reports: [...reports, { by: reporter, reason, at: Date.now() }] };
  if (adState(ad) === "live" && next.reports.length >= REPORT_LIMIT) {
    next.status = "attention";
    next.issue = "Hidden after buyer reports.";
    next.pausedAt = Date.now();
  }
  saveAd(next);
  return { ok: true };
}
