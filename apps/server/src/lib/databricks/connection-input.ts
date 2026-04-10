import { AppError } from '../errors.js';

export function normalizeDatabricksHost(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new AppError(400, 'Databricks host is required', 'HOST_REQUIRED');
  }

  const withProtocol = trimmed
    .replace(/^https?(?=\/\/)/i, (match) => `${match}:`)
    .replace(/^\/+/, '');

  const candidate = /^https?:\/\//i.test(withProtocol)
    ? withProtocol
    : `https://${withProtocol}`;

  try {
    const url = new URL(candidate);

    if (!url.hostname) {
      throw new Error('Missing hostname');
    }

    return url.host;
  } catch {
    throw new AppError(
      400,
      'Enter a valid Databricks host, such as dbc-fc271e0e-e88e.cloud.databricks.com',
      'INVALID_DATABRICKS_HOST'
    );
  }
}

export function normalizeDatabricksHttpPath(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new AppError(400, 'SQL warehouse HTTP path is required', 'HTTP_PATH_REQUIRED');
  }

  const withProtocol = trimmed.replace(/^https?(?=\/\/)/i, (match) => `${match}:`);

  if (/^https?:\/\//i.test(withProtocol)) {
    try {
      const url = new URL(withProtocol);
      return url.pathname || '/';
    } catch {
      throw new AppError(
        400,
        'Enter a valid SQL warehouse HTTP path',
        'INVALID_DATABRICKS_HTTP_PATH'
      );
    }
  }

  return withProtocol.startsWith('/') ? withProtocol : `/${withProtocol}`;
}
