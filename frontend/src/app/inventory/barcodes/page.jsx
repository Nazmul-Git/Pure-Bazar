'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import BarcodeGraphic from '@/components/inventory/barcode-graphic';
import { buildBarcodeLabels } from '@/services/barcodeEngine';
import { getProducts } from '@/services/inventory';
import { downloadOutput, printESC } from '@/utils/print-esc';

export default function BarcodesPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const canRead = (user?.permissions || []).includes('*') || (user?.permissions || []).includes('products:read');
  const [products, setProducts] = useState([]);
  const [queue, setQueue] = useState([]);
  const [search, setSearch] = useState('');
  const [labelType, setLabelType] = useState('price');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!initialized) return undefined;
    if (!token || !canRead) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    getProducts(token)
      .then((response) => active && setProducts(response.data.products))
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'Unable to load products for labels.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, initialized, token]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? products.filter((product) => `${product.name} ${product.barcode}`.toLowerCase().includes(query))
      : products;
  }, [products, search]);
  const queuedProducts = useMemo(() => queue.map((item) => ({
    ...products.find((product) => product.id === item.productId),
    copies: item.copies,
  })).filter((product) => product.id), [products, queue]);
  const generated = useMemo(() => {
    if (!queuedProducts.length) return null;
    try {
      return buildBarcodeLabels(queuedProducts, labelType);
    } catch {
      return null;
    }
  }, [labelType, queuedProducts]);

  function addProduct(product) {
    setQueue((current) => {
      const existing = current.find((item) => item.productId === product.id);
      return existing
        ? current.map((item) => item.productId === product.id ? { ...item, copies: item.copies + 1 } : item)
        : [...current, { productId: product.id, copies: 1 }];
    });
    setNotice('');
    setError('');
  }

  function exportOutput(format) {
    if (!generated) return;
    if (format === 'tspl') {
      downloadOutput(generated.tspl, 'purebazar-labels.tspl', 'text/plain;charset=utf-8');
    } else {
      downloadOutput(generated.escPos, 'purebazar-labels-escpos.bin', 'application/octet-stream');
    }
  }

  async function sendToPrinter() {
    if (!generated) return;
    setError('');
    setNotice('');
    try {
      await printESC(generated.escPos);
      setNotice('ESC/POS labels sent to the selected serial printer.');
    } catch (printError) {
      setError(printError.message || 'Unable to print ESC/POS labels.');
    }
  }

  const columns = [
    { key: 'name', label: 'Product' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'mrp', label: 'Price', render: (value) => `৳${Number(value).toFixed(2)}` },
    { key: 'actions', label: 'Labels', render: (_, product) => <Button size="sm" variant="secondary" onClick={() => addProduct(product)}>Add</Button> },
  ];

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading barcode labels...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to generate product labels.</p>;

  return (
    <section className="space-y-5">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Inventory</p>
        <h1 className="text-2xl font-semibold text-slate-900">Barcode &amp; Price Labels</h1>
        <p className="mt-1 text-sm text-slate-600">Select products and label quantities, then preview, print, or export printer commands.</p>
      </header>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card title="Product catalog" description={`${products.length} products available`}>
          <div className="mb-4 max-w-sm">
            <Input label="Search products" name="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product name or barcode" />
          </div>
          <Table columns={columns} rows={visibleProducts} rowKey="id" emptyMessage="No products match your search." />
        </Card>
        <Card title="Label batch" description="Add products more than once or adjust the number of copies.">
          <div className="mb-4 max-w-xs">
            <Select label="Label format" name="labelType" value={labelType} onChange={(event) => setLabelType(event.target.value)}>
              <option value="price">Barcode + price label</option>
              <option value="barcode">Barcode-only label</option>
            </Select>
          </div>
          {queue.length === 0 ? <p className="rounded border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Add one or more products to create a batch.</p> : (
            <div className="space-y-2">
              {queue.map((item) => {
                const product = products.find((entry) => entry.id === item.productId);
                return <div key={item.productId} className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_7rem_auto]">
                  <div><strong className="block text-sm">{product?.name}</strong><small className="text-slate-500">{product?.barcode}</small></div>
                  <Input label="Copies" type="number" min="1" max="500" step="1" value={item.copies} onChange={(event) => setQueue((current) => current.map((entry) => entry.productId === item.productId ? { ...entry, copies: event.target.value === '' ? '' : Number(event.target.value) } : entry))} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setQueue((current) => current.filter((entry) => entry.productId !== item.productId))}>Remove</Button>
                </div>;
              })}
            </div>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={!generated} onClick={() => exportOutput('tspl')}>Export TSPL</Button>
            <Button variant="secondary" disabled={!generated} onClick={() => exportOutput('escpos')}>Export ESC/POS</Button>
            <Button variant="secondary" disabled={!generated} onClick={sendToPrinter}>Print ESC/POS</Button>
            <Button disabled={!generated} onClick={() => window.print()}>Print preview</Button>
          </div>
        </Card>
      </div>
      <Card title="Printable preview" description={`${generated?.labels.length || 0} label${generated?.labels.length === 1 ? '' : 's'} in this batch`}>
        <div id="label-print-preview" className="label-grid">
          {generated?.labels.map((label, index) => (
            <article className="label-card" key={`${label.barcode}-${index}`}>
              <strong className="label-name">{label.name}</strong>
              <BarcodeGraphic value={label.barcode} />
              {labelType === 'price' && <strong className="label-price">BDT {label.price}</strong>}
              <Badge tone="neutral">{labelType === 'price' ? 'Price label' : 'Barcode'}</Badge>
            </article>
          ))}
        </div>
      </Card>
    </section>
  );
}