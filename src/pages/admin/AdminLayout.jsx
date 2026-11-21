import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import Logo from "../../components/Logo.jsx";
import { useEffect, useState } from "react";
import { useAdmin } from "../../context/AdminAuthContext.jsx";
import { getOverview, listAdminAds } from "../../services/adminApi.js";

const tab = ({ isActive }) =>
  `flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${isActive ? "bg-ink text-white" : "text-ink hover:bg-ink/5"}`;

export default function AdminLayout() {
  const { admin, logout } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation(); // count again whenever the staff member changes page
  const [counts, setCounts] = useState({ cases: 0, reports: 0, ads: 0 });

  useEffect(() => {
    if (!admin) return undefined;
    let live = true;
    const load = () =>
      Promise.all([getOverview(), listAdminAds()])
        .then(([o, ads]) => {
          if (live) setCounts({ cases: o.cases, reports: o.pendingReviews, ads: ads.filter((a) => a.state === "attention").length });
        })
        .catch(() => {});
    load();
    const timer = setInterval(() => !document.hidden && load(), 60000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [admin, location.pathname]);

  if (!admin) return <Navigate to="/admin/login" replace />;

  const pendingAds = counts.ads;
  const reportsWaiting = counts.reports;
  const openCases = counts.cases;

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
              {reportsWaiting > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                  {reportsWaiting}
                </span>
              )}
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
