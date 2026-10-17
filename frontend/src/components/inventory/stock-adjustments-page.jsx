'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import { getProducts } from '@/services/inventory';
import {
  approveStockAdjustment, createStockAdjustment, getLocations, getStockAdjustments, rejectStockAdjustment,
} from '@/services/stock';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
const recordId = (record) => String(record.id || record._id);
const statusTone = { Approved: 'success', Pending: 'warning', Rejected: 'danger' };
const money = (value) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(Number(value) || 0);

export default function StockAdjustmentsPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'stock:read');
  const canWrite = can(permissions, 'stock:write');
  const [adjustments, setAdjustments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [lines, setLines] = useState([]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!initialized) return undefined;
    if (!token || !canRead) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    Promise.all([
      getLocations(token),
      getStockAdjustments(token),
      can(permissions, 'products:read') ? getProducts(token) : Promise.resolve(null),
    ])
      .then(([locationResponse, adjustmentResponse, productResponse]) => {
        if (!active) return;
        const availableLocations = locationResponse.data.locations;
        setLocations(availableLocations);
        setWarehouseId(user?.locationId || availableLocations[0]?.id || '');
        setAdjustments(adjustmentResponse.data.stockAdjustments);
        setProducts(productResponse?.data.products || []);
      })
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'Unable to load stock adjustments.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, initialized, permissions, token, user?.locationId]);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const columns = [
    {
      key: '_id',
      label: 'Adjustment',
      render: (id, item) => <div><strong>{recordId(item).slice(-8).toUpperCase()}</strong><small className="block text-slate-500">{new Date(item.createdAt).toLocaleString()}</small></div>,
    },
    { key: 'warehouseId', label: 'Location', render: (id) => locations.find((item) => item.id === String(id))?.name || 'Location' },
    { key: 'reason', label: 'Reason' },
    { key: 'lines', label: 'Lines', render: (items) => items.map((line) => {
      const product = productsById.get(String(line.productId));
      return `${product?.name || String(line.productId).slice(-6)} (${Number(line.quantity) > 0 ? '+' : ''}${line.quantity})`;
    }).join(', ') },
    { key: 'value', label: 'Value', render: money },
    { key: 'status', label: 'Status', render: (status) => <Badge tone={statusTone[status] || 'neutral'}>{status}</Badge> },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, item) => item.status === 'Pending' && user?.role === 'Super Admin' ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => runDecision(item, true)}>Approve</Button>
          <Button size="sm" variant="secondary" onClick={() => runDecision(item, false)}>Reject</Button>
        </div>
      ) : '—',
    },
  ];

  function addLine() {
    const product = productsById.get(productId);
    if (!product) return;
    setLines((current) => current.some((line) => line.productId === product.id)
      ? current : [...current, { productId: product.id, quantity: '1' }]);
    setProductId('');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!warehouseId || !reason.trim() || !lines.length || lines.some((line) => !Number(line.quantity))) {
      setError('Choose a location, provide a reason, and add non-zero adjustment quantities.');
      return;
    }
    setSaving(true);
    try {
      const response = await createStockAdjustment(token, {
        warehouseId,
        reason: reason.trim(),
        lines: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
      });
      setAdjustments((current) => [response.data.stockAdjustment, ...current]);
      setLines([]);
      setReason('');
      setNotice(response.data.stockAdjustment.status === 'Pending'
        ? 'Adjustment submitted and awaiting Super Admin approval.'
        : 'Stock adjustment approved and posted.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create the stock adjustment.');
    } finally {
      setSaving(false);
    }
  }

  async function runDecision(item, approve) {
    setError('');
    setNotice('');
    try {
      const response = approve
        ? await approveStockAdjustment(token, recordId(item))
        : await rejectStockAdjustment(token, recordId(item));
      const updated = response.data.stockAdjustment;
      setAdjustments((current) => current.map((entry) => recordId(entry) === recordId(updated) ? updated : entry));
      setNotice(approve ? 'Adjustment approved and posted.' : 'Adjustment rejected.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update the stock adjustment.');
    }
  }

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading stock adjustments...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view stock adjustments.</p>;

  return (
    <section className="space-y-5">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Inventory</p>
        <h1 className="text-2xl font-semibold text-slate-900">Stock Adjustment</h1>
        <p className="mt-1 text-sm text-slate-600">Record corrections, damage, or other approved stock changes.</p>
      </header>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {canWrite && (
        <Card title="New adjustment" description="Use positive quantities to add stock and negative quantities to remove stock.">
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Warehouse or outlet" name="warehouseId" value={warehouseId} disabled={Boolean(user?.locationId)} onChange={(event) => setWarehouseId(event.target.value)}>
                <option value="">Choose a location</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </Select>
              <Input label="Reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required placeholder="e.g. Damaged goods" />
            </div>
            {!can(permissions, 'products:read') && <p className="text-sm text-amber-700">Product read permission is required to select adjustment lines.</p>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Select label="Product" name="productId" className="flex-1" value={productId} onChange={(event) => setProductId(event.target.value)} disabled={!products.length}>
                <option value="">Choose a product</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.barcode}</option>)}
              </Select>
              <Button type="button" variant="secondary" onClick={addLine} disabled={!productId}>Add product</Button>
            </div>
            {lines.map((line) => (
              <div key={line.productId} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_12rem_auto]">
                <strong className="pb-2 text-sm">{productsById.get(line.productId)?.name}</strong>
                <Input label="Quantity change (+/-)" type="number" step="any" value={line.quantity} onChange={(event) => setLines((current) => current.map((entry) => entry.productId === line.productId ? { ...entry, quantity: event.target.value } : entry))} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setLines((current) => current.filter((entry) => entry.productId !== line.productId))}>Remove</Button>
              </div>
            ))}
            <div className="flex justify-end"><Button type="submit" disabled={saving || !lines.length || !products.length}>{saving ? 'Submitting...' : 'Submit adjustment'}</Button></div>
          </form>
        </Card>
      )}

      <Card title="Adjustment register" description={`${adjustments.length} adjustment${adjustments.length === 1 ? '' : 's'} in your location scope`}>
        <Table columns={columns} rows={adjustments} rowKey="_id" emptyMessage="No stock adjustments yet." />
      </Card>
    </section>
  );
}
