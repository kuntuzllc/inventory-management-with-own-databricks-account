import ExcelJS from 'exceljs';

import type { AuthClaims, ReportResult, ReportRow, ReportType } from '../../types/domain.js';
import { reportsRepository } from './reports.repository.js';

interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
}

function toCsv(rows: ReportRow[]) {
  const firstRow = rows[0];

  if (!firstRow) {
    return '';
  }

  const columns = Object.keys(firstRow);
  const lines: Array<Array<string | number | null>> = [columns];

  for (const row of rows) {
    lines.push(columns.map((column) => row[column] ?? ''));
  }

  return lines
    .map((line) =>
      line
        .map((value) => {
          const stringValue = String(value);
          return /[",\n]/.test(stringValue)
            ? `"${stringValue.replaceAll('"', '""')}"`
            : stringValue;
        })
        .join(',')
    )
    .join('\n');
}

function calculateTotals(reportType: ReportType, rows: ReportRow[]) {
  const totals: Record<string, number> = {};

  const add = (key: string, value: unknown) => {
    if (typeof value === 'number') {
      totals[key] = (totals[key] ?? 0) + value;
    }
  };

  for (const row of rows) {
    switch (reportType) {
      case 'valuation':
        add('quantityInStock', row.quantityInStock);
        add('totalInventoryValue', row.totalInventoryValue);
        add('expectedRevenue', row.expectedRevenue);
        break;
      case 'sales':
        add('quantitySold', row.quantitySold);
        add('totalRevenue', row.totalRevenue);
        break;
      case 'profit':
        add('quantitySold', row.quantitySold);
        add('totalRevenue', row.totalRevenue);
        add('totalCost', row.totalCost);
        add('profit', row.profit);
        break;
      case 'purchases':
        add('purchasedQuantity', row.purchasedQuantity);
        add('purchaseAmount', row.purchaseAmount);
        break;
      case 'cogs':
        add('quantitySold', row.quantitySold);
        add('totalCost', row.totalCost);
        break;
      case 'monthly':
        add('purchaseAmount', row.purchaseAmount);
        add('revenue', row.revenue);
        add('cogs', row.cogs);
        add('profit', row.profit);
        break;
    }
  }

  return totals;
}

export class ReportsService {
  async getReport(auth: AuthClaims, reportType: ReportType, filters: ReportFilters): Promise<ReportResult> {
    const rows = await reportsRepository.getReport(auth.connection, auth.sub, reportType, filters);

    return {
      reportType,
      generatedAt: new Date().toISOString(),
      rows,
      totals: calculateTotals(reportType, rows)
    };
  }

  async exportReport(auth: AuthClaims, reportType: ReportType, filters: ReportFilters, format: 'csv' | 'xlsx') {
    const report = await this.getReport(auth, reportType, filters);

    if (format === 'csv') {
      return {
        buffer: Buffer.from(toCsv(report.rows), 'utf8'),
        contentType: 'text/csv',
        fileName: `${reportType}-report.csv`
      };
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    const columns = Object.keys(report.rows[0] ?? {}).map((column) => ({
      header: column,
      key: column,
      width: 20
    }));
    worksheet.columns = columns;

    for (const row of report.rows) {
      worksheet.addRow(row);
    }

    return {
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: `${reportType}-report.xlsx`
    };
  }
}

export const reportsService = new ReportsService();
