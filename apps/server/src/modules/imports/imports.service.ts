import fs from 'node:fs/promises';
import path from 'node:path';

import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import type {
  AuthClaims,
  ImportCommitResult,
  ImportPreviewResponse,
  ImportPreviewRow
} from '../../types/domain.js';
import { auditRepository } from '../audit/audit.repository.js';
import { inventoryRepository } from '../inventory/inventory.repository.js';
import { importsRepository } from './imports.repository.js';
import {
  importableInventoryFields,
  type ImportableInventoryField
} from './imports.schemas.js';

type RawSheetRow = Record<string, unknown>;

function normalizeExcelValue(value: ExcelJS.CellValue | null | undefined): string | number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'object') {
    if ('result' in value) {
      const result = value.result;
      return typeof result === 'number' || typeof result === 'string' ? result : null;
    }

    if ('text' in value) {
      return value.text ?? null;
    }
  }

  return String(value);
}

function normalizeHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildSuggestedMapping(columns: string[]) {
  const normalizedToOriginal = new Map(columns.map((column) => [normalizeHeader(column), column]));
  const aliases: Record<ImportableInventoryField, string[]> = {
    itemName: ['itemname', 'name', 'productname', 'item'],
    sku: ['sku', 'itemsku', 'productsku'],
    category: ['category'],
    brand: ['brand'],
    supplier: ['supplier', 'vendor'],
    purchaseDate: ['purchasedate', 'datepurchased'],
    purchasePrice: ['purchaseprice', 'totalpurchaseprice', 'purchaseamount'],
    unitCost: ['unitcost', 'cost', 'costperunit'],
    unitSellingPrice: ['unitsellingprice', 'sellingprice', 'saleprice', 'price'],
    quantityInStock: ['quantityinstock', 'quantity', 'stock', 'qty'],
    status: ['status'],
    condition: ['condition'],
    notes: ['notes', 'description'],
    serialOrBatchNumber: ['serialnumber', 'batchnumber', 'serialorbatchnumber'],
    imageUrl: ['imageurl', 'image']
  };

  return Object.fromEntries(
    importableInventoryFields.map((field) => [
      field,
      aliases[field].map((alias) => normalizedToOriginal.get(alias)).find(Boolean) ?? null
    ])
  ) as Record<ImportableInventoryField, string | null>;
}

async function readWorksheet(filePath: string) {
  const fileType = path.extname(filePath).toLowerCase().replace('.', '') || 'xlsx';

  if (fileType === 'csv') {
    const csvContent = await fs.readFile(filePath, 'utf8');
    const rows = parseCsv(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    }) as RawSheetRow[];

    return {
      rows,
      fileType
    };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new AppError(400, 'The uploaded file does not contain any worksheets');
  }

  const headerValues = worksheet.getRow(1).values as Array<ExcelJS.CellValue | null | undefined>;
  const headers = headerValues
    .slice(1)
    .map((value, index) => normalizeExcelValue(value) ?? `Column ${index + 1}`)
    .map((value) => String(value));
  const rows: RawSheetRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const values = row.values as Array<ExcelJS.CellValue | null | undefined>;
    const record: RawSheetRow = {};
    let hasValues = false;

    headers.forEach((header, index) => {
      const value = normalizeExcelValue(values[index + 1]);

      if (value !== null && value !== '') {
        hasValues = true;
      }

      record[header] = value;
    });

    if (hasValues) {
      rows.push(record);
    }
  });

  return {
    rows,
    fileType
  };
}

function toPreviewRow(rowNumber: number, row: RawSheetRow): ImportPreviewRow {
  return {
    rowNumber,
    values: Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, value === undefined ? null : String(value)])
    )
  };
}

function coerceNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? null : numericValue;
}

function coerceString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value).trim();
  return stringValue.length ? stringValue : null;
}

function deriveStatus(quantityInStock: number, importedStatus: string | null) {
  if (importedStatus) {
    return importedStatus;
  }

  if (quantityInStock === 0) {
    return 'sold';
  }

  if (quantityInStock <= env.DEFAULT_LOW_STOCK_THRESHOLD) {
    return 'low_stock';
  }

  return 'in_stock';
}

export class ImportsService {
  async preview(file: Express.Multer.File): Promise<ImportPreviewResponse> {
    const { rows } = await readWorksheet(file.path);
    const columns = Object.keys(rows[0] ?? {});

    return {
      uploadId: path.basename(file.path),
      fileName: file.originalname,
      columns,
      sampleRows: rows.slice(0, 10).map((row, index) => toPreviewRow(index + 2, row)),
      rowCount: rows.length,
      suggestedMapping: buildSuggestedMapping(columns)
    };
  }

