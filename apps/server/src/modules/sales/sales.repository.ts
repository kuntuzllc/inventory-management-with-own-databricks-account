import { v4 as uuid } from 'uuid';

import { buildDatabricksTableMap } from '../../lib/databricks/identifiers.js';
import { runDatabricksCommand } from '../../lib/databricks/client.js';
import type { DecryptedDatabricksConnection } from '../../types/domain.js';

export class SalesRepository {
  async createSale(
    connection: DecryptedDatabricksConnection,
    input: {
      userId: string;
      inventoryItemId: string;
      quantitySold: number;
      soldAt: string;
      unitSellingPrice: number;
      totalRevenue: number;
      totalCost: number;
      profit: number;
      notes?: string | null;
    }
  ) {
    const tables = buildDatabricksTableMap(connection);

    await runDatabricksCommand(
      connection,
      `
        INSERT INTO ${tables.inventorySales} (
          id,
          user_id,
          inventory_item_id,
          quantity_sold,
          sold_at,
          unit_selling_price,
          total_revenue,
          total_cost,
          profit,
          notes,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        uuid(),
        input.userId,
        input.inventoryItemId,
        input.quantitySold,
        input.soldAt,
        input.unitSellingPrice,
        input.totalRevenue,
        input.totalCost,
        input.profit,
        input.notes ?? null,
        new Date().toISOString()
      ]
    );
  }
}

export const salesRepository = new SalesRepository();
