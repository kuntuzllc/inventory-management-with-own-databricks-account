import fs from 'node:fs/promises';
import path from 'node:path';

import { env } from '../../config/env.js';
import type { DecryptedDatabricksConnection } from '../../types/domain.js';
import { buildDatabricksTableMap } from './identifiers.js';

export async function loadDatabricksStatements(directoryName: 'init' | 'migrations') {
  const directory = path.join(env.repoRoot, 'databricks', directoryName);
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.sql')).sort();

  return Promise.all(files.map(async (file) => fs.readFile(path.join(directory, file), 'utf8')));
}

export async function renderDatabricksStatements(
  connection: DecryptedDatabricksConnection,
  directoryName: 'init' | 'migrations'
) {
  const tableMap = buildDatabricksTableMap(connection);
  const files = await loadDatabricksStatements(directoryName);

  return files.map((template) =>
    template
      .replaceAll('{{TARGET_CATALOG}}', tableMap.catalog)
      .replaceAll('{{TARGET_SCHEMA}}', tableMap.schema)
      .replaceAll('{{APP_USERS_TABLE}}', tableMap.appUsers)
      .replaceAll('{{APP_DATABRICKS_CONNECTIONS_TABLE}}', tableMap.databricksConnections)
      .replaceAll('{{APP_AUDIT_LOGS_TABLE}}', tableMap.auditLogs)
      .replaceAll('{{INVENTORY_ITEMS_TABLE}}', tableMap.inventoryItems)
      .replaceAll('{{INVENTORY_SALES_TABLE}}', tableMap.inventorySales)
      .replaceAll('{{INVENTORY_IMPORTS_TABLE}}', tableMap.inventoryImports)
      .replaceAll('{{INVENTORY_ACTIVITY_LOG_TABLE}}', tableMap.inventoryActivityLog)
      .trim()
  );
}
