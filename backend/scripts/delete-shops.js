// Lists shops, and removes the ones you choose together with everything that belongs to them
// (products, offers, ads, orders, ratings, notices, payout details).
//
//   node scripts/delete-shops.js                       list every shop with its number
//   node scripts/delete-shops.js --delete 4,5,9        show what would be removed (nothing is deleted yet)
//   node scripts/delete-shops.js --delete 4,5,9 --yes  really remove them
//   add  --sellers  to also remove the seller accounts that are left with no shop
import { pool } from '../src/config/db.js';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => args[args.indexOf(n) + 1];
const ids = flag('--delete') ? String(value('--delete') || '').split(',').map((s) => s.trim()).filter(Boolean) : [];
const REAL = flag('--yes');
const WITH_SELLERS = flag('--sellers');

if (ids.some((i) => !/^\d{1,18}$/.test(i))) {
  console.error('Shop numbers must be digits, like: --delete 4,5,9');
  process.exit(1);
}

// Every single-column foreign key in the database: child table.column -> parent table.column
const FK_SQL = `SELECT c.conrelid::regclass::text AS child, a.attname AS childcol, c.confrelid::regclass::text AS parent, af.attname AS parentcol
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
  WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1`;

// Deletes the rows of `table` that match `where`, after deleting every row that points at them.
async function remove(c, fks, table, where, params, path, tally) {
  if (path.includes(table)) return;
  for (const fk of fks.filter((f) => f.parent === table)) {
    await remove(c, fks, fk.child, `${fk.childcol} IN (SELECT ${fk.parentcol} FROM ${table} WHERE ${where})`, params, [...path, table], tally);
  }
  const res = await c.query(`DELETE FROM ${table} WHERE ${where}`, params);
  if (res.rowCount) tally[table] = (tally[table] || 0) + res.rowCount;
}

try {
  const list = await pool.query(
    `SELECT s.id, s.name, s.created_at, s.closed_at, s.suspended, se.email,
            (SELECT count(*)::int FROM products p WHERE p.shop_id = s.id AND p.deleted_at IS NULL) AS products,
            (SELECT count(*)::int FROM orders o WHERE o.shop_id = s.id) AS orders
     FROM shops s JOIN sellers se ON se.id = s.seller_id ORDER BY s.id`
  );

  if (ids.length === 0) {
    console.log('\nNo.  Shop name                       Owner email                      Products  Orders');
    for (const s of list.rows) {
      console.log(`${String(s.id).padEnd(4)} ${String(s.name).slice(0, 31).padEnd(31)} ${String(s.email).slice(0, 32).padEnd(32)} ${String(s.products).padEnd(9)} ${s.orders}${s.closed_at ? '  (closed)' : ''}`);
    }
    console.log('\nTo remove shops: node scripts/delete-shops.js --delete 4,5,9');
  } else {
    const chosen = list.rows.filter((s) => ids.includes(String(s.id)));
    const missing = ids.filter((i) => !chosen.some((s) => String(s.id) === i));
    if (missing.length) throw new Error(`No shop with number: ${missing.join(', ')}`);
    console.log(REAL ? '\nRemoving these shops:' : '\nThese shops WOULD be removed (nothing is deleted yet):');
    chosen.forEach((s) => console.log(`  ${s.id}  ${s.name}  (${s.email}, ${s.products} products, ${s.orders} orders)`));

    const fks = (await pool.query(FK_SQL)).rows;
    const client = await pool.connect();
    const tally = {};
    try {
      await client.query('BEGIN');
      await remove(client, fks, 'shops', 'id = ANY($1::bigint[])', [ids], [], tally);
      if (WITH_SELLERS) {
        await remove(client, fks, 'sellers', 'NOT EXISTS (SELECT 1 FROM shops s WHERE s.seller_id = sellers.id)', [], [], tally);
      }
      console.log('\nRows affected:');
      Object.entries(tally).forEach(([t, n]) => console.log(`  ${t}: ${n}`));
      if (REAL) {
        await client.query('COMMIT');
        console.log('\nDone. The shops are removed.');
      } else {
        await client.query('ROLLBACK');
        console.log('\nNothing was deleted. Add --yes to really remove them.');
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
} catch (err) {
  console.error(`Could not finish: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
