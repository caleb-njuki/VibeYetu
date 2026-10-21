// Stock changes caused by orders: dispatch takes stock out, a confirmed return
// puts it back. Kept in the browser for the demo; the backend owns this later.
const KEY = "vibeyetu_stock_changes";

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function adjustStock(productId, delta) {
  const changes = read();
  changes[productId] = (Number(changes[productId]) || 0) + delta;
  try {
    localStorage.setItem(KEY, JSON.stringify(changes));
  } catch {
    // Storage unavailable: the change lasts only for this visit.
  }
}

export function withStock(product) {
  const delta = Number(read()[product.id]) || 0;
  return { ...product, stock: Math.max(0, product.stock + delta) };
}
