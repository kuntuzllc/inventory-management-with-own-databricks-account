import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../lib/api';
import { formatCurrency, formatDateTime, formatNumber, humanizeLabel } from '../../lib/format';
import type { ReportType } from '../../types/models';
import { Button, Card, EmptyState, Select, Table } from '../../components/ui';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

const reportOptions: Array<{ value: ReportType; label: string }> = [
  { value: 'valuation', label: 'Inventory valuation' },
  { value: 'sales', label: 'Sales report' },
  { value: 'profit', label: 'Profit report' },
  { value: 'purchases', label: 'Purchases report' },
  { value: 'cogs', label: 'Cost of goods sold' },
  { value: 'monthly', label: 'Monthly summary' }
];

function formatMetric(key: string, value: number) {
  if (key.toLowerCase().includes('quantity')) {
    return formatNumber(value);
  }

  return formatCurrency(value);
}

function formatCell(key: string, value: string | number | null) {
  if (typeof value !== 'number') {
    return String(value ?? '—');
  }

  if (key.toLowerCase().includes('quantity')) {
    return formatNumber(value);
  }

  return formatCurrency(value);
}

export function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('valuation');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const reportQuery = useQuery({
    queryKey: ['report', reportType, dateFrom, dateTo],
    queryFn: () =>
      api.reports.get(reportType, {
        dateFrom,
        dateTo
      })
  });

  const rows = reportQuery.data?.rows ?? [];
  const columns = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="page-section">
      <header className="page-header">
        <div>
          <span className="page-header__eyebrow">Reports</span>
          <h1>Tax-season-friendly reporting</h1>
          <p>Generate valuation, sales, profit, purchase, COGS, and monthly summary outputs with optional date ranges and exports.</p>
        </div>
      </header>

      <Card title="Report builder" description="Choose a report, filter the date range, and export to CSV or Excel.">
        <div className="toolbar">
          <Select label="Report type" value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)} options={reportOptions} />
          <label className="field">
            <span className="field__label">Date from</span>
            <input className="field__control" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Date to</span>
            <input className="field__control" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <Button
            variant="secondary"
            onClick={async () => {
              const blob = await api.reports.export(reportType, { dateFrom, dateTo, format: 'csv' });
              downloadBlob(blob, `${reportType}-report.csv`);
            }}
          >
            Export CSV
          </Button>
          <Button
            onClick={async () => {
              const blob = await api.reports.export(reportType, { dateFrom, dateTo, format: 'xlsx' });
              downloadBlob(blob, `${reportType}-report.xlsx`);
            }}
          >
            Export Excel
          </Button>
        </div>

        <div className="pill-row">
          <span className="pill">Generated: {reportQuery.data ? formatDateTime(reportQuery.data.generatedAt) : 'Pending'}</span>
          {reportQuery.data
            ? Object.entries(reportQuery.data.totals).map(([key, value]) => (
                <span key={key} className="pill">
                  {humanizeLabel(key)}: {formatMetric(key, value)}
                </span>
              ))
            : null}
        </div>

        {reportQuery.isLoading ? (
          <p className="muted">Loading report...</p>
        ) : rows.length ? (
          <Table columns={columns.map(humanizeLabel)}>
            {rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${reportType}`}>
                {columns.map((column) => (
                  <td key={`${rowIndex}-${column}`}>
                    {formatCell(column, row[column] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState
            title="No report rows"
            description="Adjust the date range or create more inventory and sales activity to populate this report."
          />
        )}
      </Card>
    </div>
  );
}
