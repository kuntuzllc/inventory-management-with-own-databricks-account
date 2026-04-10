import { v4 as uuid } from 'uuid';

import { buildDatabricksTableMap } from '../../lib/databricks/identifiers.js';
import { runDatabricksCommand } from '../../lib/databricks/client.js';
import type { DecryptedDatabricksConnection } from '../../types/domain.js';

export class AuditRepository {
  async log(
    connection: DecryptedDatabricksConnection,
    userId: string | null,
    action: string,
    details?: Record<string, unknown>
  ) {
    const tables = buildDatabricksTableMap(connection);

    await runDatabricksCommand(
      connection,
      `
        INSERT INTO ${tables.auditLogs} (
          id,
          user_id,
          action,
          details_json,
          created_at
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [uuid(), userId, action, details ? JSON.stringify(details) : null, new Date().toISOString()]
    );
  }
}

export const auditRepository = new AuditRepository();
