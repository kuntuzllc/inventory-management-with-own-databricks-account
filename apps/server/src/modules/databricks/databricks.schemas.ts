import { z } from 'zod';

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Only letters, numbers, and underscores are allowed');

export const databricksConnectionSchema = z.object({
  workspaceName: z.string().trim().min(1, 'Workspace nickname is required').max(120),
  host: z.string().trim().min(1, 'Host is required'),
  httpPath: z.string().trim().min(1, 'HTTP path is required'),
  token: z.string().trim().min(1, 'Personal access token is required').optional(),
  tablePrefix: identifierSchema.optional().nullable().or(z.literal(''))
});

export const databricksLookupSchema = databricksConnectionSchema;
