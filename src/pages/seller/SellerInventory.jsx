import { useEffect, useState } from "react";
import Button from "../../components/Button.jsx";
import SellerProductForm from "./SellerProductForm.jsx";
import ProductImage from "../../components/ProductImage.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { createShopProduct, getCategories, getShopCatalog, updateShopProduct } from "../../services/api.js";
import { formatKES } from "../../lib/format.js";

const stockChip = (n) =>
  n === 0 ? "bg-red-100 text-red-800" : n <= 5 ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900";

export default function SellerInventory() {
  const { seller } = useSeller();
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null); // null, "new" or a product
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    getCategories()
      .then((c) => {
        if (live) setCategories(c);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    getShopCatalog(seller.shopId)
      .then((list) => {
        if (live) setProducts(list);
      })
      .catch(() => {
        if (live) setProducts([]);
      });
    return () => {
      live = false;
    };
  }, [seller.shopId, reload]);

  async function save(data) {
    try {
      if (editing === "new") await createShopProduct(seller.shopId, data);
      else await updateShopProduct(editing.id, data);
    } catch (e) {
      return { ok: false, message: e.message || "Could not save. Please try again." };
    }
    setNotice(editing === "new" ? "Product added." : "Product updated.");
    setEditing(null);
    setReload((n) => n + 1);
    return { ok: true };
  }

  async function toggle(p) {
    try {
      await updateShopProduct(p.id, { active: p.active === false });
      setNotice(p.active === false ? "Product is visible in your shop again." : "Product hidden from buyers.");
      setReload((n) => n + 1);
    } catch {
      setNotice("Could not update the product.");
    }
  }

  const lowCount = (products || []).filter((p) => p.active !== false && p.stock <= 5).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold">Inventory</h1>
          <p className="text-sm text-ink-mute">
            Stock goes down when you dispatch an order and back up when you confirm a return.
            {lowCount > 0 && ` ${lowCount} ${lowCount === 1 ? "product is" : "products are"} low or out of stock.`}
          </p>
        </div>
        {!editing && <Button onClick={() => { setNotice(""); setEditing("new"); }}>Add product</Button>}
      </div>

      {notice && (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
          {notice}
        </p>
      )}

      {editing && (
        <SellerProductForm
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          categories={categories}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}

      {products === null ? (
        <div className="h-48 animate-pulse rounded-2xl bg-ivory-dark" aria-busy="true" />
      ) : products.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-ink-mute shadow-card">No products yet. Add your first one.</p>
      ) : (
        <ul className="divide-y divide-ink/10 rounded-2xl bg-white shadow-card">
          {products.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
              <ProductImage product={p} alt="" emojiClass="text-2xl" className="h-12 w-12 shrink-0 overflow-hidden rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {p.name}
                  {p.active === false && <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-bold">Hidden</span>}
                </p>
                <p className="text-sm text-ink-mute">{formatKES(p.price)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${stockChip(p.stock)}`}>
                {p.stock === 0 ? "Out of stock" : `${p.stock} in stock`}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => { setNotice(""); setEditing(p); }}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggle(p)}>
                  {p.active === false ? "Show" : "Hide"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
