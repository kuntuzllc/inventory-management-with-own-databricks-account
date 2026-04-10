import { maskSecret } from '../../lib/crypto.js';
import { AppError } from '../../lib/errors.js';
import { runDatabricksQuery, runDatabricksStatements } from '../../lib/databricks/client.js';
import {
  normalizeDatabricksHost,
  normalizeDatabricksHttpPath
} from '../../lib/databricks/connection-input.js';
import { deriveDatabricksNamespace } from '../../lib/databricks/naming.js';
import { renderDatabricksStatements } from '../../lib/databricks/sql-templates.js';
import type {
  AuthClaims,
  DatabricksConnectionInput,
  DatabricksConnectionMatch,
  DatabricksConnectionSummary,
  DecryptedDatabricksConnection
} from '../../types/domain.js';
import { auditRepository } from '../audit/audit.repository.js';
import {
  buildDatabricksConnectionKey,
  databricksConnectionRepository
} from './databricks.repository.js';

interface ResolvedDatabricksConnectionInput {
  workspaceName: string;
  host: string;
  httpPath: string;
  token: string | undefined;
  catalog: string;
  schema: string;
  tablePrefix: string | null;
}

function resolveConnectionInput(
  input: DatabricksConnectionInput
): ResolvedDatabricksConnectionInput {
  const namespace = deriveDatabricksNamespace(input.workspaceName);

  return {
    workspaceName: namespace.workspaceName,
    host: normalizeDatabricksHost(input.host),
    httpPath: normalizeDatabricksHttpPath(input.httpPath),
    token: input.token?.trim() || undefined,
    catalog: namespace.catalog,
    schema: namespace.schema,
    tablePrefix: input.tablePrefix?.trim() || null
  };
}

function buildConnectionFromResolved(
  input: ResolvedDatabricksConnectionInput,
  userId: string,
  overrides?: Partial<DecryptedDatabricksConnection>
): DecryptedDatabricksConnection {
  const now = new Date().toISOString();

  return {
    id: overrides?.id ?? 'transient',
    userId,
    connectionKey: overrides?.connectionKey ?? buildDatabricksConnectionKey(input),
    workspaceName: overrides?.workspaceName ?? input.workspaceName,
    host: overrides?.host ?? input.host,
    httpPath: overrides?.httpPath ?? input.httpPath,
    token: overrides?.token ?? input.token ?? '',
    catalog: overrides?.catalog ?? input.catalog,
    schema: overrides?.schema ?? input.schema,
    tablePrefix: overrides?.tablePrefix ?? input.tablePrefix,
    connectionStatus: overrides?.connectionStatus ?? 'pending',
    lastTestedAt: overrides?.lastTestedAt ?? null,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now
  };
}

function buildSummaryFromConnection(
  connection: DecryptedDatabricksConnection
): DatabricksConnectionSummary {
  return {
    id: connection.id,
    connectionKey: connection.connectionKey,
    workspaceName: connection.workspaceName,
    host: connection.host,
    httpPath: connection.httpPath,
    catalog: connection.catalog,
    schema: connection.schema,
    tablePrefix: connection.tablePrefix,
    connectionStatus: connection.connectionStatus,
    lastTestedAt: connection.lastTestedAt,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
    hasToken: Boolean(connection.token),
    tokenMask: maskSecret(connection.token)
  };
}

function isNamespaceMissingError(error: unknown) {
  if (!error) {
    return false;
  }

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : JSON.stringify(error).toLowerCase();

  return (
    message.includes('table_or_view_not_found') ||
    message.includes('schema_not_found') ||
    message.includes('catalog_not_found') ||
    message.includes('no such catalog') ||
    message.includes('no such schema') ||
    message.includes('no such table') ||
    message.includes('table or view not found') ||
    message.includes('cannot be found') ||
    message.includes('does not exist') ||
    (message.includes('app_databricks_connections') && message.includes('not found')) ||
    (message.includes('app_databricks_connections') && message.includes('cannot be found')) ||
    (message.includes('app_databricks_connections') && message.includes('does not exist'))
  );
}

export class DatabricksService {
  private ensureSameWorkspace(
    currentConnection: DecryptedDatabricksConnection,
    nextInput: ResolvedDatabricksConnectionInput
  ) {
    if (
      currentConnection.workspaceName !== nextInput.workspaceName ||
      currentConnection.catalog !== nextInput.catalog ||
      currentConnection.schema !== nextInput.schema
    ) {
      throw new AppError(
        400,
        'To switch to a different Databricks workspace, sign out and log back in with the other workspace details.',
        'RELOGIN_REQUIRED'
      );
    }
  }

