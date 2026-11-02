'use client';

import { useEffect, useId, useState } from 'react';
import { LoaderCircle, ScanBarcode } from 'lucide-react';
import { Modal } from '@/components/ui';

// html5-qrcode throws (sync or async) when stopping a scanner that never started or already stopped.
async function safeStop(scanner) {
  if (!scanner) return;
  try {
    const state = typeof scanner.getState === 'function' ? scanner.getState() : null;
    // 2 = SCANNING, 3 = PAUSED
    if (state !== null && state !== 2 && state !== 3) return;
    await scanner.stop();
  } catch {
    // already stopped, camera missing or permission denied: nothing to release
  }
}

export default function CameraBarcodeScanner({ onScan, disabled = false }) {
  const elementId = `barcode-reader-${useId().replace(/:/g, '')}`;
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    let scanner;

    async function start() {
      setStarting(true);
      setError('');
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!active) return;
        scanner = new Html5Qrcode(elementId);
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 140 } },
          async (decodedText) => {
            if (!active || !decodedText.trim()) return;
            active = false;
            await safeStop(scanner);
            setOpen(false);
            onScan(decodedText.trim());
          },
          () => {},
        );
      } catch (startError) {
        if (active) setError(startError?.message || String(startError || '') || 'Unable to access the camera. Check browser permission and HTTPS.');
      } finally {
        if (active) setStarting(false);
      }
    }

    start();
    return () => {
      active = false;
      safeStop(scanner);
    };
  }, [elementId, onScan, open]);

  function close() {
    setOpen(false);
    setError('');
  }

  return (
    <>
      <span className="block shrink-0 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          aria-label="Scan barcode via camera"
          title="Scan barcode"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-100 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ScanBarcode size={22} />
        </button>
      </span>
      <Modal open={open} onClose={close} title="Scan via Camera" className="max-w-lg">
        <div className="space-y-3">
          <div id={elementId} className="min-h-40 overflow-hidden rounded-lg bg-slate-950" />
          {starting && <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><LoaderCircle size={15} className="animate-spin" /> Starting rear camera...</p>}
          {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <p className="text-xs text-slate-500">Allow camera access and hold the barcode inside the frame.</p>
        </div>
      </Modal>
    </>
  );
}
