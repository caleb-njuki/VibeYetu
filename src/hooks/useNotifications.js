import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrders } from "../context/OrdersContext.jsx";
import useNow from "./useNow.js";
import { buildNotifications } from "../lib/orders.js";
import { listNotices } from "../lib/suspensions.js";
import { SHOPS_CHANGED } from "../lib/sellers.js";

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
  const [tick, setTick] = useState(0);

  // Shop notices (suspension, review decisions) can arrive from another page or tab.
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(SHOPS_CHANGED, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(SHOPS_CHANGED, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  useEffect(() => {
    setRead(load(key));
  }, [key]);

  const items = useMemo(() => {
    const fromOrders = buildNotifications(orders, role, role === "seller" ? shopId : null, now);
    if (role !== "seller") return fromOrders;
    const notices = listNotices(shopId).map((n) => ({ id: n.id, orderId: null, at: n.at, text: n.text, href: n.href }));
    return [...fromOrders, ...notices].sort((a, b) => b.at - a.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick makes the notices reload
  }, [orders, role, shopId, now, tick]);
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
