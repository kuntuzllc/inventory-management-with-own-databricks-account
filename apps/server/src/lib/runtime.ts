import fs from 'node:fs/promises';

import { env } from '../config/env.js';

export async function ensureRuntimeDirectories() {
  await Promise.all([
    fs.mkdir(env.uploadDir, { recursive: true }),
    fs.mkdir(env.tempDir, { recursive: true })
  ]);
}
