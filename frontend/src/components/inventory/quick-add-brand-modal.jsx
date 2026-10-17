'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';

export default function QuickAddBrandModal({ open, onClose, onSubmit, brand = null }) {
  const [name, setName] = useState('');
  const [logo, setLogo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(brand?.name || '');
      setLogo(null);
      setError('');
    }
  }, [brand, open]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit({ name: name.trim(), logo });
      onClose();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save brand.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={brand ? 'Edit brand' : 'Quick add brand'}>
      <form className="space-y-4" onSubmit={submit}>
        <Input label="Brand name" name="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} autoFocus />
        <Input label={brand?.logoUrl ? 'Replace logo (optional)' : 'Logo (optional)'} name="logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogo(event.target.files?.[0] || null)} />
        <p className="text-xs text-slate-500">PNG, JPEG, or WebP; maximum 2 MB.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : brand ? 'Save changes' : 'Add brand'}</Button>
        </div>
      </form>
    </Modal>
  );
}
