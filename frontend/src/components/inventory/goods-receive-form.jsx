'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Search, Trash2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Button, Card, Input, Select } from '@/components/ui';
import {
  createGoodsReceive, getLocations, getReceiveVendors, getWarehouseStock, searchReceiveProducts,
} from '@/services/stock';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);

export default function GoodsReceiveForm() {
  const router = useRouter();
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'stock:read');
  const canWrite = can(permissions, 'stock:write');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [location, setLocation] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [stock, setStock] = useState([]);
  const [ownerType, setOwnerType] = useState('COMPANY');
  const [vendorId, setVendorId] = useState('');
  const [challan, setChallan] = useState('');
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState([]);
  const [lines, setLines] = useState([]);

  useEffect(() => {
    if (!initialized) return undefined;
    if (!token || !canRead) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    Promise.all([getLocations(token, 'CENTRAL'), getReceiveVendors(token)])
      .then(async ([locationResponse, vendorResponse]) => {
        const central = locationResponse.data.locations.find(({ type }) => type === 'CENTRAL');
        if (!central) throw new Error('Central Warehouse is not configured. Run the default data seed first.');
        const stockResponse = await getWarehouseStock(token, central.id);
        if (!active) return;
        setLocation(central);
        setVendors(vendorResponse.data.vendors);
        setStock(stockResponse.data.stock);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || requestError.message || 'Unable to load GRN data.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, initialized, token]);

  useEffect(() => {
    if (!token || (ownerType === 'VENDOR' && !vendorId) || search.trim().length < 2) {
      setMatches([]);
      setSearchError('');
      return undefined;
    }
    let active = true;
    const timeout = setTimeout(() => {
      searchReceiveProducts(token, {
        ownerType,
        ...(ownerType === 'VENDOR' ? { vendorId } : {}),
        q: search.trim(),
      })
        .then((response) => active && setMatches(response.data.products))
        .catch((requestError) => active && setSearchError(
          requestError.response?.data?.message || 'Unable to search products.',
        ));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [ownerType, search, token, vendorId]);

  const stockByProduct = useMemo(
    () => new Map(stock.map((item) => [item.productId, Number(item.quantity) || 0])),
    [stock],
  );
  const activeVendors = vendors.filter((vendor) => vendor.status === 'Active');

  function addProduct(product) {
    setLines((current) => {
      if (current.some((line) => line.productId === product.id)) return current;
      return [...current, {
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        receivedQuantity: 1,
        acceptedQuantity: 1,
        rejectedQuantity: 0,
      }];
    });
    setSearch('');
    setMatches([]);
  }

  function updateLine(productId, field, value) {
    const quantity = value === '' ? '' : Number(value);
    setLines((current) => current.map((line) => (
      line.productId === productId ? { ...line, [field]: quantity } : line
    )));
  }

  function removeLine(productId) {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!location || (ownerType === 'VENDOR' && (!vendorId || !challan.trim())) || lines.length === 0) {
      setError(ownerType === 'VENDOR'
        ? 'Select a vendor, enter the challan number, and add at least one product.'
        : 'Add at least one company product.');
      return;
    }
    const validLines = lines.every((line) => (
      Number(line.receivedQuantity) > 0
      && Number(line.acceptedQuantity) >= 0
      && Number(line.rejectedQuantity) >= 0
      && Number(line.acceptedQuantity) + Number(line.rejectedQuantity) <= Number(line.receivedQuantity)
    ));
    if (!validLines) {
      setError('Accepted and rejected quantities must be valid and cannot exceed the received quantity.');
      return;
    }

    setSaving(true);
    try {
      await createGoodsReceive(token, {
        ownerType,
        ...(ownerType === 'VENDOR' ? { vendorId, vendorChallanNumber: challan.trim() } : {}),
        warehouseId: location.id,
        lines: lines.map((line) => ({
          productId: line.productId,
          receivedQuantity: Number(line.receivedQuantity),
          acceptedQuantity: Number(line.acceptedQuantity),
          rejectedQuantity: Number(line.rejectedQuantity),
        })),
      });
      router.push('/inventory/goods-receives');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save the goods receive.');
      setSaving(false);
    }
  }

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading GRN form...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view goods receives.</p>;
  if (!canWrite) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to create goods receives.</p>;

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/inventory/goods-receives" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft size={16} /> Goods Receive
          </Link>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Inventory</p>
          <h1 className="text-2xl font-semibold text-slate-900">New Goods Receive</h1>
          <p className="mt-1 text-sm text-slate-600">Receive goods into {location?.name}.</p>
        </div>
        <Button type="submit" disabled={saving || !location}>
          {saving ? 'Saving...' : 'Save Draft'}
        </Button>
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <Card title="Receive details" description="The selected Central Warehouse is loaded automatically.">
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Purchase type"
            name="ownerType"
            value={ownerType}
            onChange={(event) => {
              setOwnerType(event.target.value);
              setVendorId('');
              setChallan('');
              setLines([]);
              setMatches([]);
              setSearch('');
            }}
          >
            <option value="COMPANY">Company purchase</option>
            <option value="VENDOR">Vendor purchase</option>
          </Select>
          {ownerType === 'VENDOR' && (
            <>
              <Select
                label="Vendor"
                name="vendorId"
                value={vendorId}
                onChange={(event) => {
                  setVendorId(event.target.value);
                  setLines([]);
                  setMatches([]);
                  setSearch('');
                }}
                required
              >
                <option value="">Select a vendor</option>
                {activeVendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name} — {vendor.shopName} ({vendor.memberId})
                  </option>
                ))}
              </Select>
              <Input
                label="Vendor challan number"
                name="challan"
                value={challan}
                onChange={(event) => setChallan(event.target.value)}
                maxLength={100}
                required
                placeholder="Enter challan number"
              />
            </>
          )}
        </div>
        {ownerType === 'VENDOR' && !activeVendors.length && (
          <p className="mt-3 text-sm text-slate-500">No active vendors are available.</p>
        )}
      </Card>

      <Card title="Add products" description="Search by product name or barcode. Current Central Warehouse stock is shown for each result.">
        <div className="max-w-lg">
          <Input
            label={`Search ${ownerType === 'COMPANY' ? 'company' : 'vendor'} products`}
            name="productSearch"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={ownerType === 'COMPANY' || vendorId
              ? 'Type at least 2 characters' : 'Select a vendor first'}
            disabled={ownerType === 'VENDOR' && !vendorId}
          />
          <Search size={16} aria-hidden="true" className="pointer-events-none relative -mt-7 ml-auto mr-3 text-slate-400" />
        </div>
        {searchError && <p role="alert" className="mt-3 text-sm text-red-700">{searchError}</p>}
        {search.trim().length >= 2 && (
          <div className="mt-3 max-w-lg overflow-hidden rounded border border-slate-200">
            {matches.length ? matches.map((product) => (
              <button
                key={product.id}
                type="button"
                className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
                onClick={() => addProduct(product)}
                disabled={lines.some((line) => line.productId === product.id)}
              >
                <span>
                  <strong className="block text-sm text-slate-800">{product.name}</strong>
                  <small className="text-slate-500">{product.barcode}</small>
                </span>
                <span className="whitespace-nowrap text-xs text-slate-500">
                  Stock: {stockByProduct.get(product.id) ?? 0}
                  <Plus size={15} className="ml-2 inline" />
                </span>
              </button>
            )) : <p className="px-3 py-3 text-sm text-slate-500">No matching products.</p>}
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="ui-table min-w-[760px]">
            <thead>
              <tr>
                <th scope="col">Product</th><th scope="col">Current stock</th><th scope="col">Received</th>
                <th scope="col">Accepted</th><th scope="col">Rejected</th><th scope="col"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.length ? lines.map((line) => (
                <tr key={line.productId}>
                  <td>
                    <strong className="block">{line.productName}</strong>
                    <small className="text-slate-500">{line.barcode}</small>
                  </td>
                  <td>{stockByProduct.get(line.productId) ?? 0}</td>
                  {['receivedQuantity', 'acceptedQuantity', 'rejectedQuantity'].map((field) => (
                    <td key={field}>
                      <input
                        aria-label={`${line.productName} ${field}`}
                        className="ui-input w-28"
                        type="number"
                        min={field === 'receivedQuantity' ? '0.000001' : '0'}
                        max={field === 'acceptedQuantity'
                          ? Number(line.receivedQuantity || 0) - Number(line.rejectedQuantity || 0)
                          : field === 'rejectedQuantity'
                            ? Number(line.receivedQuantity || 0) - Number(line.acceptedQuantity || 0)
                            : undefined}
                        step="any"
                        value={line[field]}
                        onChange={(event) => updateLine(line.productId, field, event.target.value)}
                      />
                    </td>
                  ))}
                  <td>
                    <button type="button" className="icon-button" aria-label={`Remove ${line.productName}`} onClick={() => removeLine(line.productId)}>
                      <Trash2 size={17} />
                    </button>
                  </td>
                </tr>
              )) : <tr><td className="table-empty" colSpan={6}>
                Search for a {ownerType === 'COMPANY' ? 'company' : 'vendor'} product to add it to this receive.
              </td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => router.push('/inventory/goods-receives')}>Cancel</Button>
        <Button type="submit" disabled={saving || !location}>{saving ? 'Saving...' : 'Save Draft'}</Button>
      </div>
    </form>
  );
}
