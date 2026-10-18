'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import { getVendors, updateVendorStatus } from '@/services/vendor';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium' }).format(date);
}

function statusTone(status) {
  return { Active: 'success', Suspended: 'warning', Closed: 'neutral' }[status] || 'neutral';
}

export default function VendorDirectoryPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'vendors:read');
  const canWrite = can(permissions, 'vendors:write');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [vendors, setVendors] = useState([]);
  const [statusSelections, setStatusSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    getVendors(token, filters)
      .then(({ data }) => {
        if (!active) return;
        setVendors(data.vendors);
        setStatusSelections(Object.fromEntries(data.vendors.map((vendor) => [vendor.id, vendor.status])));
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load the vendor directory.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token, filters, reload]);

  function search(event) {
    event.preventDefault();
    setNotice('');
    setFilters({ q: query.trim(), status });
  }

  async function saveStatus(vendor) {
    const nextStatus = statusSelections[vendor.id] || vendor.status;
    if (nextStatus === vendor.status) return;
    setUpdatingId(vendor.id);
    setError('');
    setNotice('');
    try {
      const { data } = await updateVendorStatus(token, vendor.id, nextStatus);
      setVendors((current) => current.map((item) => (item.id === vendor.id ? data.vendor : item)));
      setStatusSelections((current) => ({ ...current, [vendor.id]: data.vendor.status }));
      setNotice(`${vendor.name}'s status was updated to ${data.vendor.status}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update vendor status.');
    } finally {
      setUpdatingId('');
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Vendor',
      render: (name, vendor) => (
        <div>
          <strong className="block text-slate-800">{name}</strong>
          <small className="text-slate-500">Member ID: {vendor.memberId}</small>
        </div>
      ),
    },
    {
      key: 'shopName',
      label: 'Shop & category',
      render: (shopName, vendor) => <div><span className="block">{shopName}</span><small className="text-slate-500">{vendor.productCategory}</small></div>,
    },
    { key: 'mobile', label: 'Mobile' },
    { key: 'payoutMethod', label: 'Payout' },
    { key: 'createdAt', label: 'Registered', render: formatDate },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <Badge tone={statusTone(value)}>{value}</Badge>,
    },
    ...(canWrite ? [{
      key: 'actions',
      label: 'Update status',
      render: (_, vendor) => (
        <div className="flex min-w-[190px] items-center gap-2">
          <select
            className="ui-select"
            aria-label={`Status for ${vendor.name}`}
            value={statusSelections[vendor.id] || vendor.status}
            onChange={(event) => setStatusSelections((current) => ({ ...current, [vendor.id]: event.target.value }))}
            disabled={updatingId === vendor.id}
          >
            {['Active', 'Suspended', 'Closed'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <Button size="sm" variant="secondary" disabled={updatingId === vendor.id || (statusSelections[vendor.id] || vendor.status) === vendor.status} onClick={() => saveStatus(vendor)}>
            {updatingId === vendor.id ? 'Saving...' : 'Save'}
          </Button>
        </div>
      ),
    }] : []),
  ];

  if (!initialized) {
    return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading vendor directory...</p>;
  }
  if (!token || !canRead) {
    return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view vendors.</p>;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Vendors</p>
          <h1 className="text-2xl font-semibold text-slate-900">Vendor Directory</h1>
          <p className="mt-1 text-sm text-slate-600">Search registered vendors, review payout details, and manage vendor status.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setReload((count) => count + 1)} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </Button>
          {canWrite && <Link href="/vendors/register" className="ui-button button-primary button-md"><Plus size={16} /> Register Vendor</Link>}
        </div>
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

      <Card title="Find vendors" description="Search by member ID, vendor, shop, mobile, or product category.">
        <form className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]" onSubmit={search}>
          <Input label="Search" name="vendorSearch" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, member ID, shop, mobile..." />
          <Select label="Status" name="vendorStatus" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {['Active', 'Suspended', 'Closed'].map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <div className="flex items-end"><Button type="submit"><Search size={16} /> Search</Button></div>
        </form>
      </Card>

      <Card title="Registered vendors" description={`${vendors.length} vendor${vendors.length === 1 ? '' : 's'} found`}>
        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-slate-500">Loading vendors...</p>
        ) : (
          <Table columns={columns} rows={vendors} rowKey="id" emptyMessage="No vendors match these filters." />
        )}
      </Card>
    </section>
  );
}
