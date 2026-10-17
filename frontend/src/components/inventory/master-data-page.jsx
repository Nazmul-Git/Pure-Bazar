'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Table } from '@/components/ui';

export default function MasterDataPage({
  title, itemName, description, resource, itemProp, permission, columns, getItems, createItem, updateItem, deleteItem, FormModal,
}) {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingId, setDeletingId] = useState('');
  const permissions = user?.permissions || [];
  const canRead = permissions.includes('*') || permissions.includes(`${permission}:read`);
  const canWrite = permissions.includes('*') || permissions.includes(`${permission}:write`);

  const refresh = useCallback(async () => {
    const response = await getItems(token);
    setItems(response.data[resource]);
  }, [getItems, resource, token]);

  useEffect(() => {
    if (!initialized) return undefined;
    if (!token || !canRead) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    getItems(token)
      .then((response) => active && setItems(response.data[resource]))
      .catch((requestError) => active && setError(requestError.response?.data?.message || `Unable to load ${title.toLowerCase()}.`))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, getItems, initialized, resource, title, token]);

  async function save(payload) {
    if (editingItem) await updateItem(token, editingItem.id, payload);
    else await createItem(token, payload);
    await refresh();
  }

  function startCreate() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function startEdit(item) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  async function remove(item) {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    setError('');
    setDeletingId(item.id);
    try {
      await deleteItem(token, item.id);
      await refresh();
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Unable to delete ${itemName.toLowerCase()}.`);
    } finally {
      setDeletingId('');
    }
  }

  const tableColumns = canWrite ? [...columns, {
    key: 'actions',
    label: 'Actions',
    render: (_, item) => (
      <div className="flex justify-end gap-1">
        <button className="icon-button" aria-label={`Edit ${item.name}`} title={`Edit ${item.name}`} onClick={() => startEdit(item)}><Pencil size={16} /></button>
        <button className="icon-button" aria-label={`Delete ${item.name}`} title={`Delete ${item.name}`} disabled={deletingId === item.id} onClick={() => remove(item)}><Trash2 size={16} /></button>
      </div>
    ),
  }] : columns;

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading {title.toLowerCase()}...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view {title.toLowerCase()}.</p>;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Inventory setup</p>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        {canWrite && <Button onClick={startCreate}><Plus size={17} /> Quick add {itemName.toLowerCase()}</Button>}
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {loading
        ? <p role="status" className="py-10 text-center text-sm text-slate-500">Loading {title.toLowerCase()}...</p>
        : <Table columns={tableColumns} rows={items} rowKey="id" emptyMessage={`No ${title.toLowerCase()} found.`} />}
      {canWrite && <FormModal open={dialogOpen} onClose={() => setDialogOpen(false)} onSubmit={save} {...{ [itemProp]: editingItem }} />}
    </section>
  );
}
