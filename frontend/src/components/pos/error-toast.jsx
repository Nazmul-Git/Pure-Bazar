'use client';

import { AlertTriangle, X } from 'lucide-react';

export default function ErrorToast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div
        role="alert"
        className="pb-toast-in pointer-events-auto flex items-start gap-3 rounded-xl border border-orange-500/50 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 shadow-xl shadow-black/30 backdrop-blur-md"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" aria-hidden="true" />
        <p className="flex-1 font-medium">{message}</p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Dismiss notification" className="rounded p-0.5 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
