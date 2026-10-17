'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import useBarcodeScanner from '@/hooks/use-barcode-scanner';
import {
  approveStockAdjustment, createStockAdjustment, getLocations, getStockAdjustments, rejectStockAdjustment,
  searchReceiveProducts,
} from '@/services/stock';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
const recordId = (record) => String(record.id || record._id);
const statusTone = { Approved: 'success', Pending: 'warning', Rejected: 'danger' };
const money = (value) => new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(Number(value) || 0);
const reasons = ['Damaged', 'Expired', 'Lost or stolen', 'Found extra stock', 'Data entry correction', 'Other'];

export default function StockAdjustmentsPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'stock:read');
  const canWrite = can(permissions, 'stock:write');
  const canReadProducts = can(permissions, 'products:read');
  const [adjustments, setAdjustments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [matches, setMatches] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [mode, setMode] = useState('REMOVE');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [lines, setLines] = useState([]);
  const [reason, setReason] = useState('');
  const [reasonNote, setReasonNote] = useState('');
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
    ])
      .then(([locationResponse, adjustmentResponse]) => {
        if (!active) return;
        const availableLocations = locationResponse.data.locations;
        setLocations(availableLocations);
        setWarehouseId(user?.locationId || availableLocations[0]?.id || '');
        setAdjustments(adjustmentResponse.data.stockAdjustments);
      })
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'Unable to load stock adjustments.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, initialized, permissions, token, user?.locationId]);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const reasonMismatch = (
    (['Damaged', 'Expired', 'Lost or stolen'].includes(reason) && mode !== 'REMOVE')
    || (reason === 'Found extra stock' && mode !== 'ADD')
  );
  const overStockLines = lines.filter((line) => (
    mode === 'REMOVE' && Number(line.quantity) > Number(line.stockQuantity)
  ));

  useEffect(() => {
    const query = search.trim();
    if (!token || !warehouseId || !canReadProducts || !query) {
      setMatches([]);
      setSearching(false);
      setSearchError('');
      return undefined;
    }
    setMatches([]);
    setSearchError('');
    let active = true;
    const timeout = setTimeout(() => {
      setSearching(true);
      searchReceiveProducts(token, { warehouseId, mode, q: query, limit: 10 })
        .then((response) => active && setMatches(response.data.products))
        .catch((requestError) => active && setSearchError(
          requestError.response?.data?.message || 'Unable to search products.',
        ))
        .finally(() => active && setSearching(false));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [canReadProducts, mode, search, token, warehouseId]);

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
      return `${line.productName || product?.name || String(line.productId).slice(-6)} (${Number(line.quantity) > 0 ? '+' : ''}${line.quantity})`;
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

  const addProduct = useCallback((product) => {
    setProducts((current) => current.some((item) => item.id === product.id)
      ? current : [...current, product]);
    setLines((current) => current.some((line) => line.productId === product.id)
      ? current : [...current, {
        productId: product.id,
        quantity: '1',
        stockQuantity: Number(product.stockQuantity) || 0,
      }]);
    setSearch('');
    setMatches([]);
    setSearchError('');
  }, []);

  const scanBarcode = useCallback(async (barcode) => {
    if (!token || !warehouseId || !canReadProducts) {
      setError('Choose a location and ensure you have product read permission before scanning.');
      return;
    }
    setError('');
    setNotice('');
    try {
      const response = await searchReceiveProducts(token, {
        warehouseId, mode, q: barcode, limit: 10,
      });
      const product = response.data.products.find((item) => item.barcode === barcode);
      if (!product) {
        setError(`No eligible product matches barcode ${barcode}.`);
        return;
      }
      addProduct(product);
      setNotice(`${product.name} added to this adjustment.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to search for the scanned product.');
    }
  }, [addProduct, canReadProducts, mode, token, warehouseId]);
  const scanner = useBarcodeScanner(scanBarcode);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!warehouseId || !reason || (reason === 'Other' && !reasonNote.trim())
      || !lines.length || lines.some((line) => !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0)) {
      setError('Choose a location and reason, add a valid note for Other, and enter a positive quantity for each product.');
      return;
    }
    if (reasonMismatch) {
      setError('Choose a reason that matches the selected adjustment mode.');
      return;
    }
    if (overStockLines.length) {
      setError('Cannot remove more stock than is currently available at this location.');
      return;
    }
    setSaving(true);
    try {
      const response = await createStockAdjustment(token, {
        warehouseId,
        mode,
        reason,
        ...(reason === 'Other' ? { reasonNote: reasonNote.trim() } : {}),
        lines: lines.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
      });
      setAdjustments((current) => [response.data.stockAdjustment, ...current]);
      setLines([]);
      setReason('');
      setReasonNote('');
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
        <Card title="New adjustment" description="Enter positive quantities; the selected mode determines whether stock is added or removed.">
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Warehouse or outlet" name="warehouseId" value={warehouseId} disabled={Boolean(user?.locationId)} onChange={(event) => {
                setWarehouseId(event.target.value);
                setLines([]);
                setSearch('');
                setMatches([]);
              }}>
                <option value="">Choose a location</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </Select>
              <Select label="Adjustment mode" name="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="REMOVE">Remove stock</option>
                <option value="ADD">Add stock</option>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} required>
                <option value="">Choose a reason</option>
                {reasons.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              {reason === 'Other' && <Input label="Reason note" name="reasonNote" value={reasonNote} onChange={(event) => setReasonNote(event.target.value)} maxLength={500} required placeholder="Add a short note" />}
            </div>
            {reasonMismatch && <p role="alert" className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{reason} is not allowed in {mode === 'REMOVE' ? 'Remove stock' : 'Add stock'} mode.</p>}
            {!can(permissions, 'products:read') && <p className="text-sm text-amber-700">Product read permission is required to select adjustment lines.</p>}
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Scan barcode and press Enter" name="barcodeScanner" value={scanner.value} onChange={scanner.onChange} onKeyDown={scanner.onKeyDown} placeholder="Focus here, then scan a product barcode" disabled={!warehouseId || !can(permissions, 'products:read')} />
              <div className="relative">
                <Input label="Find product" name="productSearch" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or barcode" disabled={!warehouseId || !can(permissions, 'products:read')} />
                {searching && <p role="status" className="mt-1 text-xs text-slate-500">Searching products...</p>}
                {searchError && <p role="alert" className="mt-1 text-xs text-red-700">{searchError}</p>}
                {matches.length > 0 && <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
                  {matches.map((product) => <button key={product.id} type="button" className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50" onClick={() => addProduct(product)}>
                    <span className="block text-sm font-medium">{product.name}</span>
                    <small className="text-slate-500">{product.barcode} · Current stock: {product.stockQuantity}</small>
                  </button>)}
                </div>}
                {search.trim() && !searching && !searchError && matches.length === 0 && <p className="mt-1 text-xs text-slate-500">No products found for this search.</p>}
              </div>
            </div>
            {lines.map((line) => (
              <div key={line.productId} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_8rem_12rem_auto]">
                <div><strong className="block text-sm">{productsById.get(line.productId)?.name}</strong><small className="text-slate-500">{productsById.get(line.productId)?.barcode}</small></div>
                <span className="pb-2 text-sm text-slate-600">Current stock: {line.stockQuantity}</span>
                <div>
                  <Input label="Quantity" type="number" min="0.000001" max={mode === 'REMOVE' ? line.stockQuantity : undefined} step="any" value={line.quantity} onChange={(event) => setLines((current) => current.map((entry) => entry.productId === line.productId ? { ...entry, quantity: event.target.value } : entry))} />
                  {mode === 'REMOVE' && Number(line.quantity) > Number(line.stockQuantity) && <p className="mt-1 text-xs text-red-700">Cannot remove more than {line.stockQuantity} currently in stock.</p>}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setLines((current) => current.filter((entry) => entry.productId !== line.productId))}>Remove</Button>
              </div>
            ))}
            <div className="flex justify-end"><Button type="submit" disabled={saving || !lines.length || reasonMismatch}>{saving ? 'Submitting...' : 'Submit adjustment'}</Button></div>
          </form>
        </Card>
      )}

      <Card title="Adjustment register" description={`${adjustments.length} adjustment${adjustments.length === 1 ? '' : 's'} in your location scope`}>
        <Table columns={columns} rows={adjustments} rowKey="_id" emptyMessage="No stock adjustments yet." />
      </Card>
    </section>
  );
}
