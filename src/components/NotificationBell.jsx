import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import useNotifications from "../hooks/useNotifications.js";
import { formatWhen } from "../lib/orders.js";

// The bell with the unread count. Used in the main navbar and in My Shop.
export default function NotificationBell({ role, shopId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { items, unreadCount, isUnread, markRead, markAllRead } = useNotifications(role, shopId);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openItem(n) {
    markRead(n.id);
    setOpen(false);
    if (n.href) navigate(n.href);
    else navigate(role === "seller" ? `/my-shop/orders/${n.orderId}` : `/orders/${n.orderId}`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative rounded-full p-2 hover:bg-ink/5"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="fixed inset-x-4 top-28 z-50 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-ink/10 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <h2 className="font-extrabold">Notifications</h2>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="text-sm font-semibold text-vibe hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-mute">No notifications yet. Order updates will show here.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-ink/10 overflow-y-auto">
              {items.slice(0, 15).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-vibe-light ${isUnread(n.id) ? "bg-vibe-light/50" : ""}`}
                  >
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${isUnread(n.id) ? "bg-vibe" : "bg-transparent"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className={`block text-sm ${isUnread(n.id) ? "font-semibold" : ""}`}>{n.text}</span>
                      <span className="text-xs text-ink-mute">
                        {n.orderId ? `Order ${n.orderId}` : "Shop notice"} &middot; {formatWhen(n.at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
