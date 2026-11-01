import { useEffect, useRef, useState } from "react";
import Button from "../../components/Button.jsx";
import AdSlide from "../../components/AdSlide.jsx";
import ImageUploader from "../../components/ImageUploader.jsx";
import useNow from "../../hooks/useNow.js";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { getShop } from "../../services/api.js";
import {
  DEFAULT_HEADLINE_COLOR,
  DEFAULT_SUBTEXT_COLOR,
  DURATIONS,
  MIN_CONTRAST,
  PHOTO_HEADLINE_COLOR,
  PHOTO_SUBTEXT_COLOR,
  PRICE_PER_DAY,
  TEXT_COLOR_PRESETS,
  adState,
  checkAd,
  contrastOnWhite,
  createAd,
  listAds,
  stopAd,
} from "../../lib/ads.js";
import { deleteImage, imageSrc } from "../../lib/images.js";
import { formatWhen } from "../../lib/orders.js";
import { formatKES } from "../../lib/format.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";
const TONES = {
  attention: "bg-amber-100 text-amber-900",
  scheduled: "bg-vibe-light text-vibe-dark",
  live: "bg-green-100 text-green-900",
  ended: "bg-ink/10 text-ink-soft",
  refunded: "bg-red-100 text-red-800",
  stopped: "bg-ink/10 text-ink-soft",
};
const LABELS = {
  attention: "Needs attention",
  scheduled: "Scheduled",
  live: "Live",
  ended: "Ended",
  refunded: "Refunded",
  stopped: "Stopped",
};

// Pick a text colour: a few ready colours, or any colour with the colour box.
function ColorField({ id, label, value, onChange }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {TEXT_COLOR_PRESETS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={c.name}
            aria-pressed={value.toLowerCase() === c.value}
            title={c.name}
            onClick={() => onChange(c.value)}
            style={{ backgroundColor: c.value }}
            className={`h-8 w-8 rounded-full border border-ink/25 ${value.toLowerCase() === c.value ? "ring-2 ring-vibe ring-offset-2" : ""}`}
          />
        ))}
        <label htmlFor={id} className="ml-1 flex items-center gap-2 text-xs font-semibold text-ink-soft">
          Any colour
          <input
            id={id}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-10 cursor-pointer rounded border border-ink/25 bg-white p-0.5"
          />
        </label>
      </div>
    </fieldset>
  );
}

