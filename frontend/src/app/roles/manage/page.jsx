'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { AlertTriangle, KeyRound, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { createRole, deleteRole, getRoles, getUsers, updateRole } from '@/services/admin';
import { permissionGroups, presets, sensitivePrefixes } from './permission-options';
const emptyForm = { name: '', permissions: ['dashboard:read'] };

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
    setForm({ name: role.name, permissions: role.permissions || [] });
    setError('');
    setDialogOpen(true);
  }

  function togglePermissions(permissionList, enabled) {
    if (permissionList.length === 0) return;
    setForm((current) => ({
      ...current,
      permissions: enabled
        ? [...new Set([...current.permissions, ...permissionList])]
        : current.permissions.filter((permission) => !permissionList.includes(permission)),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const isSuperAdmin = form.name.trim() === 'Super Admin';
    const sensitivePermissions = form.permissions.filter((permission) => (
      sensitivePrefixes.some((prefix) => permission.startsWith(prefix))
    ));
    if (sensitivePermissions.length && !isSuperAdmin && !window.confirm(
      `High-risk access selected (${sensitivePermissions.join(', ')}). Save these permissions for this non-Super Admin role?`,
    )) return;

    setSaving(true);
    const payload = {
      name: form.name,
      permissions: [...new Set(form.permissions)],
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

      <nav aria-label="Role administration" className="flex gap-5 border-b border-slate-200">
        <Link href="/roles/manage" aria-current="page" className="border-b-2 border-blue-600 pb-3 text-sm font-semibold text-blue-700">Roles</Link>
        <Link href="/roles/users" className="pb-3 text-sm font-medium text-slate-500 hover:text-slate-900">Users</Link>
      </nav>

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
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">Permissions</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(presets).map(([name, permissions]) => (
                  <Button
                    key={name}
                    type="button"
                    variant="secondary"
                    onClick={() => setForm((current) => ({ ...current, permissions }))}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {permissionGroups.map((group) => (
                <fieldset key={group.name} className="rounded-md border border-slate-200 p-3">
                  <legend className="px-1 text-sm font-semibold text-slate-800">{group.name}</legend>
                  <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] gap-x-2 gap-y-3">
                    <span />
                    <span className="text-center text-xs font-medium text-slate-500">Read</span>
                    <span className="text-center text-xs font-medium text-slate-500">Write</span>
                    {group.rows.map((row) => (
                      <div key={row.label} className="col-span-3 grid grid-cols-subgrid items-center gap-x-2">
                        <span className="text-xs text-slate-700">{row.label}</span>
                        {['read', 'write'].map((level) => {
                          const permissionList = row[level];
                          if (!permissionList.length) {
                            return <span key={level} aria-hidden="true" />;
                          }
                          const selectedCount = permissionList.filter((permission) => form.permissions.includes(permission)).length;
                          const checked = selectedCount === permissionList.length;
                          return (
                            <label key={level} className="flex justify-center">
                              <input
                                type="checkbox"
                                aria-label={`${row.label} ${level} permission`}
                                ref={(element) => {
                                  if (element) element.indeterminate = selectedCount > 0 && !checked;
                                }}
                                checked={checked}
                                onChange={(event) => togglePermissions(permissionList, event.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
          {form.name.trim() !== 'Super Admin' && form.permissions.some((permission) => (
            sensitivePrefixes.some((prefix) => permission.startsWith(prefix))
          )) && (
            <div role="alert" className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <p><strong>High-risk permissions selected.</strong> This non-Super Admin role will receive sensitive permissions for settings, role administration, vendor payouts, or audit logs. You will be asked to confirm before saving.</p>
            </div>
          )}
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