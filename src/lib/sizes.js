// Sizes for clothes and shoes. A product has a `sizeType` ("none", "clothing" or "shoes") and,
// when it has sizes, a `sizes` object that says how many are in stock per size, for example
// { S: 3, M: 4, L: 0 }. A size that is missing from the object is a size the seller does not sell.
export const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
export const SHOE_SIZES = Array.from({ length: 13 }, (_, i) => String(35 + i)); // EU 35 to 47

export const SIZE_TYPES = [
  { id: "none", label: "No sizes (one size, or not clothing or shoes)" },
  { id: "clothing", label: "Clothing (XS to 3XL)" },
  { id: "shoes", label: "Shoes (EU 35 to 47)" },
];

export const isSizeType = (type) => type === "clothing" || type === "shoes";

export const sizesFor = (type) => (type === "clothing" ? CLOTHING_SIZES : type === "shoes" ? SHOE_SIZES : []);

// "M" for clothes, "EU 42" for shoes.
export const formatSize = (type, size) => (!size ? "" : type === "shoes" ? `EU ${size}` : String(size));

export const sizeWord = (type) => (type === "shoes" ? "shoe size" : "size");

// [["S", 3], ["M", 4]] in the usual order. A size that is not on the list goes last.
export function sizeEntries(type, sizes) {
  if (!sizes || typeof sizes !== "object") return [];
  const order = sizesFor(type);
  const rank = (s) => (order.includes(s) ? order.indexOf(s) : order.length);
  return Object.entries(sizes)
    .map(([size, n]) => [size, Math.max(0, Number(n) || 0)])
    .sort((a, b) => rank(a[0]) - rank(b[0]) || String(a[0]).localeCompare(String(b[0])));
}

export const hasSizes = (product) => Boolean(product) && isSizeType(product.sizeType) && sizeEntries(product.sizeType, product.sizes).length > 0;

export const totalStock = (sizes) => Object.values(sizes || {}).reduce((n, v) => n + (Number(v) || 0), 0);

// "S to XL" or "EU 40 to 43". Used on product cards and in Inventory.
export function sizeRange(product) {
  if (!hasSizes(product)) return "";
  const list = sizeEntries(product.sizeType, product.sizes).map(([s]) => s);
  const first = formatSize(product.sizeType, list[0]);
  return list.length === 1 ? first : `${first} to ${formatSize(product.sizeType, list[list.length - 1])}`;
}

// Turns what the seller typed ({ M: "4", L: "" }) into { M: 4 }. An empty box means "I do not sell this size".
// Returns { ok: true, sizes } or { ok: false, message }.
export function cleanSizes(type, typed) {
  if (!isSizeType(type)) return { ok: true, sizes: null };
  const sizes = {};
  for (const size of sizesFor(type)) {
    const raw = String((typed || {})[size] ?? "").trim();
    if (raw === "") continue;
    if (!/^\d{1,4}$/.test(raw)) return { ok: false, message: `Enter the stock for ${formatSize(type, size)} as a whole number.` };
    sizes[size] = Number(raw);
  }
  if (Object.keys(sizes).length === 0) {
    return { ok: false, message: `Enter the stock for at least one ${sizeWord(type)}. Leave the sizes you do not sell empty.` };
  }
  return { ok: true, sizes };
}
