import { z } from 'zod';

export const reportParamsSchema = z.object({
  reportType: z.enum(['valuation', 'sales', 'profit', 'purchases', 'cogs', 'monthly'])
});

export const reportQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  format: z.enum(['csv', 'xlsx']).optional()
});
