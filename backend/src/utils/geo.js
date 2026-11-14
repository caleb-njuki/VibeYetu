// Where a shop is, and how far buyers can search.
export const MAX_RADIUS_KM = 40; // buyers only see shops within this distance

// A rough box around Kenya. A pin outside it is a mistake (for example a swapped latitude and longitude).
const KENYA = { minLat: -4.9, maxLat: 5.1, minLng: 33.8, maxLng: 42.0 };

// Returns { lat, lng } (rounded to 6 decimals, about 10 cm), or null when no pin was sent. Throws a plain message otherwise.
export function readPin(lat, lng, fail) {
  if (lat === undefined && lng === undefined) return null;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw fail('Place the pin on the map to show where your shop is.');
  }
  if (lat < KENYA.minLat || lat > KENYA.maxLat || lng < KENYA.minLng || lng > KENYA.maxLng) {
    throw fail('That pin is outside Kenya. Move it to where your shop is.');
  }
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}
