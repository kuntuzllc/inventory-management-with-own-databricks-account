import { Router, type Express } from 'express';
import rateLimit from 'express-rate-limit';

import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';
import { authService } from './auth.service.js';
import { loginSchema, signUpSchema } from './auth.schemas.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please wait a moment and try again.',
    code: 'RATE_LIMITED'
  }
});

export function registerAuthRoutes(app: Express) {
  const router = Router();

  router.post(
    '/signup',
    authLimiter,
    validateBody(signUpSchema),
    asyncHandler(async (req, res) => {
      const result = await authService.signUp(req.body);
      res.status(201).json(result);
    })
  );

  router.post(
    '/login',
    authLimiter,
    validateBody(loginSchema),
    asyncHandler(async (req, res) => {
      const result = await authService.login(req.body);
      res.json(result);
    })
  );

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await authService.getCurrentUser(req.auth!);
      res.json({ user });
    })
  );

  router.post(
    '/logout',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await authService.logout(req.auth!);
      res.json(result);
    })
  );

  app.use('/api/auth', router);
}
