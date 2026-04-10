import type { AuthClaims, InventoryFilters, InventoryMutationInput } from '../../types/domain.js';
import { AppError } from '../../lib/errors.js';
import { auditRepository } from '../audit/audit.repository.js';
import { inventoryRepository } from './inventory.repository.js';

export class InventoryService {
  async list(auth: AuthClaims, filters: InventoryFilters) {
    return inventoryRepository.findMany(auth.connection, auth.sub, filters);
  }

  async getById(auth: AuthClaims, itemId: string) {
    const item = await inventoryRepository.findById(auth.connection, auth.sub, itemId);

    if (!item) {
      throw new AppError(404, 'Inventory item not found', 'ITEM_NOT_FOUND');
    }

    return item;
  }

  async create(auth: AuthClaims, input: InventoryMutationInput) {
    const item = await inventoryRepository.create(auth.connection, auth.sub, input);

    if (!item) {
      throw new AppError(500, 'Failed to create inventory item', 'CREATE_FAILED');
    }

    await inventoryRepository.logActivity(auth.connection, {
      userId: auth.sub,
      inventoryItemId: item.id,
      activityType: 'inventory.created',
      description: `Created inventory item ${item.itemName}`,
      metadata: {
        sku: item.sku,
        quantityInStock: item.quantityInStock
      }
    });
    await auditRepository.log(auth.connection, auth.sub, 'inventory.created', {
      inventoryItemId: item.id,
      sku: item.sku
    });

    return item;
  }

  async update(auth: AuthClaims, itemId: string, input: InventoryMutationInput) {
    const item = await inventoryRepository.update(auth.connection, auth.sub, itemId, input);

    if (!item) {
      throw new AppError(404, 'Inventory item not found', 'ITEM_NOT_FOUND');
    }

    await inventoryRepository.logActivity(auth.connection, {
      userId: auth.sub,
      inventoryItemId: item.id,
      activityType: 'inventory.updated',
      description: `Updated inventory item ${item.itemName}`,
      metadata: {
        sku: item.sku,
        quantityInStock: item.quantityInStock
      }
    });
    await auditRepository.log(auth.connection, auth.sub, 'inventory.updated', {
      inventoryItemId: item.id
    });

    return item;
  }

  async delete(auth: AuthClaims, itemId: string) {
    const existing = await inventoryRepository.findById(auth.connection, auth.sub, itemId);

    if (!existing) {
      throw new AppError(404, 'Inventory item not found', 'ITEM_NOT_FOUND');
    }

    await inventoryRepository.delete(auth.connection, auth.sub, itemId);
    await inventoryRepository.logActivity(auth.connection, {
      userId: auth.sub,
      inventoryItemId: itemId,
      activityType: 'inventory.deleted',
      description: `Deleted inventory item ${existing.itemName}`,
      metadata: {
        sku: existing.sku
      }
    });
    await auditRepository.log(auth.connection, auth.sub, 'inventory.deleted', {
      inventoryItemId: itemId
    });

    return { success: true };
  }
}

export const inventoryService = new InventoryService();
