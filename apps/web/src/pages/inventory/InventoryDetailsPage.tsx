import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api, resolveServerAssetUrl } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import { Button, Card, LoadingState, Modal, TextArea, Input } from '../../components/ui';

export function InventoryDetailsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isSaleOpen, setIsSaleOpen] = useState(false);
  const [saleForm, setSaleForm] = useState({
    quantitySold: '1',
    unitSellingPrice: '',
    soldAt: new Date().toISOString().slice(0, 16),
    notes: ''
  });
  const [selling, setSelling] = useState(false);

  const itemQuery = useQuery({
    queryKey: ['inventory-item', params.id],
    queryFn: () => api.inventory.get(params.id!)
  });

  if (itemQuery.isLoading) {
    return <LoadingState label="Loading item details..." />;
  }

  if (itemQuery.isError || !itemQuery.data?.item) {
    return (
      <div className="page-section">
        <Card title="Item not available" description="The requested inventory record could not be loaded.">
          <Link to="/inventory">
            <Button>Back to inventory</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const item = itemQuery.data.item;

  return (
    <div className="page-section">
      <header className="page-header">
        <div>
          <span className="page-header__eyebrow">Inventory detail</span>
          <h1>{item.itemName}</h1>
          <p>Track stock, pricing, supplier details, notes, and record partial or full sales directly from here.</p>
        </div>
        <div className="button-row">
          <Button
            variant="secondary"
            onClick={() => {
              setSaleForm((current) => ({
                ...current,
                unitSellingPrice: item.unitSellingPrice.toString()
              }));
              setIsSaleOpen(true);
            }}
          >
            Mark as sold
          </Button>
          <Link to={`/inventory/${item.id}/edit`}>
            <Button>Edit item</Button>
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
                navigate('/inventory');
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
      </header>

      <div className="detail-layout">
        <Card title="Overview" description={`${item.sku} • ${item.status}`}>
          <div className="detail-grid">
            <div><span>Category</span><strong>{item.category ?? '—'}</strong></div>
            <div><span>Brand</span><strong>{item.brand ?? '—'}</strong></div>
            <div><span>Supplier</span><strong>{item.supplier ?? '—'}</strong></div>
            <div><span>Condition</span><strong>{item.condition ?? '—'}</strong></div>
            <div><span>Purchase date</span><strong>{formatDate(item.purchaseDate)}</strong></div>
            <div><span>Purchase price</span><strong>{item.purchasePrice ? formatCurrency(item.purchasePrice) : '—'}</strong></div>
            <div><span>Unit cost</span><strong>{formatCurrency(item.unitCost)}</strong></div>
            <div><span>Unit selling price</span><strong>{formatCurrency(item.unitSellingPrice)}</strong></div>
            <div><span>Quantity in stock</span><strong>{formatNumber(item.quantityInStock)}</strong></div>
            <div><span>Total inventory value</span><strong>{formatCurrency(item.totalInventoryValue)}</strong></div>
            <div><span>Serial or batch</span><strong>{item.serialOrBatchNumber ?? '—'}</strong></div>
            <div><span>Last sold</span><strong>{formatDateTime(item.lastSoldAt)}</strong></div>
            <div className="detail-grid__full"><span>Notes</span><strong>{item.notes ?? '—'}</strong></div>
          </div>
        </Card>

        <Card title="Image" description="Product photo or reference image.">
          {item.imageUrl ? (
            <div className="image-preview image-preview--detail">
              <img src={resolveServerAssetUrl(item.imageUrl)} alt={item.itemName} />
            </div>
          ) : (
            <p className="muted">No image attached to this item yet.</p>
          )}
        </Card>
      </div>

      <Modal open={isSaleOpen} title={`Record sale for ${item.itemName}`} onClose={() => setIsSaleOpen(false)}>
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setSelling(true);

            try {
              await api.sales.create({
                inventoryItemId: item.id,
                quantitySold: Number(saleForm.quantitySold),
                unitSellingPrice: Number(saleForm.unitSellingPrice),
                soldAt: new Date(saleForm.soldAt).toISOString(),
                notes: saleForm.notes || null
              });
              showToast({ variant: 'success', title: 'Sale recorded' });
              setIsSaleOpen(false);
              await queryClient.invalidateQueries({ queryKey: ['inventory-item', item.id] });
              await queryClient.invalidateQueries({ queryKey: ['inventory'] });
              await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
            } catch (error) {
              showToast({
                variant: 'error',
                title: 'Sale failed',
                description: error instanceof Error ? error.message : 'Please try again.'
              });
            } finally {
              setSelling(false);
            }
          }}
        >
          <Input label="Quantity sold" type="number" min="1" max={item.quantityInStock} value={saleForm.quantitySold} onChange={(event) => setSaleForm((current) => ({ ...current, quantitySold: event.target.value }))} required />
          <Input label="Unit selling price" type="number" min="0" step="0.01" value={saleForm.unitSellingPrice} onChange={(event) => setSaleForm((current) => ({ ...current, unitSellingPrice: event.target.value }))} required />
          <Input label="Sold at" type="datetime-local" value={saleForm.soldAt} onChange={(event) => setSaleForm((current) => ({ ...current, soldAt: event.target.value }))} required />
          <TextArea label="Notes" rows={4} value={saleForm.notes} onChange={(event) => setSaleForm((current) => ({ ...current, notes: event.target.value }))} />
          <Button type="submit" loading={selling}>
            Record sale
          </Button>
        </form>
      </Modal>
    </div>
  );
}