  async commit(
    auth: AuthClaims,
    input: {
      uploadId: string;
      fileName?: string;
      mapping: Record<ImportableInventoryField, string | null>;
    }
  ): Promise<ImportCommitResult> {
    const filePath = path.join(env.tempDir, input.uploadId);
    const { rows, fileType } = await readWorksheet(filePath);
    const connection = auth.connection;

    const failures: ImportCommitResult['failures'] = [];
    let successCount = 0;

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const getValue = (field: ImportableInventoryField) => {
        const columnName = input.mapping[field];
        return columnName ? row[columnName] : null;
      };

      const itemName = coerceString(getValue('itemName'));
      const sku = coerceString(getValue('sku'));
      const unitCost = coerceNumber(getValue('unitCost'));
      const unitSellingPrice = coerceNumber(getValue('unitSellingPrice'));
      const quantityInStock = coerceNumber(getValue('quantityInStock'));

      if (
        !itemName ||
        !sku ||
        unitCost === null ||
        unitSellingPrice === null ||
        quantityInStock === null
      ) {
        failures.push({
          rowNumber,
          message:
            'Missing one or more required fields: itemName, sku, unitCost, unitSellingPrice, quantityInStock.'
        });
        continue;
      }

      try {
        const item = await inventoryRepository.create(connection, auth.sub, {
          itemName,
          sku,
          category: coerceString(getValue('category')),
          brand: coerceString(getValue('brand')),
          supplier: coerceString(getValue('supplier')),
          purchaseDate: coerceString(getValue('purchaseDate')),
          purchasePrice:
            coerceNumber(getValue('purchasePrice')) ??
            Number((unitCost * quantityInStock).toFixed(2)),
          unitCost,
          unitSellingPrice,
          quantityInStock,
          status: deriveStatus(quantityInStock, coerceString(getValue('status'))),
          condition: coerceString(getValue('condition')),
          notes: coerceString(getValue('notes')),
          serialOrBatchNumber: coerceString(getValue('serialOrBatchNumber')),
          imageUrl: coerceString(getValue('imageUrl'))
        });

        if (item) {
          successCount += 1;
        }
      } catch (error) {
        failures.push({
          rowNumber,
          message: error instanceof Error ? error.message : 'Unknown import failure'
        });
      }
    }

    const importRunId = await importsRepository.createImportRun(connection, {
      userId: auth.sub,
      fileName: input.fileName ?? input.uploadId,
      fileType,
      totalRows: rows.length,
      successCount,
      failureCount: failures.length,
      mappingJson: JSON.stringify(input.mapping),
      summaryJson: JSON.stringify({
        failures
      })
    });

    await inventoryRepository.logActivity(connection, {
      userId: auth.sub,
      activityType: 'inventory.imported',
      description: `Imported ${successCount} inventory row(s)`,
      metadata: {
        importRunId,
        successCount,
        failureCount: failures.length
      }
    });
    await auditRepository.log(connection, auth.sub, 'inventory.imported', {
      importRunId,
      successCount,
      failureCount: failures.length
    });

    await fs.unlink(filePath).catch(() => undefined);

    return {
      importRunId,
      successCount,
      failureCount: failures.length,
      failures
    };
  }

  async listHistory(auth: AuthClaims) {
    return importsRepository.listHistory(auth.connection, auth.sub);
  }

  async generateTemplate(format: 'xlsx' | 'csv') {
    const headers = [
      'Item Name',
      'SKU',
      'Category',
      'Brand',
      'Supplier',
      'Purchase Date',
      'Purchase Price',
      'Unit Cost',
      'Unit Selling Price',
      'Quantity In Stock',
      'Status',
      'Condition',
      'Notes',
      'Serial Or Batch Number',
      'Image URL'
    ];
    const sampleRow = [
      'Widget Alpha',
      'SKU-1001',
      'Electronics',
      'Acme',
      'Acme Supply',
      '2026-01-12',
      1200,
      100,
      145,
      12,
      'in_stock',
      'new',
      'Imported sample row',
      'BATCH-001',
      'https://example.com/widget-alpha.jpg'
    ];
    if (format === 'csv') {
      return {
        buffer: Buffer.from(
          [headers, sampleRow]
            .map((row) =>
              row
                .map((value) => {
                  const stringValue = String(value ?? '');
                  return /[",\n]/.test(stringValue)
                    ? `"${stringValue.replaceAll('"', '""')}"`
                    : stringValue;
                })
                .join(',')
            )
            .join('\n'),
          'utf8'
        ),
        contentType: 'text/csv',
        fileName: 'inventory-import-template.csv'
      };
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventory Template');
    worksheet.addRow(headers);
    worksheet.addRow(sampleRow);

    return {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: 'inventory-import-template.xlsx'
    };
  }
}

export const importsService = new ImportsService();
