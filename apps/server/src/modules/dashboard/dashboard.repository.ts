import { env } from '../../config/env.js';
import { buildDatabricksTableMap } from '../../lib/databricks/identifiers.js';
import { runDatabricksQuery } from '../../lib/databricks/client.js';
import type { DashboardSummary, DecryptedDatabricksConnection, InventoryItem } from '../../types/domain.js';
import { inventoryRepository } from '../inventory/inventory.repository.js';

interface SummaryRow {
  total_inventory_items: string | number | null;
  total_quantity: string | number | null;
  total_inventory_value: string | number | null;
  total_purchase_cost: string | number | null;
  total_expected_revenue: string | number | null;
}

interface SalesSummaryRow {
  sold_items_total: string | number | null;
  actual_revenue: string | number | null;
  actual_profit: string | number | null;
}

interface LowStockRow {
  id: string;
  user_id: string;
  item_name: string;
  sku: string;
  category: string | null;
  brand: string | null;
  supplier: string | null;
  purchase_date: string | null;
  purchase_price: string | number | null;
  unit_cost: string | number;
  unit_selling_price: string | number;
  quantity_in_stock: string | number;
  total_inventory_value: string | number;
  status: string;
  item_condition: string | null;
  notes: string | null;
  serial_or_batch_number: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  last_sold_at: string | null;
}

function toNumber(value: string | number | null | undefined, fallback = 0) {
  if (value === null) {
    return fallback;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numericValue) ? fallback : numericValue;
}

function mapLowStockRow(row: LowStockRow): InventoryItem {
  return {
    id: row.id,
    userId: row.user_id,
    itemName: row.item_name,
    sku: row.sku,
    category: row.category,
    brand: row.brand,
    supplier: row.supplier,
    purchaseDate: row.purchase_date,
    purchasePrice: row.purchase_price === null ? null : toNumber(row.purchase_price),
    unitCost: toNumber(row.unit_cost),
    unitSellingPrice: toNumber(row.unit_selling_price),
    quantityInStock: toNumber(row.quantity_in_stock),
    totalInventoryValue: toNumber(row.total_inventory_value),
    status: row.status,
    condition: row.item_condition,
    notes: row.notes,
    serialOrBatchNumber: row.serial_or_batch_number,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSoldAt: row.last_sold_at
  };
}

export class DashboardRepository {
  async getSummary(
    connection: DecryptedDatabricksConnection,
    userId: string
  ): Promise<DashboardSummary> {
    const tables = buildDatabricksTableMap(connection);

    const [inventoryTotalsRows, salesTotalsRows, lowStockRows, recentActivity] = await Promise.all([
      runDatabricksQuery<SummaryRow>(
        connection,
        `
          SELECT
            COUNT(*) AS total_inventory_items,
            COALESCE(SUM(quantity_in_stock), 0) AS total_quantity,
            COALESCE(SUM(total_inventory_value), 0) AS total_inventory_value,
            COALESCE(SUM(COALESCE(purchase_price, unit_cost * quantity_in_stock)), 0) AS total_purchase_cost,
            COALESCE(SUM(unit_selling_price * quantity_in_stock), 0) AS total_expected_revenue
          FROM ${tables.inventoryItems}
          WHERE user_id = ?
        `,
        [userId]
      ),
      runDatabricksQuery<SalesSummaryRow>(
        connection,
        `
          SELECT
            COALESCE(SUM(quantity_sold), 0) AS sold_items_total,
            COALESCE(SUM(total_revenue), 0) AS actual_revenue,
            COALESCE(SUM(profit), 0) AS actual_profit
          FROM ${tables.inventorySales}
          WHERE user_id = ?
        `,
        [userId]
      ),
      runDatabricksQuery<LowStockRow>(
        connection,
        `
          SELECT
            id,
            user_id,
            item_name,
            sku,
            category,
            brand,
            supplier,
            CAST(purchase_date AS STRING) AS purchase_date,
            purchase_price,
            unit_cost,
            unit_selling_price,
            quantity_in_stock,
            total_inventory_value,
            status,
            item_condition,
            notes,
            serial_or_batch_number,
            image_url,
            CAST(created_at AS STRING) AS created_at,
            CAST(updated_at AS STRING) AS updated_at,
            CAST(last_sold_at AS STRING) AS last_sold_at
          FROM ${tables.inventoryItems}
          WHERE user_id = ? AND quantity_in_stock > 0 AND quantity_in_stock <= ?
          ORDER BY quantity_in_stock ASC, updated_at DESC
          LIMIT 5
        `,
        [userId, env.DEFAULT_LOW_STOCK_THRESHOLD]
      ),
      inventoryRepository.listRecentActivity(connection, userId, 10)
    ]);

    const inventoryTotals = inventoryTotalsRows[0];
    const salesTotals = salesTotalsRows[0];

    return {
      totalInventoryItems: toNumber(inventoryTotals?.total_inventory_items ?? null),
      totalQuantity: toNumber(inventoryTotals?.total_quantity ?? null),
      totalInventoryValue: toNumber(inventoryTotals?.total_inventory_value ?? null),
      totalPurchaseCost: toNumber(inventoryTotals?.total_purchase_cost ?? null),
      totalExpectedRevenue: toNumber(inventoryTotals?.total_expected_revenue ?? null),
      soldItemsTotal: toNumber(salesTotals?.sold_items_total ?? null),
      actualRevenue: toNumber(salesTotals?.actual_revenue ?? null),
      actualProfit: toNumber(salesTotals?.actual_profit ?? null),
      lowStockItems: lowStockRows.map(mapLowStockRow),
      recentActivity
    };
  }
}

export const dashboardRepository = new DashboardRepository();
