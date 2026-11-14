import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Crosshair, MapPin, X } from "lucide-react";
import { RADII, useUserLocation } from "../context/LocationContext.jsx";

function Picker({ onClose }) {
  const { location, radiusKm, setCoords, setRadius } = useUserLocation();
  const [status, setStatus] = useState("idle"); // idle, locating or error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("This browser cannot share your location. Try another browser or phone.");
      return;
    }
    setStatus("locating");
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords(pos.coords.latitude, pos.coords.longitude);
        setStatus("idle");
        onClose();
      },
      (err) => {
        setStatus("error");
        setMessage(
          err.code === 1
            ? "Location is blocked for this site. Allow location for VibeYetu in your browser settings, then try again."
            : "We could not find your location. Check that location is turned on, then try again."
        );
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }

  const chip = (on) =>
    `rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? "border-vibe bg-vibe-light text-vibe-dark" : "border-ink/20 hover:bg-ink/5"}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/60 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="loc-title" className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="loc-title" className="text-xl font-extrabold">
              Where are you?
            </h2>
            <p className="text-sm text-ink-mute">We show shops near you, so your order arrives fast. Your location stays on your device.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-ink/5">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={status === "locating"}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-vibe px-5 py-3 text-sm font-semibold text-white hover:bg-vibe-dark disabled:opacity-60"
          >
            <Crosshair className="h-4 w-4" aria-hidden="true" />
            {status === "locating" ? "Finding you..." : location.source === "gps" ? "Update my location" : "Use my location"}
          </button>
          {message && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-mute">Show shops within</h3>
          <div className="flex flex-wrap gap-2">
            {RADII.map((km) => (
              <button key={km} type="button" aria-pressed={radiusKm === km} onClick={() => setRadius(km)} className={chip(radiusKm === km)}>
                {km} km
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// The location button in the navbar. Also shows the picker when it is opened from anywhere.
export default function LocationChip() {
  const { location, pickerOpen, openPicker, closePicker } = useUserLocation();

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-label={`Your location: ${location.label}. Change`}
        className="flex max-w-[11rem] items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-semibold shadow-card hover:bg-vibe-light"
      >
        <MapPin className="h-4 w-4 shrink-0 text-vibe" aria-hidden="true" />
        <span className="truncate">{location.label}</span>
      </button>
      {pickerOpen && createPortal(<Picker onClose={closePicker} />, document.body)}
    </>
  );
}
