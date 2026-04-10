import { v4 as uuid } from 'uuid';

import { buildDatabricksTableMap } from '../../lib/databricks/identifiers.js';
import { runDatabricksCommand, runDatabricksQuery } from '../../lib/databricks/client.js';
import type { DecryptedDatabricksConnection, InventoryImportRun } from '../../types/domain.js';

interface ImportRow {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  total_rows: string | number;
  success_count: string | number;
  failure_count: string | number;
  mapping_json: string;
  summary_json: string;
  created_at: string;
}

function toNumber(value: string | number | null | undefined) {
  return typeof value === 'number' ? value : Number(value);
}

function mapImportRow(row: ImportRow): InventoryImportRun {
  return {
    id: row.id,
    userId: row.user_id,
    fileName: row.file_name,
    fileType: row.file_type,
    totalRows: toNumber(row.total_rows),
    successCount: toNumber(row.success_count),
    failureCount: toNumber(row.failure_count),
    mappingJson: row.mapping_json,
    summaryJson: row.summary_json,
    createdAt: row.created_at
  };
}

export class ImportsRepository {
  async createImportRun(
    connection: DecryptedDatabricksConnection,
    input: {
      userId: string;
      fileName: string;
      fileType: string;
      totalRows: number;
      successCount: number;
      failureCount: number;
      mappingJson: string;
      summaryJson: string;
    }
  ) {
    const tables = buildDatabricksTableMap(connection);
    const id = uuid();

    await runDatabricksCommand(
      connection,
      `
        INSERT INTO ${tables.inventoryImports} (
          id,
          user_id,
          file_name,
          file_type,
          total_rows,
          success_count,
          failure_count,
          mapping_json,
          summary_json,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.userId,
        input.fileName,
        input.fileType,
        input.totalRows,
        input.successCount,
        input.failureCount,
        input.mappingJson,
        input.summaryJson,
        new Date().toISOString()
      ]
    );

    return id;
  }

  async listHistory(connection: DecryptedDatabricksConnection, userId: string) {
    const tables = buildDatabricksTableMap(connection);
    const rows = await runDatabricksQuery<ImportRow>(
      connection,
      `
        SELECT
          id,
          user_id,
          file_name,
          file_type,
          total_rows,
          success_count,
          failure_count,
          mapping_json,
          summary_json,
          CAST(created_at AS STRING) AS created_at
        FROM ${tables.inventoryImports}
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `,
      [userId]
    );

    return rows.map(mapImportRow);
  }
}

export const importsRepository = new ImportsRepository();
