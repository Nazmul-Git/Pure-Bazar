'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Button, Input, Modal, Select, Table } from '@/components/ui';
import { getAuditLogs, getUsers } from '@/services/admin';

function describeActor(actor) {
  if (!actor || typeof actor !== 'object') return 'Unknown user';
  return actor.name || actor.email || 'Unknown user';
}

function formatValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function flattenValues(value, path = '', result = {}) {
  if (Array.isArray(value)) {
    if (value.length === 0 && path) result[path] = '—';
    value.forEach((item, index) => flattenValues(item, `${path}[${index}]`, result));
  } else if (value && typeof value === 'object' && !(value instanceof Date)) {
    const entries = Object.entries(value);
    if (entries.length === 0 && path) result[path] = '—';
    entries.forEach(([key, item]) => flattenValues(item, path ? `${path}.${key}` : key, result));
  } else if (path) {
    result[path] = formatValue(value);
  }
  return result;
}

function flattenSnapshot(value) {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || value instanceof Date) return { Value: formatValue(value) };
  return flattenValues(value);
}

function getChangeRows(log) {
  const previous = flattenSnapshot(log.before);
  const next = flattenSnapshot(log.after);
  const changedRows = Array.from(new Set([...Object.keys(previous), ...Object.keys(next)]))
    .sort()
    .filter((key) => previous[key] !== next[key])
    .map((key) => ({ key, previous: previous[key] || '—', next: next[key] || '—' }));
  const metadata = flattenSnapshot(log.metadata);
  const metadataRows = Object.entries(metadata).map(([key, value]) => ({
    key: `Metadata.${key}`,
    previous: '—',
    next: value,
  }));
  return [...changedRows, ...metadataRows];
}

function ChangeComparison({ log }) {
  const rows = getChangeRows(log);
  if (rows.length === 0) {
    return <p className="m-0 text-sm text-slate-500">No field changes were recorded for this event.</p>;
  }
  return (
    <div className="table-wrap">
      <div className="table-scroll">
        <table className="ui-table">
          <thead>
            <tr><th>Key</th><th>Previous Value</th><th>New Value</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="font-medium">{row.key}</th>
                <td className="whitespace-normal break-words">{row.previous}</td>
                <td className="whitespace-normal break-words">{row.next}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AuditTrailPage() {
  const token = useSelector((state) => state.auth.token);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ who: '', what: '', from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

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
    { key: 'details', label: 'Changes', render: (_, row) => (
      <Button variant="ghost" size="sm" onClick={() => setSelectedLog(row)}>View Details</Button>
    ) },
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
      <Modal open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} title="Audit log details" className="max-w-4xl">
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p className="m-0"><span className="text-slate-500">Action:</span> {selectedLog.action || '—'}</p>
              <p className="m-0"><span className="text-slate-500">Area:</span> {selectedLog.entity || '—'}</p>
            </div>
            <ChangeComparison log={selectedLog} />
          </div>
        )}
      </Modal>
    </section>
  );
}
