'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import useToastMessages from '@/hooks/use-toast-messages';
import { Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import useBarcodeScanner from '@/hooks/use-barcode-scanner';
import { getProducts } from '@/services/inventory';
import { combineQuantity, formatStock, isMultiUnit, splitQuantity } from '@/services/stock-units.cjs';
import {
  createStockCount, getLocations, getStockCounts, getWarehouseStock, postStockCount,
} from '@/services/stock';
import { T } from '@/i18n/language-provider';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
const recordId = (record) => String(record.id || record._id);
const statusTone = { Counting: 'info', PendingApproval: 'warning', Posted: 'success', Rejected: 'danger' };

const lineQuantity = (line) => combineQuantity(line.boxes, line.pieces, line.unitsPerPackage);

export default function StockCountsPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'stock:read');
  const canWrite = can(permissions, 'stock:write');
  const [counts, setCounts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [stock, setStock] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [countLines, setCountLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useToastMessages({ success: notice, error });

  useEffect(() => {
    if (!initialized) return undefined;
    if (!token || !canRead) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    Promise.all([
      getLocations(token),
      getStockCounts(token),
      can(permissions, 'products:read') ? getProducts(token) : Promise.resolve(null),
    ])
      .then(([locationResponse, countResponse, productResponse]) => {
        if (!active) return;
        const availableLocations = locationResponse.data.locations;
        setLocations(availableLocations);
        setWarehouseId(user?.locationId || availableLocations[0]?.id || '');
        setCounts(countResponse.data.stockCounts);
        setProducts(productResponse?.data.products || []);
      })
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'Unable to load stock count data.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, initialized, permissions, token, user?.locationId]);

  useEffect(() => {
    if (!token || !warehouseId) return undefined;
    let active = true;
    getWarehouseStock(token, warehouseId)
      .then((response) => active && setStock(response.data.stock))
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'Unable to load location stock.'));
    return () => { active = false; };
  }, [token, warehouseId]);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const stockByProduct = useMemo(() => new Map(stock.map((item) => [item.productId, Number(item.quantity) || 0])), [stock]);
  const stockUnits = useMemo(() => new Map(stock.map((item) => [item.productId, item.unitsPerPackage])), [stock]);
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? products.filter((product) => `${product.name} ${product.barcode}`.toLowerCase().includes(query)).slice(0, 8) : [];
  }, [products, search]);

  const addProduct = useCallback((product) => {
    setCountLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) return current.map((line) => line.productId === product.id
        ? { ...line, ...(isMultiUnit(line.unitsPerPackage) ? { pieces: Number(line.pieces) + 1 } : { boxes: Number(line.boxes) + 1 }) } : line);
      const expectedQuantity = stockByProduct.get(product.id) || 0;
      const { boxes, pieces } = splitQuantity(expectedQuantity, product.unitsPerPackage);
      return [...current, { productId: product.id, expectedQuantity, unitsPerPackage: product.unitsPerPackage || 1, boxes, pieces }];
    });
    setSearch('');
  }, [stockByProduct]);

  const scanner = useBarcodeScanner((barcode) => {
    const product = products.find((item) => item.barcode === barcode);
    if (!product) {
      setError(`No product matches barcode ${barcode}.`);
      return;
    }
    setError('');
    addProduct(product);
    setNotice(`${product.name} added to this count.`);
  });

  const updateLine = (productId, field, value) => setCountLines((current) => current.map((item) => item.productId === productId ? { ...item, [field]: value } : item));

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!warehouseId || !reason.trim() || !countLines.length
      || countLines.some((line) => !Number.isFinite(lineQuantity(line)) || Number(line.boxes) < 0 || Number(line.pieces) < 0)) {
      setError('Choose a location, provide a reason, and enter a non-negative count for each product.');
      return;
    }
    setSaving(true);
    try {
      const response = await createStockCount(token, {
        warehouseId,
        reason: reason.trim(),
        lines: countLines.map((line) => ({ productId: line.productId, countedQuantity: lineQuantity(line) })),
      });
      setCounts((current) => [response.data.stockCount, ...current]);
      setCountLines([]);
      setReason('');
      setNotice('Count saved. Post it from the register when the physical count is complete.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save the stock count.');
    } finally {
      setSaving(false);
    }
  }

  async function postCount(count) {
    setError('');
    setNotice('');
    try {
      const response = await postStockCount(token, recordId(count));
      const updated = response.data.stockCount;
      setCounts((current) => current.map((item) => recordId(item) === recordId(updated) ? updated : item));
      setNotice(updated.status === 'PendingApproval'
        ? 'Count posted and its stock adjustment is awaiting Super Admin approval.'
        : 'Count posted and stock differences applied.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to post this stock count.');
    }
  }

  const unitsOf = (productId) => productsById.get(String(productId))?.unitsPerPackage || stockUnits.get(String(productId)) || 1;
  const columns = [
    {
      key: '_id',
      label: 'Count / Date',
      render: (_, count) => <div><strong>{recordId(count).slice(-8).toUpperCase()}</strong><small className="block text-slate-500">{new Date(count.createdAt).toLocaleString()}</small></div>,
    },
    { key: 'warehouseId', label: 'Location', render: (id) => locations.find((item) => item.id === String(id))?.name || 'Location' },
    { key: 'reason', label: 'Reason' },
    { key: 'lines', label: 'Products', render: (items) => items.length },
    { key: 'status', label: 'Status', render: (status) => <Badge tone={statusTone[status] || 'neutral'}>{status}</Badge> },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, count) => count.status === 'Counting' && canWrite
        ? <Button size="sm" onClick={() => postCount(count)}>Post count</Button>
        : count.status === 'PendingApproval' ? 'Awaiting approval' : '—',
    },
  ];

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500"><T>{"Loading stock counts..."}</T></p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><T>{"You do not have permission to view stock counts."}</T></p>;

  return (
    <section className="space-y-5">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500"><T>{"Inventory"}</T></p>
        <h1 className="text-2xl font-semibold text-slate-900"><T>{"Stock Count"}</T></h1>
        <p className="mt-1 text-sm text-slate-600"><T>{"Scan or select products, record physical quantities, then post the count."}</T></p>
      </header>
      {canWrite && (
        <Card title="Start stock count" description="The system quantity is captured when the count is submitted.">
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Warehouse or outlet" name="warehouseId" value={warehouseId} disabled={Boolean(user?.locationId)} onChange={(event) => setWarehouseId(event.target.value)}>
                <option value=""><T>{"Choose a location"}</T></option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </Select>
              <Input label="Count reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required placeholder="e.g. Monthly inventory count" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Scan barcode and press Enter" name="barcodeScanner" value={scanner.value} onChange={scanner.onChange} onKeyDown={scanner.onKeyDown} placeholder="Focus here, then scan a product barcode" disabled={!products.length} />
              <div className="relative">
                <Input label="Find product" name="productSearch" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or barcode" disabled={!products.length} />
                {matches.length > 0 && <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
                  {matches.map((product) => <button key={product.id} type="button" className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50" onClick={() => addProduct(product)}>
                    <span className="block text-sm font-medium">{product.name}</span><small className="text-slate-500">{product.barcode}</small>
                  </button>)}
                </div>}
              </div>
            </div>
            {!can(permissions, 'products:read') && <p className="text-sm text-amber-700"><T>{"Product read permission is required to select or scan count lines."}</T></p>}
            {countLines.length > 0 && <div className="space-y-2">
              {countLines.map((line) => {
                const product = productsById.get(line.productId);
                return <div key={line.productId} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_12rem_14rem_auto]">
                  <div><strong className="block text-sm">{product?.name || 'Product'}</strong><small className="text-slate-500">{product?.barcode}</small></div>
                  <span className="pb-2 text-sm text-slate-600">System: {formatStock(line.expectedQuantity, line.unitsPerPackage)}</span>
                  <div className="flex gap-2">
                    <Input label={isMultiUnit(line.unitsPerPackage) ? 'Boxes' : 'Counted quantity'} type="number" min="0" step={isMultiUnit(line.unitsPerPackage) ? '1' : 'any'} value={line.boxes} onChange={(event) => updateLine(line.productId, 'boxes', event.target.value)} />
                    {isMultiUnit(line.unitsPerPackage) && <Input label="Pieces" type="number" min="0" step="1" value={line.pieces} onChange={(event) => updateLine(line.productId, 'pieces', event.target.value)} />}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCountLines((current) => current.filter((item) => item.productId !== line.productId))}>Remove</Button>
                </div>;
              })}
            </div>}
            <div className="flex justify-end"><Button type="submit" disabled={saving || !countLines.length || !products.length}>{saving ? 'Saving...' : 'Save count'}</Button></div>
          </form>
        </Card>
      )}
      <Card title="Count register" description={`${counts.length} count${counts.length === 1 ? '' : 's'} in your location scope`}>
        <Table columns={columns} rows={counts} rowKey="_id" emptyMessage="No stock counts yet." />
      </Card>
      {counts.filter((count) => count.lines?.length).map((count) => (
        <Card key={recordId(count)} title={`Count ${recordId(count).slice(-8).toUpperCase()}`} description={count.reason}>
          <div className="space-y-2">
            {count.lines.map((line) => <div key={String(line.productId)} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2 text-sm">
              <span>{productsById.get(String(line.productId))?.name || String(line.productId).slice(-8)}</span>
              <span className="text-slate-600">System {formatStock(line.expectedQuantity, unitsOf(line.productId))} · Counted {formatStock(line.countedQuantity, unitsOf(line.productId))} · Difference {line.difference > 0 ? '+' : ''}{formatStock(line.difference, unitsOf(line.productId))}</span>
            </div>)}
          </div>
        </Card>
      ))}
    </section>
  );
}
