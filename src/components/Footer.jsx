import { Link } from "react-router-dom";
import Logo from "./Logo.jsx";

const COLUMNS = [
  { title: "Shop", links: [["All products", "/search"], ["Cart", "/cart"], ["My orders", "/orders"]] },
  { title: "Help", links: [["How escrow works", "/how-it-works"], ["Refunds", "/help/refunds"], ["Contact us", "/contact"], ["Terms of use", "/terms"]] },
  { title: "Sell", links: [["Open a shop", "/my-shop"], ["Seller guide", "/sell/guide"], ["Fees", "/sell/fees"]] },
];

export default function Footer() {
  return (
    <footer className="mt-16 bg-ink text-ivory">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-4">
        <div className="space-y-3">
          <Logo light />
          <p className="text-sm text-ivory/70">
            Kenya&apos;s trusted marketplace. Every payment is protected by escrow.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-ivory/60">{col.title}</h3>
            <ul className="space-y-2 text-sm">
              {col.links.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="hover:text-white hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-ivory/60">
        &copy; {new Date().getFullYear()} VIBEYETU. Made in Kenya.
      </div>
    </footer>
  );
}
