import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { ensureRuntimeDirectories } from './lib/runtime.js';

async function start() {
  await ensureRuntimeDirectories();

  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'InventorySelf server is listening');
  });
}

start().catch((error) => {
  logger.error({ err: error }, 'Failed to start server');
  process.exit(1);
});
