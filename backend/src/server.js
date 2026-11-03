// Starts the backend. Run it with: npm run dev
import app from './app.js';
import { config } from './config/env.js';
import { pool, checkDb } from './config/db.js';

const server = app.listen(config.port, async () => {
  console.log(`VibeYetu API running on http://localhost:${config.port}`);

  const dbOk = await checkDb();
  console.log(
    dbOk
      ? 'Database: connected'
      : 'Database: NOT connected (check DB_* settings in backend/.env and that PostgreSQL is running)'
  );
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Stop the other server or change PORT in .env.`);
  } else {
    console.error('Server failed to start:', err.message);
  }
  process.exit(1);
});

// Close everything cleanly when the server is stopped (Ctrl+C).
async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down...`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  // Safety: force exit if something hangs.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
