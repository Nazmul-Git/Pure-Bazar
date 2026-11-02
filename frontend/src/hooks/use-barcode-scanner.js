'use client';

import { useCallback, useState } from 'react';

export default function useBarcodeScanner(onScan) {
  const [value, setValue] = useState('');
  const handleChange = useCallback((event) => setValue(event.target.value), []);
  const handleKeyDown = useCallback((event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const barcode = value.trim();
    setValue('');
    if (barcode) onScan(barcode);
  }, [onScan, value]);
  const scan = useCallback((barcode) => {
    const normalized = String(barcode || '').trim();
    if (normalized) onScan(normalized);
  }, [onScan]);

  return { value, onChange: handleChange, onKeyDown: handleKeyDown, onScan: scan };
}
