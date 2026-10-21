import { Link } from "react-router-dom";

export default function Logo({ className = "text-xl sm:text-2xl", light = false }) {
  return (
    <Link
      to="/"
      aria-label="VIBEYETU home"
      className={`font-extrabold tracking-[0.18em] ${light ? "text-ivory" : "text-ink"} ${className}`}
    >
      VIBEYETU
    </Link>
  );
}
