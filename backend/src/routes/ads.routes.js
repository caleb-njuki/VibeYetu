// Ads for buyers.
//   GET  /api/ads?lat=&lng=&radiusKm=     live ads from shops near the buyer (up to 6, random order)
//   POST /api/ads/:adId/report            buyer signed in. body: { reason: "Misleading"|"Offensive"|"Spam" }
import { Router } from 'express';
import { z } from 'zod';
import { requireBuyer } from '../middleware/auth.js';
import { listLiveAds, reportAd } from '../services/ad.service.js';
import { parseNear } from '../utils/near.js';
import { handle, parseBody, limiter } from '../utils/routeHelpers.js';
import { REPORT_REASONS } from '../utils/adRules.js';

const router = Router();
const reportSchema = z.object({ reason: z.enum(REPORT_REASONS, 'Choose a reason.') });

router.get('/', handle(async (req, res) => res.json(await listLiveAds(parseNear(req.query)))));
router.post('/:adId/report', requireBuyer, limiter(60, 'Too many reports. Please wait a few minutes.'), handle(async (req, res) => {
  const { reason } = parseBody(reportSchema, req.body, 'Choose a reason.');
  res.json(await reportAd(req.buyer.id, req.params.adId, reason));
}));

export default router;
