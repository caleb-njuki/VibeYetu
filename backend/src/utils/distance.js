// Straight-line distance between two points on the map, in kilometres (Haversine formula).
export function kmBetween(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const MAX_DELIVERY_KM = 40; // the same as the widest search distance in the app
export const MAX_RATE_PER_KM = 200; // what a shop may charge per kilometre, in whole shillings

// The delivery fee: the shop's rate per kilometre times the distance, to the nearest shilling.
export const deliveryFeeFor = (ratePerKm, km) => Math.round(ratePerKm * km);
