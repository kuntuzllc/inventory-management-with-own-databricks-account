import path from 'node:path';

import { Router, type Express } from 'express';
import multer from 'multer';

import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';
import { validateBody, validateQuery } from '../../middlewares/validate.js';
import { importsService } from './imports.service.js';
import { importCommitSchema, importTemplateQuerySchema } from './imports.schemas.js';

const importUpload = multer({
  dest: env.tempDir,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (extension === '.csv' || extension === '.xlsx') {
      callback(null, true);
      return;
    }

    callback(new AppError(400, 'Only .csv and .xlsx files are supported'));
  }
});

export function registerImportRoutes(app: Express) {
  const router = Router();

  router.post(
    '/preview',
    requireAuth,
    importUpload.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        throw new AppError(400, 'A file is required for import preview');
      }

      const preview = await importsService.preview(req.file);
      res.json(preview);
    })
  );

  router.post(
    '/commit',
    requireAuth,
    validateBody(importCommitSchema),
    asyncHandler(async (req, res) => {
      const result = await importsService.commit(req.auth!, req.body);
      res.json(result);
    })
  );

  router.get(
    '/history',
    requireAuth,
    asyncHandler(async (req, res) => {
      const imports = await importsService.listHistory(req.auth!);
      res.json({ imports });
    })
  );

  router.get(
    '/template',
    requireAuth,
    validateQuery(importTemplateQuerySchema),
    asyncHandler(async (req, res) => {
      const result = await importsService.generateTemplate(
        (req.query.format as 'xlsx' | 'csv' | undefined) ?? 'xlsx'
      );
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.send(result.buffer);
    })
  );

  app.use('/api/imports', router);
}
