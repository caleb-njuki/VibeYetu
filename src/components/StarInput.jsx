import { useState } from "react";
import { Star } from "lucide-react";

// Tap a star to rate from 1 to 5.
export default function StarInput({ value, onChange, label }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="rounded p-1"
        >
          <Star className={`h-8 w-8 ${n <= shown ? "fill-amber-400 text-amber-400" : "text-ink/25"}`} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

// Read-only stars, for showing a rating that was already given.
export function Stars({ value, className = "h-4 w-4" }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${className} ${n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-ink/25"}`} aria-hidden="true" />
      ))}
    </span>
  );
}
