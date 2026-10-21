import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MapPin } from "lucide-react";
import ProductCard from "../components/ProductCard.jsx";
import { useUserLocation } from "../context/LocationContext.jsx";
import { getCategories, searchProducts } from "../services/api.js";

const chip = (active) =>
  `shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
    active ? "bg-ink text-white" : "bg-white text-ink shadow-card hover:bg-vibe-light"
  }`;

const selectCls = "rounded-full border border-ink/20 bg-white px-4 py-2 text-sm font-medium";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const sort = params.get("sort") || "relevance";
  const { near, location, radiusKm, openPicker } = useUserLocation();

  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getCategories()
      .then((c) => {
        if (live) setCategories(c);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setFailed(false);
    searchProducts({ q, category, sort, near })
      .then((r) => {
        if (live) setResults(r);
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
  }, [q, category, sort, near]);

  function setParam(key, value) {
    const next = new URLSearchParams(params);
    if (value && value !== "relevance") next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 pt-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{q ? `Results for "${q}"` : "Shops near you"}</h1>
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
          <MapPin className="h-4 w-4 text-vibe" aria-hidden="true" />
          Within {radiusKm} km of {location.label}.
          <button type="button" onClick={openPicker} className="font-semibold text-vibe hover:underline">
            Change
          </button>
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Categories">
        <button type="button" onClick={() => setParam("category", "")} className={chip(!category)}>
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setParam("category", c.id)}
            aria-pressed={category === c.id}
            className={chip(category === c.id)}
          >
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={sort} onChange={(e) => setParam("sort", e.target.value)} aria-label="Sort by" className={selectCls}>
          <option value="relevance">Sort: Nearest first</option>
          <option value="price-asc">Price: Low to high</option>
          <option value="price-desc">Price: High to low</option>
          <option value="rating">Top rated</option>
        </select>
        {!loading && !failed && (
          <p className="text-sm text-ink-mute" aria-live="polite">
            {results.length} {results.length === 1 ? "item" : "items"}
          </p>
        )}
      </div>

      {failed ? (
        <p className="rounded-2xl bg-white p-6 text-ink-mute shadow-card">Something went wrong. Please try again.</p>
      ) : loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-ivory-dark" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="space-y-3 rounded-2xl bg-white p-8 text-center shadow-card">
          <p className="text-ink-mute">No products found near you. Try another search, a bigger distance or a different area.</p>
          <button type="button" onClick={openPicker} className="font-semibold text-vibe hover:underline">
            Change location or distance
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {results.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
