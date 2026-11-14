import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair } from "lucide-react";
import { findArea } from "../lib/areas.js";

const NAIROBI = { lat: -1.2864, lng: 36.8172 };
const PIN_HTML =
  '<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16 1C8 1 2 7 2 15c0 10 14 26 14 26s14-16 14-26C30 7 24 1 16 1z" fill="#0f766e" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15" r="5" fill="#fff"/></svg>';

// A free map (OpenStreetMap) where the seller puts a pin on their shop.
// value is { lat, lng } or null. The seller taps the map, drags the pin, or uses their phone's location.
export default function PinPicker({ value, onChange, areaId, label = "Place a pin on your shop" }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const change = useRef(onChange);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  change.current = onChange;

  // Build the map once.
  useEffect(() => {
    const start = value || findArea(areaId) || NAIROBI;
    const m = L.map(box.current, { scrollWheelZoom: false }).setView([start.lat, start.lng], value ? 17 : findArea(areaId) ? 14 : 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    m.on("click", (e) => change.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // The map is built only once. Later changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show the pin (create, move or remove it) whenever the value changes.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) {
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
      }
      return;
    }
    if (!marker.current) {
      marker.current = L.marker([value.lat, value.lng], {
        draggable: true,
        icon: L.divIcon({ html: PIN_HTML, className: "", iconSize: [32, 42], iconAnchor: [16, 41] }),
        alt: "Your shop",
      }).addTo(m);
      marker.current.on("dragend", () => {
        const p = marker.current.getLatLng();
        change.current({ lat: p.lat, lng: p.lng });
      });
    } else {
      marker.current.setLatLng([value.lat, value.lng]);
    }
    if (!m.getBounds().contains([value.lat, value.lng])) m.setView([value.lat, value.lng], Math.max(m.getZoom(), 16));
  }, [value]);

  // When the area changes and there is no pin yet, look at that area.
  useEffect(() => {
    const a = findArea(areaId);
    if (a && map.current && !value) map.current.setView([a.lat, a.lng], 14);
    // Only the area matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("This browser cannot share your location. Tap the map instead.");
      return;
    }
    setStatus("locating");
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("idle");
        change.current({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (map.current) map.current.setView([pos.coords.latitude, pos.coords.longitude], 17);
      },
      (err) => {
        setStatus("error");
        setMessage(err.code === 1 ? "Location is blocked for this site. Tap the map instead." : "We could not find your location. Tap the map instead.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div ref={box} className="z-0 h-64 w-full overflow-hidden rounded-xl border border-ink/20" role="application" aria-label="Map. Tap to place your shop pin." />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={status === "locating"}
          className="flex items-center gap-2 rounded-full border border-ink/30 bg-white px-4 py-2 text-sm font-semibold hover:bg-ink/5 disabled:opacity-60"
        >
          <Crosshair className="h-4 w-4" aria-hidden="true" />
          {status === "locating" ? "Finding you..." : "Use my current location"}
        </button>
        <p className={`text-xs ${value ? "font-semibold text-vibe-dark" : "text-ink-mute"}`}>
          {value ? "Pin placed. Drag it or tap the map to move it." : "Tap the map where your shop is."}
        </p>
      </div>
      {message && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {message}
        </p>
      )}
    </div>
  );
}
