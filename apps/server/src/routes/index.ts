import type { Express } from 'express';

import { registerAuthRoutes } from '../modules/auth/auth.routes.js';
import { registerDashboardRoutes } from '../modules/dashboard/dashboard.routes.js';
import { registerDatabricksRoutes } from '../modules/databricks/databricks.routes.js';
import { registerImportRoutes } from '../modules/imports/imports.routes.js';
import { registerInventoryRoutes } from '../modules/inventory/inventory.routes.js';
import { registerReportRoutes } from '../modules/reports/reports.routes.js';
import { registerSalesRoutes } from '../modules/sales/sales.routes.js';
import { registerUploadRoutes } from '../modules/uploads/uploads.routes.js';

export function registerRoutes(app: Express) {
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  registerAuthRoutes(app);
  registerDatabricksRoutes(app);
  registerInventoryRoutes(app);
  registerSalesRoutes(app);
  registerImportRoutes(app);
  registerDashboardRoutes(app);
  registerReportRoutes(app);
  registerUploadRoutes(app);
}
