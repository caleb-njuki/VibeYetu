import { createContext, useContext, useMemo, useState } from "react";
import { shopIdsFor } from "../lib/sellers.js";

// Demo seller session. Real email and password checks arrive with the backend.
// A seller can own several shops (branches). `shopId` is the shop they are working on now.
const SellerContext = createContext(null);
const STORAGE_KEY = "vibeyetu_seller";

function save(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the seller stays signed in for this visit.
  }
}

function loadSeller() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed || typeof parsed.email !== "string" || typeof parsed.shopId !== "string") return null;
    // A saved session only counts if the account really owns that shop.
    const ids = shopIdsFor(parsed.email);
    if (ids.includes(parsed.shopId)) return parsed;
    return ids.length ? { ...parsed, shopId: ids[0] } : null;
  } catch {
    return null;
  }
}

export function SellerAuthProvider({ children }) {
  const [seller, setSeller] = useState(loadSeller);

  const value = useMemo(
    () => ({
      seller,
      login: (next) => {
        setSeller(next);
        save(next);
      },
      // Move to another shop (branch) the seller owns. Returns false for any other shop.
      switchShop: (shopId) => {
        if (!seller || !shopIdsFor(seller.email).includes(shopId)) return false;
        const next = { ...seller, shopId };
        setSeller(next);
        save(next);
        return true;
      },
      logout: () => {
        setSeller(null);
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Nothing to clean up.
        }
      },
    }),
    [seller]
  );

  return <SellerContext.Provider value={value}>{children}</SellerContext.Provider>;
}

export function useSeller() {
  const ctx = useContext(SellerContext);
  if (!ctx) throw new Error("useSeller must be used inside SellerAuthProvider");
  return ctx;
}
