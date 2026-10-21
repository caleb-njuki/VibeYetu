import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { compressImage, imageSrc, saveImage } from "../lib/images.js";

// Pick photos from the phone or computer. `value` is a list of saved photo ids.
export default function ImageUploader({ label, value, onChange, max = 4 }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const room = max - value.length;

  async function onPick(e) {
    const files = [...e.target.files];
    e.target.value = "";
    if (files.length === 0 || room <= 0) return;
    setError("");
    setBusy(true);
    const added = [];
    try {
      for (const file of files.slice(0, room)) {
        added.push(saveImage(await compressImage(file)));
      }
      if (files.length > room) setError(`Only ${max} ${max === 1 ? "photo is" : "photos are"} allowed.`);
    } catch (err) {
      setError(err.message || "We could not add this photo.");
    } finally {
      if (added.length > 0) onChange([...value, ...added]);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-3">
        {value.map((id, i) => (
          <PhotoTile key={id} id={id} main={max > 1 && i === 0} onRemove={() => onChange(value.filter((x) => x !== id))} />
        ))}
        {room > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-ink/25 text-xs font-semibold text-ink-soft hover:bg-ink/5 disabled:opacity-60"
          >
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
            {busy ? "Adding..." : "Add photo"}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple={max > 1} onChange={onPick} className="sr-only" tabIndex={-1} aria-hidden="true" />
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}


function PhotoTile({ id, main, onRemove }) {
  return (
    <div className="relative h-24 w-24">
      <img src={imageSrc(id)} alt="" className="h-full w-full rounded-xl object-cover" />
      {main && <span className="absolute bottom-1 left-1 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-bold text-white">Main</span>}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow-card hover:bg-red-50"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
