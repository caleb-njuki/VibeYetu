// Finds the name of a place from a map pin, for example "Westlands" and "Nairobi".
// Uses OpenStreetMap's free Nominatim service. If it cannot be reached, the name is left empty and the shop still works.
export async function placeFor(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=en&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { placeName: "", placeTown: "" };
    const a = (await res.json())?.address || {};
    const town = a.city || a.town || a.municipality || a.county || a.state_district || "";
    const name = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.village || a.hamlet || a.town || a.city || a.county || "";
    return { placeName: String(name).slice(0, 60), placeTown: String(town).slice(0, 60) };
  } catch {
    return { placeName: "", placeTown: "" };
  }
}
