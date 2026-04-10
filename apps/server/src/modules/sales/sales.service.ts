import type { AuthClaims } from '../../types/domain.js';
import { AppError } from '../../lib/errors.js';
import { auditRepository } from '../audit/audit.repository.js';
import { inventoryRepository } from '../inventory/inventory.repository.js';
import { salesRepository } from './sales.repository.js';

export class SalesService {
  async createSale(
    auth: AuthClaims,
    input: {
      inventoryItemId: string;
      quantitySold: number;
      unitSellingPrice: number;
      soldAt?: string;
      notes?: string | null;
    }
  ) {
    const item = await inventoryRepository.findById(auth.connection, auth.sub, input.inventoryItemId);

    if (!item) {
      throw new AppError(404, 'Inventory item not found', 'ITEM_NOT_FOUND');
    }

    if (input.quantitySold > item.quantityInStock) {
      throw new AppError(
        400,
        'Cannot sell more units than are currently in stock',
        'INSUFFICIENT_STOCK'
      );
    }

    const soldAt = input.soldAt ?? new Date().toISOString();
    const totalCost = Number((item.unitCost * input.quantitySold).toFixed(2));
    const totalRevenue = Number((input.unitSellingPrice * input.quantitySold).toFixed(2));
    const profit = Number((totalRevenue - totalCost).toFixed(2));
    const nextQuantity = item.quantityInStock - input.quantitySold;

    await salesRepository.createSale(auth.connection, {
      userId: auth.sub,
      inventoryItemId: item.id,
      quantitySold: input.quantitySold,
      soldAt,
      unitSellingPrice: input.unitSellingPrice,
      totalRevenue,
      totalCost,
      profit,
      notes: input.notes ?? null
    });

    const updatedItem = await inventoryRepository.updateStockAfterSale(
      auth.connection,
      auth.sub,
      item.id,
      nextQuantity,
      soldAt
    );

    await inventoryRepository.logActivity(auth.connection, {
      userId: auth.sub,
      inventoryItemId: item.id,
      activityType: 'inventory.sold',
      description: `Sold ${input.quantitySold} unit(s) of ${item.itemName}`,
      metadata: {
        quantitySold: input.quantitySold,
        totalRevenue,
        totalCost,
        profit
      }
    });
    await auditRepository.log(auth.connection, auth.sub, 'inventory.sold', {
      inventoryItemId: item.id,
      quantitySold: input.quantitySold,
      totalRevenue,
      profit
    });

    return {
      item: updatedItem,
      sale: {
        inventoryItemId: item.id,
        quantitySold: input.quantitySold,
        soldAt,
        unitSellingPrice: input.unitSellingPrice,
        totalCost,
        totalRevenue,
        profit
      }
    };
  }
}

export const salesService = new SalesService();
