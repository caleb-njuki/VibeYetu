// Stock that orders take out of a shop, and put back.
// Stock is taken when the buyer starts checkout (so the last item cannot be sold twice)
// and put back if the order never happens or the item comes back.
// A product with sizes keeps stock per size, and `stock` is always the total of those.

const total = (sizes) => Object.values(sizes).reduce((n, v) => n + v, 0);

// product: { stock, size_type, sizes }. Changes it in memory. Returns the units left, or null if it worked.
export function takeFrom(product, size, qty) {
  if (product.size_type !== 'none') {
    const left = product.sizes?.[size] ?? 0;
    if (left < qty) return left;
    product.sizes = { ...product.sizes, [size]: left - qty };
    product.stock = total(product.sizes);
    return null;
  }
  if (product.stock < qty) return product.stock;
  product.stock -= qty;
  return null;
}

export function putBack(product, size, qty) {
  if (product.size_type !== 'none' && size) {
    product.sizes = { ...(product.sizes || {}), [size]: (product.sizes?.[size] ?? 0) + qty };
    product.stock = total(product.sizes);
  } else {
    product.stock += qty;
  }
}

export async function saveProduct(client, id, product) {
  await client.query('UPDATE products SET stock = $2, sizes = $3::jsonb, updated_at = now() WHERE id = $1', [
    id,
    product.stock,
    product.size_type === 'none' ? null : JSON.stringify(product.sizes),
  ]);
}

// Puts an order's items back into the shop's stock, once. The caller holds the lock on the order.
export async function restockOrder(client, orderId) {
  const order = await client.query('SELECT stock_held FROM orders WHERE id = $1', [orderId]);
  if (!order.rows[0]?.stock_held) return;

  const items = (await client.query('SELECT product_id, qty, size FROM order_items WHERE order_id = $1', [orderId])).rows;
  const ids = [...new Set(items.map((i) => i.product_id))];
  const products = new Map(
    (
      await client.query(
        'SELECT id, stock, size_type, sizes FROM products WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE',
        [ids]
      )
    ).rows.map((p) => [String(p.id), p])
  );

  for (const item of items) {
    const product = products.get(String(item.product_id));
    if (product) putBack(product, item.size, item.qty);
  }
  for (const [id, product] of products) await saveProduct(client, id, product);
  await client.query('UPDATE orders SET stock_held = false, updated_at = now() WHERE id = $1', [orderId]);
}
