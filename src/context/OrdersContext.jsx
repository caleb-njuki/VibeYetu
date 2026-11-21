import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { useSeller } from "./SellerAuthContext.jsx";
import { PROMISES } from "../lib/orders.js";
import { askRefund, confirmReceipt, listMyOrders, rejectDelivery, sendBuyerReport } from "../services/api.js";
import { acceptOrder, confirmReturnOfOrder, dispatchOrder, listShopOrders, rejectOrderAsSeller, sendSellerReport } from "../services/sellerApi.js";

// The buyer's orders now come from the server. The server owns every rule (escrow, the 24-hour window,
// refunds), so this file only loads the orders, keeps them fresh, and sends the buyer's actions.
// The signed-in seller's shop orders are loaded the same way (shopOrders). Staff actions come in a later update.
const OrdersContext = createContext(null);

const fail = (message) => ({ ok: false, message });
const OK = { ok: true };
const LATER = "This part is being connected in the next update.";
const REFRESH_MS = 15000;

export function OrdersProvider({ children }) {
  const { user } = useAuth();
  const buyerId = user?.id ?? null;
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const current = useRef(buyerId);
  current.current = buyerId;

  // The orders of the shop the seller has open.
  const { seller } = useSeller();
  const shopId = seller?.shopId ?? null;
  const [shopOrders, setShopOrders] = useState([]);
  const [strikes, setStrikes] = useState({ streak: 0, limit: 3 });
  const currentShop = useRef(shopId);
  currentShop.current = shopId;

  const refreshShop = useCallback(async () => {
    const which = currentShop.current;
    if (!which) return;
    try {
      const data = await listShopOrders(which);
      if (currentShop.current === which) {
        setShopOrders(data.orders);
        if (data.strikes) setStrikes(data.strikes);
      }
    } catch {
      // A failed refresh keeps the orders already on screen.
    }
  }, []);

  useEffect(() => {
    setShopOrders([]);
    setStrikes({ streak: 0, limit: 3 });
    if (!shopId) return undefined;
    refreshShop();
    const timer = setInterval(() => {
      if (!document.hidden) refreshShop();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [shopId, refreshShop]);

  const refresh = useCallback(async () => {
    if (!current.current) return;
    const who = current.current;
    try {
      const list = await listMyOrders();
      if (current.current === who) {
        setOrders(list);
        setLoaded(true);
      }
    } catch {
      // A failed refresh keeps the orders already on screen. The next refresh tries again.
    }
  }, []);

  // Load when a buyer signs in, clear when they sign out, and keep fresh while the page is open.
  useEffect(() => {
    setOrders([]);
    setLoaded(false);
    if (!buyerId) return undefined;
    refresh();
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, REFRESH_MS);
    const onShow = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [buyerId, refresh]);

  const value = useMemo(() => {
    // Runs one buyer action on the server, then reloads the orders so every page shows the new state.
    const run = async (work) => {
      try {
        await work();
        await refresh();
        return OK;
      } catch (err) {
        await refresh();
        return fail(err.message || "Something went wrong. Please try again.");
      }
    };
    const later = () => fail(LATER);
    // The same, for a seller action on the open shop.
    const runShop = async (work) => {
      try {
        await work(currentShop.current);
        await refreshShop();
        return OK;
      } catch (err) {
        await refreshShop();
        return fail(err.message || "Something went wrong. Please try again.");
      }
    };
    return {
      orders,
      loaded,
      refresh,
      shopOrders,
      strikes,
      refreshShop,
      addOrders: () => {}, // the server saves orders when they are paid

      // ---- Buyer actions ----
      buyerConfirm: (id, code) => run(() => confirmReceipt(id, String(code).trim())),
      buyerReject: (id, reason) => run(() => rejectDelivery(id, reason)),
      requestRefund: (id) => run(() => askRefund(id)),
      submitReport: (id, role, report) =>
        role === "buyer" ? run(() => sendBuyerReport(id, report)) : runShop((shop) => sendSellerReport(shop, id, report)),

      // ---- Seller actions ----
      sellerAccept: (id, ms) => {
        const promise = PROMISES.find((p) => p.ms === ms)?.id;
        return promise ? runShop((shop) => acceptOrder(shop, id, promise)) : Promise.resolve(fail("Choose when the order will be ready."));
      },
      sellerReject: (id, reason) => runShop((shop) => rejectOrderAsSeller(shop, id, reason)),
      sellerDispatch: (id, code) => runShop((shop) => dispatchOrder(shop, id, String(code).trim())),
      sellerConfirmReturn: (id) => runShop((shop) => confirmReturnOfOrder(shop, id)),

      // ---- Staff actions: connected in a later update ----
      expirePendingNow: () => {},
      expireNow: () => {},
      supportRefund: () => {},
      supportRelease: () => {},
    };
  }, [orders, loaded, refresh, shopOrders, strikes, refreshShop]);

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used inside OrdersProvider");
  return ctx;
}
