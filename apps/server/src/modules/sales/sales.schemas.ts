import { z } from 'zod';

export const createSaleSchema = z.object({
  inventoryItemId: z.string().uuid(),
  quantitySold: z.coerce.number().int().min(1),
  unitSellingPrice: z.coerce.number().min(0),
  soldAt: z.string().optional(),
  notes: z.string().trim().max(2000).optional().nullable()
});
