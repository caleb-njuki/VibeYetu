import { Minus, Plus } from "lucide-react";

export default function QtyStepper({ value, onChange, min = 1, max = 10 }) {
  return (
    <div className="inline-flex items-center rounded-full border border-ink/20 bg-white">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="rounded-full p-2 hover:bg-ink/5 disabled:opacity-40"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="w-8 text-center text-sm font-bold" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="rounded-full p-2 hover:bg-ink/5 disabled:opacity-40"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
