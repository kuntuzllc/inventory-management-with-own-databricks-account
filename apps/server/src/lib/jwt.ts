import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { decryptJson, encryptJson } from './crypto.js';
import type { AuthClaims, ConnectionStatus, DecryptedDatabricksConnection } from '../types/domain.js';

interface TokenPayload {
  username: string;
  workspaceName: string | null;
  cx: string;
}

const validConnectionStatuses = new Set<ConnectionStatus>([
  'pending',
  'connected',
  'failed',
  'initialized',
  'disconnected'
]);

function asString(value: unknown, label: string) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid JWT connection payload: ${label}`);
  }

  return value;
}

function assertConnectionPayload(value: unknown): DecryptedDatabricksConnection {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid JWT connection payload');
  }

  const connection = value as Record<string, unknown>;
  const connectionStatus = asString(connection.connectionStatus ?? 'connected', 'connectionStatus');

  return {
    id: asString(connection.id, 'id'),
    userId: asString(connection.userId, 'userId'),
    connectionKey: asString(connection.connectionKey, 'connectionKey'),
    workspaceName:
      typeof connection.workspaceName === 'string' || connection.workspaceName === null
        ? connection.workspaceName
        : null,
    host: asString(connection.host, 'host'),
    httpPath: asString(connection.httpPath, 'httpPath'),
    token: asString(connection.token, 'token'),
    catalog: asString(connection.catalog, 'catalog'),
    schema: asString(connection.schema, 'schema'),
    tablePrefix:
      typeof connection.tablePrefix === 'string' || connection.tablePrefix === null
        ? connection.tablePrefix
        : null,
    connectionStatus: validConnectionStatuses.has(connectionStatus as ConnectionStatus)
      ? (connectionStatus as ConnectionStatus)
      : 'connected',
    lastTestedAt:
      typeof connection.lastTestedAt === 'string' || connection.lastTestedAt === null
        ? connection.lastTestedAt
        : null,
    createdAt: asString(connection.createdAt, 'createdAt'),
    updatedAt: asString(connection.updatedAt, 'updatedAt')
  };
}

export function signAccessToken(
  user: { id: string; username: string },
  connection: DecryptedDatabricksConnection
) {
  const payload: TokenPayload = {
    username: user.username,
    workspaceName: connection.workspaceName ?? null,
    cx: encryptJson(connection)
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: `${env.TOKEN_TTL_HOURS}h`
  });
}

export function readRememberedConnectionBundle(bundle: string) {
  return assertConnectionPayload(decryptJson(bundle));
}

export function verifyAccessToken(token: string) {
  const payload = jwt.verify(token, env.JWT_SECRET);

  if (
    typeof payload !== 'object' ||
    !payload.sub ||
    !payload.username ||
    typeof payload.cx !== 'string'
  ) {
    throw new Error('Invalid JWT payload');
  }

  return {
    sub: String(payload.sub),
    username: String(payload.username),
    workspaceName:
      typeof payload.workspaceName === 'string' || payload.workspaceName === null
        ? payload.workspaceName
        : null,
    connection: readRememberedConnectionBundle(payload.cx)
  } satisfies AuthClaims;
}
