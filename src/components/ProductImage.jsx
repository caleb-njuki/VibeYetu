import { imageSrc } from "../lib/images.js";

// The seller's photo when there is one, otherwise a coloured tile with the category emoji.
export default function ProductImage({ product, index = 0, className = "", emojiClass = "text-6xl", alt }) {
  const src = imageSrc(product.images?.[index]);
  if (src) {
    return <img src={src} alt={alt ?? product.name} loading="lazy" className={`object-cover ${className}`} />;
  }
  const hue = product.hue ?? 220;
  return (
    <div
      className={`flex items-center justify-center ${emojiClass} ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 93%), hsl(${hue} 60% 80%))` }}
      aria-hidden="true"
    >
      {product.emoji}
    </div>
  );
}