  private mergeSessionConnection(
    currentConnection: DecryptedDatabricksConnection,
    overrides: Partial<DecryptedDatabricksConnection>
  ) {
    return {
      ...currentConnection,
      ...overrides,
      updatedAt: overrides.updatedAt ?? new Date().toISOString()
    } satisfies DecryptedDatabricksConnection;
  }

  private async initializeWorkspace(connection: DecryptedDatabricksConnection) {
    const initStatements = await renderDatabricksStatements(connection, 'init');
    const migrationStatements = await renderDatabricksStatements(connection, 'migrations');

    await runDatabricksStatements(connection, [...initStatements, ...migrationStatements]);
  }

  private async getSavedConnectionIfPresent(
    connection: DecryptedDatabricksConnection,
    userId: string
  ) {
    try {
      return await databricksConnectionRepository.getByUserId(connection, userId);
    } catch (error) {
      if (isNamespaceMissingError(error)) {
        return null;
      }

      throw error;
    }
  }

  private async getConnectionMatchIfPresent(
    connection: DecryptedDatabricksConnection,
    connectionKey: string
  ) {
    try {
      return await databricksConnectionRepository.getByConnectionKey(connection, connectionKey);
    } catch (error) {
      if (isNamespaceMissingError(error)) {
        return null;
      }

      throw error;
    }
  }

  getRequiredConnection(auth: AuthClaims) {
    return auth.connection;
  }

  async getSummary(auth: AuthClaims) {
    const savedConnection = await this.getSavedConnectionIfPresent(auth.connection, auth.sub);

    return savedConnection
      ? databricksConnectionRepository.toSummary(savedConnection)
      : buildSummaryFromConnection(auth.connection);
  }

  async identifyConnection(input: DatabricksConnectionInput): Promise<DatabricksConnectionMatch> {
    const resolvedInput = resolveConnectionInput(input);

    if (!resolvedInput.token) {
      throw new AppError(
        400,
        'A personal access token is required to check whether this workspace is already linked.',
        'TOKEN_REQUIRED'
      );
    }

    const transientConnection = buildConnectionFromResolved(resolvedInput, 'transient', {
      token: resolvedInput.token
    });

    await runDatabricksQuery(transientConnection, 'SELECT 1 AS ok');

    const connectionKey = buildDatabricksConnectionKey(resolvedInput);
    const existing = await this.getConnectionMatchIfPresent(transientConnection, connectionKey);

    return {
      connectionKey,
      hasMatch: Boolean(existing),
      suggestedAuthFlow: existing ? 'login' : 'signup',
      workspaceName: existing?.workspaceName ?? resolvedInput.workspaceName,
      catalog: existing?.catalog ?? resolvedInput.catalog,
      schema: existing?.schema ?? resolvedInput.schema
    };
  }

  async testTransientConnection(input: DatabricksConnectionInput & { token: string }) {
    const resolvedInput = resolveConnectionInput(input);
    const transientConnection = buildConnectionFromResolved(resolvedInput, 'transient', {
      token: resolvedInput.token ?? ''
    });

    await runDatabricksQuery(transientConnection, 'SELECT 1 AS ok');

    return {
      success: true,
      message: 'Connection test succeeded',
      connection: transientConnection
    };
  }

  async prepareWorkspace(input: DatabricksConnectionInput & { token: string }) {
    const { connection } = await this.testTransientConnection(input);
    await this.initializeWorkspace(connection);
    return connection;
  }

  async provisionConnectionForUser(
    connection: DecryptedDatabricksConnection,
    userId: string,
    input: DatabricksConnectionInput & { token: string }
  ) {
    const resolvedInput = resolveConnectionInput(input);
    const initializedConnection = this.mergeSessionConnection(connection, {
      userId,
      token: input.token,
      tablePrefix: resolvedInput.tablePrefix,
      connectionStatus: 'initialized',
      connectionKey: buildDatabricksConnectionKey(resolvedInput)
    });

    await this.initializeWorkspace(initializedConnection);

    const record = await databricksConnectionRepository.upsert(initializedConnection, userId, {
      workspaceName: resolvedInput.workspaceName,
      host: resolvedInput.host,
      httpPath: resolvedInput.httpPath,
      token: input.token,
      catalog: resolvedInput.catalog,
      schema: resolvedInput.schema,
      tablePrefix: resolvedInput.tablePrefix,
      status: 'initialized'
    });

    await databricksConnectionRepository.updateStatus(
      initializedConnection,
      userId,
      'initialized',
      true
    );

    return databricksConnectionRepository.toDecrypted(record);
  }

