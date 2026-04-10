import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { signAccessToken } from '../../lib/jwt.js';
import { requireAuth } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';
import { databricksConnectionSchema, databricksLookupSchema } from './databricks.schemas.js';
import { databricksService } from './databricks.service.js';

export function registerDatabricksRoutes(app: Express) {
  const router = Router();

  router.post(
    '/onboarding/identify',
    validateBody(databricksLookupSchema),
    asyncHandler(async (req, res) => {
      const match = await databricksService.identifyConnection(req.body);
      res.json(match);
    })
  );

  router.get(
    '/connection',
    requireAuth,
    asyncHandler(async (req, res) => {
      const connection = await databricksService.getSummary(req.auth!);
      res.json({ connection });
    })
  );

  router.put(
    '/connection',
    requireAuth,
    validateBody(databricksConnectionSchema),
    asyncHandler(async (req, res) => {
      const result = await databricksService.saveConnection(req.auth!, req.body);
      res.json({
        connection: result.connection,
        token: signAccessToken(
          { id: req.auth!.sub, username: req.auth!.username },
          result.sessionConnection
        )
      });
    })
  );

  router.post(
    '/connection/test',
    requireAuth,
    validateBody(databricksConnectionSchema),
    asyncHandler(async (req, res) => {
      const result = await databricksService.testConnection(req.auth!, req.body);
      res.json({
        success: result.success,
        message: result.message,
        token: signAccessToken(
          { id: req.auth!.sub, username: req.auth!.username },
          result.sessionConnection
        )
      });
    })
  );

  router.post(
    '/connection/initialize',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await databricksService.initializeTables(req.auth!);
      res.json({
        success: result.success,
        message: result.message,
        token: signAccessToken(
          { id: req.auth!.sub, username: req.auth!.username },
          result.sessionConnection
        )
      });
    })
  );

  router.delete(
    '/connection',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await databricksService.disconnect(req.auth!);
      res.json(result);
    })
  );

  app.use('/api/databricks', router);
}
