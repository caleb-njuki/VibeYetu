import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "vibeyetu_cart";
const MAX_QTY = 10;

// One cart line is one product in one size. `key` tells lines apart: the same dress in M and in L
// are two lines. A product without sizes uses its id as the key.
export const lineKey = (productId, size) => (size ? `${productId}::${size}` : productId);

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    // A cart saved before sizes existed has no key, so give each line one.
    return parsed.filter((i) => i && typeof i.id === "string").map((i) => ({ ...i, key: i.key || lineKey(i.id, i.size) }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage unavailable: the cart still works for this visit.
    }
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.qty, 0),
      total: items.reduce((n, i) => n + i.qty * i.price, 0),
      // `size` is the raw size ("M" or "42"). Pass it for products that have sizes.
      add: (product, qty = 1, size = "") =>
        setItems((prev) => {
          const key = lineKey(product.id, size);
          const found = prev.find((i) => i.key === key);
          if (found) {
            return prev.map((i) => (i.key === key ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i));
          }
          return [
            ...prev,
            {
              key,
              id: product.id,
              name: product.name,
              price: product.price,
              emoji: product.emoji,
              hue: product.hue,
              shopId: product.shopId,
              shopName: product.shop?.name || "Shop",
              size: size || "",
              sizeType: size ? product.sizeType : "",
              qty: Math.min(MAX_QTY, qty),
            },
          ];
        }),
      setQty: (key, qty) =>
        setItems((prev) => prev.map((i) => (i.key === key ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i))),
      remove: (key) => setItems((prev) => prev.filter((i) => i.key !== key)),
      clear: () => setItems([]),
    }),
    [items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
