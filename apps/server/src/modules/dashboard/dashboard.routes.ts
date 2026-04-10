import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import { dashboardService } from './dashboard.service.js';

export function registerDashboardRoutes(app: Express) {
  const router = Router();

  router.get(
    '/summary',
    requireAuth,
    asyncHandler(async (req, res) => {
      const summary = await dashboardService.getSummary(req.auth!);
      res.json(summary);
    })
  );

  app.use('/api/dashboard', router);
}
