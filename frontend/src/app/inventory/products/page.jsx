'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import useToastMessages from '@/hooks/use-toast-messages';
import { Plus } from 'lucide-react';
import { Badge, Button, Input, Table } from '@/components/ui';
import ProductFormModal from '@/components/inventory/product-form-modal';
import { createProduct, getProducts } from '@/services/inventory';
import { getVendors } from '@/services/vendor';
import { T } from '@/i18n/language-provider';
import CameraBarcodeScanner from '@/components/common/camera-barcode-scanner';

const money = (value) => new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
}).format(Number(value) || 0);

const columns = [
  { key: 'name', label: 'Product', render: (value, product) => product.displayName || value },
  { key: 'barcode', label: 'Barcode' },
  { key: 'ownerType', label: 'Owner', render: (value) => value === 'VENDOR' ? 'Vendor' : 'Company' },
  { key: 'vendorPrice', label: 'Vendor price', render: money },
  { key: 'mrp', label: 'MRP', render: money },
  { key: 'margin', label: 'Margin', render: (value, product) => (
    <div className="flex items-center gap-2">
      <span>{money(value)}</span>
      {product.marginWarning && <Badge variant="warning">Low margin</Badge>}
    </div>
  ) },
  { key: 'vatApplicable', label: 'VAT', render: (value, product) => value ? `${product.vatRate ?? 0}%` : '—' },
];

export default function ProductsPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const [products, setProducts] = useState([]);
  const [marginWarningPercent, setMarginWarningPercent] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useToastMessages({ success: notice, error });
  const [search, setSearch] = useState('');
  const [vendors, setVendors] = useState([]);
  const [vendorFilter, setVendorFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const permissions = user?.permissions || [];
  const canRead = permissions.includes('*') || permissions.includes('products:read');
  const canWrite = permissions.includes('*') || permissions.includes('products:write');

  useEffect(() => {
    if (!initialized) return undefined;
    if (!token || !canRead) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    getProducts(token)
      .then((response) => {
        if (!active) return;
        setProducts(response.data.products);
        setMarginWarningPercent(response.data.marginWarningPercent);
      })
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'Unable to load products.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, initialized, token]);

  useEffect(() => {
    if (!initialized || !token || !canRead) return;
    getVendors(token)
      .then((response) => setVendors(response.data.vendors || []))
      .catch(() => setVendors([]));
  }, [canRead, initialized, token]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const probashiId = vendorFilter.trim().toLowerCase();
    const vendorIds = probashiId
      ? new Set(vendors.filter((vendor) => String(vendor.memberId || '').toLowerCase() === probashiId).map((vendor) => vendor.id))
      : null;
    return products.filter((product) => (
      (!vendorIds || vendorIds.has(product.vendorId))
      && (!query || `${product.name} ${product.barcode}`.toLowerCase().includes(query))
    ));
  }, [products, search, vendorFilter, vendors]);

  async function addProduct(payload) {
    const { data } = await createProduct(token, payload);
    setProducts((current) => [...current, data.product].sort((a, b) => a.name.localeCompare(b.name)));
    setError('');
    setNotice('');
    setTimeout(() => setNotice('Product created successfully.'), 0);
  }

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500"><T>{"Loading products..."}</T></p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><T>{"You do not have permission to view products."}</T></p>;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500"><T>{"Inventory"}</T></p>
          <h1 className="text-2xl font-semibold text-slate-900"><T>{"All Products"}</T></h1>
          <p className="mt-1 text-sm text-slate-600"><T>{"Review product ownership, prices, margins, and VAT."}</T></p>
        </div>
        {canWrite && <Button onClick={() => setFormOpen(true)}><Plus size={17} /> <T>{"Add New Product"}</T></Button>}
      </div>

      <div className="flex max-w-2xl flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Input label="Search products" name="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or barcode" />
        </div>
        <CameraBarcodeScanner onScan={setSearch} />
        <label className="flex min-w-44 flex-col gap-1 text-sm font-medium text-slate-700">
          <T>{"Vendor Probashi ID"}</T>
          <input
            type="search"
            name="vendorFilter"
            aria-label="Filter by vendor Probashi ID"
            list="vendor-probashi-ids"
            value={vendorFilter}
            onChange={(event) => setVendorFilter(event.target.value)}
            placeholder="e.g. phr0007"
            autoComplete="off"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <datalist id="vendor-probashi-ids">
            {vendors.filter((vendor) => vendor.memberId).map((vendor) => (
              <option key={vendor.id} value={vendor.memberId}>{vendor.shopName || vendor.name}</option>
            ))}
          </datalist>
        </label>
      </div>
      <Table columns={columns} rows={visibleProducts} rowKey="id" emptyMessage={search || vendorFilter ? 'No products match your filters.' : 'No products found.'} />

      {canWrite && (
        <ProductFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSubmit={addProduct}
          token={token}
          permissions={permissions}
          marginWarningPercent={marginWarningPercent}
        />
      )}
    </section>
  );
}
