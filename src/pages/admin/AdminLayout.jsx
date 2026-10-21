import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import Logo from "../../components/Logo.jsx";
import useNow from "../../hooks/useNow.js";
import { useAdmin } from "../../context/AdminAuthContext.jsx";
import { useOrders } from "../../context/OrdersContext.jsx";
import { getStatus } from "../../lib/orders.js";
import { adState, listAds } from "../../lib/ads.js";

const tab = ({ isActive }) =>
  `flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${isActive ? "bg-ink text-white" : "text-ink hover:bg-ink/5"}`;

export default function AdminLayout() {
  const { admin, logout } = useAdmin();
  const { orders } = useOrders();
  const now = useNow(60000);
  const navigate = useNavigate();
  useLocation(); // re-check the pending ads count whenever the admin changes page

  if (!admin) return <Navigate to="/admin/login" replace />;

  const pendingAds = listAds().filter((a) => adState(a) === "attention").length;
  const openCases = orders.filter(
    (o) => (o.status === "accepted" || o.status === "dispatched") && getStatus(o, now) === "review"
  ).length;

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Logo className="text-lg" />
          <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">Admin</span>
          <nav className="flex flex-wrap gap-1" aria-label="Admin">
            <NavLink to="/admin" end className={tab}>
              Overview
            </NavLink>
            <NavLink to="/admin/cases" className={tab}>
              Cases
              {openCases > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                  {openCases}
                </span>
              )}
            </NavLink>
            <NavLink to="/admin/orders" className={tab}>
              Orders
            </NavLink>
            <NavLink to="/admin/shops" className={tab}>
              Shops
            </NavLink>
            <NavLink to="/admin/ads" className={tab}>
              Ads
              {pendingAds > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                  {pendingAds}
                </span>
              )}
            </NavLink>
          </nav>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/admin/login");
            }}
            className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-ink/5"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
