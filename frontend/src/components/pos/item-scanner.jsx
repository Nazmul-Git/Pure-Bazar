'use client';

import { useEffect, useRef, useState } from 'react';
import { Barcode, LoaderCircle, Plus } from 'lucide-react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import { posErrorMessage, scanPosItem } from '@/services/pos';

export default function ItemScanner({ onAdd }) {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const busy = useRef(false);

  async function add(raw) {
    const value = raw.trim();
    if (!value || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      const { data } = await scanPosItem(value);
      onAdd(data.item);
      setBarcode('');
    } catch (requestError) {
      setError(posErrorMessage(requestError));
    } finally {
      busy.current = false;
      setLoading(false);
      document.getElementById('pos-barcode')?.focus();
    }
  }

  function submit(event) {
    event.preventDefault();
    add(barcode);
  }

  // Scanners type a full code in milliseconds; add once input goes quiet.
  useEffect(() => {
    if (barcode.trim().length < 6) return undefined;
    const timer = setTimeout(() => add(barcode), 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcode]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Scan or enter item barcode"
            name="pos-barcode"
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            placeholder="Scan barcode, then press Enter"
            autoComplete="off"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={loading || !barcode.trim()}>
          {loading ? <LoaderCircle size={17} className="animate-spin" /> : <Barcode size={17} />}
          {loading ? 'Looking up...' : 'Add item'}
        </Button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
        <Plus size={13} /> Each scan adds one; quantity can be adjusted in the cart.
      </p>
    </section>
  );
}
