// One-off: locks the national ID and KRA PIN of sellers saved before encryption existed.
// Safe to run again: values that are already locked are skipped.
//   node scripts/encrypt-existing.js
import { pool } from '../src/config/db.js';
import { encryptText, isEncrypted } from '../src/utils/crypto.js';

const { rows } = await pool.query('SELECT id, id_number, kra_pin FROM sellers ORDER BY id');
let changed = 0;
for (const r of rows) {
  const idNumber = isEncrypted(r.id_number) ? r.id_number : encryptText(r.id_number);
  const kraPin = !r.kra_pin || isEncrypted(r.kra_pin) ? r.kra_pin : encryptText(r.kra_pin);
  if (idNumber === r.id_number && kraPin === r.kra_pin) continue;
  await pool.query('UPDATE sellers SET id_number = $2, kra_pin = $3 WHERE id = $1', [r.id, idNumber, kraPin]);
  changed += 1;
}
console.log(`Done. ${changed} of ${rows.length} sellers updated.`);
await pool.end();
