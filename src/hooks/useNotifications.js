import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrders } from "../context/OrdersContext.jsx";
import { getToken } from "../services/http.js";
import { listBuyerNotifications, readBuyerNotifications } from "../services/api.js";
import { listShopNotifications, readShopNotifications } from "../services/sellerApi.js";

const EVERY_MS = 20000;

// The bell for one side of the marketplace. role is "buyer" or "seller".
// The server builds the list and remembers what has been read, so it is the same on every device.
export default function useNotifications(role, shopId = "me") {
  const { orders, shopOrders } = useOrders();
  const [items, setItems] = useState([]);
  const signedIn = Boolean(getToken(role));

  const load = useCallback(async () => {
    if (!getToken(role) || (role === "seller" && (!shopId || shopId === "me"))) return;
    try {
      const data = role === "seller" ? await listShopNotifications(shopId) : await listBuyerNotifications();
      setItems(data.items || []);
    } catch {
      // Keep what is on screen. The next refresh tries again.
    }
  }, [role, shopId]);

  useEffect(() => {
    setItems([]);
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [load, signedIn]);

  // A fresh list of orders usually means something changed, so look again.
  const watched = role === "seller" ? shopOrders : orders;
  useEffect(() => {
    load();
  }, [watched, load]);

  const send = useCallback(
    async (body) => {
      try {
        const data = role === "seller" ? await readShopNotifications(shopId, body) : await readBuyerNotifications(body);
        setItems(data.items || []);
      } catch {
        load();
      }
    },
    [role, shopId, load]
  );

  const unread = useMemo(() => items.filter((n) => !n.read), [items]);
  const unreadOrderIds = useMemo(() => new Set(unread.map((n) => n.orderId)), [unread]);
  const mark = useCallback(
    (ids) => {
      if (ids.length === 0) return;
      setItems((list) => list.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
      send({ ids });
    },
    [send]
  );

  return {
    items,
    unreadCount: unread.length,
    unreadOrderIds,
    isUnread: (id) => items.some((n) => n.id === id && !n.read),
    markRead: (id) => mark([id]),
    markAllRead: () => {
      if (unread.length === 0) return;
      setItems((list) => list.map((n) => ({ ...n, read: true })));
      send({ all: true });
    },
    markOrderRead: (orderId) => mark(unread.filter((n) => n.orderId === orderId).map((n) => n.id)),
  };
}
