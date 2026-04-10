import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api, resolveServerAssetUrl } from '../../lib/api';
import { formatCurrency } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import { Button, Card, Input, LoadingState, Select, TextArea } from '../../components/ui';

const statusOptions = [
  { label: 'In stock', value: 'in_stock' },
  { label: 'Low stock', value: 'low_stock' },
  { label: 'Sold', value: 'sold' },
  { label: 'Reserved', value: 'reserved' }
];

const conditionOptions = [
  { label: 'New', value: 'new' },
  { label: 'Used', value: 'used' },
  { label: 'Refurbished', value: 'refurbished' },
  { label: 'Open box', value: 'open_box' }
];

function emptyForm() {
  return {
    itemName: '',
    sku: '',
    category: '',
    brand: '',
    supplier: '',
    purchaseDate: '',
    purchasePrice: '',
    unitCost: '0',
    unitSellingPrice: '0',
    quantityInStock: '0',
    status: 'in_stock',
    condition: 'new',
    notes: '',
    serialOrBatchNumber: '',
    imageUrl: ''
  };
}

export function InventoryFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams();
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const itemQuery = useQuery({
    queryKey: ['inventory-item', params.id],
    queryFn: () => api.inventory.get(params.id!),
    enabled: mode === 'edit' && Boolean(params.id)
  });

  useEffect(() => {
    if (!itemQuery.data?.item) {
      return;
    }

    const item = itemQuery.data.item;
    setForm({
      itemName: item.itemName,
      sku: item.sku,
      category: item.category ?? '',
      brand: item.brand ?? '',
      supplier: item.supplier ?? '',
      purchaseDate: item.purchaseDate ?? '',
      purchasePrice: item.purchasePrice?.toString() ?? '',
      unitCost: item.unitCost.toString(),
      unitSellingPrice: item.unitSellingPrice.toString(),
      quantityInStock: item.quantityInStock.toString(),
      status: item.status,
      condition: item.condition ?? 'new',
      notes: item.notes ?? '',
      serialOrBatchNumber: item.serialOrBatchNumber ?? '',
      imageUrl: item.imageUrl ?? ''
    });
  }, [itemQuery.data]);

  const computedInventoryValue = useMemo(() => {
    const quantity = Number(form.quantityInStock || '0');
    const unitCost = Number(form.unitCost || '0');
    return formatCurrency(quantity * unitCost);
  }, [form.quantityInStock, form.unitCost]);

  if (mode === 'edit' && itemQuery.isLoading) {
    return <LoadingState label="Loading inventory item..." />;
  }

  return (
    <div className="page-section">
      <header className="page-header">
        <div>
          <span className="page-header__eyebrow">{mode === 'create' ? 'New item' : 'Edit item'}</span>
          <h1>{mode === 'create' ? 'Add inventory item' : 'Update inventory item'}</h1>
          <p>Capture pricing, stock, supplier details, notes, and either an image URL or an uploaded image.</p>
        </div>
        <Link to="/inventory">
          <Button variant="ghost">Back to inventory</Button>
        </Link>
      </header>

      <Card title="Item details" description={`Current computed inventory value: ${computedInventoryValue}`}>
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);

            try {
              const payload = {
                ...form,
                purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
                unitCost: Number(form.unitCost),
                unitSellingPrice: Number(form.unitSellingPrice),
                quantityInStock: Number(form.quantityInStock),
                category: form.category || null,
                brand: form.brand || null,
                supplier: form.supplier || null,
                purchaseDate: form.purchaseDate || null,
                condition: form.condition || null,
                notes: form.notes || null,
                serialOrBatchNumber: form.serialOrBatchNumber || null,
                imageUrl: form.imageUrl || null
              };

              const response =
                mode === 'create'
                  ? await api.inventory.create(payload)
                  : await api.inventory.update(params.id!, payload);

              showToast({
                variant: 'success',
                title: mode === 'create' ? 'Inventory item created' : 'Inventory item updated'
              });
              await queryClient.invalidateQueries({ queryKey: ['inventory'] });
              await queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
              navigate(`/inventory/${response.item.id}`);
            } catch (error) {
              showToast({
                variant: 'error',
                title: 'Save failed',
                description: error instanceof Error ? error.message : 'Please try again.'
              });
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="form-grid">
            <Input label="Item name" value={form.itemName} onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value }))} required />
            <Input label="SKU" value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} required />
            <Input label="Category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            <Input label="Brand" value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} />
            <Input label="Supplier" value={form.supplier} onChange={(event) => setForm((current) => ({ ...current, supplier: event.target.value }))} />
            <Input label="Purchase date" type="date" value={form.purchaseDate} onChange={(event) => setForm((current) => ({ ...current, purchaseDate: event.target.value }))} />
            <Input label="Purchase price" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(event) => setForm((current) => ({ ...current, purchasePrice: event.target.value }))} />
            <Input label="Unit cost" type="number" min="0" step="0.01" value={form.unitCost} onChange={(event) => setForm((current) => ({ ...current, unitCost: event.target.value }))} required />
            <Input label="Unit selling price" type="number" min="0" step="0.01" value={form.unitSellingPrice} onChange={(event) => setForm((current) => ({ ...current, unitSellingPrice: event.target.value }))} required />
            <Input label="Quantity in stock" type="number" min="0" step="1" value={form.quantityInStock} onChange={(event) => setForm((current) => ({ ...current, quantityInStock: event.target.value }))} required />
            <Select label="Status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} options={statusOptions} />
            <Select label="Condition" value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))} options={conditionOptions} />
            <Input label="Serial or batch number" value={form.serialOrBatchNumber} onChange={(event) => setForm((current) => ({ ...current, serialOrBatchNumber: event.target.value }))} />
            <Input label="Image URL" value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="https://example.com/item.jpg" />
          </div>

          <label className="field">
            <span className="field__label">Upload image</span>
            <input
              className="field__control"
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];

                if (!file) {
                  return;
                }

                setUploadingImage(true);
                try {
                  const result = await api.uploads.image(file);
                  setForm((current) => ({ ...current, imageUrl: result.url }));
                  showToast({ variant: 'success', title: 'Image uploaded' });
                } catch (error) {
                  showToast({
                    variant: 'error',
                    title: 'Upload failed',
                    description: error instanceof Error ? error.message : 'Please try again.'
                  });
                } finally {
                  setUploadingImage(false);
                }
              }}
            />
          </label>

          {form.imageUrl ? (
            <div className="image-preview">
              <img src={resolveServerAssetUrl(form.imageUrl)} alt={form.itemName || 'Inventory preview'} />
            </div>
          ) : null}

          <TextArea label="Notes" rows={5} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />

          <div className="button-row">
            <Button type="submit" loading={saving}>
              {mode === 'create' ? 'Create item' : 'Save changes'}
            </Button>
            <Button type="button" variant="secondary" loading={uploadingImage}>
              {uploadingImage ? 'Uploading image...' : 'Image upload ready'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
