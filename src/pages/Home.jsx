import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Banknote, BadgeCheck, KeyRound, Lock, PackageCheck, ShieldCheck, Smartphone } from "lucide-react";
import Button from "../components/Button.jsx";
import ProductCard from "../components/ProductCard.jsx";
import ShopCard from "../components/ShopCard.jsx";
import AdCarousel from "../components/AdCarousel.jsx";
import { useUserLocation } from "../context/LocationContext.jsx";
import { getCategories, getHome, getLiveAds } from "../services/api.js";

const STEPS = [
  { icon: Lock, title: "You pay", text: "Your money is held safely in escrow." },
  { icon: PackageCheck, title: "You receive", text: "Inspect your item at delivery or pickup." },
  { icon: KeyRound, title: "Both confirm", text: "You and the seller enter your receipt code." },
  { icon: Banknote, title: "Seller is paid", text: "Funds are released only after both confirm." },
];

const TRUST = [
  { icon: ShieldCheck, title: "Escrow on every order", text: "No seller is paid until you are happy." },
  { icon: Smartphone, title: "M-Pesa or card", text: "Pay the way you already do." },
  { icon: BadgeCheck, title: "Checked sellers", text: "Identity and payout details are reviewed." },
];

const EMPTY_HOME = { total: 0, offers: [], newArrivals: [], bestSellers: [], shops: [] };

function Section({ id, title, hint, children }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div>
        <h2 id={id} className="text-2xl font-extrabold">
          {title}
        </h2>
        {hint && <p className="text-sm text-ink-mute">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// Scrolls sideways on phones and becomes a grid on larger screens.
function Row({ wide = false, children }) {
  return (
    <div
      className={`-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:overflow-visible md:px-0 ${
        wide ? "md:grid-cols-3" : "md:grid-cols-4"
      }`}
    >
      {children}
    </div>
  );
}

function ProductRow({ products }) {
  return (
    <Row>
      {products.map((p) => (
        <div key={p.id} className="w-44 shrink-0 snap-start md:w-auto">
          <ProductCard product={p} />
        </div>
      ))}
    </Row>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-ivory-dark" />
      ))}
    </div>
  );
}

export default function Home() {
  const { near, location, radiusKm, openPicker } = useUserLocation();
  const [categories, setCategories] = useState([]);
  const [home, setHome] = useState(EMPTY_HOME);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([getCategories(), getHome(near), getLiveAds(near).catch(() => [])])
      .then(([c, h, a]) => {
        if (!live) return;
        setCategories(c);
        setHome(h);
        setAds(a);
        setFailed(false);
      })
      .catch(() => {
        if (live) setFailed(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [near]);

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-4 pt-8">
      {location.source === "default" && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-vibe-light px-4 py-3 text-sm text-vibe-dark">
          Showing shops near {location.label}.
          <button type="button" onClick={openPicker} className="font-semibold underline">
            Use my location
          </button>
        </p>
      )}

      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <p className="inline-block rounded-full bg-vibe-light px-3 py-1 text-xs font-bold uppercase tracking-wider text-vibe-dark">
            Karibu VibeYetu
          </p>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
            Shop with confidence. <span className="text-vibe">Pay with escrow.</span>
          </h1>
          <p className="max-w-lg text-ink-soft">
            Buy from shops near you. Your money stays protected until you have received your item and confirmed it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button to="/search" size="lg">
              Start shopping
            </Button>
            <Button to="/my-shop" variant="outline" size="lg">
              Sell on VibeYetu
            </Button>
          </div>
        </div>
        <AdCarousel ads={ads} />
      </section>

      <Section id="cat-title" title="Shop by category">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {categories.map((c) => (
            <Link
              key={c.id}
              to={`/search?category=${c.id}`}
              className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 text-center shadow-card transition-colors hover:bg-vibe-light"
            >
              <span className="text-3xl" aria-hidden="true">
                {c.emoji}
              </span>
              <span className="text-sm font-semibold">{c.name}</span>
            </Link>
          ))}
        </div>
      </Section>

      {failed ? (
        <p className="rounded-2xl bg-white p-6 text-ink-mute shadow-card">We could not load products. Please refresh the page.</p>
      ) : loading ? (
        <>
          <SkeletonRow />
          <SkeletonRow />
        </>
      ) : home.total === 0 ? (
        <div className="space-y-3 rounded-2xl bg-white p-8 text-center shadow-card">
          <p className="text-ink-mute">No shops within {radiusKm} km of you yet. Try a bigger distance or another area.</p>
          <Button onClick={openPicker}>Change location</Button>
        </div>
      ) : (
        <>
          {home.offers.length > 0 && (
            <Section id="offers-title" title="Offers near you" hint="Discounts from shops close to you, for a limited time.">
              <ProductRow products={home.offers} />
            </Section>
          )}

          {home.shops.length > 0 && (
            <Section id="shops-title" title="Shops near you" hint="Nearest first.">
              <Row wide>
                {home.shops.map((s) => (
                  <div key={s.id} className="w-64 shrink-0 snap-start md:w-auto">
                    <ShopCard shop={s} />
                  </div>
                ))}
              </Row>
            </Section>
          )}

          <Section id="new-title" title="New arrivals" hint="Fresh products from shops near you.">
            <ProductRow products={home.newArrivals} />
          </Section>

          {home.bestSellers.length > 0 && (
            <Section id="best-title" title="Best sellers" hint="What your neighbours are buying.">
              <ProductRow products={home.bestSellers} />
            </Section>
          )}

          <div className="text-center">
            <Button to="/search" variant="outline" size="lg">
              Browse everything near you
            </Button>
          </div>
        </>
      )}

      <Section id="how-title" title="How escrow protects you">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-card">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold text-ink-mute">Step {i + 1}</p>
                <p className="font-bold">{title}</p>
                <p className="text-sm text-ink-mute">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Why VibeYetu">
        {TRUST.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-card">
            <Icon className="mt-0.5 h-6 w-6 shrink-0 text-vibe" aria-hidden="true" />
            <div>
              <p className="font-bold">{title}</p>
              <p className="text-sm text-ink-mute">{text}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
