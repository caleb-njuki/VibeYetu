// Units sold per product, counted from completed orders saved in the browser.
// The key matches the one used by OrdersContext. The backend counts this later.
const ORDERS_KEY = "vibeyetu_orders_v2";

export function soldCounts() {
  try {
    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
    if (!Array.isArray(orders)) return {};
    const counts = {};
    orders.forEach((o) => {
      if (o.status !== "completed") return;
      (o.items || []).forEach((i) => {
        if (i.productId) counts[i.productId] = (counts[i.productId] || 0) + i.qty;
      });
    });
    return counts;
  } catch {
    return {};
  }
}
