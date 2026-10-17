'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';

const emptyForm = { name: '', vatRate: '', commissionPercent: '' };

export default function QuickAddCategoryModal({ open, onClose, onSubmit, category = null }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(category ? {
        name: category.name,
        vatRate: category.vatRate ?? '',
        commissionPercent: category.commissionPercent ?? '',
      } : emptyForm);
      setError('');
    }
  }, [category, open]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = { name: form.name.trim(), commissionEnabled: false };
    if (form.vatRate !== '') payload.vatRate = Number(form.vatRate);
    if (form.commissionPercent !== '') payload.commissionPercent = Number(form.commissionPercent);
    try {
      await onSubmit(payload);
      onClose();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={category ? 'Edit category' : 'Quick add category'}>
      <form className="space-y-4" onSubmit={submit}>
        <Input label="Category name" name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={100} autoFocus />
        <Input label="VAT rate (%)" name="vatRate" type="number" min="0" max="100" step="0.01" value={form.vatRate} onChange={(event) => setForm({ ...form, vatRate: event.target.value })} />
        <Input label="Commission rate (%)" name="commissionPercent" type="number" min="0" max="100" step="0.01" value={form.commissionPercent} onChange={(event) => setForm({ ...form, commissionPercent: event.target.value })} />
        <p className="text-xs text-slate-500">Category commission remains disabled.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : category ? 'Save changes' : 'Add category'}</Button>
        </div>
      </form>
    </Modal>
  );
}
