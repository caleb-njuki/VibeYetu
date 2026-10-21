import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import AdSlide from "./AdSlide.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { reportAd } from "../lib/ads.js";

// Shown when no seller ad is live, so the home page is never empty.
const HOUSE_SLIDE = {
  id: "house",
  house: true,
  theme: "blue",
  headline: "Shop nearby. Pay safely.",
  subtext: "Every order is protected by escrow. Your money is released only when you are happy.",
  cta: "Start shopping",
  to: "/search",
};

const REPORT_REASONS = ["Misleading", "Offensive", "Spam"];

export default function AdCarousel({ ads }) {
  const slides = ads.length > 0 ? ads : [HOUSE_SLIDE];
  const count = slides.length;
  const { user } = useAuth();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const current = index % count;
  const ad = slides[current];

  useEffect(() => {
    if (paused || reportOpen || count < 2) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => setIndex((i) => ((i % count) + 1) % count), 5000);
    return () => clearInterval(id);
  }, [paused, reportOpen, count]);

  useEffect(() => {
    setReportOpen(false);
    setReportMsg("");
  }, [current]);

  function report(reason) {
    const result = reportAd(ad.id, user.phone, reason);
    setReportMsg(result.ok ? "Thank you. We will review this ad." : result.message);
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured offers and ads"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div role="group" aria-roledescription="slide" aria-label={`${current + 1} of ${count}`} className="h-full">
        <AdSlide ad={ad} />
      </div>

      {!ad.house && (
        <button
          type="button"
          onClick={() => setReportOpen((v) => !v)}
          aria-expanded={reportOpen}
          className="absolute bottom-4 left-4 flex items-center gap-1 rounded-full bg-black/30 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/50 sm:bottom-6 sm:left-6"
        >
          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
          Report ad
        </button>
      )}

      {reportOpen && !ad.house && (
        <div className="absolute bottom-14 left-4 z-10 w-60 space-y-2 rounded-2xl bg-white p-3 text-sm text-ink shadow-lg sm:left-6">
          {!user ? (
            <p>
              <Link to="/login" className="font-semibold text-vibe hover:underline">
                Sign in
              </Link>{" "}
              to report this ad.
            </p>
          ) : reportMsg ? (
            <p role="status" className="font-semibold">
              {reportMsg}
            </p>
          ) : (
            <>
              <p className="font-bold">Why are you reporting it?</p>
              <div className="flex flex-wrap gap-1.5">
                {REPORT_REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => report(r)} className="rounded-full border border-ink/20 px-3 py-1 font-semibold hover:bg-vibe-light">
                    {r}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {count > 1 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-2 sm:bottom-6 sm:right-6">
          <button type="button" onClick={() => setIndex((current - 1 + count) % count)} aria-label="Previous ad" className="rounded-full bg-black/30 p-1.5 text-white hover:bg-black/50">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to ad ${i + 1}`}
                aria-current={i === current}
                className={`h-2 rounded-full bg-white/80 transition-all ${i === current ? "w-5" : "w-2 opacity-60"}`}
              />
            ))}
          </div>
          <button type="button" onClick={() => setIndex((current + 1) % count)} aria-label="Next ad" className="rounded-full bg-black/30 p-1.5 text-white hover:bg-black/50">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
