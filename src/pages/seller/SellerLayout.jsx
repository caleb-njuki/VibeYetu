import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import Logo from "../../components/Logo.jsx";
import NotificationBell from "../../components/NotificationBell.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { getShop } from "../../services/api.js";

const tab = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-semibold ${isActive ? "bg-ink text-white" : "text-ink hover:bg-ink/5"}`;

export default function SellerLayout() {
  const { seller, logout } = useSeller();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [shopName, setShopName] = useState("");
  const shopId = seller?.shopId;

  useEffect(() => {
    if (!shopId) return undefined;
    let live = true;
    getShop(shopId)
      .then((s) => {
        if (live && s) setShopName(s.name);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [shopId, pathname]);

  if (!seller) return <Navigate to="/my-shop/login" replace />;

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
            <span className="hidden font-semibold text-ink-soft sm:inline">{shopName}</span>
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
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
