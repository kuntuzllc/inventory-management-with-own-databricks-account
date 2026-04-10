import bcrypt from 'bcryptjs';

import { AppError } from '../../lib/errors.js';
import { readRememberedConnectionBundle, signAccessToken } from '../../lib/jwt.js';
import type { AuthClaims, DatabricksConnectionInput } from '../../types/domain.js';
import { auditRepository } from '../audit/audit.repository.js';
import { databricksConnectionRepository } from '../databricks/databricks.repository.js';
import { databricksService } from '../databricks/databricks.service.js';
import { authRepository } from './auth.repository.js';

export class AuthService {
  async signUp(input: {
    username: string;
    password: string;
    databricksConnection: DatabricksConnectionInput & { token: string };
  }) {
    const onboardingMatch = await databricksService.identifyConnection(input.databricksConnection);

    if (onboardingMatch.hasMatch) {
      throw new AppError(
        409,
        'This Databricks workspace is already linked. Please log in instead.',
        'DATABRICKS_ALREADY_LINKED',
        {
          connectionKey: onboardingMatch.connectionKey
        }
      );
    }

    const workspaceConnection = await databricksService.prepareWorkspace(input.databricksConnection);
    const existingUser = await authRepository.findByUsername(workspaceConnection, input.username);

    if (existingUser) {
      throw new AppError(409, 'That username is already in use', 'USERNAME_IN_USE');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await authRepository.create(workspaceConnection, {
      username: input.username,
      passwordHash
    });

    if (!user) {
      throw new AppError(500, 'Failed to create user account', 'USER_CREATE_FAILED');
    }

    try {
      const sessionConnection = await databricksService.provisionConnectionForUser(
        workspaceConnection,
        user.id,
        input.databricksConnection
      );
      await auditRepository.log(sessionConnection, user.id, 'auth.signup', {
        username: user.username,
        workspaceName: input.databricksConnection.workspaceName
      });

      const authUser = authRepository.toAuthUser(user);

      return {
        token: signAccessToken(authUser, sessionConnection),
        user: authUser
      };
    } catch (error) {
      await authRepository.deleteById(workspaceConnection, user.id);
      throw error;
    }
  }

  async login(input: {
    workspaceName: string;
    username: string;
    password: string;
    rememberedConnection?: string;
    host?: string;
    httpPath?: string;
    token?: string;
  }) {
    const rememberedConnection = input.rememberedConnection
      ? readRememberedConnectionBundle(input.rememberedConnection)
      : null;

    const connectionInput = rememberedConnection
      ? {
          workspaceName: input.workspaceName,
          host: rememberedConnection.host,
          httpPath: rememberedConnection.httpPath,
          token: rememberedConnection.token
        }
      : {
          workspaceName: input.workspaceName,
          host: input.host!,
          httpPath: input.httpPath!,
          token: input.token!
        };

    const { connection: workspaceConnection } = await databricksService.testTransientConnection(
      connectionInput
    );

    const user = await authRepository.findByUsername(workspaceConnection, input.username);

    if (!user) {
      throw new AppError(
        401,
        'Invalid warehouse nickname, username, or password',
        'INVALID_CREDENTIALS'
      );
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(
        401,
        'Invalid warehouse nickname, username, or password',
        'INVALID_CREDENTIALS'
      );
    }

    const savedConnectionRecord = await databricksConnectionRepository.getByUserId(
      workspaceConnection,
      user.id
    );

    if (!savedConnectionRecord) {
      throw new AppError(
        400,
        'No saved Databricks workspace metadata was found for this user. Recreate the account from the Databricks setup page.',
        'DATABRICKS_METADATA_MISSING'
      );
    }

    await databricksConnectionRepository.upsert(workspaceConnection, user.id, {
      workspaceName: savedConnectionRecord.workspaceName ?? input.workspaceName,
      host: connectionInput.host,
      httpPath: connectionInput.httpPath,
      token: connectionInput.token,
      catalog: savedConnectionRecord.catalog,
      schema: savedConnectionRecord.schema,
      tablePrefix: savedConnectionRecord.tablePrefix,
      status: 'connected'
    });
    await databricksConnectionRepository.updateStatus(
      workspaceConnection,
      user.id,
      'connected',
      true
    );

    const refreshedRecord = await databricksConnectionRepository.getByUserId(
      workspaceConnection,
      user.id
    );

    if (!refreshedRecord) {
      throw new AppError(
        500,
        'Failed to load refreshed connection metadata',
        'CONNECTION_LOAD_FAILED'
      );
    }

    const savedConnection = databricksConnectionRepository.toDecrypted(refreshedRecord);
    const sessionConnection = {
      ...savedConnection,
      host: connectionInput.host,
      httpPath: connectionInput.httpPath,
      token: connectionInput.token,
      workspaceName: input.workspaceName
    };

    await auditRepository.log(sessionConnection, user.id, 'auth.login', {
      username: user.username,
      workspaceName: input.workspaceName
    });

    const authUser = authRepository.toAuthUser(user);

    return {
      token: signAccessToken(authUser, sessionConnection),
      user: authUser
    };
  }

  async getCurrentUser(auth: AuthClaims) {
    const user = await authRepository.findById(auth.connection, auth.sub);

    if (!user) {
      throw new AppError(404, 'User account was not found', 'USER_NOT_FOUND');
    }

    return authRepository.toAuthUser(user);
  }

  async logout(auth: AuthClaims) {
    await auditRepository.log(auth.connection, auth.sub, 'auth.logout');
    return { success: true };
  }
}

export const authService = new AuthService();
