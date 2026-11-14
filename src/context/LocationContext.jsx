import { createContext, useContext, useEffect, useMemo, useState } from "react";

// Where the buyer is. Search, the home page and ads only show shops near this point.
// The point always comes from the phone or browser (GPS). Buyers choose only how far to look.
const LocationContext = createContext(null);
const STORAGE_KEY = "vibeyetu_location";

export const RADII = [10, 20, 40];
const DEFAULT_RADIUS = 20;
// Until the buyer shares their location we look around Nairobi CBD, and the button says so.
const DEFAULT_LOCATION = { lat: -1.2864, lng: 36.8172, label: "Set my location", source: "default" };

function load() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (p && p.source === "gps" && typeof p.lat === "number" && typeof p.lng === "number") {
      return {
        location: { lat: p.lat, lng: p.lng, label: "My location", source: "gps" },
        radiusKm: RADII.includes(p.radiusKm) ? p.radiusKm : DEFAULT_RADIUS,
      };
    }
    // An older saved area or radius is dropped; only the distance is kept when it is still allowed.
    if (p && RADII.includes(p.radiusKm)) return { location: DEFAULT_LOCATION, radiusKm: p.radiusKm };
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
      setCoords: (lat, lng) => {
        setState((s) => ({ ...s, location: { lat, lng, label: "My location", source: "gps" } }));
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
