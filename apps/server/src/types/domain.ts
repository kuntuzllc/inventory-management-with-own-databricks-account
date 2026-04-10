export type ConnectionStatus =
  | 'pending'
  | 'connected'
  | 'failed'
  | 'initialized'
  | 'disconnected';

export interface AuthUser {
  id: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord extends AuthUser {
  passwordHash: string;
}

export interface DatabricksConnectionRecord {
  id: string;
  userId: string;
  connectionKey: string;
  workspaceName: string | null;
  hostEncrypted: string;
  httpPathEncrypted: string;
  tokenEncrypted: string;
  catalog: string;
  schema: string;
  tablePrefix: string | null;
  connectionStatus: ConnectionStatus;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatabricksConnectionSummary {
  id: string;
  connectionKey: string;
  workspaceName: string | null;
  host: string;
  httpPath: string;
  catalog: string;
  schema: string;
  tablePrefix: string | null;
  connectionStatus: ConnectionStatus;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasToken: boolean;
  tokenMask: string | null;
}

export interface DecryptedDatabricksConnection {
  id: string;
  userId: string;
  connectionKey: string;
  workspaceName: string | null;
  host: string;
  httpPath: string;
  token: string;
  catalog: string;
  schema: string;
  tablePrefix: string | null;
  connectionStatus: ConnectionStatus;
  lastTestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthClaims {
  sub: string;
  username: string;
  workspaceName: string | null;
  connection: DecryptedDatabricksConnection;
}

export interface InventoryItem {
  id: string;
  userId: string;
  itemName: string;
  sku: string;
  category: string | null;
  brand: string | null;
  supplier: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  unitCost: number;
  unitSellingPrice: number;
  quantityInStock: number;
  totalInventoryValue: number;
  status: string;
  condition: string | null;
  notes: string | null;
  serialOrBatchNumber: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastSoldAt: string | null;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
}

export interface InventoryFilters {
  search?: string;
  category?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface InventoryMutationInput {
  itemName: string;
  sku: string;
  category?: string | null;
  brand?: string | null;
  supplier?: string | null;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  unitCost: number;
  unitSellingPrice: number;
  quantityInStock: number;
  status: string;
  condition?: string | null;
  notes?: string | null;
  serialOrBatchNumber?: string | null;
  imageUrl?: string | null;
}

export interface InventorySale {
  id: string;
  userId: string;
  inventoryItemId: string;
  quantitySold: number;
  soldAt: string;
  unitSellingPrice: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  notes: string | null;
  createdAt: string;
}

export interface InventoryImportRun {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  totalRows: number;
  successCount: number;
  failureCount: number;
  mappingJson: string;
  summaryJson: string;
  createdAt: string;
}

export interface InventoryActivityLogEntry {
  id: string;
  userId: string;
  inventoryItemId: string | null;
  activityType: string;
  description: string;
  metadataJson: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  totalInventoryItems: number;
  totalQuantity: number;
  totalInventoryValue: number;
  totalPurchaseCost: number;
  totalExpectedRevenue: number;
  soldItemsTotal: number;
  actualRevenue: number;
  actualProfit: number;
  lowStockItems: InventoryItem[];
  recentActivity: InventoryActivityLogEntry[];
}

export interface ReportRow {
  [key: string]: string | number | null;
}

export interface ReportResult {
  reportType: ReportType;
  generatedAt: string;
  rows: ReportRow[];
  totals: Record<string, number>;
}

export type ReportType =
  | 'valuation'
  | 'sales'
  | 'profit'
  | 'purchases'
  | 'cogs'
  | 'monthly';

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  values: Record<string, string | number | null>;
}

export interface ImportPreviewResponse {
  uploadId: string;
  fileName: string;
  columns: string[];
  sampleRows: ImportPreviewRow[];
  rowCount: number;
  suggestedMapping: Record<string, string | null>;
}

export interface ImportCommitResult {
  importRunId: string;
  successCount: number;
  failureCount: number;
  failures: Array<{
    rowNumber: number;
    message: string;
  }>;
}

export interface DatabricksConnectionInput {
  workspaceName: string;
  host: string;
  httpPath: string;
  token?: string;
  tablePrefix?: string | null;
}

export interface DatabricksConnectionMatch {
  connectionKey: string;
  hasMatch: boolean;
  suggestedAuthFlow: 'login' | 'signup';
  workspaceName: string | null;
  catalog: string;
  schema: string;
}
