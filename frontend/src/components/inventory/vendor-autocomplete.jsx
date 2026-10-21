'use client';

import { useEffect, useState } from 'react';
import { searchVendors } from '@/services/inventory';

const label = (vendor) => `${vendor.name} - ${vendor.shopName || 'No shop'} (${vendor.memberId})`;

export default function VendorAutocomplete({ token, value, onChange }) {
  const [text, setText] = useState('');
  const [options, setOptions] = useState([]);
  const [focused, setFocused] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!focused) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await searchVendors(token, text.trim());
        if (!active) return;
        setOptions(data.vendors.slice(0, 20));
        setMessage('');
      } catch (error) {
        if (active) setMessage(error.response?.data?.message || 'Unable to load vendors.');
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [text, token, focused]);

  function choose(vendor) {
    setText(label(vendor));
    setFocused(false);
    onChange(vendor.id);
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-700" htmlFor="vendor-search">Vendor</label>
      <input
        id="vendor-search"
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        value={text}
        placeholder="Search by vendor name, shop name or member ID"
        autoComplete="off"
        role="combobox"
        aria-expanded={focused}
        aria-controls="vendor-options"
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChange={(event) => { setText(event.target.value); if (value) onChange(''); }}
      />
      {focused && (
        <ul id="vendor-options" role="listbox" className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded border border-slate-200 bg-white shadow">
          {options.map((vendor) => (
            <li key={vendor.id} role="option" aria-selected={vendor.id === value}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(vendor)}>
                {label(vendor)}
              </button>
            </li>
          ))}
          {!options.length && <li className="px-3 py-2 text-sm text-slate-500">No vendors found</li>}
        </ul>
      )}
      {message && <p role="alert" className="mt-1 text-xs text-amber-800">{message}</p>}
      {text && !value && !focused && <p role="alert" className="mt-1 text-xs text-red-700">Select a vendor from the list.</p>}
    </div>
  );
}
