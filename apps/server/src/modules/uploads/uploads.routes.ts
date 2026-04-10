import path from 'node:path';

import { Router, type Express } from 'express';
import multer from 'multer';
import { v4 as uuid } from 'uuid';

import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middlewares/auth.js';

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, env.uploadDir);
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${uuid()}${extension}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith('image/')) {
      callback(null, true);
      return;
    }

    callback(new AppError(400, 'Only image uploads are allowed'));
  }
});

export function registerUploadRoutes(app: Express) {
  const router = Router();

  router.post(
    '/images',
    requireAuth,
    imageUpload.single('file'),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        throw new AppError(400, 'An image file is required');
      }

      res.status(201).json({
        url: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname
      });
    })
  );

  app.use('/api/uploads', router);
}
