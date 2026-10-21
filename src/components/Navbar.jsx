import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Package, Search, ShoppingBag, Store, User } from "lucide-react";
import Logo from "./Logo.jsx";
import LocationChip from "./LocationChip.jsx";
import Button from "./Button.jsx";
import NotificationBell from "./NotificationBell.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { maskPhone } from "../lib/format.js";

const linkCls = "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-ink/5";

export default function Navbar() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { count } = useCart();
  const { user, logout } = useAuth();

  function onSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  function onLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-ivory">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <Logo />
        <LocationChip />

        <form
          onSubmit={onSearch}
          role="search"
          className="order-last flex basis-full items-center gap-2 rounded-full bg-white px-4 py-2 shadow-card md:order-none md:max-w-xl md:basis-auto md:flex-1"
        >
          <Search className="h-4 w-4 text-ink-mute" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products and shops"
            aria-label="Search products and shops"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-mute"
          />
        </form>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Main">
          {user ? (
            <>
              <span className="hidden text-sm font-semibold text-ink-soft lg:inline">{maskPhone(user.phone)}</span>
              <NotificationBell role="buyer" />
              <Link to="/orders" className={linkCls}>
                <Package className="h-5 w-5" aria-hidden="true" />
                <span className="hidden sm:inline">Orders</span>
              </Link>
              <button type="button" onClick={onLogout} className={linkCls}>
                <LogOut className="h-5 w-5" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <Link to="/login" className={linkCls}>
              <User className="h-5 w-5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
          <Link to="/cart" aria-label={`Cart, ${count} items`} className="relative rounded-full p-2 hover:bg-ink/5">
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-vibe px-1 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          <Button to="/my-shop" variant="dark" size="sm">
            <Store className="h-4 w-4" aria-hidden="true" />
            My Shop
          </Button>
        </nav>
      </div>
    </header>
  );
}
