import { createContext, useContext, useMemo, useState } from "react";

// Demo seller session. Real email and password checks arrive with the backend.
const SellerContext = createContext(null);
const STORAGE_KEY = "vibeyetu_seller";

function loadSeller() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return parsed && typeof parsed.email === "string" && typeof parsed.shopId === "string" ? parsed : null;
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
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Storage unavailable: the seller stays signed in for this visit.
        }
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
