import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const serverDir = path.resolve(currentDir, '..', '..');
const repoRoot = path.resolve(serverDir, '..', '..');

dotenv.config({ path: path.join(serverDir, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  APP_ENCRYPTION_KEY: z
    .string()
    .min(16, 'APP_ENCRYPTION_KEY must be at least 16 characters'),
  TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  DEFAULT_LOW_STOCK_THRESHOLD: z.coerce.number().int().min(1).max(500).default(5)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = {
  ...parsed.data,
  repoRoot,
  serverDir,
  uploadDir: path.resolve(serverDir, 'uploads'),
  tempDir: path.resolve(serverDir, 'tmp')
};
