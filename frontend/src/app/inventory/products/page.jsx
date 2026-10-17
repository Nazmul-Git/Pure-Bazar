'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Plus, Search } from 'lucide-react';
import { Badge, Button, Input, Table } from '@/components/ui';
import ProductFormModal from '@/components/inventory/product-form-modal';
import { createProduct, getProducts } from '@/services/inventory';

const money = (value) => new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
}).format(Number(value) || 0);

const columns = [
  { key: 'name', label: 'Product' },
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
  const [search, setSearch] = useState('');
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

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => `${product.name} ${product.barcode}`.toLowerCase().includes(query));
  }, [products, search]);

  async function addProduct(payload) {
    const { data } = await createProduct(token, payload);
    setProducts((current) => [...current, data.product].sort((a, b) => a.name.localeCompare(b.name)));
    setError('');
  }

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading products...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view products.</p>;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Inventory</p>
          <h1 className="text-2xl font-semibold text-slate-900">All Products</h1>
          <p className="mt-1 text-sm text-slate-600">Review product ownership, prices, margins, and VAT.</p>
        </div>
        {canWrite && <Button onClick={() => setFormOpen(true)}><Plus size={17} /> Add New Product</Button>}
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <div className="max-w-sm">
        <Input label="Search products" name="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or barcode" />
        <Search size={16} aria-hidden="true" className="pointer-events-none relative -mt-7 ml-auto mr-3 text-slate-400" />
      </div>
      <Table columns={columns} rows={visibleProducts} rowKey="id" emptyMessage={search ? 'No products match your search.' : 'No products found.'} />

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
