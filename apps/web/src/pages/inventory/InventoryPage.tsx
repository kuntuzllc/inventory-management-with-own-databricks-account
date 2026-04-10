import { useDeferredValue, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { api } from '../../lib/api';
import { formatCurrency, formatNumber } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import { Button, Card, EmptyState, Input, LoadingState, Select, Table } from '../../components/ui';

export function InventoryPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const deferredSearch = useDeferredValue(search);

  const inventoryQuery = useQuery({
    queryKey: ['inventory', deferredSearch, category, status, sortBy],
    queryFn: () =>
      api.inventory.list({
        search: deferredSearch,
        category,
        status,
        sortBy
      })
  });

  if (inventoryQuery.isLoading) {
    return <LoadingState label="Loading inventory..." />;
  }

  if (inventoryQuery.isError) {
    return (
      <div className="page-section">
        <Card title="Inventory unavailable" description="Make sure your Databricks tables are initialized.">
          <EmptyState
            title="Unable to load inventory"
            description={inventoryQuery.error instanceof Error ? inventoryQuery.error.message : 'Something went wrong.'}
            actions={
              <Link to="/settings">
                <Button>Open settings</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const items = inventoryQuery.data!.items;

  return (
    <div className="page-section">
      <header className="page-header">
        <div>
          <span className="page-header__eyebrow">Inventory</span>
          <h1>Inventory command center</h1>
          <p>Search, filter, sort, and manage every item flowing through your operation.</p>
        </div>
        <Link to="/inventory/new">
          <Button>Add item</Button>
        </Link>
      </header>

      <Card title="Browse inventory" description={`${inventoryQuery.data!.total} item(s) in the current result set.`}>
        <div className="toolbar">
          <Input label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, SKU, category, or brand" />
          <Input label="Category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Filter by category" />
          <Select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { label: 'In stock', value: 'in_stock' },
              { label: 'Low stock', value: 'low_stock' },
              { label: 'Sold', value: 'sold' }
            ]}
            placeholder="All statuses"
          />
          <Select
            label="Sort by"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            options={[
              { label: 'Recently updated', value: 'updatedAt' },
              { label: 'Item name', value: 'itemName' },
              { label: 'Quantity', value: 'quantityInStock' },
              { label: 'Inventory value', value: 'totalInventoryValue' }
            ]}
          />
        </div>

        {items.length ? (
          <Table columns={['Item', 'SKU', 'Category', 'Quantity', 'Value', 'Status', 'Actions']}>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link to={`/inventory/${item.id}`}>{item.itemName}</Link>
                </td>
                <td>{item.sku}</td>
                <td>{item.category ?? '—'}</td>
                <td>{formatNumber(item.quantityInStock)}</td>
                <td>{formatCurrency(item.totalInventoryValue)}</td>
                <td>{item.status}</td>
                <td>
                  <div className="table-actions">
                    <Link to={`/inventory/${item.id}`}>
                      <Button variant="ghost">View</Button>
                    </Link>
                    <Link to={`/inventory/${item.id}/edit`}>
                      <Button variant="secondary">Edit</Button>
                    </Link>
                    <Button
                      variant="danger"
                      onClick={async () => {
                        const confirmed = window.confirm(`Delete ${item.itemName}?`);

                        if (!confirmed) {
                          return;
                        }

                        try {
                          await api.inventory.delete(item.id);
                          showToast({ variant: 'success', title: 'Inventory item deleted' });
                          await queryClient.invalidateQueries({ queryKey: ['inventory'] });
                          await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
                        } catch (error) {
                          showToast({
                            variant: 'error',
                            title: 'Delete failed',
                            description: error instanceof Error ? error.message : 'Please try again.'
                          });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState
            title="No inventory items yet"
            description="Add a product manually or head to Imports to bring in a spreadsheet."
            actions={
              <Link to="/inventory/new">
                <Button>Add first item</Button>
              </Link>
            }
          />
        )}
      </Card>
    </div>
  );
}
