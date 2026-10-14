'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { KeyRound, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { createRole, deleteRole, getRoles, getUsers, updateRole } from '@/services/admin';

const emptyForm = { name: '', permissions: '' };

export default function RoleManagementPage() {
  const token = useSelector((state) => state.auth.token);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState(emptyForm);

  async function refresh() {
    const [rolesResponse, usersResponse] = await Promise.all([getRoles(token), getUsers(token)]);
    setRoles(rolesResponse.data.roles);
    setUsers(usersResponse.data.users);
  }

  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all([getRoles(token), getUsers(token)])
      .then(([rolesResponse, usersResponse]) => {
        if (!active) return;
        setRoles(rolesResponse.data.roles);
        setUsers(usersResponse.data.users);
      })
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'Unable to load roles.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  function startCreate() {
    setEditingRole(null);
    setForm(emptyForm);
    setError('');
    setDialogOpen(true);
  }

  function startEdit(role) {
    setEditingRole(role);
    setForm({ name: role.name, permissions: (role.permissions || []).join('\n') });
    setError('');
    setDialogOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      name: form.name,
      permissions: form.permissions.split('\n').map((permission) => permission.trim()).filter(Boolean),
    };
    try {
      if (editingRole) await updateRole(token, editingRole._id, payload);
      else await createRole(token, payload);
      await refresh();
      setDialogOpen(false);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save role.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(role) {
    if (!window.confirm(`Delete the ${role.name} role?`)) return;
    setError('');
    try {
      await deleteRole(token, role._id);
      await refresh();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete role.');
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Access control</p>
          <h1 className="text-2xl font-semibold text-slate-900">Manage roles</h1>
          <p className="mt-1 text-sm text-slate-600">Define permissions for each team role.</p>
        </div>
        <Button onClick={startCreate}><Plus size={17} /> Add role</Button>
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Shield size={18} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">System roles</h2>
          <span className="ml-auto text-xs text-slate-500">{roles.length} roles</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Assigned users</th><th className="px-4 py-3 font-semibold">Permissions</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan="4" className="px-4 py-10 text-center text-slate-500">Loading roles...</td></tr>
                : roles.length === 0 ? <tr><td colSpan="4" className="px-4 py-10 text-center text-slate-500">No roles found.</td></tr>
                  : roles.map((role) => {
                    const permissionList = role.permissions || [];
                    const protectedRole = role.name === 'Super Admin';
                    const assignedCount = users.filter((user) => user.roleId === role._id).length;
                    return (
                      <tr key={role._id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{role.name}{protectedRole && <span className="ml-2 text-xs font-normal text-slate-500">Built-in</span>}</td>
                        <td className="px-4 py-3 text-slate-600">{assignedCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex max-w-xl flex-wrap gap-1.5">
                            {permissionList.includes('*') ? <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">All permissions</span>
                              : permissionList.slice(0, 3).map((permission) => <span key={permission} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{permission}</span>)}
                            {!permissionList.includes('*') && permissionList.length > 3 && <span className="px-1 py-1 text-xs text-slate-500">+{permissionList.length - 3} more</span>}
                            {!permissionList.length && <span className="text-xs text-slate-400">No permissions</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {protectedRole ? <span title="The Super Admin role is protected" className="inline-flex p-2 text-slate-400"><KeyRound size={16} /></span> : <>
                            <button title="Edit role" aria-label={`Edit ${role.name}`} className="icon-button" onClick={() => startEdit(role)}><Pencil size={16} /></button>
                            <button title="Delete role" aria-label={`Delete ${role.name}`} className="icon-button" onClick={() => remove(role)}><Trash2 size={16} /></button>
                          </>}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingRole ? 'Edit role' : 'Add role'}>
        <form className="space-y-4" onSubmit={submit}>
          <Input label="Role name" name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} maxLength={80} />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700">Permissions</span>
            <textarea name="permissions" rows={7} value={form.permissions} onChange={(event) => setForm({ ...form, permissions: event.target.value })} placeholder={'products:read\nproducts:write'} className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save role'}</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}