import { buildDatabricksTableMap } from '../../lib/databricks/identifiers.js';
import { runDatabricksQuery } from '../../lib/databricks/client.js';
import type { DecryptedDatabricksConnection, ReportRow, ReportType } from '../../types/domain.js';

interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function withNumericFields<T extends ReportRow>(
  row: ReportRow,
  numericFields: string[]
): T {
  const cloned: ReportRow = { ...row };

  for (const field of numericFields) {
    cloned[field] = toNumber(cloned[field]);
  }

  return cloned as T;
}

function buildDateFilter(
  columnSql: string,
  filters: ReportFilters,
  params: unknown[]
) {
  const clauses: string[] = [];

  if (filters.dateFrom) {
    clauses.push(`DATE(${columnSql}) >= ?`);
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push(`DATE(${columnSql}) <= ?`);
    params.push(filters.dateTo);
  }

  return clauses;
}

export class ReportsRepository {
  async getReport(
    connection: DecryptedDatabricksConnection,
    userId: string,
    reportType: ReportType,
    filters: ReportFilters
  ) {
    const tables = buildDatabricksTableMap(connection);

    switch (reportType) {
      case 'valuation': {
        const params: unknown[] = [userId];
        const whereClauses = ['user_id = ?'];
        whereClauses.push(...buildDateFilter('purchase_date', filters, params));

        const rows = await runDatabricksQuery<ReportRow>(
          connection,
          `
            SELECT
              item_name AS itemName,
              sku,
              category,
              brand,
              supplier,
              quantity_in_stock AS quantityInStock,
              unit_cost AS unitCost,
              unit_selling_price AS unitSellingPrice,
              total_inventory_value AS totalInventoryValue,
              (unit_selling_price * quantity_in_stock) AS expectedRevenue,
              status,
              CAST(updated_at AS STRING) AS updatedAt
            FROM ${tables.inventoryItems}
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY updated_at DESC
          `,
          params
        );

        return rows.map((row) =>
          withNumericFields(row, [
            'quantityInStock',
            'unitCost',
            'unitSellingPrice',
            'totalInventoryValue',
            'expectedRevenue'
          ])
        );
      }

      case 'sales': {
        const params: unknown[] = [userId];
        const whereClauses = ['s.user_id = ?'];
        whereClauses.push(...buildDateFilter('s.sold_at', filters, params));

        const rows = await runDatabricksQuery<ReportRow>(
          connection,
          `
            SELECT
              CAST(s.sold_at AS STRING) AS soldAt,
              i.item_name AS itemName,
              i.sku AS sku,
              s.quantity_sold AS quantitySold,
              s.unit_selling_price AS unitSellingPrice,
              s.total_revenue AS totalRevenue,
              s.notes AS notes
            FROM ${tables.inventorySales} s
            LEFT JOIN ${tables.inventoryItems} i
              ON i.id = s.inventory_item_id AND i.user_id = s.user_id
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY s.sold_at DESC
          `,
          params
        );

        return rows.map((row) =>
          withNumericFields(row, ['quantitySold', 'unitSellingPrice', 'totalRevenue'])
        );
      }

      case 'profit': {
        const params: unknown[] = [userId];
        const whereClauses = ['s.user_id = ?'];
        whereClauses.push(...buildDateFilter('s.sold_at', filters, params));

        const rows = await runDatabricksQuery<ReportRow>(
          connection,
          `
            SELECT
              CAST(s.sold_at AS STRING) AS soldAt,
              i.item_name AS itemName,
              i.sku AS sku,
              s.quantity_sold AS quantitySold,
              s.total_revenue AS totalRevenue,
              s.total_cost AS totalCost,
              s.profit AS profit
            FROM ${tables.inventorySales} s
            LEFT JOIN ${tables.inventoryItems} i
              ON i.id = s.inventory_item_id AND i.user_id = s.user_id
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY s.sold_at DESC
          `,
          params
        );

        return rows.map((row) =>
          withNumericFields(row, ['quantitySold', 'totalRevenue', 'totalCost', 'profit'])
        );
      }

      case 'purchases': {
        const params: unknown[] = [userId, userId];
        const whereClauses = ['i.user_id = ?'];
        whereClauses.push(...buildDateFilter('i.purchase_date', filters, params));

        const rows = await runDatabricksQuery<ReportRow>(
          connection,
          `
            WITH sales_totals AS (
              SELECT
                inventory_item_id,
                SUM(quantity_sold) AS totalSold
              FROM ${tables.inventorySales}
              WHERE user_id = ?
              GROUP BY inventory_item_id
            )
            SELECT
              CAST(i.purchase_date AS STRING) AS purchaseDate,
              i.item_name AS itemName,
              i.sku AS sku,
              i.supplier AS supplier,
              (COALESCE(st.totalSold, 0) + i.quantity_in_stock) AS purchasedQuantity,
              i.unit_cost AS unitCost,
              COALESCE(
                i.purchase_price,
                (COALESCE(st.totalSold, 0) + i.quantity_in_stock) * i.unit_cost
              ) AS purchaseAmount
            FROM ${tables.inventoryItems} i
            LEFT JOIN sales_totals st
              ON st.inventory_item_id = i.id
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY i.purchase_date DESC NULLS LAST, i.updated_at DESC
          `,
          params
        );

        return rows.map((row) =>
          withNumericFields(row, ['purchasedQuantity', 'unitCost', 'purchaseAmount'])
        );
      }

      case 'cogs': {
        const params: unknown[] = [userId];
        const whereClauses = ['s.user_id = ?'];
        whereClauses.push(...buildDateFilter('s.sold_at', filters, params));

        const rows = await runDatabricksQuery<ReportRow>(
          connection,
          `
            SELECT
              CAST(s.sold_at AS STRING) AS soldAt,
              i.item_name AS itemName,
              i.sku AS sku,
              s.quantity_sold AS quantitySold,
              s.total_cost AS totalCost
            FROM ${tables.inventorySales} s
            LEFT JOIN ${tables.inventoryItems} i
              ON i.id = s.inventory_item_id AND i.user_id = s.user_id
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY s.sold_at DESC
          `,
          params
        );

        return rows.map((row) => withNumericFields(row, ['quantitySold', 'totalCost']));
      }

      case 'monthly': {
        const salesAggregateParams: unknown[] = [userId];
        const purchaseWhereParams: unknown[] = [userId];
        const salesWhereParams: unknown[] = [userId];
        const purchaseFilters = buildDateFilter(
          'i.purchase_date',
          filters,
          purchaseWhereParams
        );
        const salesFilters = buildDateFilter('s.sold_at', filters, salesWhereParams);

        const rows = await runDatabricksQuery<ReportRow>(
          connection,
          `
            WITH sales_totals AS (
              SELECT
                inventory_item_id,
                SUM(quantity_sold) AS totalSold
              FROM ${tables.inventorySales}
              WHERE user_id = ?
              GROUP BY inventory_item_id
            ),
            combined AS (
              SELECT
                date_format(i.purchase_date, 'yyyy-MM') AS month,
                COALESCE(
                  i.purchase_price,
                  (COALESCE(st.totalSold, 0) + i.quantity_in_stock) * i.unit_cost
                ) AS purchaseAmount,
                0 AS revenue,
                0 AS cogs,
                0 AS profit
              FROM ${tables.inventoryItems} i
              LEFT JOIN sales_totals st
                ON st.inventory_item_id = i.id
              WHERE i.user_id = ? ${purchaseFilters.length ? `AND ${purchaseFilters.join(' AND ')}` : ''}

              UNION ALL

              SELECT
                date_format(s.sold_at, 'yyyy-MM') AS month,
                0 AS purchaseAmount,
                s.total_revenue AS revenue,
                s.total_cost AS cogs,
                s.profit AS profit
              FROM ${tables.inventorySales} s
              WHERE s.user_id = ? ${salesFilters.length ? `AND ${salesFilters.join(' AND ')}` : ''}
            )
            SELECT
              month,
              SUM(purchaseAmount) AS purchaseAmount,
              SUM(revenue) AS revenue,
              SUM(cogs) AS cogs,
              SUM(profit) AS profit
            FROM combined
            WHERE month IS NOT NULL
            GROUP BY month
            ORDER BY month DESC
          `,
          [...salesAggregateParams, ...purchaseWhereParams, ...salesWhereParams]
        );

        return rows.map((row) =>
          withNumericFields(row, ['purchaseAmount', 'revenue', 'cogs', 'profit'])
        );
      }
    }
  }
}

export const reportsRepository = new ReportsRepository();
