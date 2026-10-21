import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const THEMES = {
  blue: { box: "bg-vibe text-white", cta: "bg-white text-vibe-dark hover:bg-ivory", sub: "text-white/80", tag: "bg-white/15 text-white" },
  black: { box: "bg-ink text-ivory", cta: "bg-vibe text-white hover:bg-vibe-dark", sub: "text-ivory/70", tag: "bg-white/10 text-ivory" },
  ivory: { box: "bg-white text-ink ring-1 ring-ink/10", cta: "bg-ink text-white hover:bg-ink-soft", sub: "text-ink-soft", tag: "bg-ink/5 text-ink-soft" },
};

export const THEME_NAMES = Object.keys(THEMES);

// One ad. Used on the home page, in the seller's preview and in admin review.
export default function AdSlide({ ad }) {
  const t = THEMES[ad.theme] || THEMES.blue;
  const ctaCls = `mt-4 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${t.cta}`;
  const label = ad.house ? "VibeYetu" : ad.shopName ? `Ad \u00b7 ${ad.shopName}` : "Ad";

  return (
    <div className={`flex h-full min-h-[16rem] flex-col justify-between gap-6 rounded-3xl p-6 sm:p-8 ${t.box}`}>
      <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${t.tag}`}>{label}</span>
      <div className="space-y-2">
        <p className="text-3xl font-extrabold leading-tight sm:text-4xl">{ad.headline}</p>
        {ad.subtext && <p className={`max-w-md ${t.sub}`}>{ad.subtext}</p>}
        {ad.to ? (
          <Link to={ad.to} className={ctaCls}>
            {ad.cta || "Shop now"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className={ctaCls}>
            {ad.cta || "Shop now"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}
