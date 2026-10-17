'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';

const emptyForm = { name: '', abbreviation: '' };

export default function QuickAddUnitModal({ open, onClose, onSubmit, unit = null }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(unit ? { name: unit.name, abbreviation: unit.abbreviation } : emptyForm);
      setError('');
    }
  }, [open, unit]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit({ name: form.name.trim(), abbreviation: form.abbreviation.trim() });
      onClose();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save unit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={unit ? 'Edit unit' : 'Quick add unit'}>
      <form className="space-y-4" onSubmit={submit}>
        <Input label="Unit name" name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={100} autoFocus />
        <Input label="Abbreviation" name="abbreviation" value={form.abbreviation} onChange={(event) => setForm({ ...form, abbreviation: event.target.value })} required maxLength={20} />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : unit ? 'Save changes' : 'Add unit'}</Button>
        </div>
      </form>
    </Modal>
  );
}
