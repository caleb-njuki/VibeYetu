import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Crosshair, MapPin, X } from "lucide-react";
import { RADII, useUserLocation } from "../context/LocationContext.jsx";
import { AREAS, TOWNS } from "../lib/areas.js";

function Picker({ onClose }) {
  const { location, radiusKm, setArea, setCoords, setRadius } = useUserLocation();
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
      setMessage("This browser cannot share your location. Choose your area below.");
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
            ? "Location is blocked for this site. Choose your area below."
            : "We could not find your location. Choose your area below."
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
            <p className="text-sm text-ink-mute">We show shops near you, so your order arrives fast.</p>
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
            {status === "locating" ? "Finding you..." : "Use my current location"}
          </button>
          {message && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {message}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-mute">Or choose your area</h3>
          {TOWNS.map((town) => (
            <div key={town} className="space-y-1.5">
              <p className="text-sm font-bold">{town}</p>
              <div className="flex flex-wrap gap-2">
                {AREAS.filter((a) => a.town === town).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={location.areaId === a.id}
                    onClick={() => {
                      setArea(a.id);
                      onClose();
                    }}
                    className={chip(location.areaId === a.id)}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
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
