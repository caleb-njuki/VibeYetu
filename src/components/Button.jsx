import { Link } from "react-router-dom";

const VARIANTS = {
  primary: "bg-vibe text-white hover:bg-vibe-dark",
  dark: "bg-ink text-white hover:bg-ink-soft",
  outline: "border border-ink/20 text-ink hover:bg-ink/5",
  ghost: "text-ink hover:bg-ink/5",
};

const SIZES = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

// Pass `to` to render a router link, otherwise it renders a <button>.
export default function Button({ to, variant = "primary", size = "md", className = "", children, ...rest }) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
