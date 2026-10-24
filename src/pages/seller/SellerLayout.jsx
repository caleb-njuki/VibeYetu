import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Plus } from "lucide-react";
import Logo from "../../components/Logo.jsx";
import NotificationBell from "../../components/NotificationBell.jsx";
import SuspensionBanner from "../../components/SuspensionBanner.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { SHOPS_CHANGED, ownedShops } from "../../lib/sellers.js";

const tab = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-semibold ${isActive ? "bg-ink text-white" : "text-ink hover:bg-ink/5"}`;

export default function SellerLayout() {
  const { seller, logout, switchShop } = useSeller();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [, refresh] = useState(0);

  useEffect(() => {
    const bump = () => refresh((n) => n + 1);
    window.addEventListener(SHOPS_CHANGED, bump);
    window.addEventListener("storage", bump); // support decided in another tab
    return () => {
      window.removeEventListener(SHOPS_CHANGED, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  if (!seller) return <Navigate to="/my-shop/login" replace />;

  const branches = ownedShops(seller.email);
  const current = branches.find((b) => b.id === seller.shopId);

  function onSwitch(e) {
    if (!switchShop(e.target.value)) return;
    // An order page belongs to one shop, so go back to the orders list.
    if (pathname.startsWith("/my-shop/orders/")) navigate("/my-shop");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Logo className="text-lg" />
          <span className="rounded-full bg-vibe-light px-3 py-1 text-xs font-bold uppercase tracking-wider text-vibe-dark">My Shop</span>
          <nav className="flex flex-wrap gap-1" aria-label="My Shop">
            <NavLink to="/my-shop" end className={tab}>
              Orders
            </NavLink>
            <NavLink to="/my-shop/inventory" className={tab}>
              Inventory
            </NavLink>
            <NavLink to="/my-shop/offers" className={tab}>
              Offers
            </NavLink>
            <NavLink to="/my-shop/sales" className={tab}>
              Sales
            </NavLink>
            <NavLink to="/my-shop/ads" className={tab}>
              Ads
            </NavLink>
            <NavLink to="/my-shop/settings" className={tab}>
              Settings
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <NotificationBell role="seller" shopId={seller.shopId} />
            <Link to="/" className="font-semibold text-vibe hover:underline">
              Marketplace
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/my-shop/login");
              }}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 font-semibold hover:bg-ink/5"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
        <div className="border-t border-ink/10 bg-ivory-dark/60">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
            <label htmlFor="active-shop" className="font-semibold text-ink-soft">
              {branches.length > 1 ? "Working on:" : "Your shop:"}
            </label>
            {branches.length > 1 ? (
              <select
                id="active-shop"
                value={seller.shopId}
                onChange={onSwitch}
                className="max-w-[16rem] rounded-full border border-ink/20 bg-white px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-vibe"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.suspended ? " (suspended)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span id="active-shop" className="font-bold">
                {current?.name}
              </span>
            )}
            <Link to="/my-shop/branches/new" className="ml-auto flex items-center gap-1 font-semibold text-vibe hover:underline">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add branch
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Keyed by shop, so every page starts fresh when the seller switches branch. */}
        <div key={seller.shopId}>
          <SuspensionBanner shopId={seller.shopId} />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
