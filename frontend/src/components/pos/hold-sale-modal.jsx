'use client';

import { useState } from 'react';

export default function HoldSaleModal({ onConfirm, onCancel }) {
  const [note, setNote] = useState('');

  function submit(event) {
    event.preventDefault();
    onConfirm(note.trim());
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="hold-sale-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
        <h2 id="hold-sale-title" className="text-lg font-semibold text-slate-900">Hold Sale</h2>
        <label className="block text-sm font-medium text-slate-700">
          Customer Name / Token Number (Optional)
          <input
            autoFocus
            type="text"
            value={note}
            maxLength={100}
            onChange={(event) => setNote(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Cancel</button>
          <button type="submit" className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white">Confirm Hold</button>
        </div>
      </form>
    </div>
  );
}
