'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { ArrowDownToLine, ArrowUpFromLine, Check, Plus, Send } from 'lucide-react';
import { Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import { getProducts } from '@/services/inventory';
import {
  createStockTransfer, dispatchStockTransfer, getLocations, getStockTransfers, receiveStockTransfer,
} from '@/services/stock';

const statuses = ['Requested', 'Dispatched', 'Received', 'Discrepancy'];
const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
const statusTone = {
  Requested: 'warning',
  Dispatched: 'info',
  Received: 'success',
  Discrepancy: 'danger',
};
const displayId = (id) => id.slice(-8).toUpperCase();
const formatDate = (value) => new Intl.DateTimeFormat('en-BD', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export default function StockTransfersPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'stock:transfer:read');
  const canWrite = can(permissions, 'stock:transfer:write');
  const canReceive = can(permissions, 'stock:transfer:receive');
  const canChooseSource = ['Super Admin', 'Inventory Manager'].includes(user?.role);
  const [transfers, setTransfers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [sourceId, setSourceId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [productId, setProductId] = useState('');
  const [requestLines, setRequestLines] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [quantityDraft, setQuantityDraft] = useState({});
  const [statusFilter, setStatusFilter] = useState('');
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
    const requests = [getStockTransfers(token), getLocations(token)];
    if (canWrite && can(permissions, 'products:read')) requests.push(getProducts(token));
    Promise.all(requests)
      .then(([transferResponse, locationResponse, productResponse]) => {
        if (!active) return;
        const availableLocations = locationResponse.data.locations;
        setTransfers(transferResponse.data.stockTransfers);
        setLocations(availableLocations);
        setProducts(productResponse?.data.products || []);
        setSourceId(user?.locationId || availableLocations.find(({ type }) => type === 'CENTRAL')?.id || '');
        setOutletId(availableLocations.find(({ type }) => type === 'OUTLET')?.id || '');
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load outlet transfers.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, canWrite, initialized, permissions, token, user?.locationId]);

  const locationsById = useMemo(() => new Map(locations.map((location) => [location.id, location.name])), [locations]);
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const visibleTransfers = useMemo(() => transfers.filter((transfer) => (
    !statusFilter || transfer.status === statusFilter
  )), [statusFilter, transfers]);
  const selectedTransfer = transfers.find(({ id }) => id === selectedId);
  const sourceLocations = locations.filter(({ type }) => type === 'CENTRAL');
  const outletLocations = locations.filter(({ type }) => type === 'OUTLET');

  function selectTransfer(transfer) {
    setSelectedId(transfer.id);
    setQuantityDraft({});
    setError('');
    setNotice('');
  }

  function addRequestLine() {
    if (!productId) return;
    setRequestLines((current) => {
      const existing = current.find((line) => line.productId === productId);
      if (existing) return current.map((line) => line.productId === productId
        ? { ...line, requestedQuantity: Number(line.requestedQuantity) + 1 }
        : line);
      return [...current, { productId, requestedQuantity: 1 }];
    });
    setProductId('');
  }

  async function submitRequest(event) {
    event.preventDefault();
    if (!sourceId || !outletId || !requestLines.length) {
      setError('Select a source warehouse, an outlet, and at least one product.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await createStockTransfer(token, {
        fromWarehouseId: sourceId,
        toWarehouseId: outletId,
        lines: requestLines,
      });
      setTransfers((current) => [response.data.stockTransfer, ...current]);
      setSelectedId(response.data.stockTransfer.id);
      setRequestLines([]);
      setNotice('Transfer request created.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create the transfer request.');
    } finally {
      setSaving(false);
    }
  }

  async function submitWorkflow(event) {
    event.preventDefault();
    if (!selectedTransfer) return;
    setSaving(true);
    setError('');
    setNotice('');
    const isDispatch = selectedTransfer.status === 'Requested';
    const quantityField = isDispatch ? 'dispatchedQuantity' : 'receivedQuantity';
    const lines = selectedTransfer.lines.map((line) => ({
      productId: line.productId,
      [quantityField]: Number(quantityDraft[line.productId]
        ?? (isDispatch ? line.requestedQuantity : line.dispatchedQuantity)),
    }));
    try {
      const action = isDispatch ? dispatchStockTransfer : receiveStockTransfer;
      const response = await action(token, selectedTransfer.id, { lines });
      const updatedTransfer = response.data.stockTransfer;
      setTransfers((current) => current.map((transfer) => (
        transfer.id === updatedTransfer.id ? updatedTransfer : transfer
      )));
      setQuantityDraft({});
      setNotice(isDispatch ? 'Transfer dispatched to the outlet.' : 'Outlet receipt confirmed.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this transfer.');
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: 'id',
      label: 'Transfer / Date',
      render: (id, transfer) => (
        <div><strong className="block text-slate-800">{displayId(id)}</strong><small className="text-slate-500">{formatDate(transfer.createdAt)}</small></div>
      ),
    },
    { key: 'fromWarehouseId', label: 'From', render: (id) => locationsById.get(id) || 'Central warehouse' },
    { key: 'toWarehouseId', label: 'Outlet', render: (id) => locationsById.get(id) || 'Outlet' },
    { key: 'lines', label: 'Products', render: (lines) => lines.length },
    { key: 'status', label: 'Status', render: (status) => <Badge tone={statusTone[status] || 'neutral'}>{status}</Badge> },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, transfer) => (
        <Button size="sm" variant={selectedId === transfer.id ? 'secondary' : 'ghost'} onClick={() => selectTransfer(transfer)}>
          {selectedId === transfer.id ? 'Selected' : 'View'}
        </Button>
      ),
    },
  ];

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading outlet transfers...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view outlet transfers.</p>;

  return (
    <section className="space-y-5">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Inventory</p>
        <h1 className="text-2xl font-semibold text-slate-900">Outlet Transfers</h1>
        <p className="mt-1 text-sm text-slate-600">Request stock, dispatch from the central warehouse, and confirm outlet deliveries.</p>
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      {canWrite && (
        <Card title="Request a transfer" description="Create an outlet stock request from the central warehouse.">
          <form className="space-y-4" onSubmit={submitRequest}>
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Source warehouse" name="sourceId" value={sourceId} disabled={!canChooseSource} onChange={(event) => setSourceId(event.target.value)}>
                <option value="">Choose a warehouse</option>
                {sourceLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </Select>
              <Select label="Destination outlet" name="outletId" value={outletId} onChange={(event) => setOutletId(event.target.value)}>
                <option value="">Choose an outlet</option>
                {outletLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </Select>
            </div>
            {!can(permissions, 'products:read') && <p className="text-sm text-amber-700">Product read permission is required to add transfer lines.</p>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Select label="Product" name="productId" className="flex-1" value={productId} onChange={(event) => setProductId(event.target.value)} disabled={!products.length}>
                <option value="">Choose a product</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.barcode}</option>)}
              </Select>
              <Button type="button" variant="secondary" onClick={addRequestLine} disabled={!productId}><Plus size={16} /> Add product</Button>
            </div>
            {requestLines.length > 0 && (
              <div className="space-y-2">
                {requestLines.map((line) => (
                  <div key={line.productId} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_9rem_auto]">
                    <span className="text-sm font-medium text-slate-800">{productsById.get(line.productId)?.name || displayId(line.productId)}</span>
                    <Input label="Requested quantity" type="number" min="0.000001" step="any" value={line.requestedQuantity} onChange={(event) => setRequestLines((current) => current.map((item) => item.productId === line.productId ? { ...item, requestedQuantity: event.target.value } : item))} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setRequestLines((current) => current.filter((item) => item.productId !== line.productId))}>Remove</Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !requestLines.length || !products.length}><Send size={16} /> {saving ? 'Submitting...' : 'Submit request'}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Transfer register" description={`${transfers.length} transfer${transfers.length === 1 ? '' : 's'} in your location scope`}>
        <div className="mb-4 max-w-xs">
          <Select label="Filter by status" name="statusFilter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </div>
        <Table columns={columns} rows={visibleTransfers} rowKey="id" emptyMessage={statusFilter ? `No ${statusFilter.toLowerCase()} transfers.` : 'No outlet transfers yet.'} />
      </Card>

      {selectedTransfer && (
        <Card
          title={`Transfer ${displayId(selectedTransfer.id)}`}
          description={`${locationsById.get(selectedTransfer.fromWarehouseId) || 'Central warehouse'} to ${locationsById.get(selectedTransfer.toWarehouseId) || 'Outlet'} · ${formatDate(selectedTransfer.createdAt)}`}
          actions={<Badge tone={statusTone[selectedTransfer.status] || 'neutral'}>{selectedTransfer.status}</Badge>}
        >
          <form className="space-y-4" onSubmit={submitWorkflow}>
            <div className="space-y-3">
              {selectedTransfer.lines.map((line) => {
                const product = productsById.get(line.productId);
                const editable = (selectedTransfer.status === 'Requested' && canWrite)
                  || (selectedTransfer.status === 'Dispatched' && canReceive);
                const quantityName = selectedTransfer.status === 'Requested' ? 'Dispatch quantity' : 'Received quantity';
                const currentQuantity = selectedTransfer.status === 'Requested'
                  ? line.dispatchedQuantity
                  : line.receivedQuantity;
                const initialQuantity = selectedTransfer.status === 'Requested'
                  ? line.requestedQuantity
                  : line.dispatchedQuantity;
                return (
                  <div key={line.productId} className="grid items-center gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_repeat(3,minmax(5rem,auto))]">
                    <div><strong className="block text-sm text-slate-800">{product?.name || displayId(line.productId)}</strong><small className="text-slate-500">{product?.barcode || line.productId}</small></div>
                    <span className="text-sm text-slate-600">Requested: {line.requestedQuantity}</span>
                    {selectedTransfer.status !== 'Requested' && <span className="text-sm text-slate-600">Dispatched: {line.dispatchedQuantity}</span>}
                    {editable ? (
                      <Input label={quantityName} type="number" min="0" step="any" value={quantityDraft[line.productId] ?? currentQuantity ?? initialQuantity} onChange={(event) => setQuantityDraft((current) => ({ ...current, [line.productId]: event.target.value }))} />
                    ) : selectedTransfer.status === 'Received' || selectedTransfer.status === 'Discrepancy' ? (
                      <span className="text-sm text-slate-600">Received: {line.receivedQuantity}</span>
                    ) : null}
                    {line.discrepancyQuantity > 0 && <span className="text-sm font-medium text-red-700">Difference: {line.discrepancyQuantity}</span>}
                  </div>
                );
              })}
            </div>
            {selectedTransfer.status === 'Requested' && canWrite && (
              <div className="flex justify-end"><Button type="submit" disabled={saving}><ArrowUpFromLine size={16} /> {saving ? 'Dispatching...' : 'Dispatch transfer'}</Button></div>
            )}
            {selectedTransfer.status === 'Dispatched' && canReceive && (
              <div className="flex justify-end"><Button type="submit" disabled={saving}><ArrowDownToLine size={16} /> {saving ? 'Confirming...' : 'Confirm outlet receipt'}</Button></div>
            )}
            {!((selectedTransfer.status === 'Requested' && canWrite) || (selectedTransfer.status === 'Dispatched' && canReceive)) && (
              <p className="text-sm text-slate-500"><Check size={15} className="mr-1 inline" /> This transfer is read-only for your role or has completed its available action.</p>
            )}
          </form>
        </Card>
      )}
    </section>
  );
}
