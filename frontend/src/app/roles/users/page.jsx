'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Badge, Button, Input, Modal, Select } from '@/components/ui';
import { createUser, deleteUser, getRoles, getUsers, updateUser } from '@/services/admin';

const emptyForm = { name: '', email: '', password: '', roleId: '', isActive: true };

export default function RoleUsersPage() {
  const token = useSelector((state) => state.auth.token);
  const currentUser = useSelector((state) => state.auth.user);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);

  async function refresh() {
    const [usersResponse, rolesResponse] = await Promise.all([getUsers(token), getRoles(token)]);
    setUsers(usersResponse.data.users);
    setRoles(rolesResponse.data.roles);
  }

  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all([getUsers(token), getRoles(token)])
      .then(([usersResponse, rolesResponse]) => {
        if (!active) return;
        setUsers(usersResponse.data.users);
        setRoles(rolesResponse.data.roles);
      })
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'Unable to load users.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  function startCreate() {
    setEditingUser(null);
    setForm({ ...emptyForm, roleId: roles[0]?._id || '' });
    setError('');
    setDialogOpen(true);
  }

  function startEdit(user) {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: '', roleId: user.roleId, isActive: user.isActive });
    setError('');
    setDialogOpen(true);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    try {
      if (editingUser) await updateUser(token, editingUser.id, payload);
      else await createUser(token, payload);
      await refresh();
      setDialogOpen(false);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save user.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(user) {
    if (!window.confirm(`Delete ${user.name}?`)) return;
    setError('');
    try {
      await deleteUser(token, user.id);
      await refresh();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete user.');
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Access control</p>
          <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-600">Manage accounts and assign system roles.</p>
        </div>
        <Button onClick={startCreate} disabled={!roles.length}>
          <Plus size={17} /> Add user
        </Button>
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Users size={18} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">Team accounts</h2>
          <span className="ml-auto text-xs text-slate-500">{users.length} users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-3 font-semibold">Name</th><th className="px-4 py-3 font-semibold">Email</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">Loading users...</td></tr>
                : users.length === 0 ? <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">No users found.</td></tr>
                  : users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                      <td className="px-4 py-3 text-slate-600">{user.email}</td>
                      <td className="px-4 py-3 text-slate-700">{user.role || 'Unassigned'}</td>
                      <td className="px-4 py-3"><Badge variant={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        <button title="Edit user" aria-label={`Edit ${user.name}`} className="icon-button" onClick={() => startEdit(user)}><Pencil size={16} /></button>
                        <button title="Delete user" aria-label={`Delete ${user.name}`} className="icon-button" disabled={user.id === currentUser?.id} onClick={() => remove(user)}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingUser ? 'Edit user' : 'Add user'}>
        <form className="space-y-4" onSubmit={submit}>
          <Input label="Full name" name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required minLength={2} maxLength={100} />
          <Input label="Email address" name="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          <Input label={editingUser ? 'New password (optional)' : 'Password'} name="password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editingUser} minLength={8} maxLength={128} />
          <Select label="Role" name="roleId" value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })} required>
            {roles.map((role) => <option key={role._id} value={role._id}>{role.name}</option>)}
          </Select>
          {editingUser && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Account is active</label>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !roles.length}>{saving ? 'Saving...' : 'Save user'}</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}