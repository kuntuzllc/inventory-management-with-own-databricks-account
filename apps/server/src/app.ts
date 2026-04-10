import express, { type RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { registerRoutes } from './routes/index.js';

export function createApp() {
  const app = express();
  const pinoHttpMiddleware = pinoHttp as unknown as (options: {
    logger: typeof logger;
  }) => RequestHandler;

  app.disable('x-powered-by');
  app.set('etag', false);
  app.use(
    cors({
      origin: env.APP_ORIGIN,
      credentials: false
    })
  );
  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttpMiddleware({ logger }));
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/uploads', express.static(env.uploadDir));

  registerRoutes(app);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
