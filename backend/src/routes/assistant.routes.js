// The help-chat assistant. Anyone may ask; a logged-in buyer's orders help it answer ("where is my order?").
//   POST /api/assistant   body: { message (1-500 chars), lang: "en"|"sw", history?: [{role:"user"|"assistant", text}] (last 4 used) }
//   -> { reply, source: "ai" | "canned" | "guard" }
import { Router } from 'express';
import { z } from 'zod';
import { optionalBuyer } from '../middleware/optionalBuyer.js';
import { answer } from '../services/assistant.service.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';

const router = Router();

const schema = z.object({
  message: z.string('Type your question.').trim().min(1, 'Type your question.').max(500, 'Please keep your question under 500 characters.'),
  lang: z.enum(['en', 'sw']).optional(),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(2000) }))
    .max(20)
    .optional(),
});

router.post(
  '/',
  limiter(40, 'You have asked a lot of questions. Please wait a few minutes and try again.'),
  optionalBuyer,
  handle(async (req, res) => {
    const body = parseBody(schema, req.body, 'Type your question.');
    res.json(await answer({ ...body, buyerId: req.buyerId ?? null }));
  })
);

export default router;
