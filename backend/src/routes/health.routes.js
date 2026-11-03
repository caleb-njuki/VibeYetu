// GET /api/health  ->  tells you if the server and the database are working.
import { Router } from 'express';
import { checkDb } from '../config/db.js';

const router = Router();

router.get('/', async (req, res) => {
  const dbOk = await checkDb();

  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'unreachable',
    time: new Date().toISOString(),
  });
});

export default router;
