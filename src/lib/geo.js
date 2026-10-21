const EARTH_KM = 6371;
const rad = (deg) => (deg * Math.PI) / 180;

export const hasLocation = (place) => typeof place?.lat === "number" && typeof place?.lng === "number";

// Straight-line distance in kilometres between two {lat, lng} points.
export function distanceKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

export function formatDistance(km) {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

// A simple city estimate: 15 minutes to prepare and hand over, plus travel time.
export function etaMinutes(km) {
  return Math.max(15, Math.round((15 + km * 4) / 5) * 5);
}

// Opening times are "HH:MM" strings. Returns null when the shop has not set them.
export function isOpenNow(shop, date = new Date()) {
  if (typeof shop.opens !== "string" || typeof shop.closes !== "string") return null;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const [oh, om] = shop.opens.split(":").map(Number);
  const [ch, cm] = shop.closes.split(":").map(Number);
  const open = oh * 60 + om;
  const close = ch * 60 + cm;
  return close > open ? minutes >= open && minutes < close : minutes >= open || minutes < close;
}

// Adds distance, delivery time and open or closed to a shop, from the buyer's point of view.
export function withDistance(shop, near) {
  const km = distanceKm(near, shop);
  return { ...shop, distanceKm: km, etaMinutes: etaMinutes(km), openNow: isOpenNow(shop) };
}
