import type { DecryptedDatabricksConnection } from '../../types/domain.js';
import { AppError } from '../errors.js';

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assertSafeIdentifier(value: string, label: string) {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new AppError(400, `Invalid ${label}`, 'INVALID_IDENTIFIER', { label, value });
  }
}

export function quoteIdentifier(value: string) {
  assertSafeIdentifier(value, 'identifier');
  return `\`${value}\``;
}

export function normalizeTablePrefix(prefix: string | null | undefined) {
  if (!prefix) {
    return '';
  }

  const normalized = prefix.trim().replace(/_+$/g, '');

  if (!normalized) {
    return '';
  }

  assertSafeIdentifier(normalized, 'table prefix');
  return `${normalized}_`;
}

export type DatabricksTableKey =
  | 'appUsers'
  | 'databricksConnections'
  | 'auditLogs'
  | 'inventoryItems'
  | 'inventorySales'
  | 'inventoryImports'
  | 'inventoryActivityLog';

export function buildDatabricksTableMap(connection: DecryptedDatabricksConnection) {
  assertSafeIdentifier(connection.catalog, 'catalog');
  assertSafeIdentifier(connection.schema, 'schema');

  const prefix = normalizeTablePrefix(connection.tablePrefix);
  const tableNames = {
    appUsers: 'app_users',
    databricksConnections: 'app_databricks_connections',
    auditLogs: 'app_audit_logs',
    inventoryItems: `${prefix}inventory_items`,
    inventorySales: `${prefix}inventory_sales`,
    inventoryImports: `${prefix}inventory_imports`,
    inventoryActivityLog: `${prefix}inventory_activity_log`
  } satisfies Record<DatabricksTableKey, string>;

  return {
    catalog: quoteIdentifier(connection.catalog),
    schema: `${quoteIdentifier(connection.catalog)}.${quoteIdentifier(connection.schema)}`,
    appUsers: `${quoteIdentifier(connection.catalog)}.${quoteIdentifier(connection.schema)}.${quoteIdentifier(tableNames.appUsers)}`,
    databricksConnections: `${quoteIdentifier(connection.catalog)}.${quoteIdentifier(connection.schema)}.${quoteIdentifier(tableNames.databricksConnections)}`,
    auditLogs: `${quoteIdentifier(connection.catalog)}.${quoteIdentifier(connection.schema)}.${quoteIdentifier(tableNames.auditLogs)}`,
    inventoryItems: `${quoteIdentifier(connection.catalog)}.${quoteIdentifier(connection.schema)}.${quoteIdentifier(tableNames.inventoryItems)}`,
    inventorySales: `${quoteIdentifier(connection.catalog)}.${quoteIdentifier(connection.schema)}.${quoteIdentifier(tableNames.inventorySales)}`,
    inventoryImports: `${quoteIdentifier(connection.catalog)}.${quoteIdentifier(connection.schema)}.${quoteIdentifier(tableNames.inventoryImports)}`,
    inventoryActivityLog: `${quoteIdentifier(connection.catalog)}.${quoteIdentifier(connection.schema)}.${quoteIdentifier(tableNames.inventoryActivityLog)}`
  };
}
