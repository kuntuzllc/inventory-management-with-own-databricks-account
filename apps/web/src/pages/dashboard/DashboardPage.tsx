import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { api } from '../../lib/api';
import { formatCurrency, formatDateTime, formatNumber } from '../../lib/format';
import { Button, Card, EmptyState, LoadingState, StatCard, Table } from '../../components/ui';

export function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: api.dashboard.getSummary
  });

  if (summaryQuery.isLoading) {
    return <LoadingState label="Loading dashboard..." fullscreen={false} />;
  }

  if (summaryQuery.isError) {
    return (
      <div className="page-section">
        <Card title="Databricks connection needed" description="Connect and initialize your workspace first.">
          <EmptyState
            title="Dashboard unavailable"
            description={summaryQuery.error instanceof Error ? summaryQuery.error.message : 'Unable to load dashboard data.'}
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

  const summary = summaryQuery.data!;

  return (
    <div className="page-section">
      <header className="page-header">
        <div>
          <span className="page-header__eyebrow">Dashboard</span>
          <h1>Inventory pulse</h1>
          <p>See current stock, current value, revenue, profit, and the activity moving your operation forward.</p>
        </div>
        <Link to="/inventory/new">
          <Button>Add inventory item</Button>
        </Link>
      </header>

      <section className="stats-grid">
        <StatCard label="Inventory items" value={formatNumber(summary.totalInventoryItems)} />
        <StatCard label="Total quantity" value={formatNumber(summary.totalQuantity)} />
        <StatCard label="Inventory value" value={formatCurrency(summary.totalInventoryValue)} />
        <StatCard label="Purchase cost" value={formatCurrency(summary.totalPurchaseCost)} />
        <StatCard label="Expected revenue" value={formatCurrency(summary.totalExpectedRevenue)} />
        <StatCard label="Units sold" value={formatNumber(summary.soldItemsTotal)} />
        <StatCard label="Actual revenue" value={formatCurrency(summary.actualRevenue)} accent="#0b7a4b" />
        <StatCard label="Actual profit" value={formatCurrency(summary.actualProfit)} accent="#b44d12" />
      </section>

      <div className="dashboard-grid">
        <Card title="Low stock items" description="Items below the default low-stock threshold.">
          {summary.lowStockItems.length ? (
            <Table columns={['Item', 'SKU', 'Quantity', 'Value', 'Status']}>
              {summary.lowStockItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/inventory/${item.id}`}>{item.itemName}</Link>
                  </td>
                  <td>{item.sku}</td>
                  <td>{formatNumber(item.quantityInStock)}</td>
                  <td>{formatCurrency(item.totalInventoryValue)}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState
              title="No low stock items"
              description="Your current inventory levels look healthy."
            />
          )}
        </Card>

        <Card title="Recent activity" description="Latest inventory updates, sales, and imports.">
          {summary.recentActivity.length ? (
            <div className="activity-list">
              {summary.recentActivity.map((activity) => (
                <div key={activity.id} className="activity-list__item">
                  <div>
                    <strong>{activity.description}</strong>
                    <p>{activity.activityType}</p>
                  </div>
                  <span>{formatDateTime(activity.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recent activity"
              description="Create inventory items, import stock, or record sales to populate this feed."
            />
          )}
        </Card>
      </div>
    </div>
  );
}
