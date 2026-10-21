import { useState } from "react";
import Button from "../../components/Button.jsx";
import ImageUploader from "../../components/ImageUploader.jsx";
import { deleteImage } from "../../lib/images.js";

const inputCls = "w-full rounded-xl border border-ink/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-vibe";

const hueFor = (name) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

// Add or edit a product. `product` is null when adding.
export default function SellerProductForm({ product, categories, onSave, onCancel }) {
  const [name, setName] = useState(product?.name || "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [category, setCategory] = useState(product?.category || categories[0]?.id || "");
  const [description, setDescription] = useState(product?.description || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState(product?.images || []);

  async function submit(e) {
    e.preventDefault();
    const priceNum = Number(price);
    const stockNum = Number(stock);
    const cat = categories.find((c) => c.id === category);
    if (name.trim().length < 3) return setError("Enter a product name of at least 3 characters.");
    if (!Number.isInteger(priceNum) || priceNum < 1) return setError("Enter a price in whole shillings, like 1500.");
    if (!Number.isInteger(stockNum) || stockNum < 0) return setError("Enter the stock as a whole number, 0 or more.");
    if (!cat) return setError("Choose a category.");
    setError("");
    setBusy(true);
    const result = await onSave({
      name: name.trim(),
      price: priceNum,
      stock: stockNum,
      category,
      emoji: cat.emoji,
      hue: product?.hue ?? hueFor(name.trim()),
      description: description.trim() || "No description yet.",
      images,
    });
    if (result && !result.ok) {
      setError(result.message);
      setBusy(false);
    } else {
      // Photos the seller removed are no longer needed.
      (product?.images || []).filter((id) => !images.includes(id)).forEach(deleteImage);
    }
  }

  function cancel() {
    // Photos added in this form but never saved are not needed.
    const original = product?.images || [];
    images.filter((id) => !original.includes(id)).forEach(deleteImage);
    onCancel();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-card" noValidate>
      <h2 className="text-lg font-extrabold">{product ? "Edit product" : "Add a product"}</h2>
      <ImageUploader label="Photos (the first one is the main photo)" value={images} onChange={setImages} max={4} />
      <div className="space-y-1.5">
        <label htmlFor="p-name" className="text-sm font-semibold">
          Product name
        </label>
        <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="p-price" className="text-sm font-semibold">
            Price (KES)
          </label>
          <input id="p-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="p-stock" className="text-sm font-semibold">
            In stock
          </label>
          <input id="p-stock" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="p-cat" className="text-sm font-semibold">
            Category
          </label>
          <select id="p-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="p-desc" className="text-sm font-semibold">
          Description
        </label>
        <textarea id="p-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Save product"}
        </Button>
        <Button variant="ghost" onClick={cancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
