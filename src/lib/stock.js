// Stock changes caused by orders: dispatch takes stock out, a confirmed return
// puts it back. Kept in the browser for the demo; the backend owns this later.
// A product with sizes keeps one change per size, under the key "productId::size".
import { isSizeType } from "./sizes.js";

const KEY = "vibeyetu_stock_changes";

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function write(changes) {
  try {
    localStorage.setItem(KEY, JSON.stringify(changes));
  } catch {
    // Storage unavailable: the change lasts only for this visit.
  }
}

const keyOf = (productId, size) => (size ? `${productId}::${size}` : productId);

export function adjustStock(productId, delta, size) {
  const changes = read();
  const key = keyOf(productId, size);
  changes[key] = (Number(changes[key]) || 0) + delta;
  write(changes);
}

// When a seller types new stock numbers, they replace everything the orders changed before.
export function resetStock(productId) {
  const changes = read();
  Object.keys(changes).forEach((key) => {
    if (key === productId || key.startsWith(`${productId}::`)) delete changes[key];
  });
  write(changes);
}

export function withStock(product) {
  const changes = read();
  if (isSizeType(product.sizeType) && product.sizes && typeof product.sizes === "object") {
    const sizes = {};
    let total = 0;
    Object.entries(product.sizes).forEach(([size, n]) => {
      const left = Math.max(0, (Number(n) || 0) + (Number(changes[keyOf(product.id, size)]) || 0));
      sizes[size] = left;
      total += left;
    });
    return { ...product, sizes, stock: total };
  }
  const delta = Number(changes[product.id]) || 0;
  return { ...product, stock: Math.max(0, product.stock + delta) };
}
