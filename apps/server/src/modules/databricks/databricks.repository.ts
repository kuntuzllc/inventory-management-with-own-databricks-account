import { createHash } from 'node:crypto';
import { v4 as uuid } from 'uuid';

import { decryptSecret, encryptSecret, maskSecret } from '../../lib/crypto.js';
import {
  normalizeDatabricksHost,
  normalizeDatabricksHttpPath
} from '../../lib/databricks/connection-input.js';
import { deriveDatabricksNamespace } from '../../lib/databricks/naming.js';
import { buildDatabricksTableMap } from '../../lib/databricks/identifiers.js';
import { runDatabricksCommand, runDatabricksQuery } from '../../lib/databricks/client.js';
import type {
  DatabricksConnectionRecord,
  DatabricksConnectionSummary,
  ConnectionStatus,
  DecryptedDatabricksConnection
} from '../../types/domain.js';

interface DatabricksConnectionRow {
  id: string;
  user_id: string;
  connection_key: string | null;
  workspace_name: string | null;
  host_encrypted: string;
  http_path_encrypted: string;
  token_encrypted: string;
  catalog: string;
  schema: string;
  table_prefix: string | null;
  connection_status: ConnectionStatus;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapConnectionRecord(row: DatabricksConnectionRow): DatabricksConnectionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    connectionKey: row.connection_key ?? '',
    workspaceName: row.workspace_name,
    hostEncrypted: row.host_encrypted,
    httpPathEncrypted: row.http_path_encrypted,
    tokenEncrypted: row.token_encrypted,
    catalog: row.catalog,
    schema: row.schema,
    tablePrefix: row.table_prefix,
    connectionStatus: row.connection_status,
    lastTestedAt: row.last_tested_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSummary(record: DatabricksConnectionRecord): DatabricksConnectionSummary {
  const host = decryptSecret(record.hostEncrypted);
  const httpPath = decryptSecret(record.httpPathEncrypted);
  const token = decryptSecret(record.tokenEncrypted);

  return {
    id: record.id,
    connectionKey: record.connectionKey,
    workspaceName: record.workspaceName,
    host,
    httpPath,
    catalog: record.catalog,
    schema: record.schema,
    tablePrefix: record.tablePrefix,
    connectionStatus: record.connectionStatus,
    lastTestedAt: record.lastTestedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    hasToken: true,
    tokenMask: maskSecret(token)
  };
}

function mapDecrypted(record: DatabricksConnectionRecord): DecryptedDatabricksConnection {
  return {
    id: record.id,
    userId: record.userId,
    connectionKey: record.connectionKey,
    workspaceName: record.workspaceName,
    host: decryptSecret(record.hostEncrypted),
    httpPath: decryptSecret(record.httpPathEncrypted),
    token: decryptSecret(record.tokenEncrypted),
    catalog: record.catalog,
    schema: record.schema,
    tablePrefix: record.tablePrefix,
    connectionStatus: record.connectionStatus,
    lastTestedAt: record.lastTestedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function buildDatabricksConnectionKey(input: {
  workspaceName?: string | null;
  host: string;
  httpPath: string;
  tablePrefix?: string | null;
  catalog?: string;
  schema?: string;
}) {
  const derivedNamespace =
    input.catalog && input.schema
      ? null
      : deriveDatabricksNamespace(input.workspaceName ?? '');
  const catalog = input.catalog?.trim() ?? derivedNamespace!.catalog;
  const schema = input.schema?.trim() ?? derivedNamespace!.schema;
  const payload = [
    input.host.trim().toLowerCase(),
    input.httpPath.trim(),
    catalog.toLowerCase(),
    schema.toLowerCase(),
    input.tablePrefix?.trim().toLowerCase() ?? ''
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
}

export class DatabricksConnectionRepository {
  async getByUserId(connection: DecryptedDatabricksConnection, userId: string) {
    const tables = buildDatabricksTableMap(connection);
    const result = await runDatabricksQuery<DatabricksConnectionRow>(
      connection,
      `
        SELECT
          id,
          user_id,
          connection_key,
          workspace_name,
          host_encrypted,
          http_path_encrypted,
          token_encrypted,
          catalog,
          schema,
          table_prefix,
          connection_status,
          CAST(last_tested_at AS STRING) AS last_tested_at,
          CAST(created_at AS STRING) AS created_at,
          CAST(updated_at AS STRING) AS updated_at
        FROM ${tables.databricksConnections}
        WHERE user_id = ?
        LIMIT 1
      `,
      [userId]
    );

    return result[0] ? mapConnectionRecord(result[0]) : null;
  }

  async getByConnectionKey(connection: DecryptedDatabricksConnection, connectionKey: string) {
    const tables = buildDatabricksTableMap(connection);
    const result = await runDatabricksQuery<DatabricksConnectionRow>(
      connection,
      `
        SELECT
          id,
          user_id,
          connection_key,
          workspace_name,
          host_encrypted,
          http_path_encrypted,
          token_encrypted,
          catalog,
          schema,
          table_prefix,
          connection_status,
          CAST(last_tested_at AS STRING) AS last_tested_at,
          CAST(created_at AS STRING) AS created_at,
          CAST(updated_at AS STRING) AS updated_at
        FROM ${tables.databricksConnections}
        WHERE connection_key = ?
        LIMIT 1
      `,
      [connectionKey]
    );

    return result[0] ? mapConnectionRecord(result[0]) : null;
  }

  async upsert(
    connection: DecryptedDatabricksConnection,
    userId: string,
    input: {
      workspaceName?: string | null;
      host: string;
      httpPath: string;
      token: string;
      catalog: string;
      schema: string;
      tablePrefix?: string | null;
      status: ConnectionStatus;
    }
  ) {
    const tables = buildDatabricksTableMap(connection);
    const existing = await this.getByUserId(connection, userId);
    const id = existing?.id ?? uuid();
    const connectionKey = buildDatabricksConnectionKey(input);
    const now = new Date().toISOString();

    if (existing) {
      await runDatabricksCommand(
        connection,
        `
          UPDATE ${tables.databricksConnections}
          SET
            connection_key = ?,
            workspace_name = ?,
            host_encrypted = ?,
            http_path_encrypted = ?,
            token_encrypted = ?,
            catalog = ?,
            schema = ?,
            table_prefix = ?,
            connection_status = ?,
            updated_at = ?
          WHERE user_id = ?
        `,
        [
          connectionKey,
          input.workspaceName ?? null,
          encryptSecret(input.host),
          encryptSecret(input.httpPath),
          encryptSecret(input.token),
          input.catalog,
          input.schema,
          input.tablePrefix ?? null,
          input.status,
          now,
          userId
        ]
      );
    } else {
      await runDatabricksCommand(
        connection,
        `
          INSERT INTO ${tables.databricksConnections} (
            id,
            user_id,
            connection_key,
            workspace_name,
            host_encrypted,
            http_path_encrypted,
            token_encrypted,
            catalog,
            schema,
            table_prefix,
            connection_status,
            last_tested_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          userId,
          connectionKey,
          input.workspaceName ?? null,
          encryptSecret(input.host),
          encryptSecret(input.httpPath),
          encryptSecret(input.token),
          input.catalog,
          input.schema,
          input.tablePrefix ?? null,
          input.status,
          null,
          now,
          now
        ]
      );
    }

    const result = await this.getByUserId(connection, userId);
    return result!;
  }

  async updateStatus(
    connection: DecryptedDatabricksConnection,
    userId: string,
    status: ConnectionStatus,
    lastTestedAt = false
  ) {
    const tables = buildDatabricksTableMap(connection);

    await runDatabricksCommand(
      connection,
      `
        UPDATE ${tables.databricksConnections}
        SET
          connection_status = ?,
          last_tested_at = CASE WHEN ? THEN ? ELSE last_tested_at END,
          updated_at = ?
        WHERE user_id = ?
      `,
      [status, lastTestedAt, new Date().toISOString(), new Date().toISOString(), userId]
    );

    return this.getByUserId(connection, userId);
  }

  async delete(connection: DecryptedDatabricksConnection, userId: string) {
    const tables = buildDatabricksTableMap(connection);

    await runDatabricksCommand(
      connection,
      `
        DELETE FROM ${tables.databricksConnections}
        WHERE user_id = ?
      `,
      [userId]
    );
  }

  async updateConnectionKey(
    connection: DecryptedDatabricksConnection,
    userId: string,
    connectionKey: string
  ) {
    const tables = buildDatabricksTableMap(connection);

    await runDatabricksCommand(
      connection,
      `
        UPDATE ${tables.databricksConnections}
        SET connection_key = ?, updated_at = ?
        WHERE user_id = ?
      `,
      [connectionKey, new Date().toISOString(), userId]
    );
  }

  toSummary(record: DatabricksConnectionRecord) {
    return mapSummary(record);
  }

  toDecrypted(record: DatabricksConnectionRecord) {
    return mapDecrypted(record);
  }
}

export const databricksConnectionRepository = new DatabricksConnectionRepository();

