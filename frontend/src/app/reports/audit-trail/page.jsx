'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Button, Input, Select, Table } from '@/components/ui';
import { getAuditLogs, getUsers } from '@/services/admin';

function describeActor(actor) {
  if (!actor || typeof actor !== 'object') return 'Unknown user';
  return actor.name || actor.email || 'Unknown user';
}

function describeChanges(log) {
  if (!log.before && !log.after) return '—';
  return (
    <details className="max-w-sm whitespace-normal">
      <summary className="cursor-pointer text-blue-700">View details</summary>
      <div className="mt-2 space-y-2 text-xs">
        {log.before && <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2">Before: {JSON.stringify(log.before, null, 2)}</pre>}
        {log.after && <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2">After: {JSON.stringify(log.after, null, 2)}</pre>}
        {log.metadata && Object.keys(log.metadata).length > 0 && <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2">Metadata: {JSON.stringify(log.metadata, null, 2)}</pre>}
      </div>
    </details>
  );
}

export default function AuditTrailPage() {
  const token = useSelector((state) => state.auth.token);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ who: '', what: '', from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadLogs(nextFilters = filters) {
    setLoading(true);
    setError('');
    try {
      const { data } = await getAuditLogs(token, nextFilters);
      setLogs(data.auditLogs);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load audit trail.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    Promise.all([getUsers(token), getAuditLogs(token)])
      .then(([usersResponse, logsResponse]) => {
        if (!active) return;
        setUsers(usersResponse.data.users);
        setLogs(logsResponse.data.auditLogs);
      })
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'Unable to load audit trail.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    await loadLogs(filters);
  }

  async function clearFilters() {
    const emptyFilters = { who: '', what: '', from: '', to: '' };
    setFilters(emptyFilters);
    await loadLogs(emptyFilters);
  }

  const columns = [
    { key: 'createdAt', label: 'Date and time', render: (value) => new Date(value).toLocaleString() },
    { key: 'actorId', label: 'User', render: (value) => describeActor(value) },
    { key: 'action', label: 'Action' },
    { key: 'entity', label: 'Area' },
    { key: 'entityId', label: 'Record ID', render: (value) => value?.toString() || '—' },
    { key: 'details', label: 'Changes', render: (_, row) => describeChanges(row) },
  ];

  return (
    <section className="space-y-5">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Reports</p>
        <h1 className="text-2xl font-semibold text-slate-900">Audit Trail</h1>
        <p className="mt-1 text-sm text-slate-600">Review administrative changes and filter recent activity.</p>
      </div>

      <form onSubmit={submit} className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
        <Select label="User" value={filters.who} onChange={(event) => updateFilter('who', event.target.value)}>
          <option value="">All users</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}
        </Select>
        <Input label="Action or area" value={filters.what} maxLength="80" placeholder="e.g. UPDATE or Settings" onChange={(event) => updateFilter('what', event.target.value)} />
        <Input label="From date" type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} />
        <Input label="To date" type="date" min={filters.from || undefined} value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} />
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={loading}>{loading ? 'Loading...' : 'Apply filters'}</Button>
          <Button type="button" variant="secondary" onClick={clearFilters} disabled={loading}>Clear</Button>
        </div>
      </form>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {loading
        ? <p role="status" className="py-10 text-center text-slate-500">Loading audit trail...</p>
        : <Table columns={columns} rows={logs} rowKey="_id" pageSize={15} emptyMessage="No audit events match these filters." />}
      <p className="text-xs text-slate-500">The API returns up to 100 events per request.</p>
    </section>
  );
}
