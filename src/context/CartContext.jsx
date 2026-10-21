import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "vibeyetu_cart";
const MAX_QTY = 10;

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
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
      add: (product, qty = 1) =>
        setItems((prev) => {
          const found = prev.find((i) => i.id === product.id);
          if (found) {
            return prev.map((i) =>
              i.id === product.id ? { ...i, qty: Math.min(MAX_QTY, i.qty + qty) } : i
            );
          }
          return [
            ...prev,
            {
              id: product.id,
              name: product.name,
              price: product.price,
              emoji: product.emoji,
              hue: product.hue,
              shopId: product.shopId,
              shopName: product.shop?.name || "Shop",
              qty: Math.min(MAX_QTY, qty),
            },
          ];
        }),
      setQty: (id, qty) =>
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, qty: Math.max(1, Math.min(MAX_QTY, qty)) } : i))
        ),
      remove: (id) => setItems((prev) => prev.filter((i) => i.id !== id)),
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
