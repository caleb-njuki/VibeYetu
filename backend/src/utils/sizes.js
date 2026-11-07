// Sizes for clothes and shoes. Same lists as the frontend (src/lib/sizes.js).
export const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
export const SHOE_SIZES = Array.from({ length: 13 }, (_, i) => String(35 + i)); // EU 35 to 47

export const sizesFor = (type) =>
  type === 'clothing' ? CLOTHING_SIZES : type === 'shoes' ? SHOE_SIZES : [];

// Checks { M: 4, L: 0 } for a size type. Returns { ok: true, sizes, total } or { ok: false, message }.
// A size that is not in the object is a size the seller does not sell.
export function cleanSizes(type, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'Enter the stock for at least one size.' };
  }
  const allowed = sizesFor(type);
  const sizes = {};
  let total = 0;
  for (const [size, value] of Object.entries(input)) {
    if (!allowed.includes(size)) {
      return { ok: false, message: `${size} is not a valid ${type === 'shoes' ? 'shoe size' : 'clothing size'}.` };
    }
    if (!Number.isInteger(value) || value < 0 || value > 9999) {
      return { ok: false, message: `Enter the stock for ${size} as a whole number from 0 to 9999.` };
    }
    sizes[size] = value;
    total += value;
  }
  if (Object.keys(sizes).length === 0) {
    return { ok: false, message: 'Enter the stock for at least one size. Leave the sizes you do not sell out.' };
  }
  // Keep the usual order (S, M, L ...) in what is saved.
  const ordered = {};
  for (const size of allowed) if (size in sizes) ordered[size] = sizes[size];
  return { ok: true, sizes: ordered, total };
}
