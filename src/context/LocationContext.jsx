import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AREAS, findArea } from "../lib/areas.js";
import { distanceKm } from "../lib/geo.js";

// Where the buyer is. Search, the home page and ads only show shops near this point.
const LocationContext = createContext(null);
const STORAGE_KEY = "vibeyetu_location";

export const RADII = [5, 10, 15, 25];
const DEFAULT_RADIUS = 15;
const DEFAULT_LOCATION = { lat: -1.2864, lng: 36.8172, label: "Nairobi CBD", source: "default", areaId: "cbd" };

const areaLabel = (a) => (a.name.includes(a.town) ? a.name : `${a.name}, ${a.town}`);

function load() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (p && typeof p.lat === "number" && typeof p.lng === "number" && typeof p.label === "string") {
      return {
        location: { lat: p.lat, lng: p.lng, label: p.label, source: p.source || "area", areaId: p.areaId || "" },
        radiusKm: RADII.includes(p.radiusKm) ? p.radiusKm : DEFAULT_RADIUS,
      };
    }
  } catch {
    // Unreadable saved location: use the default below.
  }
  return { location: DEFAULT_LOCATION, radiusKm: DEFAULT_RADIUS };
}

export function LocationProvider({ children }) {
  const [state, setState] = useState(load);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state.location, radiusKm: state.radiusKm }));
    } catch {
      // Storage unavailable: the location lasts only for this visit.
    }
  }, [state]);

  // Keeps the same object until the point or distance really changes,
  // so pages do not reload their data when only the picker opens.
  const near = useMemo(
    () => ({ lat: state.location.lat, lng: state.location.lng, radiusKm: state.radiusKm }),
    [state.location.lat, state.location.lng, state.radiusKm]
  );

  const value = useMemo(
    () => ({
      location: state.location,
      radiusKm: state.radiusKm,
      near,
      pickerOpen,
      openPicker: () => setPickerOpen(true),
      closePicker: () => setPickerOpen(false),
      setArea: (id) => {
        const a = findArea(id);
        if (!a) return;
        setState((s) => ({ ...s, location: { lat: a.lat, lng: a.lng, label: areaLabel(a), source: "area", areaId: a.id } }));
      },
      setCoords: (lat, lng) => {
        const closest = AREAS.map((a) => ({ a, km: distanceKm({ lat, lng }, a) })).sort((x, y) => x.km - y.km)[0];
        const label = closest && closest.km <= 30 ? `Near ${closest.a.name}` : "Your location";
        setState((s) => ({ ...s, location: { lat, lng, label, source: "gps", areaId: "" } }));
      },
      setRadius: (km) => {
        if (RADII.includes(km)) setState((s) => ({ ...s, radiusKm: km }));
      },
    }),
    [state, near, pickerOpen]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useUserLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useUserLocation must be used inside LocationProvider");
  return ctx;
}
