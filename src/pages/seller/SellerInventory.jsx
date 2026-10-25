import { useEffect, useState } from "react";
import Button from "../../components/Button.jsx";
import CloseShopFlow from "../../components/CloseShopFlow.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import SellerProductForm from "./SellerProductForm.jsx";
import ProductImage from "../../components/ProductImage.jsx";
import { useOrders } from "../../context/OrdersContext.jsx";
import { useSeller } from "../../context/SellerAuthContext.jsx";
import { createShopProduct, deleteShopProduct, getCategories, getShopCatalog, updateShopProduct } from "../../services/api.js";
import { ownedShops } from "../../lib/sellers.js";
import { isOpenOrder } from "../../lib/shopClosure.js";
import { formatKES } from "../../lib/format.js";

const stockChip = (n) =>
  n === 0 ? "bg-red-100 text-red-800" : n <= 5 ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900";

export default function SellerInventory() {
  const { seller } = useSeller();
  const { orders } = useOrders();
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null); // null, "new" or a product
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState(null); // { tone: "ok" | "error", text }
  const [deleting, setDeleting] = useState(null); // the product waiting for a yes or no
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [closing, setClosing] = useState(false);

  const shopName = ownedShops(seller.email).find((s) => s.id === seller.shopId)?.name || "this shop";

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
    setNotice({ tone: "ok", text: editing === "new" ? "Product added." : "Product updated." });
    setEditing(null);
    setReload((n) => n + 1);
    return { ok: true };
  }

  async function toggle(p) {
    try {
      await updateShopProduct(p.id, { active: p.active === false });
      setNotice({
        tone: "ok",
        text: p.active === false ? "Product is visible in your shop again." : "Product hidden from buyers.",
      });
      setReload((n) => n + 1);
    } catch {
      setNotice({ tone: "error", text: "Could not update the product." });
    }
  }

  // Hiding is the gentle option offered inside the delete box.
  async function hideInstead() {
    const p = deleting;
    setDeleting(null);
    if (p && p.active !== false) await toggle(p);
  }

  async function confirmDelete() {
    const p = deleting;
    if (!p || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteShopProduct(seller.shopId, p.id);
      if (editing && editing !== "new" && editing.id === p.id) setEditing(null);
      setNotice({ tone: "ok", text: `"${p.name}" was deleted.` });
      setReload((n) => n + 1);
    } catch (e) {
      setNotice({ tone: "error", text: e.message || "Could not delete the product." });
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  }

  const lowCount = (products || []).filter((p) => p.active !== false && p.stock <= 5).length;
  // Open orders that include the product being deleted. They can still be completed.
  const openWithDeleting = deleting
    ? orders.filter((o) => o.shopId === seller.shopId && isOpenOrder(o) && (o.items || []).some((i) => i.productId === deleting.id)).length
    : 0;

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
        {!editing && (
          <Button
            onClick={() => {
              setNotice(null);
              setEditing("new");
            }}
          >
            Add product
          </Button>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${notice.tone === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-900"}`}
        >
          {notice.text}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNotice(null);
                    setEditing(p);
                  }}
                >
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggle(p)}>
                  {p.active === false ? "Show" : "Hide"}
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => {
                    setNotice(null);
                    setDeleting(p);
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="close-title" className="space-y-3 rounded-2xl border border-red-200 bg-white p-5">
        <h2 id="close-title" className="text-lg font-extrabold text-red-800">
          Close this shop
        </h2>
        <p className="text-sm text-ink-soft">
          Closing removes <strong>{shopName}</strong> and all its products from VibeYetu. We will ask why, check that no orders are
          waiting, and confirm with your password. Just need a break? Hide your products instead.
        </p>
        <Button variant="danger" onClick={() => setClosing(true)}>
          Close shop
        </Button>
      </section>

      {deleting && (
        <ConfirmDialog
          title={`Delete "${deleting.name}"?`}
          confirmLabel="Delete product"
          danger
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        >
          <p>This removes the product from your shop and from search for good. Orders already placed keep the item&apos;s name and price.</p>
          {openWithDeleting > 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 font-semibold text-amber-900">
              {openWithDeleting} open {openWithDeleting === 1 ? "order includes" : "orders include"} this product. {openWithDeleting === 1 ? "It" : "They"} can
              still be completed.
            </p>
          )}
          {deleting.active !== false && (
            <p>
              Not sure?{" "}
              <button type="button" onClick={hideInstead} className="font-semibold text-vibe underline">
                Hide it instead
              </button>{" "}
              and you can show it again any time.
            </p>
          )}
        </ConfirmDialog>
      )}

      {closing && <CloseShopFlow onClose={() => setClosing(false)} />}
    </div>
  );
}
