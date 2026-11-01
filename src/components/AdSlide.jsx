import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { imageSrc } from "../lib/images.js";
import { DEFAULT_HEADLINE_COLOR, DEFAULT_SUBTEXT_COLOR, isHexColor } from "../lib/ads.js";

// One ad. Used on the home page, in the seller's preview and in admin review.
// There is no coloured background: an ad is a plain white card, or the seller's photo with the text on top.
// The seller picks the colour of the text. Only valid #rrggbb values are ever used as a colour.
export default function AdSlide({ ad }) {
  const src = imageSrc(ad.image);
  const darken = Boolean(src) && ad.darken !== false;
  const headlineColor = isHexColor(ad.headlineColor) ? ad.headlineColor : DEFAULT_HEADLINE_COLOR;
  const subtextColor = isHexColor(ad.subtextColor) ? ad.subtextColor : DEFAULT_SUBTEXT_COLOR;
  const ctaCls =
    "mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-soft";
  const label = ad.house ? "VibeYetu" : ad.shopName ? `Ad · ${ad.shopName}` : "Ad";

  return (
    <div className="relative flex h-full min-h-[16rem] overflow-hidden rounded-3xl bg-white ring-1 ring-ink/10">
      {src && <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {darken && <div className="absolute inset-0 bg-black/35" aria-hidden="true" />}
      <div className="relative flex w-full flex-col justify-between gap-6 p-6 sm:p-8">
        <span className="w-fit rounded-full bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink-soft ring-1 ring-ink/10">
          {label}
        </span>
        <div className="space-y-2">
          <p className="text-3xl font-extrabold leading-tight sm:text-4xl" style={{ color: headlineColor }}>
            {ad.headline}
          </p>
          {ad.subtext && (
            <p className="max-w-md" style={{ color: subtextColor }}>
              {ad.subtext}
            </p>
          )}
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
    </div>
  );
}
