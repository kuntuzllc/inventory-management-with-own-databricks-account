import type {
  ApiErrorShape,
  DashboardSummary,
  DatabricksConnectionInput,
  DatabricksConnectionMatch,
  DatabricksConnectionSummary,
  ImportCommitResult,
  ImportPreviewResponse,
  InventoryImportRun,
  InventoryItem,
  InventoryListResponse,
  ReportResult,
  ReportType,
  User
} from '../types/models';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(payload: ApiErrorShape, status: number) {
    super(payload.error || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => undefined;

export function configureApi(config: {
  getToken: () => string | null;
  onUnauthorized: () => void;
}) {
  getToken = config.getToken;
  onUnauthorized = config.onUnauthorized;
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>) {
  const url = new URL(path, API_BASE_URL);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    headers?: Record<string, string>;
    responseType?: 'json' | 'blob';
  } = {}
) {
  const token = getToken();
  const headers = new Headers(options.headers);
  const isFormData = options.body instanceof FormData;

  if (!isFormData && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const requestOptions: RequestInit = {
    method: options.method ?? 'GET',
    headers
  };

  if (options.body !== undefined) {
    requestOptions.body = isFormData
      ? (options.body as FormData)
      : JSON.stringify(options.body);
  }

  const response = await fetch(buildUrl(path, options.query), requestOptions);

  if (response.status === 401) {
    onUnauthorized();
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({
      error: 'Request failed',
      code: 'REQUEST_FAILED'
    }))) as ApiErrorShape;
    throw new ApiError(payload, response.status);
  }

  if (options.responseType === 'blob') {
    return (await response.blob()) as T;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function resolveServerAssetUrl(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  return `${API_BASE_URL}${value}`;
}

export const api = {
  auth: {
    signUp: (payload: {
      username: string;
      password: string;
      databricksConnection: DatabricksConnectionInput & { token: string };
    }) =>
      request<{ token: string; user: User }>('/api/auth/signup', {
        method: 'POST',
        body: payload
      }),
    login: (payload: {
      workspaceName: string;
      username: string;
      password: string;
      rememberedConnection: string;
    }) =>
      request<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: payload
      }),
    me: () => request<{ user: User }>('/api/auth/me'),
    logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' })
  },
  databricks: {
    identifyConnection: (payload: DatabricksConnectionInput) =>
      request<DatabricksConnectionMatch>('/api/databricks/onboarding/identify', {
        method: 'POST',
        body: payload
      }),
    getConnection: () =>
      request<{ connection: DatabricksConnectionSummary | null }>('/api/databricks/connection'),
    saveConnection: (payload: DatabricksConnectionInput) =>
      request<{ connection: DatabricksConnectionSummary; token: string }>('/api/databricks/connection', {
        method: 'PUT',
        body: payload
      }),
    testConnection: (payload: DatabricksConnectionInput) =>
      request<{ success: boolean; message: string; token: string }>('/api/databricks/connection/test', {
        method: 'POST',
        body: payload
      }),
    initializeConnection: () =>
      request<{ success: boolean; message: string; token: string }>('/api/databricks/connection/initialize', {
        method: 'POST'
      }),
    disconnectConnection: () =>
      request<{ success: boolean }>('/api/databricks/connection', {
        method: 'DELETE'
      })
  },
  dashboard: {
    getSummary: () => request<DashboardSummary>('/api/dashboard/summary')
  },
  inventory: {
    list: (query: Record<string, string | number | undefined>) =>
      request<InventoryListResponse>('/api/inventory', { query }),
    get: (id: string) => request<{ item: InventoryItem }>(`/api/inventory/${id}`),
    create: (payload: Record<string, unknown>) =>
      request<{ item: InventoryItem }>('/api/inventory', {
        method: 'POST',
        body: payload
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      request<{ item: InventoryItem }>(`/api/inventory/${id}`, {
        method: 'PUT',
        body: payload
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/inventory/${id}`, { method: 'DELETE' })
  },
  uploads: {
    image: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return request<{ url: string; fileName: string }>('/api/uploads/images', {
        method: 'POST',
        body: formData
      });
    }
  },
  sales: {
    create: (payload: {
      inventoryItemId: string;
      quantitySold: number;
      unitSellingPrice: number;
      soldAt?: string;
      notes?: string | null;
    }) =>
      request<{
        item: InventoryItem | null;
        sale: {
          inventoryItemId: string;
          quantitySold: number;
          soldAt: string;
          unitSellingPrice: number;
          totalCost: number;
          totalRevenue: number;
          profit: number;
        };
      }>('/api/sales', {
        method: 'POST',
        body: payload
      })
  },
  imports: {
    preview: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return request<ImportPreviewResponse>('/api/imports/preview', {
        method: 'POST',
        body: formData
      });
    },
    commit: (payload: {
      uploadId: string;
      fileName?: string;
      mapping: Record<string, string | null>;
    }) =>
      request<ImportCommitResult>('/api/imports/commit', {
        method: 'POST',
        body: payload
      }),
    history: () => request<{ imports: InventoryImportRun[] }>('/api/imports/history'),
    downloadTemplate: (format: 'csv' | 'xlsx') =>
      request<Blob>('/api/imports/template', {
        query: { format },
        responseType: 'blob'
      })
  },
  reports: {
    get: (reportType: ReportType, query: Record<string, string | undefined>) =>
      request<ReportResult>(`/api/reports/${reportType}`, {
        query
      }),
    export: (reportType: ReportType, query: Record<string, string | undefined>) =>
      request<Blob>(`/api/reports/${reportType}/export`, {
        query,
        responseType: 'blob'
      })
  }
};


