'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Input, Modal, Select } from '@/components/ui';
import {
  createBrand, createCategory, createUnit, getBrands, getCategories, getUnits,
} from '@/services/inventory';
import QuickAddBrandModal from './quick-add-brand-modal';
import QuickAddCategoryModal from './quick-add-category-modal';
import QuickAddUnitModal from './quick-add-unit-modal';
import VendorAutocomplete from './vendor-autocomplete';

const emptyForm = {
  name: '',
  ownerType: 'COMPANY',
  vendorId: '',
  vendorPrice: '',
  mrp: '',
  categoryId: '',
  brandId: '',
  unitId: '',
  unitValue: '',
  vatApplicable: false,
  vatRate: '',
};

const money = (value) => new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
}).format(Number.isFinite(value) ? value : 0);

function roundedMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default function ProductFormModal({
  open, onClose, onSubmit, token, permissions, marginWarningPercent,
}) {
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [units, setUnits] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogErrors, setCatalogErrors] = useState([]);
  const [quickAdd, setQuickAdd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const can = (permission) => permissions.includes('*') || permissions.includes(permission);
  const vendorPrice = Number(form.vendorPrice);
  const mrp = Number(form.mrp);
  const hasPrices = form.vendorPrice !== '' && form.mrp !== ''
    && Number.isFinite(vendorPrice) && Number.isFinite(mrp);
  const roundedVendorPrice = hasPrices ? roundedMoney(vendorPrice) : 0;
  const roundedMrp = hasPrices ? roundedMoney(mrp) : 0;
  const margin = hasPrices ? roundedMoney(roundedMrp - roundedVendorPrice) : null;
  const discountPercent = Number.isFinite(marginWarningPercent) ? marginWarningPercent : 5;
  const warningAmount = hasPrices ? roundedMoney(roundedMrp * discountPercent / 100) : 0;
  const marginWarning = margin !== null && margin >= 0 && margin < warningAmount;
  const invalidMrp = hasPrices && mrp < vendorPrice;

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setForm(emptyForm);
    setError('');
    setCatalogErrors([]);
    setCatalogLoading(true);

    const requests = [
      ['categories', 'categories:read', getCategories],
      ['brands', 'brands:read', getBrands],
      ['units', 'units:read', getUnits],
    ];
    const unavailable = requests
      .filter(([, permission]) => !can(permission))
      .map(([name]) => `You do not have permission to load ${name}.`);
    const available = requests.filter(([, permission]) => can(permission));

    Promise.allSettled(available.map(([, , load]) => load(token))).then((results) => {
      if (!active) return;
      const errors = [...unavailable];
      results.forEach((result, index) => {
        const [name] = available[index];
        if (result.status === 'rejected') {
          errors.push(result.reason.response?.data?.message || `Unable to load ${name}.`);
          return;
        }
        const values = result.value.data[name];
        if (name === 'categories') setCategories(values);
        if (name === 'brands') setBrands(values);
        if (name === 'units') setUnits(values);
      });
      setCatalogErrors(errors);
      setCatalogLoading(false);
    });

    return () => { active = false; };
  // Permissions are refreshed with the authenticated user; reopening reloads catalog data.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token, permissions]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (form.ownerType === 'VENDOR' && !/^[a-f\d]{24}$/i.test(form.vendorId.trim())) {
      setError('Select a vendor from the list.');
      return;
    }
    if (invalidMrp) {
      setError('MRP must be greater than or equal to vendor price.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      ...(form.brandId ? { brandId: form.brandId } : {}),
      unitId: form.unitId,
      ...(form.unitValue !== '' ? { unitValue: Number(form.unitValue) } : {}),
      ownerType: form.ownerType,
      ...(form.ownerType === 'VENDOR' ? { vendorId: form.vendorId.trim() } : {}),
      vendorPrice: roundedVendorPrice,
      mrp: roundedMrp,
      vatApplicable: form.vatApplicable,
      ...(form.vatApplicable && form.vatRate !== '' ? { vatRate: Number(form.vatRate) } : {}),
    };

    setSaving(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create product.');
    } finally {
      setSaving(false);
    }
  }

  async function addCategory(payload) {
    const { data } = await createCategory(token, payload);
    setCategories((current) => [...current, data.category].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((current) => ({ ...current, categoryId: data.category.id }));
  }

  async function addBrand(payload) {
    const { data } = await createBrand(token, payload);
    setBrands((current) => [...current, data.brand].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((current) => ({ ...current, brandId: data.brand.id }));
  }

  async function addUnit(payload) {
    const { data } = await createUnit(token, payload);
    setUnits((current) => [...current, data.unit].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((current) => ({ ...current, unitId: data.unit.id }));
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Add new product" className="product-form-modal">
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Product name" name="name" value={form.name} onChange={(event) => update('name', event.target.value)} required maxLength={150} autoFocus />
            <Select label="Owner" name="ownerType" value={form.ownerType} onChange={(event) => update('ownerType', event.target.value)}>
              <option value="COMPANY">Company</option>
              <option value="VENDOR">Vendor</option>
            </Select>
          </div>

          {form.ownerType === 'VENDOR' && (
            <VendorAutocomplete token={token} value={form.vendorId} onChange={(id) => update('vendorId', id)} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-end gap-2">
              <Select label="Category" name="categoryId" value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)} required className="min-w-0 flex-1">
                <option value="">Select category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </Select>
              {can('categories:write') && <Button type="button" variant="secondary" size="sm" aria-label="Quick add category" title="Quick add category" onClick={() => setQuickAdd('category')}><Plus size={15} /> Quick Add</Button>}
            </div>
            <div className="flex items-end gap-2">
              <Select label="Brand" name="brandId" value={form.brandId} onChange={(event) => update('brandId', event.target.value)} className="min-w-0 flex-1">
                <option value="">Select brand (optional)</option>
                {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </Select>
              {can('brands:write') && <Button type="button" variant="secondary" size="sm" aria-label="Quick add brand" title="Quick add brand" onClick={() => setQuickAdd('brand')}><Plus size={15} /> Quick Add</Button>}
            </div>
            <div className="flex items-end gap-2">
              <Input label="Unit Quantity / Value" name="unitValue" type="number" min="0" step="any" value={form.unitValue} onChange={(event) => update('unitValue', event.target.value)} placeholder="e.g. 500" className="min-w-0 flex-1" />
              <Select label="Unit" name="unitId" value={form.unitId} onChange={(event) => update('unitId', event.target.value)} required className="min-w-0 flex-1">
                <option value="">Select unit</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</option>)}
              </Select>
              {can('units:write') && <Button type="button" variant="secondary" size="sm" aria-label="Quick add unit" title="Quick add unit" onClick={() => setQuickAdd('unit')}><Plus size={15} /> Quick Add</Button>}
            </div>
            <Input label="Barcode" name="barcode" value="Generated when product is saved" readOnly />
          </div>
          {catalogLoading && <p role="status" className="text-xs text-slate-500">Loading product categories, brands, and units...</p>}
          {catalogErrors.map((message) => <p key={message} role="alert" className="text-xs text-amber-800">{message}</p>)}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Vendor price (৳)" name="vendorPrice" type="number" min="0" step="0.01" value={form.vendorPrice} onChange={(event) => update('vendorPrice', event.target.value)} required />
            <Input label="MRP (৳)" name="mrp" type="number" min="0" step="0.01" value={form.mrp} onChange={(event) => update('mrp', event.target.value)} required />
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Margin</p>
            <p className={`mt-1 text-lg font-semibold ${marginWarning || invalidMrp ? 'text-amber-800' : 'text-slate-900'}`}>
              {margin === null ? 'Enter prices to calculate' : money(margin)}
            </p>
            {invalidMrp && <p role="alert" className="mt-1 text-xs text-red-700">MRP must be greater than or equal to vendor price.</p>}
            {marginWarning && !invalidMrp && <p role="status" className="mt-1 text-xs text-amber-800">Margin is below the {discountPercent}% shareholder discount threshold ({money(warningAmount)}).</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="vatApplicable" checked={form.vatApplicable} onChange={(event) => update('vatApplicable', event.target.checked)} />
              VAT applicable
            </label>
            <Input label="VAT rate (%)" name="vatRate" type="number" min="0" max="100" step="0.01" value={form.vatRate} onChange={(event) => update('vatRate', event.target.value)} required={form.vatApplicable} disabled={!form.vatApplicable} />
          </div>

          {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || catalogLoading || !hasPrices || invalidMrp}>{saving ? 'Saving...' : 'Save product'}</Button>
          </div>
        </form>
      </Modal>
      <QuickAddCategoryModal open={quickAdd === 'category'} onClose={() => setQuickAdd('')} onSubmit={addCategory} />
      <QuickAddBrandModal open={quickAdd === 'brand'} onClose={() => setQuickAdd('')} onSubmit={addBrand} />
      <QuickAddUnitModal open={quickAdd === 'unit'} onClose={() => setQuickAdd('')} onSubmit={addUnit} />
    </>
  );
}
