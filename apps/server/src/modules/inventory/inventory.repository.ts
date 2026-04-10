import { v4 as uuid } from 'uuid';

import { env } from '../../config/env.js';
import {
  buildDatabricksTableMap,
  type DatabricksTableKey
} from '../../lib/databricks/identifiers.js';
import {
  runDatabricksCommand,
  runDatabricksQuery
} from '../../lib/databricks/client.js';
import type {
  DecryptedDatabricksConnection,
  InventoryActivityLogEntry,
  InventoryFilters,
  InventoryItem,
  InventoryListResponse,
  InventoryMutationInput
} from '../../types/domain.js';

interface InventoryRow {
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

interface CountRow {
  total: string | number;
}

interface ActivityRow {
  id: string;
  user_id: string;
  inventory_item_id: string | null;
  activity_type: string;
  description: string;
  metadata_json: string | null;
  created_at: string;
}

function toNumber(value: string | number | null | undefined, fallback = 0) {
  if (value === null) {
    return fallback;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numericValue) ? fallback : numericValue;
}

function mapInventoryRow(row: InventoryRow): InventoryItem {
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

function mapActivityRow(row: ActivityRow): InventoryActivityLogEntry {
  return {
    id: row.id,
    userId: row.user_id,
    inventoryItemId: row.inventory_item_id,
    activityType: row.activity_type,
    description: row.description,
    metadataJson: row.metadata_json,
    createdAt: row.created_at
  };
}

const inventorySelect = `
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
`;

export class InventoryRepository {
  private getTable(connection: DecryptedDatabricksConnection, key: DatabricksTableKey) {
    return buildDatabricksTableMap(connection)[key];
  }

  async findMany(
    connection: DecryptedDatabricksConnection,
    userId: string,
    filters: InventoryFilters
  ): Promise<InventoryListResponse> {
    const table = this.getTable(connection, 'inventoryItems');
    const whereClauses = ['user_id = ?'];
    const params: unknown[] = [userId];

    if (filters.search) {
      const search = `%${filters.search.toLowerCase()}%`;
      whereClauses.push(
        '(LOWER(item_name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(COALESCE(category, \'\')) LIKE ? OR LOWER(COALESCE(brand, \'\')) LIKE ?)'
      );
      params.push(search, search, search, search);
    }

    if (filters.category) {
      whereClauses.push('LOWER(COALESCE(category, \'\')) = ?');
      params.push(filters.category.toLowerCase());
    }

    if (filters.status) {
      whereClauses.push('LOWER(status) = ?');
      params.push(filters.status.toLowerCase());
    }

    const orderableColumns = {
      itemName: 'item_name',
      sku: 'sku',
      category: 'category',
      quantityInStock: 'quantity_in_stock',
      totalInventoryValue: 'total_inventory_value',
      purchaseDate: 'purchase_date',
      updatedAt: 'updated_at',
      unitCost: 'unit_cost',
      unitSellingPrice: 'unit_selling_price'
    } satisfies Record<string, string>;

    const sortColumn =
      orderableColumns[(filters.sortBy ?? 'updatedAt') as keyof typeof orderableColumns] ??
      'updated_at';
    const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [items, totalRows] = await Promise.all([
      runDatabricksQuery<InventoryRow>(
        connection,
        `
          ${inventorySelect}
          FROM ${table}
          ${whereSql}
          ORDER BY ${sortColumn} ${sortOrder}
          LIMIT ? OFFSET ?
        `,
        [...params, pageSize, offset]
      ),
      runDatabricksQuery<CountRow>(
        connection,
        `
          SELECT COUNT(*) AS total
          FROM ${table}
          ${whereSql}
        `,
        params
      )
    ]);

    return {
      items: items.map(mapInventoryRow),
      total: toNumber(totalRows[0]?.total ?? null)
    };
  }

  async findById(connection: DecryptedDatabricksConnection, userId: string, id: string) {
    const table = this.getTable(connection, 'inventoryItems');
    const rows = await runDatabricksQuery<InventoryRow>(
      connection,
      `
        ${inventorySelect}
        FROM ${table}
        WHERE user_id = ? AND id = ?
        LIMIT 1
      `,
      [userId, id]
    );

    return rows[0] ? mapInventoryRow(rows[0]) : null;
  }

  async create(
    connection: DecryptedDatabricksConnection,
    userId: string,
    input: InventoryMutationInput
  ) {
    const table = this.getTable(connection, 'inventoryItems');
    const id = uuid();
    const now = new Date().toISOString();
    const totalInventoryValue = Number((input.unitCost * input.quantityInStock).toFixed(2));

    await runDatabricksCommand(
      connection,
      `
        INSERT INTO ${table} (
          id,
          user_id,
          item_name,
          sku,
          category,
          brand,
          supplier,
          purchase_date,
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
          created_at,
          updated_at,
          last_sold_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        userId,
        input.itemName,
        input.sku,
        input.category ?? null,
        input.brand ?? null,
        input.supplier ?? null,
        input.purchaseDate ?? null,
        input.purchasePrice ?? null,
        input.unitCost,
        input.unitSellingPrice,
        input.quantityInStock,
        totalInventoryValue,
        input.status,
        input.condition ?? null,
        input.notes ?? null,
        input.serialOrBatchNumber ?? null,
        input.imageUrl ?? null,
        now,
        now,
        null
      ]
    );

    return this.findById(connection, userId, id);
  }

  async update(
    connection: DecryptedDatabricksConnection,
    userId: string,
    id: string,
    input: InventoryMutationInput
  ) {
    const existing = await this.findById(connection, userId, id);

    if (!existing) {
      return null;
    }

    const table = this.getTable(connection, 'inventoryItems');
    const totalInventoryValue = Number((input.unitCost * input.quantityInStock).toFixed(2));

    await runDatabricksCommand(
      connection,
      `
        UPDATE ${table}
        SET
          item_name = ?,
          sku = ?,
          category = ?,
          brand = ?,
          supplier = ?,
          purchase_date = ?,
          purchase_price = ?,
          unit_cost = ?,
          unit_selling_price = ?,
          quantity_in_stock = ?,
          total_inventory_value = ?,
          status = ?,
          item_condition = ?,
          notes = ?,
          serial_or_batch_number = ?,
          image_url = ?,
          updated_at = ?
        WHERE user_id = ? AND id = ?
      `,
      [
        input.itemName,
        input.sku,
        input.category ?? null,
        input.brand ?? null,
        input.supplier ?? null,
        input.purchaseDate ?? null,
        input.purchasePrice ?? null,
        input.unitCost,
        input.unitSellingPrice,
        input.quantityInStock,
        totalInventoryValue,
        input.status,
        input.condition ?? null,
        input.notes ?? null,
        input.serialOrBatchNumber ?? null,
        input.imageUrl ?? null,
        new Date().toISOString(),
        userId,
        id
      ]
    );

    return this.findById(connection, userId, id);
  }

  async delete(connection: DecryptedDatabricksConnection, userId: string, id: string) {
    const existing = await this.findById(connection, userId, id);

    if (!existing) {
      return false;
    }

    const table = this.getTable(connection, 'inventoryItems');

    await runDatabricksCommand(
      connection,
      `
        DELETE FROM ${table}
        WHERE user_id = ? AND id = ?
      `,
      [userId, id]
    );

    return true;
  }

  async updateStockAfterSale(
    connection: DecryptedDatabricksConnection,
    userId: string,
    id: string,
    quantityInStock: number,
    lastSoldAt: string
  ) {
    const table = this.getTable(connection, 'inventoryItems');
    const rows = await runDatabricksQuery<Pick<InventoryRow, 'unit_cost' | 'status'>>(
      connection,
      `
        SELECT unit_cost, status
        FROM ${table}
        WHERE user_id = ? AND id = ?
        LIMIT 1
      `,
      [userId, id]
    );

    const current = rows[0];

    if (!current) {
      return null;
    }

    const status =
      quantityInStock === 0
        ? 'sold'
        : quantityInStock <= env.DEFAULT_LOW_STOCK_THRESHOLD
          ? 'low_stock'
          : current.status === 'sold'
            ? 'in_stock'
            : current.status;

    await runDatabricksCommand(
      connection,
      `
        UPDATE ${table}
        SET
          quantity_in_stock = ?,
          total_inventory_value = ?,
          status = ?,
          last_sold_at = ?,
          updated_at = ?
        WHERE user_id = ? AND id = ?
      `,
      [
        quantityInStock,
        Number((toNumber(current.unit_cost) * quantityInStock).toFixed(2)),
        status,
        lastSoldAt,
        new Date().toISOString(),
        userId,
        id
      ]
    );

    return this.findById(connection, userId, id);
  }

  async logActivity(
    connection: DecryptedDatabricksConnection,
    input: {
      userId: string;
      inventoryItemId?: string | null;
      activityType: string;
      description: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const table = this.getTable(connection, 'inventoryActivityLog');

    await runDatabricksCommand(
      connection,
      `
        INSERT INTO ${table} (
          id,
          user_id,
          inventory_item_id,
          activity_type,
          description,
          metadata_json,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        uuid(),
        input.userId,
        input.inventoryItemId ?? null,
        input.activityType,
        input.description,
        input.metadata ? JSON.stringify(input.metadata) : null,
        new Date().toISOString()
      ]
    );
  }

  async listRecentActivity(
    connection: DecryptedDatabricksConnection,
    userId: string,
    limit = 10
  ) {
    const table = this.getTable(connection, 'inventoryActivityLog');
    const rows = await runDatabricksQuery<ActivityRow>(
      connection,
      `
        SELECT
          id,
          user_id,
          inventory_item_id,
          activity_type,
          description,
          metadata_json,
          CAST(created_at AS STRING) AS created_at
        FROM ${table}
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      [userId, limit]
    );

    return rows.map(mapActivityRow);
  }
}

export const inventoryRepository = new InventoryRepository();
