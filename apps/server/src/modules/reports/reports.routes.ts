import { Router, type Express } from 'express';

import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import { validateParams, validateQuery } from '../../middlewares/validate.js';
import { reportsService } from './reports.service.js';
import { reportParamsSchema, reportQuerySchema } from './reports.schemas.js';

export function registerReportRoutes(app: Express) {
  const router = Router();

  router.get(
    '/:reportType',
    requireAuth,
    validateParams(reportParamsSchema),
    validateQuery(reportQuerySchema),
    asyncHandler(async (req, res) => {
      const report = await reportsService.getReport(
        req.auth!,
        req.params.reportType as import('../../types/domain.js').ReportType,
        req.query
      );
      res.json(report);
    })
  );

  router.get(
    '/:reportType/export',
    requireAuth,
    validateParams(reportParamsSchema),
    validateQuery(reportQuerySchema),
    asyncHandler(async (req, res) => {
      const format = req.query.format ?? 'csv';
      const result = await reportsService.exportReport(
        req.auth!,
        req.params.reportType as import('../../types/domain.js').ReportType,
        req.query,
        format === 'xlsx' ? 'xlsx' : 'csv'
      );
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.send(result.buffer);
    })
  );

  app.use('/api/reports', router);
}
