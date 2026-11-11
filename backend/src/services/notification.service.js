// The bell. Notifications are built from order events and shop notices, so nothing is stored twice.
// A notification is an order event the OTHER side caused, plus a reminder when the 24-hour window ends.
import { pool } from '../config/db.js';
import { WINDOW_SECONDS } from '../utils/orderRules.js';

const MAX_SHOWN = 100;

export async function addShopNotice(shopId, text, href = '/my-shop/report', db = pool) {
  await db.query('INSERT INTO shop_notices (shop_id, text, href) VALUES ($1, $2, $3)', [shopId, text, href]);
}

const OWNER = {
  buyer: { type: 'buyer', column: 'o.buyer_id', text: 'e.buyer_text' },
  seller: { type: 'shop', column: 'o.shop_id', text: 'e.seller_text' },
};

async function build(role, ownerId) {
  const own = OWNER[role];
  const [events, reminders, reads, notices] = await Promise.all([
    pool.query(
      `SELECT e.id, e.order_id, e.created_at, ${own.text} AS text
       FROM order_events e JOIN orders o ON o.id = e.order_id
       WHERE ${own.column} = $1 AND e.notify IN ($2, 'both') AND ${own.text} IS NOT NULL
       ORDER BY e.created_at DESC, e.id DESC LIMIT ${MAX_SHOWN}`,
      [ownerId, role]
    ),
    pool.query(
      `SELECT o.id AS order_id, o.accepted_at + make_interval(secs => $2) AS at
       FROM orders o
       WHERE ${own.column} = $1 AND o.status IN ('accepted', 'dispatched')
         AND now() > o.accepted_at + make_interval(secs => $2)`,
      [ownerId, WINDOW_SECONDS]
    ),
    pool.query('SELECT notif_id FROM notification_reads WHERE owner_type = $1 AND owner_id = $2', [own.type, ownerId]),
    role === 'seller'
      ? pool.query('SELECT id, text, href, created_at FROM shop_notices WHERE shop_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2::int', [ownerId, MAX_SHOWN])
      : { rows: [] },
  ]);

  const read = new Set(reads.rows.map((r) => r.notif_id));
  const items = [
    ...events.rows.map((e) => ({ id: `e${e.id}`, orderId: e.order_id, at: new Date(e.created_at).getTime(), text: e.text })),
    ...reminders.rows.map((r) => ({ id: `${r.order_id}:expired`, orderId: r.order_id, at: new Date(r.at).getTime(), text: 'The 24-hour window ended. Please answer the review form.' })),
    ...notices.rows.map((n) => ({ id: `n${n.id}`, orderId: null, at: new Date(n.created_at).getTime(), text: n.text, href: n.href })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_SHOWN)
    .map((n) => ({ ...n, read: read.has(n.id) }));
  return items;
}

export async function listNotifications(role, ownerId) {
  const items = await build(role, ownerId);
  return { items, unreadCount: items.filter((n) => !n.read).length };
}

// ids: the notifications to mark. all: true marks everything shown.
export async function markNotificationsRead(role, ownerId, { ids = [], all = false }) {
  const own = OWNER[role];
  const list = all ? (await build(role, ownerId)).map((n) => n.id) : ids;
  if (list.length) {
    await pool.query(
      `INSERT INTO notification_reads (owner_type, owner_id, notif_id)
       SELECT $1, $2, unnest($3::text[]) ON CONFLICT DO NOTHING`,
      [own.type, ownerId, list]
    );
  }
  return listNotifications(role, ownerId);
}
