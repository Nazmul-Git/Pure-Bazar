'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const label = (vendor) => `${vendor.name} — ${vendor.shopName} (${vendor.mobile || vendor.memberId})`;

export default function VendorCombobox({ vendors, value, onChange }) {
  const selected = vendors.find((vendor) => vendor.id === value);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const root = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (root.current && !root.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return vendors;
    return vendors.filter((vendor) => [vendor.name, vendor.shopName, vendor.mobile, vendor.memberId]
      .some((field) => String(field || '').toLowerCase().includes(term)));
  }, [query, vendors]);

  function choose(vendor) {
    onChange(vendor.id);
    setQuery('');
    setOpen(false);
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (results[highlight]) choose(results[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className="relative">
      <label htmlFor="vendorSearch" className="mb-1 block text-sm font-medium text-slate-700">Vendor</label>
      <input
        id="vendorSearch"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="vendor-options"
        autoComplete="off"
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        placeholder="Search by name, business or mobile"
        value={open ? query : (selected ? label(selected) : query)}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
          setOpen(true);
          if (value) onChange('');
        }}
        onKeyDown={onKeyDown}
        required={!value}
      />
      {open && (
        <ul id="vendor-options" role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded border border-slate-200 bg-white shadow-lg">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No matching vendors.</li>}
          {results.map((vendor, index) => (
            <li
              key={vendor.id}
              role="option"
              aria-selected={vendor.id === value}
              className={`cursor-pointer px-3 py-2 text-sm ${index === highlight ? 'bg-slate-100' : ''}`}
              onMouseDown={(event) => { event.preventDefault(); choose(vendor); }}
              onMouseEnter={() => setHighlight(index)}
            >
              <span className="font-medium text-slate-900">{vendor.name}</span>
              <span className="text-slate-600"> — {vendor.shopName}</span>
              <span className="block text-xs text-slate-500">{vendor.mobile} · {vendor.memberId}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
