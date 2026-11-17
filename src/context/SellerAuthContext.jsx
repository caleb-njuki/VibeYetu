import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SESSION_EXPIRED, get, getToken, setToken } from "../services/http.js";

// The signed-in seller. A seller can own several shops (branches). `shopId` is the shop they are working on now.
// The shops come from the server and are kept here, so pages can read them without waiting.
//   seller = { id, email, fullName, phone, shopId, shops: [{ id, name, area, town, suspended, ... }] }
const SellerContext = createContext(null);
const STORAGE_KEY = "vibeyetu_seller";
export const SHOPS_REFRESH = "vibeyetu:shops-changed"; // same name the pages already fire after a rename or a new branch

function save(next) {
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the seller stays signed in for this visit.
  }
}

function loadSeller() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed || typeof parsed.email !== "string" || !Array.isArray(parsed.shops) || !getToken("seller")) return null;
    return parsed.shops.some((s) => s.id === parsed.shopId) ? parsed : parsed.shops.length ? { ...parsed, shopId: parsed.shops[0].id } : null;
  } catch {
    return null;
  }
}

// Keeps the shop the seller was on if it still exists, otherwise the first one.
const withShops = (seller, shops, preferred) => {
  const want = preferred || seller?.shopId;
  return { ...seller, shops, shopId: shops.some((s) => s.id === want) ? want : shops[0]?.id || "" };
};

export function SellerAuthProvider({ children }) {
  const [seller, setSeller] = useState(loadSeller);

  const refresh = useCallback(async () => {
    if (!getToken("seller")) return;
    try {
      const data = await get("/auth/seller/me", "seller");
      setSeller((s) => {
        if (!s) return s;
        const next = withShops({ ...s, ...data.seller }, data.shops);
        save(next);
        return next;
      });
    } catch {
      // A bad token signs the seller out through the session-expired event. Other errors keep what we have.
    }
  }, []);

  useEffect(() => {
    const onExpired = (e) => {
      if (e.detail === "seller") {
        setSeller(null);
        save(null);
      }
    };
    window.addEventListener(SESSION_EXPIRED, onExpired);
    // Pages fire this after a rename, a new branch or a closed shop: read the shop list again.
    window.addEventListener(SHOPS_REFRESH, refresh);
    return () => {
      window.removeEventListener(SESSION_EXPIRED, onExpired);
      window.removeEventListener(SHOPS_REFRESH, refresh);
    };
  }, [refresh]);

  // On opening the site with a saved login, check it is still good and get the newest shop list.
  useEffect(() => {
    if (seller) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      seller,
      shops: seller?.shops || [],
      // The shop the seller is working on right now, in full.
      shop: seller?.shops?.find((s) => s.id === seller.shopId) || null,
      // login({ seller, shops, token }, preferredShopId?). Used after sign-in and after sign-up.
      login: ({ seller: who, shops, token }, preferredShopId) => {
        if (token) setToken("seller", token);
        const next = withShops(who, shops, preferredShopId);
        setSeller(next);
        save(next);
      },
      // A branch was just opened: add it to the list and work on it.
      addShop: (shop) => {
        if (!seller) return;
        const next = { ...seller, shops: [...seller.shops.filter((s) => s.id !== shop.id), shop], shopId: shop.id };
        setSeller(next);
        save(next);
      },
      // The shop's details were saved: keep the copy in memory in step with the server.
      patchShop: (shop) => {
        if (!seller) return;
        const next = { ...seller, shops: seller.shops.map((s) => (s.id === shop.id ? shop : s)) };
        setSeller(next);
        save(next);
      },
      // After a password change the server gives a fresh token.
      replaceToken: (token) => setToken("seller", token),
      refresh,
      // Move to another shop (branch) the seller owns. Returns false for any other shop.
      switchShop: (shopId) => {
        if (!seller || !seller.shops.some((s) => s.id === shopId)) return false;
        const next = { ...seller, shopId };
        setSeller(next);
        save(next);
        return true;
      },
      logout: () => {
        setToken("seller", "");
        setSeller(null);
        save(null);
      },
    }),
    [seller, refresh]
  );

  return <SellerContext.Provider value={value}>{children}</SellerContext.Provider>;
}

export function useSeller() {
  const ctx = useContext(SellerContext);
  if (!ctx) throw new Error("useSeller must be used inside SellerAuthProvider");
  return ctx;
}
