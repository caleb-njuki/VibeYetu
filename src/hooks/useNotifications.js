import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrders } from "../context/OrdersContext.jsx";
import useNow from "./useNow.js";
import { buildNotifications } from "../lib/orders.js";

const MAX_STORED = 500;

function load(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Notifications for one side of the marketplace. role is "buyer" or "seller".
// Sellers pass their shopId so they only see their own orders.
export default function useNotifications(role, shopId = "me") {
  const { orders } = useOrders();
  const now = useNow(60000);
  const key = `vibeyetu_read_${role}_${shopId}`;
  const [read, setRead] = useState(() => load(key));

  useEffect(() => {
    setRead(load(key));
  }, [key]);

  const items = useMemo(
    () => buildNotifications(orders, role, role === "seller" ? shopId : null, now),
    [orders, role, shopId, now]
  );
  const readSet = useMemo(() => new Set(read), [read]);
  const unread = useMemo(() => items.filter((n) => !readSet.has(n.id)), [items, readSet]);
  const unreadOrderIds = useMemo(() => new Set(unread.map((n) => n.orderId)), [unread]);

  const markIds = useCallback(
    (ids) => {
      if (ids.length === 0) return;
      setRead((prev) => {
        const next = [...new Set([...prev, ...ids])].slice(-MAX_STORED);
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Storage unavailable: read marks last only for this visit.
        }
        return next;
      });
    },
    [key]
  );

  return {
    items,
    unreadCount: unread.length,
    unreadOrderIds,
    isUnread: (id) => !readSet.has(id),
    markRead: (id) => markIds([id]),
    markAllRead: () => markIds(unread.map((n) => n.id)),
    markOrderRead: (orderId) => markIds(unread.filter((n) => n.orderId === orderId).map((n) => n.id)),
  };
}
