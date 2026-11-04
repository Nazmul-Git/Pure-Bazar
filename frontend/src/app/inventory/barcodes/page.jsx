'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import BarcodeGraphic from '@/components/inventory/barcode-graphic';
import { DEFAULT_LABEL_SIZE, LABEL_SIZES, buildBarcodeLabels } from '@/services/barcodeEngine';
import { getUnitOptions } from '@/services/barcodeUnits';
import { getProducts } from '@/services/inventory';
import { downloadOutput, printESC } from '@/utils/print-esc';
import { T } from '@/i18n/language-provider';
import useToastMessages from '@/hooks/use-toast-messages';
import CameraBarcodeScanner from '@/components/common/camera-barcode-scanner';

export default function BarcodesPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const canRead = (user?.permissions || []).includes('*') || (user?.permissions || []).includes('products:read');
  const [products, setProducts] = useState([]);
  const [queue, setQueue] = useState([]);
  const [search, setSearch] = useState('');
  const [labelType, setLabelType] = useState('price');
  const [sizeKey, setSizeKey] = useState(DEFAULT_LABEL_SIZE);
  const [loading, setLoading] = useState(true);
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
  const queuedProducts = useMemo(() => queue.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) return null;
    const unit = getUnitOptions(product).find((option) => option.value === item.unit) || getUnitOptions(product)[0];
    const sellingPrice = item.sellingPrice === '' ? unit.price : Number(item.sellingPrice);
    return {
      ...product,
      copies: item.copies,
      packageTag: item.packageTag,
      unitName: unit.name,
      price: sellingPrice,
      originalPrice: item.originalPrice === '' ? undefined : Number(item.originalPrice),
    };
  }).filter(Boolean), [products, queue]);
  const generatedState = useMemo(() => {
    if (!queuedProducts.length) return { generated: null, labelError: '' };
    try {
      return { generated: buildBarcodeLabels(queuedProducts, labelType, sizeKey), labelError: '' };
    } catch (buildError) {
      return { generated: null, labelError: buildError.message };
    }
  }, [labelType, queuedProducts, sizeKey]);
  const { generated, labelError } = generatedState;

  function addProduct(product) {
    const defaultOption = getUnitOptions(product)[0];
    const defaultPrice = Number(defaultOption.price).toFixed(2);
    setQueue((current) => {
      const existing = current.find((item) => item.productId === product.id && item.unit === defaultOption.value
        && item.sellingPrice === defaultPrice && item.originalPrice === '');
      return existing
        ? current.map((item) => item === existing ? { ...item, copies: item.copies + 1 } : item)
        : [...current, { key: `${product.id}-${Date.now()}-${current.length}`, productId: product.id, unit: defaultOption.value, copies: 1, sellingPrice: defaultPrice, originalPrice: '', packageTag: '' }];
    });
    setNotice('');
    setError('');
  }

  function updateItem(key, changes) {
    setQueue((current) => current.map((entry) => entry.key === key ? { ...entry, ...changes } : entry));
  }

  function exportOutput(format) {
    if (!generated) return;
    if (format === 'tspl') {
      downloadOutput(generated.tspl, 'purebazar-labels.tspl', 'text/plain;charset=utf-8');
    } else {
      downloadOutput(generated.escPos, 'purebazar-labels-escpos.bin', 'application/octet-stream');
    }
  }

  async function sendTsplToPrinter() {
    if (!generated) return;
    setError('');
    setNotice('');
    try {
      await printESC(new TextEncoder().encode(generated.tspl));
      setNotice('TSPL labels sent to the selected Xprinter.');
    } catch (printError) {
      setError(printError.message || 'Unable to print TSPL labels.');
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

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500"><T>{"Loading barcode labels..."}</T></p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><T>{"You do not have permission to generate product labels."}</T></p>;

  return (
    <section className="barcode-page space-y-4 sm:space-y-5">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500"><T>{"Inventory"}</T></p>
        <h1 className="text-xl font-semibold sm:text-2xl text-slate-900"><T>{"Barcode & Price Labels"}</T></h1>
        <p className="mt-1 text-sm text-slate-600"><T>{"Select products and label quantities, then preview, print, or export printer commands."}</T></p>
      </header>
      <div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card title="Product catalog" description={`${products.length} products available`}>
          <div className="mb-4 flex w-full max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="w-full min-w-0 flex-1"><Input label="Search products" name="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product name or barcode" /></div>
            <CameraBarcodeScanner onScan={setSearch} />
          </div>
                    <div className="max-w-full overflow-x-auto"><Table columns={columns} rows={visibleProducts} rowKey="id"                     emptyMessage="No products match your search." /></div>
        </Card>
        <Card title="Label batch" description="Add products more than once or adjust the number of copies.">
          <div className="mb-4 grid w-full min-w-0 max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Label format" name="labelType" value={labelType} onChange={(event) => setLabelType(event.target.value)}>
              <option value="price"><T>{"Barcode + price label"}</T></option>
              <option value="barcode"><T>{"Barcode-only label"}</T></option>
            </Select>
            <Select label="Label size" name="labelSize" value={sizeKey} onChange={(event) => setSizeKey(event.target.value)}>
              {Object.values(LABEL_SIZES).map((size) => <option key={size.key} value={size.key}>{size.label}</option>)}
            </Select>
          </div>
          {queue.length === 0 ? <p className="rounded border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500"><T>{"Add one or more products to create a batch."}</T></p> : (
            <div className="space-y-2">
              {queue.map((item) => {
                const product = products.find((entry) => entry.id === item.productId);
                const unitOptions = product ? getUnitOptions(product) : [];
                const unit = unitOptions.find((option) => option.value === item.unit) || unitOptions[0];
                const numberField = (field) => (event) => updateItem(item.key, { [field]: event.target.value });
                return <div key={item.key} className="grid grid-cols-1 items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                  <div className="min-w-0 break-words sm:col-span-2"><strong className="block text-sm">{product?.name}</strong><small className="text-slate-500">{product?.barcode}</small></div>
                  <Select label="Unit" name={`unit-${item.key}`} value={item.unit} onChange={(event) => updateItem(item.key, { unit: event.target.value })}>
                    {unitOptions.map((option) => <option key={option.value} value={option.value}>{option.name}</option>)}
                  </Select>
                  <Input label="Copies" type="number" min="1" max="500" step="1" value={item.copies} onChange={(event) => updateItem(item.key, { copies: event.target.value === '' ? '' : Number(event.target.value) })} />
                  <Input label="Package Size / Weight Tag" name={`packageTag-${item.key}`} maxLength={20} value={item.packageTag || ''} placeholder="Optional, e.g. 5 Kg" onChange={(event) => updateItem(item.key, { packageTag: event.target.value })} />
                  <Input label="Original price (strikethrough)" type="number" min="0" step="0.01" value={item.originalPrice} placeholder="Optional" onChange={numberField('originalPrice')} />
                  <Input label={`Price (type to override) - per ${unit?.name || 'unit'}`} type="number" min="0" step="0.01" value={item.sellingPrice} placeholder={unit ? Number(unit.price).toFixed(2) : ''} onChange={numberField('sellingPrice')} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setQueue((current) => current.filter((entry) => entry.key !== item.key))}>Remove</Button>
                </div>;
              })}
            </div>
          )}
          {labelError && <p role="alert" className="mt-3 text-sm text-red-700">{labelError}</p>}
          <div className="barcode-actions mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2">
            <Button variant="secondary" disabled={!generated} onClick={() => exportOutput('tspl')}>Export TSPL</Button>
            <Button variant="secondary" disabled={!generated} onClick={sendTsplToPrinter}>Print TSPL (Xprinter)</Button>
            <Button variant="secondary" disabled={!generated} onClick={() => exportOutput('escpos')}>Export ESC/POS</Button>
            <Button variant="secondary" disabled={!generated} onClick={sendToPrinter}>Print ESC/POS</Button>
            <Button disabled={!generated} onClick={() => window.print()}>Print preview</Button>
          </div>
        </Card>
      </div>
      <Card title="Printable preview" description={`${generated?.labels.length || 0} label${generated?.labels.length === 1 ? '' : 's'} in this batch`}>
        <style>{`@media print { @page { size: auto; margin: 5mm; } }`}</style>
        <div id="label-print-preview" className={`label-grid label-size-${sizeKey}`} style={{ '--label-w': `${LABEL_SIZES[sizeKey].width}mm`, '--label-h': `${LABEL_SIZES[sizeKey].height}mm` }}>
          {generated?.labels.map((label, index) => (
            <article className="label-card" key={`${label.barcode}-${index}`}>
              <strong className="label-brand"><T>{"PureBazar"}</T></strong>
              <strong className="label-name">{label.name}</strong>
              <BarcodeGraphic value={label.barcode} />
              {labelType === 'price' && (
                <div className="label-price-row">
                  {label.originalPrice && <span className="label-original-price" style={{ textDecoration: 'line-through' }}>BDT {label.originalPrice}</span>}
                  <strong className="label-price">BDT {label.price}</strong>
                </div>
              )}
              <Badge tone="neutral">{labelType === 'price' ? 'Price label' : 'Barcode'}</Badge>
            </article>
          ))}
        </div>
      </Card>
    </section>
  );
}