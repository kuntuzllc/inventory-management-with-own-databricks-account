import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';
import { salesService } from './sales.service.js';
import { createSaleSchema } from './sales.schemas.js';

export function registerSalesRoutes(app: Express) {
  const router = Router();

  router.post(
    '/',
    requireAuth,
    validateBody(createSaleSchema),
    asyncHandler(async (req, res) => {
      const result = await salesService.createSale(req.auth!, req.body);
      res.status(201).json(result);
    })
  );

  app.use('/api/sales', router);
}
