import { z } from 'zod';

export const importableInventoryFields = [
  'itemName',
  'sku',
  'category',
  'brand',
  'supplier',
  'purchaseDate',
  'purchasePrice',
  'unitCost',
  'unitSellingPrice',
  'quantityInStock',
  'status',
  'condition',
  'notes',
  'serialOrBatchNumber',
  'imageUrl'
] as const;

export type ImportableInventoryField = (typeof importableInventoryFields)[number];

export const importCommitSchema = z.object({
  uploadId: z.string().min(1),
  fileName: z.string().trim().min(1).optional(),
  mapping: z.record(z.enum(importableInventoryFields), z.string().nullable())
});

export const importTemplateQuerySchema = z.object({
  format: z.enum(['xlsx', 'csv']).default('xlsx')
});
