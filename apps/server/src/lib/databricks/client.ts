import { DBSQLClient } from '@databricks/sql';

import { logger } from '../../config/logger.js';
import { AppError } from '../errors.js';
import type { DecryptedDatabricksConnection } from '../../types/domain.js';

export type DatabricksSqlValue = string | number | boolean | null;

function normalizeParameter(value: unknown): DatabricksSqlValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return JSON.stringify(value);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function toErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function mapDatabricksClientError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  const message = toErrorMessage(error);
  const normalized = message.toLowerCase();
  const code = toErrorCode(error);

  if (code === 'ENOTFOUND' || normalized.includes('enotfound')) {
    return new AppError(
      400,
      'Could not reach the Databricks host. Check the host value and remove any extra prefixes.',
      'DATABRICKS_HOST_UNREACHABLE'
    );
  }

  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    normalized.includes('econnrefused') ||
    normalized.includes('etimedout') ||
    normalized.includes('network')
  ) {
    return new AppError(
      502,
      'Could not connect to Databricks. Check the host, SQL warehouse HTTP path, and network access.',
      'DATABRICKS_CONNECT_FAILED'
    );
  }

  if (
    normalized.includes('401') ||
    normalized.includes('403') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('invalid access token') ||
    normalized.includes('authentication')
  ) {
    return new AppError(
      401,
      'Databricks authentication failed. Check the personal access token and warehouse permissions.',
      'DATABRICKS_AUTH_FAILED'
    );
  }

  if (
    normalized.includes('/sql/1.0/warehouses/') &&
    (normalized.includes('404') || normalized.includes('not found'))
  ) {
    return new AppError(
      400,
      'The SQL warehouse HTTP path looks invalid. Check that you pasted the correct warehouse path.',
      'INVALID_DATABRICKS_HTTP_PATH'
    );
  }

  return null;
}

export async function withDatabricksSession<T>(
  connection: DecryptedDatabricksConnection,
  callback: (session: {
    executeStatement: (
      statement: string,
      options?: Record<string, unknown>
    ) => Promise<{
      fetchAll: () => Promise<unknown>;
      close: () => Promise<unknown>;
    }>;
    close: () => Promise<unknown>;
  }) => Promise<T>
) {
  const client = new DBSQLClient();
  let connectedClient:
    | {
        openSession: (options?: Record<string, unknown>) => Promise<{
          executeStatement: (
            statement: string,
            options?: Record<string, unknown>
          ) => Promise<{
            fetchAll: () => Promise<unknown>;
            close: () => Promise<unknown>;
          }>;
          close: () => Promise<unknown>;
        }>;
        close: () => Promise<unknown>;
      }
    | null = null;
  let session:
    | {
        executeStatement: (
          statement: string,
          options?: Record<string, unknown>
        ) => Promise<{
          fetchAll: () => Promise<unknown>;
          close: () => Promise<unknown>;
        }>;
        close: () => Promise<unknown>;
      }
    | null = null;

  try {
    connectedClient = await client.connect({
      host: connection.host,
      path: connection.httpPath,
      token: connection.token,
      userAgentEntry: 'inventory-self'
    });

    session = await connectedClient.openSession({
      configuration: {
        query_tags: 'app:inventory-self'
      }
    });

    return await callback(session);
  } catch (error) {
    throw mapDatabricksClientError(error) ?? error;
  } finally {
    if (session) {
      await session.close().catch((error) => {
        logger.warn({ err: error }, 'Failed to close Databricks session cleanly');
      });
    }

    if (connectedClient) {
      await connectedClient.close().catch((error) => {
        logger.warn({ err: error }, 'Failed to close Databricks client cleanly');
      });
    }
  }
}

export async function runDatabricksQuery<T>(
  connection: DecryptedDatabricksConnection,
  statement: string,
  parameters: unknown[] = []
) {
  return withDatabricksSession(connection, async (session) => {
    logger.debug({ statement }, 'Executing Databricks query');
    const operation = await session.executeStatement(statement, {
      runAsync: true,
      maxRows: 10_000,
      ordinalParameters: parameters.map(normalizeParameter)
    });

    try {
      const rows = (await operation.fetchAll()) as unknown as T[];
      return rows;
    } finally {
      await operation.close();
    }
  });
}

export async function runDatabricksCommand(
  connection: DecryptedDatabricksConnection,
  statement: string,
  parameters: unknown[] = []
) {
  await withDatabricksSession(connection, async (session) => {
    logger.debug({ statement }, 'Executing Databricks command');
    const operation = await session.executeStatement(statement, {
      runAsync: true,
      maxRows: 1,
      ordinalParameters: parameters.map(normalizeParameter)
    });

    try {
      await operation.fetchAll();
    } finally {
      await operation.close();
    }
  });
}

export async function runDatabricksStatements(
  connection: DecryptedDatabricksConnection,
  statements: string[]
) {
  await withDatabricksSession(connection, async (session) => {
    for (const statement of statements) {
      logger.debug({ statement }, 'Executing Databricks migration statement');
      const operation = await session.executeStatement(statement, {
        runAsync: true,
        maxRows: 1
      });

      try {
        await operation.fetchAll();
      } finally {
        await operation.close();
      }
    }
  });
}
