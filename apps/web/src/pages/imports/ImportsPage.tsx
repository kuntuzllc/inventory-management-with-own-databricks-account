import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import { Button, Card, EmptyState, Input, Select, Table } from '../../components/ui';

const importableFields = [
  { value: 'itemName', label: 'Item name' },
  { value: 'sku', label: 'SKU' },
  { value: 'category', label: 'Category' },
  { value: 'brand', label: 'Brand' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'purchaseDate', label: 'Purchase date' },
  { value: 'purchasePrice', label: 'Purchase price' },
  { value: 'unitCost', label: 'Unit cost' },
  { value: 'unitSellingPrice', label: 'Unit selling price' },
  { value: 'quantityInStock', label: 'Quantity in stock' },
  { value: 'status', label: 'Status' },
  { value: 'condition', label: 'Condition' },
  { value: 'notes', label: 'Notes' },
  { value: 'serialOrBatchNumber', label: 'Serial or batch number' },
  { value: 'imageUrl', label: 'Image URL' }
];

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.imports.preview>> | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.imports.commit>> | null>(null);

  const historyQuery = useQuery({
    queryKey: ['import-history'],
    queryFn: api.imports.history
  });

  return (
    <div className="page-section">
      <header className="page-header">
        <div>
          <span className="page-header__eyebrow">Imports</span>
          <h1>Spreadsheet import pipeline</h1>
          <p>Upload CSV or Excel files, preview rows, map columns to inventory fields, and commit the import into your Databricks tables.</p>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            const blob = await api.imports.downloadTemplate('xlsx');
            downloadBlob(blob, 'inventory-import-template.xlsx');
          }}
        >
          Download template
        </Button>
      </header>

      <Card title="Preview import file" description="Preview first, then commit with mapped columns and validation.">
        <div className="toolbar">
          <label className="field field--wide">
            <span className="field__label">Spreadsheet file</span>
            <input className="field__control" type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <Button
            loading={previewing}
            disabled={!file}
            onClick={async () => {
              if (!file) {
                return;
              }

              setPreviewing(true);
              setResult(null);
              try {
                const importPreview = await api.imports.preview(file);
                setPreview(importPreview);
                setMapping(importPreview.suggestedMapping);
                showToast({ variant: 'success', title: 'Preview ready' });
              } catch (error) {
                showToast({
                  variant: 'error',
                  title: 'Preview failed',
                  description: error instanceof Error ? error.message : 'Please try again.'
                });
              } finally {
                setPreviewing(false);
              }
            }}
          >
            Preview import
          </Button>
        </div>

        {preview ? (
          <div className="stack">
            <div className="pill-row">
              <span className="pill">{preview.fileName}</span>
              <span className="pill">{preview.rowCount} rows</span>
            </div>

            <div className="mapping-grid">
              {importableFields.map((field) => (
                <Select
                  key={field.value}
                  label={field.label}
                  value={mapping[field.value] ?? ''}
                  onChange={(event) =>
                    setMapping((current) => ({
                      ...current,
                      [field.value]: event.target.value || null
                    }))
                  }
                  options={preview.columns.map((column) => ({ label: column, value: column }))}
                  placeholder="Skip field"
                />
              ))}
            </div>

            <Table columns={preview.columns}>
              {preview.sampleRows.map((row) => (
                <tr key={row.rowNumber}>
                  {preview.columns.map((column) => (
                    <td key={`${row.rowNumber}-${column}`}>{String(row.values[column] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </Table>

            <div className="button-row">
              <Button
                loading={committing}
                onClick={async () => {
                  setCommitting(true);
                  try {
                    const importResult = await api.imports.commit({
                      uploadId: preview.uploadId,
                      fileName: preview.fileName,
                      mapping
                    });
                    setResult(importResult);
                    showToast({
                      variant: 'success',
                      title: `Imported ${importResult.successCount} row(s)`
                    });
                    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
                    await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
                    await queryClient.invalidateQueries({ queryKey: ['import-history'] });
                  } catch (error) {
                    showToast({
                      variant: 'error',
                      title: 'Import failed',
                      description: error instanceof Error ? error.message : 'Please try again.'
                    });
                  } finally {
                    setCommitting(false);
                  }
                }}
              >
                Commit import
              </Button>
            </div>

            {result ? (
              <Card title="Import summary" description="Success and failure counts for the latest run.">
                <div className="stats-grid stats-grid--compact">
                  <div className="mini-stat"><span>Successful rows</span><strong>{result.successCount}</strong></div>
                  <div className="mini-stat"><span>Failed rows</span><strong>{result.failureCount}</strong></div>
                </div>
                {result.failures.length ? (
                  <Table columns={['Row', 'Message']}>
                    {result.failures.map((failure) => (
                      <tr key={`${failure.rowNumber}-${failure.message}`}>
                        <td>{failure.rowNumber}</td>
                        <td>{failure.message}</td>
                      </tr>
                    ))}
                  </Table>
                ) : null}
              </Card>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="No preview yet"
            description="Choose a CSV or Excel file and generate a preview before committing anything."
          />
        )}
      </Card>

      <Card title="Recent imports" description="The latest import runs recorded in your Databricks workspace.">
        {historyQuery.data?.imports.length ? (
          <Table columns={['File', 'Rows', 'Success', 'Failed', 'Created']}>
            {historyQuery.data.imports.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.fileName}</td>
                <td>{entry.totalRows}</td>
                <td>{entry.successCount}</td>
                <td>{entry.failureCount}</td>
                <td>{formatDateTime(entry.createdAt)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No imports yet" description="Your import history will appear here after the first committed spreadsheet." />
        )}
      </Card>
    </div>
  );
}
