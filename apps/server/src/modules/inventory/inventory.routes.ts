import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate.js';
import { inventoryService } from './inventory.service.js';
import {
  inventoryIdSchema,
  inventoryItemSchema,
  inventoryQuerySchema
} from './inventory.schemas.js';

export function registerInventoryRoutes(app: Express) {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    validateQuery(inventoryQuerySchema),
    asyncHandler(async (req, res) => {
      const result = await inventoryService.list(req.auth!, req.query);
      res.json(result);
    })
  );

  router.get(
    '/:id',
    requireAuth,
    validateParams(inventoryIdSchema),
    asyncHandler(async (req, res) => {
      const item = await inventoryService.getById(req.auth!, String(req.params.id));
      res.json({ item });
    })
  );

  router.post(
    '/',
    requireAuth,
    validateBody(inventoryItemSchema),
    asyncHandler(async (req, res) => {
      const item = await inventoryService.create(req.auth!, req.body);
      res.status(201).json({ item });
    })
  );

  router.put(
    '/:id',
    requireAuth,
    validateParams(inventoryIdSchema),
    validateBody(inventoryItemSchema),
    asyncHandler(async (req, res) => {
      const item = await inventoryService.update(req.auth!, String(req.params.id), req.body);
      res.json({ item });
    })
  );

  router.delete(
    '/:id',
    requireAuth,
    validateParams(inventoryIdSchema),
    asyncHandler(async (req, res) => {
      const result = await inventoryService.delete(req.auth!, String(req.params.id));
      res.json(result);
    })
  );

  app.use('/api/inventory', router);
}
