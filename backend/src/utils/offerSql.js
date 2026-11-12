// The discount a product has right now, worked out inside the database so that the shop page,
// search, the home page and checkout all use the same rule: the best live offer wins.
// `p` must be the products table in the query.
export const DISCOUNT_SQL = `(SELECT MAX(o.percent) FROM offers o
    WHERE o.shop_id = p.shop_id AND o.active AND now() >= o.starts_at AND now() <= o.ends_at
      AND (o.all_products OR p.id = ANY(o.product_ids)))`;

// The price a buyer pays, in whole shillings (halves round up, like the frontend).
export const PRICE_NOW_SQL = `ROUND(p.price * (100 - COALESCE(${DISCOUNT_SQL}, 0)) / 100.0)::int`;
