import serverless from 'serverless-http';

import { createApp } from '../../apps/server/src/app.js';
import { ensureRuntimeDirectories } from '../../apps/server/src/lib/runtime.js';

const app = createApp();
const expressHandler = serverless(app);
let bootstrapPromise: Promise<void> | null = null;

function bootstrap() {
  if (!bootstrapPromise) {
    bootstrapPromise = ensureRuntimeDirectories();
  }

  return bootstrapPromise;
}

export const handler = async (event: unknown, context: unknown) => {
  await bootstrap();
  return expressHandler(event as never, context as never);
};
