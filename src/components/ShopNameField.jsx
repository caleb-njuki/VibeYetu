import { CheckCircle2, XCircle } from "lucide-react";
import { checkShopName, suggestShopNames } from "../lib/sellers.js";

// A shop name box that checks the name as the seller types.
// The shop name works like a username, so it must be unique. When a name is taken
// the field suggests ways to make it unique, for example by adding the town.
export default function ShopNameField({ id = "shop-name", label = "Shop name", value, onChange, areaId = "", ignoreShopId, hint }) {
  const text = String(value || "");
  const typed = text.trim().length >= 3;
  const check = typed ? checkShopName(text, { ignoreShopId }) : null;
  const suggestions = check && !check.ok && check.taken ? suggestShopNames(text, areaId) : [];
  const border = !check ? "border-ink/20" : check.ok ? "border-green-600" : "border-red-600";

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        maxLength={40}
        autoComplete="off"
        aria-invalid={check ? !check.ok : undefined}
        aria-describedby={`${id}-help`}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe ${border}`}
      />
      <div id={`${id}-help`} className="space-y-1.5">
        {check?.ok && (
          <p role="status" className="flex items-center gap-1.5 text-xs font-semibold text-green-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            This name is available.
          </p>
        )}
        {check && !check.ok && (
          <p role="status" className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            {check.message}
          </p>
        )}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-mute">Try:</span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange(s)}
                className="rounded-full bg-vibe-light px-3 py-1 text-xs font-bold text-vibe-dark hover:bg-vibe hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-ink-mute">
          {hint || "Your shop name works like a username, so it must be unique. Branches can add the town, for example Nairobi Treads Bungoma."}
        </p>
      </div>
    </div>
  );
}
