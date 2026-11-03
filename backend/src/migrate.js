// Runs every new .sql file in backend/migrations, in number order.
// Usage (from the backend folder): node src/migrate.js
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './config/db.js';

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations'
);

function errorText(err) {
  return err.message || err.code || err.errors?.[0]?.message || String(err);
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        checksum   TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(migrationsDir))
      .filter((f) => /^\d+_.+\.sql$/.test(f))
      .sort();

    const { rows } = await client.query(
      'SELECT filename, checksum FROM schema_migrations'
    );
    const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

    let ran = 0;
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      // Ignore Windows/Linux line-ending differences when fingerprinting.
      const checksum = createHash('sha256')
        .update(sql.replace(/\r\n/g, '\n'))
        .digest('hex');

      if (applied.has(file)) {
        if (applied.get(file) !== checksum) {
          throw new Error(
            `${file} was changed after it was applied. Never edit an applied migration; add a new numbered file instead.`
          );
        }
        continue;
      }

      console.log(`Applying ${file} ...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [file, checksum]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`${file} failed: ${errorText(err)}`);
      }
      ran += 1;
    }

    console.log(
      ran === 0
        ? 'Database is up to date. Nothing to run.'
        : `Done. ${ran} migration(s) applied.`
    );
  } finally {
    client.release();
  }
}

try {
  await runMigrations();
} catch (err) {
  console.error(`Migration error: ${errorText(err)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
