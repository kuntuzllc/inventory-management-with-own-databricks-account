import { z } from 'zod';
import { databricksConnectionSchema } from '../databricks/databricks.schemas.js';

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must be at most 50 characters')
  .regex(/^[A-Za-z0-9_]+$/, 'Use only letters, numbers, and underscores')
  .transform((value) => value.toLowerCase());

export const signUpSchema = z.object({
  username: usernameSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/[0-9]/, 'Password must include a number'),
  databricksConnection: databricksConnectionSchema.extend({
    token: z.string().trim().min(1, 'Personal access token is required')
  })
});

export const loginSchema = z
  .object({
    workspaceName: z.string().trim().min(1, 'Workspace nickname is required').max(120),
    username: usernameSchema,
    password: z.string().min(1),
    rememberedConnection: z.string().trim().min(1).optional(),
    host: z.string().trim().min(1).optional(),
    httpPath: z.string().trim().min(1).optional(),
    token: z.string().trim().min(1).optional()
  })
  .superRefine((value, context) => {
    const hasRememberedConnection = Boolean(value.rememberedConnection);
    const hasDirectConnection = Boolean(value.host && value.httpPath && value.token);

    if (!hasRememberedConnection && !hasDirectConnection) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A saved workspace bundle or full Databricks connection details are required',
        path: ['rememberedConnection']
      });
    }
  });