export default function SellerAds() {
  const { seller } = useSeller();
  const now = useNow(60000);
  const [ads, setAds] = useState(() => listAds(seller.shopId));
  const [shop, setShop] = useState(null);
  const [headline, setHeadline] = useState("");
  const [subtext, setSubtext] = useState("");
  const [image, setImage] = useState([]); // the ad photo: a list with at most one saved photo id
  const [darken, setDarken] = useState(true);
  const [headlineColor, setHeadlineColor] = useState(DEFAULT_HEADLINE_COLOR);
  const [subtextColor, setSubtextColor] = useState(DEFAULT_SUBTEXT_COLOR);
  const touched = useRef(false); // the seller chose a colour, so do not switch it when a photo is added
  const unsaved = useRef(null); // the photo that is not part of an ad yet
  const [target, setTarget] = useState("shop");
  const [productId, setProductId] = useState("");
  const [days, setDays] = useState(7);
  const [demoDelay, setDemoDelay] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null); // { good, text }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getShop(seller.shopId)
      .then((s) => {
        if (!live || !s) return;
        setShop(s);
        setProductId((cur) => cur || s.products[0]?.id || "");
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [seller.shopId]);

  // A photo that was added but never used in an ad is removed from storage when the seller leaves.
  useEffect(
    () => () => {
      if (unsaved.current) deleteImage(unsaved.current);
    },
    []
  );

  function onPhotoChange(ids) {
    const next = ids.slice(-1);
    const old = image[0];
    if (old && old !== next[0]) deleteImage(old);
    unsaved.current = next[0] || null;
    setImage(next);
    // Light text suits a photo and dark text suits a white ad, until the seller picks their own colours.
    if (!touched.current) {
      setHeadlineColor(next.length ? PHOTO_HEADLINE_COLOR : DEFAULT_HEADLINE_COLOR);
      setSubtextColor(next.length ? PHOTO_SUBTEXT_COLOR : DEFAULT_SUBTEXT_COLOR);
    }
  }

  const pickHeadline = (c) => {
    touched.current = true;
    setHeadlineColor(c);
  };
  const pickSubtext = (c) => {
    touched.current = true;
    setSubtextColor(c);
  };

  const refresh = () => setAds(listAds(seller.shopId));
  const total = days * PRICE_PER_DAY;

  async function submit(e) {
    e.preventDefault();
    if (headline.trim().length < 5 || headline.trim().length > 40) return setError("The headline must have 5 to 40 characters.");
    if (subtext.trim().length > 90) return setError("The extra text can have at most 90 characters.");
    if (target === "product" && !productId) return setError("Choose the product to promote.");
    // On a plain white ad, a very light text colour cannot be read.
    if (!image[0]) {
      if (contrastOnWhite(headlineColor) < MIN_CONTRAST) return setError("Your headline colour is too light to read on a white ad. Pick a darker colour or add a photo.");
      if (subtext.trim() && contrastOnWhite(subtextColor) < MIN_CONTRAST) return setError("Your extra text colour is too light to read on a white ad. Pick a darker colour or add a photo.");
    }
    setError("");
    setNotice(null);
    setBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Demo payment
    const ad = {
      id: "ad" + Date.now().toString(36),
      shopId: seller.shopId,
      headline: headline.trim(),
      subtext: subtext.trim(),
      image: image[0] || "",
      darken: Boolean(image[0]) && darken,
      headlineColor,
      subtextColor,
      target,
      productId: target === "product" ? productId : "",
      days,
      total,
      paid: true,
      createdAt: Date.now(),
      reports: [],
    };
    const issue = demoDelay ? "Payment confirmation is delayed." : checkAd(ad, shop);
    createAd(ad, issue);
    // The photo now belongs to the ad, so it must not be cleaned up when the seller leaves the page.
    unsaved.current = null;
    setImage([]);
    touched.current = false;
    setHeadlineColor(DEFAULT_HEADLINE_COLOR);
    setSubtextColor(DEFAULT_SUBTEXT_COLOR);
    setHeadline("");
    setSubtext("");
    setBusy(false);
    setNotice(
      issue
        ? { good: false, text: `Your payment of ${formatKES(total)} was received, but your ad could not go live yet: ${issue} Our team will sort it out. If it cannot be fixed, you are refunded.` }
        : { good: true, text: `Payment of ${formatKES(total)} received. Your ad is live now for ${days} ${days === 1 ? "day" : "days"}.` }
    );
    refresh();
  }

  const preview = {
    headline: headline.trim() || "Your headline here",
    subtext: subtext.trim() || "A short line that tells shoppers why to visit.",
    image: image[0] || "",
    darken: Boolean(image[0]) && darken,
    headlineColor,
    subtextColor,
    shopName: shop?.name,
    cta: "Shop now",
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold">Ads</h1>
        <p className="text-sm text-ink-mute">
          Show your shop on the home page slideshow to buyers near you. Your ad goes live as soon as your payment is received. Ads cannot contain links or phone numbers.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-card" noValidate>
          <h2 className="text-lg font-extrabold">Create an ad</h2>
          <div className="space-y-1.5">
            <label htmlFor="ad-head" className="text-sm font-semibold">
              Headline
            </label>
            <input id="ad-head" maxLength={40} value={headline} onChange={(e) => setHeadline(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ad-sub" className="text-sm font-semibold">
              Extra text (optional)
            </label>
            <input id="ad-sub" maxLength={90} value={subtext} onChange={(e) => setSubtext(e.target.value)} className={inputCls} />
          </div>

          <div className="space-y-2">
            <ImageUploader label="Ad photo (optional)" value={image} onChange={onPhotoChange} max={1} maxSize={960} />
            <p className="text-xs text-ink-mute">
              A wide, bright photo of your products works best. Without a photo your ad is plain white. Please use only photos you own.
            </p>
            {image[0] && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={darken} onChange={(e) => setDarken(e.target.checked)} className="accent-vibe" />
                Darken the photo a little so the text is easier to read
              </label>
            )}
          </div>

          <ColorField id="ad-head-color" label="Headline colour" value={headlineColor} onChange={pickHeadline} />
          <ColorField id="ad-sub-color" label="Extra text colour" value={subtextColor} onChange={pickSubtext} />

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Where should the ad lead?</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="target" checked={target === "shop"} onChange={() => setTarget("shop")} className="accent-vibe" />
                My shop page
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="target" checked={target === "product"} onChange={() => setTarget("product")} className="accent-vibe" />
                One product
              </label>
            </div>
            {target === "product" && (
              <select aria-label="Product to promote" value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
                {(shop?.products || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="ad-days" className="text-sm font-semibold">
              How long
            </label>
            <select id="ad-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputCls}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} {d === 1 ? "day" : "days"} &middot; {formatKES(d * PRICE_PER_DAY)}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className={`rounded-xl px-4 py-3 text-sm font-semibold ${notice.good ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"}`}>
              {notice.text}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Processing payment..." : `Pay ${formatKES(total)} and go live`}
          </Button>
          <label className="flex items-center gap-2 text-xs text-ink-mute">
            <input type="checkbox" checked={demoDelay} onChange={(e) => setDemoDelay(e.target.checked)} className="accent-vibe" />
            Demo only: pretend the payment confirmation is delayed
          </label>
        </form>

        <div className="space-y-2">
          <h2 className="text-lg font-extrabold">Preview</h2>
          <AdSlide ad={preview} />
        </div>
      </div>

      <section aria-labelledby="my-ads" className="space-y-3">
        <h2 id="my-ads" className="text-lg font-extrabold">
          Your ads
        </h2>
        {ads.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-ink-mute shadow-card">No ads yet.</p>
        ) : (
          <ul className="space-y-3">
            {ads.map((a) => {
              const state = adState(a, now);
              const canStop = state === "attention" || state === "scheduled" || state === "live";
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-card">
                  {imageSrc(a.image) && <img src={imageSrc(a.image)} alt="" className="h-12 w-16 shrink-0 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{a.headline}</p>
                    <p className="text-sm text-ink-mute">
                      {a.days} {a.days === 1 ? "day" : "days"} &middot; {formatKES(a.total)}
                      {a.startsAt && ` \u00b7 ${formatWhen(a.startsAt)} to ${formatWhen(a.endsAt)}`}
                    </p>
                    {state === "attention" && <p className="text-sm font-semibold text-amber-900">Our team is looking into it: {a.issue}</p>}
                    {state === "refunded" && <p className="text-sm font-semibold text-red-700">This ad could not run and you were refunded.</p>}
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${TONES[state]}`}>{LABELS[state]}</span>
                  {canStop && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        stopAd(a.id);
                        refresh();
                      }}
                    >
                      Stop ad
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
