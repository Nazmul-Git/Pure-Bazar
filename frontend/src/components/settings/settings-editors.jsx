'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';

export const defaultRoleNames = ['Cashier', 'Inventory Manager', 'Accountant'];

export const receiptDefaults = {
  storeName: '',
  headerText: '',
  footerText: '',
  paperWidth: '80mm',
  showLogo: true,
  showVatBreakdown: true,
  showCashier: true,
};

export function limitsToRows(limits, roleNames) {
  const names = [...new Set([...roleNames, ...Object.keys(limits || {})])];
  return names.map((role) => ({ role, value: limits?.[role] === undefined ? '' : String(limits[role]) }));
}

// Blank values are omitted so roles without a limit stay unset.
export function rowsToLimits(rows) {
  return Object.fromEntries(rows
    .filter((row) => row.value !== '')
    .map((row) => [row.role, Math.round(Number(row.value) * 100) / 100]));
}

export function validateLimits(rows) {
  const bad = rows.find((row) => row.value !== '' && (!Number.isFinite(Number(row.value)) || Number(row.value) < 0 || Number(row.value) > 100));
  return bad ? `Discount limit for ${bad.role} must be between 0 and 100.` : '';
}

export function validateOutlets(outlets) {
  const codes = new Set();
  for (const outlet of outlets) {
    if (!outlet.name?.trim() || !outlet.code?.trim()) return 'Every outlet needs a name and a code.';
    const code = outlet.code.trim().toUpperCase();
    if (codes.has(code)) return `Outlet code ${code} is used more than once.`;
    codes.add(code);
  }
  return '';
}

export function cleanOutlets(outlets) {
  return outlets.map((outlet) => ({
    ...outlet,
    name: outlet.name.trim(),
    location: (outlet.location || '').trim(),
    code: outlet.code.trim().toUpperCase(),
  }));
}

export function DiscountLimitsEditor({ rows, onChange }) {
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Discount limits by role</h3>
        <p className="mt-1 text-xs text-slate-500">Maximum discount percentage each role may give at checkout. Leave blank for no discount.</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        {rows.map((row, index) => (
          <div key={row.role} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0">
            <span className="text-sm font-medium text-slate-700">{row.role}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                aria-label={`${row.role} maximum discount percent`}
                value={row.value}
                onChange={(event) => onChange(rows.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)))}
                className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm focus:border-[#82C341] focus:outline-none focus:ring-2 focus:ring-[#82C341]/30"
              />
              <span className="text-sm text-slate-500">%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReceiptLayoutEditor({ value, onChange }) {
  const layout = { ...receiptDefaults, ...value };
  const set = (name, next) => onChange({ ...value, [name]: next });
  const toggles = [
    ['showLogo', 'Show store logo'],
    ['showVatBreakdown', 'Show VAT breakdown'],
    ['showCashier', 'Show cashier name'],
  ];
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Receipt layout</h3>
        <p className="mt-1 text-xs text-slate-500">Controls how printed and digital receipts look.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Store name on receipt" value={layout.storeName} onChange={(event) => set('storeName', event.target.value)} />
        <label className="ui-field">
          <span className="field-label">Paper width</span>
          <select value={layout.paperWidth} onChange={(event) => set('paperWidth', event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#82C341] focus:outline-none focus:ring-2 focus:ring-[#82C341]/30">
            <option value="58mm">58 mm thermal</option>
            <option value="80mm">80 mm thermal</option>
            <option value="A4">A4</option>
          </select>
        </label>
        <Input label="Header text" value={layout.headerText} onChange={(event) => set('headerText', event.target.value)} />
        <Input label="Footer text" value={layout.footerText} onChange={(event) => set('footerText', event.target.value)} />
      </div>
      <div className="grid gap-1 sm:grid-cols-3">
        {toggles.map(([name, label]) => (
          <label key={name} className="flex items-center gap-2 py-1 text-sm text-slate-700">
            <input type="checkbox" checked={Boolean(layout[name])} onChange={(event) => set(name, event.target.checked)} className="h-4 w-4 accent-[#82C341]" />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

export function OutletsEditor({ outlets, onChange }) {
  const update = (index, patch) => onChange(outlets.map((outlet, i) => (i === index ? { ...outlet, ...patch } : outlet)));
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Outlets</h3>
          <p className="mt-1 text-xs text-slate-500">Add, edit, or remove outlet records. Code must be unique.</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...outlets, { name: '', location: '', code: '' }])}>
          <Plus size={14} className="mr-1 inline" />Add outlet
        </Button>
      </div>
      {outlets.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">No outlets configured yet.</p>}
      {outlets.map((outlet, index) => (
        <div key={index} className="grid items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[1fr_1fr_8rem_auto]">
          <Input label="Name" value={outlet.name || ''} onChange={(event) => update(index, { name: event.target.value })} />
          <Input label="Location" value={outlet.location || ''} onChange={(event) => update(index, { location: event.target.value })} />
          <Input label="Code" value={outlet.code || ''} onChange={(event) => update(index, { code: event.target.value })} />
          <button type="button" aria-label={`Remove outlet ${outlet.name || index + 1}`} onClick={() => onChange(outlets.filter((_, i) => i !== index))} className="mb-1 rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
