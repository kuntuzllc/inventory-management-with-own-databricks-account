import { v4 as uuid } from 'uuid';

import { buildDatabricksTableMap } from '../../lib/databricks/identifiers.js';
import { runDatabricksCommand, runDatabricksQuery } from '../../lib/databricks/client.js';
import type {
  AuthUser,
  DecryptedDatabricksConnection,
  UserRecord
} from '../../types/domain.js';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export class AuthRepository {
  async findByUsername(connection: DecryptedDatabricksConnection, username: string) {
    const tables = buildDatabricksTableMap(connection);
    const result = await runDatabricksQuery<UserRow>(
      connection,
      `
        SELECT
          id,
          username,
          password_hash,
          CAST(created_at AS STRING) AS created_at,
          CAST(updated_at AS STRING) AS updated_at
        FROM ${tables.appUsers}
        WHERE LOWER(username) = ?
        LIMIT 1
      `,
      [username.toLowerCase()]
    );

    return result[0] ? mapUserRow(result[0]) : null;
  }

  async findById(connection: DecryptedDatabricksConnection, id: string) {
    const tables = buildDatabricksTableMap(connection);
    const result = await runDatabricksQuery<UserRow>(
      connection,
      `
        SELECT
          id,
          username,
          password_hash,
          CAST(created_at AS STRING) AS created_at,
          CAST(updated_at AS STRING) AS updated_at
        FROM ${tables.appUsers}
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    return result[0] ? mapUserRow(result[0]) : null;
  }

  async create(
    connection: DecryptedDatabricksConnection,
    input: { username: string; passwordHash: string }
  ) {
    const tables = buildDatabricksTableMap(connection);
    const id = uuid();
    const now = new Date().toISOString();

    await runDatabricksCommand(
      connection,
      `
        INSERT INTO ${tables.appUsers} (
          id,
          username,
          password_hash,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [id, input.username, input.passwordHash, now, now]
    );

    return this.findById(connection, id);
  }

  async deleteById(connection: DecryptedDatabricksConnection, id: string) {
    const tables = buildDatabricksTableMap(connection);

    await runDatabricksCommand(
      connection,
      `
        DELETE FROM ${tables.appUsers}
        WHERE id = ?
      `,
      [id]
    );
  }

  toAuthUser(user: UserRecord) {
    return toAuthUser(user);
  }
}

export const authRepository = new AuthRepository();