  async saveConnection(auth: AuthClaims, input: DatabricksConnectionInput) {
    const resolvedInput = resolveConnectionInput(input);
    this.ensureSameWorkspace(auth.connection, resolvedInput);

    const token = resolvedInput.token || auth.connection.token;

    if (!token) {
      throw new AppError(400, 'A personal access token is required', 'TOKEN_REQUIRED');
    }

    const updatedConnection = this.mergeSessionConnection(auth.connection, {
      host: resolvedInput.host,
      httpPath: resolvedInput.httpPath,
      token,
      workspaceName: resolvedInput.workspaceName,
      tablePrefix: resolvedInput.tablePrefix,
      connectionKey: buildDatabricksConnectionKey(resolvedInput)
    });

    const record = await databricksConnectionRepository.upsert(auth.connection, auth.sub, {
      workspaceName: resolvedInput.workspaceName,
      host: resolvedInput.host,
      httpPath: resolvedInput.httpPath,
      token,
      catalog: resolvedInput.catalog,
      schema: resolvedInput.schema,
      tablePrefix: resolvedInput.tablePrefix,
      status: updatedConnection.connectionStatus
    });

    await auditRepository.log(auth.connection, auth.sub, 'databricks.updated', {
      workspaceName: resolvedInput.workspaceName,
      catalog: resolvedInput.catalog,
      schema: resolvedInput.schema,
      tablePrefix: resolvedInput.tablePrefix
    });

    return {
      connection: databricksConnectionRepository.toSummary(record),
      sessionConnection: this.mergeSessionConnection(updatedConnection, {
        id: record.id,
        connectionKey: record.connectionKey,
        connectionStatus: record.connectionStatus,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        lastTestedAt: record.lastTestedAt
      })
    };
  }

  async testConnection(auth: AuthClaims, input: DatabricksConnectionInput) {
    const resolvedInput = resolveConnectionInput(input);
    this.ensureSameWorkspace(auth.connection, resolvedInput);

    const token = resolvedInput.token || auth.connection.token;

    if (!token) {
      throw new AppError(400, 'A personal access token is required to test the connection');
    }

    const mergedConnection = this.mergeSessionConnection(auth.connection, {
      host: resolvedInput.host,
      httpPath: resolvedInput.httpPath,
      token,
      workspaceName: resolvedInput.workspaceName,
      tablePrefix: resolvedInput.tablePrefix,
      connectionKey: buildDatabricksConnectionKey(resolvedInput)
    });

    await runDatabricksQuery(mergedConnection, 'SELECT 1 AS ok');

    const savedConnection = await this.getSavedConnectionIfPresent(auth.connection, auth.sub);

    if (savedConnection) {
      await databricksConnectionRepository.upsert(auth.connection, auth.sub, {
        workspaceName: resolvedInput.workspaceName,
        host: resolvedInput.host,
        httpPath: resolvedInput.httpPath,
        token,
        catalog: resolvedInput.catalog,
        schema: resolvedInput.schema,
        tablePrefix: resolvedInput.tablePrefix,
        status: 'connected'
      });
      await databricksConnectionRepository.updateStatus(
        auth.connection,
        auth.sub,
        'connected',
        true
      );
    }

    await auditRepository.log(auth.connection, auth.sub, 'databricks.tested', {
      workspaceName: mergedConnection.workspaceName,
      catalog: mergedConnection.catalog,
      schema: mergedConnection.schema
    });

    return {
      success: true,
      message: 'Connection test succeeded',
      sessionConnection: this.mergeSessionConnection(mergedConnection, {
        connectionStatus: 'connected',
        lastTestedAt: new Date().toISOString()
      })
    };
  }

  async initializeTables(auth: AuthClaims) {
    const connection = auth.connection;
    await this.initializeWorkspace(connection);

    const savedConnection = await this.getSavedConnectionIfPresent(connection, auth.sub);

    if (savedConnection) {
      await databricksConnectionRepository.updateStatus(connection, auth.sub, 'initialized', true);
    }

    await auditRepository.log(connection, auth.sub, 'databricks.initialized', {
      catalog: connection.catalog,
      schema: connection.schema,
      tablePrefix: connection.tablePrefix
    });

    return {
      success: true,
      message: 'Inventory tables are initialized',
      sessionConnection: this.mergeSessionConnection(connection, {
        connectionStatus: 'initialized',
        lastTestedAt: new Date().toISOString()
      })
    };
  }

  async disconnect(auth: AuthClaims) {
    await databricksConnectionRepository.delete(auth.connection, auth.sub);
    await auditRepository.log(auth.connection, auth.sub, 'databricks.disconnected');
    return { success: true };
  }
}

export const databricksService = new DatabricksService();

