import { z } from 'zod';

export const inventoryItemSchema = z.object({
  itemName: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(120),
  category: z.string().trim().max(120).optional().nullable(),
  brand: z.string().trim().max(120).optional().nullable(),
  supplier: z.string().trim().max(120).optional().nullable(),
  purchaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Purchase date must be YYYY-MM-DD')
    .optional()
    .nullable(),
  purchasePrice: z.coerce.number().min(0).optional().nullable(),
  unitCost: z.coerce.number().min(0),
  unitSellingPrice: z.coerce.number().min(0),
  quantityInStock: z.coerce.number().int().min(0),
  status: z.string().trim().min(1).max(50),
  condition: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  serialOrBatchNumber: z.string().trim().max(120).optional().nullable(),
  imageUrl: z
    .union([z.string().trim().url(), z.literal('')])
    .optional()
    .nullable()
});

export const inventoryQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  status: z.string().trim().optional(),
  sortBy: z
    .enum([
      'itemName',
      'sku',
      'category',
      'quantityInStock',
      'totalInventoryValue',
      'purchaseDate',
      'updatedAt',
      'unitCost',
      'unitSellingPrice'
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const inventoryIdSchema = z.object({
  id: z.string().uuid()
});
