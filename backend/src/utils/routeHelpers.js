// Small helpers shared by route files.
import rateLimit from 'express-rate-limit';
import { httpError } from './httpError.js';

// Passes errors from async routes to the app's error handler.
export const handle = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Checks a request body with a zod schema. Throws a 400 with a clear message if it does not fit.
export function parseBody(schema, body, fallback = 'Please check the information you entered.') {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw httpError(400, issue.code === 'invalid_type' ? fallback : issue.message);
  }
  return parsed.data;
}

// A limit on how often one address may call a route (per 15 minutes).
export function limiter(limit, message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
  });
}
