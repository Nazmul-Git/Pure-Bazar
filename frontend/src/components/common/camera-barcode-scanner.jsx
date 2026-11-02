'use client';

import { useEffect, useId, useState } from 'react';
import { Camera, LoaderCircle } from 'lucide-react';
import { Button, Modal } from '@/components/ui';

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
            try {
              await scanner.stop();
            } catch (stopError) {
              console.error('Unable to stop barcode camera after scan.', stopError);
            }
            setOpen(false);
            onScan(decodedText.trim());
          },
          () => {},
        );
      } catch (startError) {
        if (active) setError(startError.message || 'Unable to access the camera. Check browser permission and HTTPS.');
      } finally {
        if (active) setStarting(false);
      }
    }

    start();
    return () => {
      active = false;
      if (scanner) {
        scanner.stop().catch((stopError) => console.error('Unable to stop barcode camera.', stopError));
      }
    };
  }, [elementId, onScan, open]);

  function close() {
    setOpen(false);
    setError('');
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        <Camera size={15} /> Scan via Camera
      </Button>
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
