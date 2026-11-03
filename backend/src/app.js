// Builds the Express app: security settings, routes and error handling.
// server.js is the file that actually starts it.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import apiRoutes from './routes/index.js';

const app = express();

// Security headers.
app.use(helmet());

// Strict CORS: only the frontend addresses listed in CORS_ORIGIN may call the API.
app.use(
  cors({
    origin(origin, callback) {
      // Requests with no origin (curl, Postman, server-to-server) are allowed.
      if (!origin || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      const err = new Error('Origin not allowed');
      err.status = 403;
      return callback(err);
    },
  })
);

// Read JSON bodies, with a size limit.
app.use(express.json({ limit: '100kb' }));

// Basic rate limit for the whole API (the login routes add stricter limits of their own).
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  })
);

// Routes (the full list is in routes/index.js)
app.use('/api', apiRoutes);

// Anything else: not found.
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) ? err.status : 500;

  if (status >= 500) {
    console.error('Server error:', err);
  }

  let message = err.message;
  if (status >= 500) message = 'Something went wrong on the server';
  else if (err.type === 'entity.parse.failed') message = 'Invalid JSON in request body';
  else if (err.type === 'entity.too.large') message = 'Request body is too large';

  res.status(status).json({ error: message });
});

export default app;
