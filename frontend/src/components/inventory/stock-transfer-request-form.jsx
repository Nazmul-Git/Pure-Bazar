'use client';

import { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Button, Card, Input, Select } from '@/components/ui';
import useBarcodeScanner from '@/hooks/use-barcode-scanner';
import { searchReceiveProducts } from '@/services/stock';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);

export default function StockTransferRequestForm({
  token,
  permissions,
  canChooseSource,
  sourceLocations,
  outletLocations,
  sourceId,
  setSourceId,
  outletId,
  setOutletId,
  saving,
  setError,
  onSubmitRequest,
}) {
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [requestLines, setRequestLines] = useState([]);

  useEffect(() => {
    const query = search.trim();
    if (!token || !sourceId || !can(permissions, 'products:read') || !query) {
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
      searchReceiveProducts(token, { warehouseId: sourceId, mode: 'REMOVE', q: query, limit: 10 })
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
  }, [permissions, search, sourceId, token]);

  const addRequestProduct = useCallback((product) => {
    const stockQuantity = Number(product.stockQuantity) || 0;
    const existing = requestLines.find((line) => line.productId === product.id);
    if (existing && Number(existing.requestedQuantity || 0) + 1 > stockQuantity) {
      setError(`${product.name}: requested quantity cannot exceed the ${stockQuantity} units available in the Central Warehouse.`);
      return false;
    }
    setRequestLines((current) => {
      const line = current.find((item) => item.productId === product.id);
      if (line) return current.map((item) => item.productId === product.id
        ? { ...item, requestedQuantity: Number(item.requestedQuantity || 0) + 1 }
        : item);
      return [...current, {
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        stockQuantity,
        requestedQuantity: 1,
      }];
    });
    setSearch('');
    setMatches([]);
    setSearchError('');
    setError('');
    return true;
  }, [requestLines, setError]);

  const scanBarcode = useCallback(async (barcode) => {
    if (!token || !sourceId || !can(permissions, 'products:read')) {
      setError('Choose a source warehouse and ensure you have product read permission before scanning.');
      return;
    }
    setError('');
    try {
      const response = await searchReceiveProducts(token, {
        warehouseId: sourceId, mode: 'REMOVE', q: barcode, limit: 10,
      });
      const product = response.data.products.find((item) => item.barcode === barcode);
      if (!product) {
        setError(`No in-stock Central Warehouse product matches barcode ${barcode}.`);
        return;
      }
      if (addRequestProduct(product)) setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to search for the scanned product.');
    }
  }, [addRequestProduct, permissions, setError, sourceId, token]);
  const scanner = useBarcodeScanner(scanBarcode);
  const invalidRequestLines = requestLines.filter((line) => (
    !Number.isInteger(Number(line.requestedQuantity))
    || Number(line.requestedQuantity) < 1
    || Number(line.requestedQuantity) > line.stockQuantity
  ));

  function changeSource(event) {
    setSourceId(event.target.value);
    setRequestLines([]);
    setSearch('');
    setMatches([]);
    setSearchError('');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (invalidRequestLines.length) {
      setError('Enter a positive whole-number quantity no greater than the available Central Warehouse stock for each product.');
      return;
    }
    const created = await onSubmitRequest(requestLines);
    if (created) {
      setRequestLines([]);
      setSearch('');
    }
  }

  return (
    <Card title="Request a transfer" description="Create an outlet stock request from the central warehouse.">
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Source warehouse" name="sourceId" value={sourceId} disabled={!canChooseSource} onChange={changeSource}>
            <option value="">Choose a warehouse</option>
            {sourceLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </Select>
          <Select label="Destination outlet" name="outletId" value={outletId} onChange={(event) => setOutletId(event.target.value)}>
            <option value="">Choose an outlet</option>
            {outletLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </Select>
        </div>
        {!can(permissions, 'products:read') && <p className="text-sm text-amber-700">Product read permission is required to add transfer lines.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Scan barcode and press Enter" name="barcodeScanner" value={scanner.value} onChange={scanner.onChange} onKeyDown={scanner.onKeyDown} placeholder="Focus here, then scan a product barcode" disabled={!sourceId || !can(permissions, 'products:read')} />
          <div className="relative">
            <Input label="Find product" name="productSearch" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or barcode" disabled={!sourceId || !can(permissions, 'products:read')} />
            {searching && <p role="status" className="mt-1 text-xs text-slate-500">Searching products...</p>}
            {searchError && <p role="alert" className="mt-1 text-xs text-red-700">{searchError}</p>}
            {matches.length > 0 && <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
              {matches.map((product) => <button key={product.id} type="button" className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50" onClick={() => addRequestProduct(product)}>
                <span className="block text-sm font-medium">{product.name}</span>
                <small className="text-slate-500">{product.barcode} · Central Warehouse stock: {product.stockQuantity}</small>
              </button>)}
            </div>}
            {search.trim() && !searching && !searchError && matches.length === 0 && <p className="mt-1 text-xs text-slate-500">No in-stock Central Warehouse products found for this search.</p>}
          </div>
        </div>
        {requestLines.length > 0 && (
          <div className="space-y-2">
            {requestLines.map((line) => (
              <div key={line.productId} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_9rem_auto]">
                <div><strong className="block text-sm font-medium text-slate-800">{line.productName}</strong><small className="text-slate-500">{line.barcode} · Central Warehouse stock: {line.stockQuantity}</small></div>
                <div>
                  <Input label="Requested quantity" type="number" min="1" max={line.stockQuantity} step="1" value={line.requestedQuantity} onChange={(event) => setRequestLines((current) => current.map((item) => item.productId === line.productId ? { ...item, requestedQuantity: event.target.value } : item))} />
                  {Number(line.requestedQuantity) > line.stockQuantity
                    ? <p className="mt-1 text-xs text-red-700">Cannot request more than {line.stockQuantity} currently available in the Central Warehouse.</p>
                    : !Number.isInteger(Number(line.requestedQuantity)) || Number(line.requestedQuantity) < 1
                      ? <p className="mt-1 text-xs text-red-700">Enter a positive whole-number quantity.</p>
                      : null}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRequestLines((current) => current.filter((item) => item.productId !== line.productId))}>Remove</Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !requestLines.length || invalidRequestLines.length > 0}><Send size={16} /> {saving ? 'Submitting...' : 'Submit request'}</Button>
        </div>
      </form>
    </Card>
  );
}
