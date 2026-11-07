// Reads "where is the buyer" and paging from a request address, for example
//   /api/products?lat=-1.2864&lng=36.8172&radiusKm=15&limit=20&offset=0
import { httpError } from './httpError.js';

export const DEFAULT_RADIUS_KM = 15;

// A number from text, or null if it is not a plain number.
function toNumber(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Returns { lat, lng, radiusKm }, or null when the buyer sent no location.
export function parseNear(query = {}) {
  if (query.lat === undefined && query.lng === undefined) return null;

  const lat = toNumber(query.lat);
  const lng = toNumber(query.lng);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw httpError(400, 'Your location is not valid. Please choose your area again.');
  }

  let radiusKm = DEFAULT_RADIUS_KM;
  if (query.radiusKm !== undefined) {
    radiusKm = toNumber(query.radiusKm);
    if (radiusKm === null || radiusKm < 1 || radiusKm > 100) {
      throw httpError(400, 'Choose a distance between 1 and 100 km.');
    }
  }
  return { lat, lng, radiusKm };
}

// Returns { limit, offset }.
export function parsePaging(query = {}) {
  let limit = 60;
  let offset = 0;
  if (query.limit !== undefined) {
    limit = toNumber(query.limit);
    if (limit === null || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw httpError(400, 'The limit must be a whole number from 1 to 100.');
    }
  }
  if (query.offset !== undefined) {
    offset = toNumber(query.offset);
    if (offset === null || !Number.isInteger(offset) || offset < 0 || offset > 10000) {
      throw httpError(400, 'The offset must be a whole number from 0 to 10000.');
    }
  }
  return { limit, offset };
}
