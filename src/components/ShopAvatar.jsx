import { imageSrc } from "../lib/images.js";

// The shop's profile photo, or its first letter when it has none.
export default function ShopAvatar({ shop, className = "h-14 w-14 text-xl" }) {
  const src = imageSrc(shop.photo);
  if (src) return <img src={src} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />;
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-ink font-extrabold text-white ${className}`} aria-hidden="true">
      {shop.name[0]}
    </span>
  );
}
