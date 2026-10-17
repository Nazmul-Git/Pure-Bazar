'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { ArrowUpRight, Check, Plus } from 'lucide-react';
import { Badge, Button, Card, Input, Table } from '@/components/ui';
import { approveGoodsReceive, getGoodsReceives, getReceiveVendors } from '@/services/stock';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
const formatDate = (value) => new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium' }).format(new Date(value));

function statusTone(status) {
  if (status === 'Approved') return 'success';
  if (status === 'Rejected') return 'danger';
  return 'warning';
}

export default function GoodsReceivesPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'stock:read');
  const canWrite = can(permissions, 'stock:write');
  const [receives, setReceives] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!initialized) return undefined;
    if (!token || !canRead) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    Promise.all([getGoodsReceives(token), getReceiveVendors(token)])
      .then(([receiveResponse, vendorResponse]) => {
        if (!active) return;
        setReceives(receiveResponse.data.goodsReceives);
        setVendors(vendorResponse.data.vendors);
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load goods receives.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, initialized, token]);

  const vendorNames = useMemo(
    () => new Map(vendors.map((vendor) => [vendor.id, vendor.name])),
    [vendors],
  );
  const visibleReceives = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return receives;
    return receives.filter((receive) => (
      `${receive.vendorChallanNumber || ''} ${vendorNames.get(receive.vendorId) || receive.vendorId || ''} ${receive.status}`
        .toLowerCase().includes(query)
    ));
  }, [receives, search, vendorNames]);

  async function approve(id) {
    setApprovingId(id);
    setError('');
    try {
      const response = await approveGoodsReceive(token, id);
      setReceives((current) => current.map((receive) => (
        receive.id === id ? response.data.goodsReceive : receive
      )));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to approve this GRN.');
    } finally {
      setApprovingId('');
    }
  }

  const columns = [
    {
      key: 'id',
      label: 'GRN / Date',
      render: (id, receive) => (
        <div><strong className="block text-slate-800">{id.slice(-8).toUpperCase()}</strong><small className="text-slate-500">{formatDate(receive.createdAt)}</small></div>
      ),
    },
    { key: 'vendorId', label: 'Vendor', render: (id) => vendorNames.get(id) || '—' },
    { key: 'vendorChallanNumber', label: 'Challan', render: (value) => value || '—' },
    { key: 'lines', label: 'Products', render: (lines) => lines.length },
    { key: 'status', label: 'Status', render: (status) => <Badge tone={statusTone(status)}>{status}</Badge> },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, receive) => (
        <div className="flex items-center gap-2">
          {canWrite && receive.status === 'Draft' && (
            <Button size="sm" onClick={() => approve(receive.id)} disabled={approvingId === receive.id}>
              <Check size={15} /> {approvingId === receive.id ? 'Approving...' : 'Approve'}
            </Button>
          )}
          <Link className="ui-button button-secondary button-sm" href={`/inventory/goods-receives/${receive.id}/print`}>
            Print <ArrowUpRight size={14} />
          </Link>
        </div>
      ),
    },
  ];

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading goods receives...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view goods receives.</p>;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Inventory</p>
          <h1 className="text-2xl font-semibold text-slate-900">Goods Receive</h1>
          <p className="mt-1 text-sm text-slate-600">Create, review, approve, and print vendor goods receipts.</p>
        </div>
        {canWrite && <Link href="/inventory/goods-receives/new" className="ui-button button-primary button-md"><Plus size={17} /> New GRN</Link>}
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <Card title="Goods Receive Notes" description={`${receives.length} total GRN${receives.length === 1 ? '' : 's'}`}>
        <div className="mb-4 max-w-sm">
          <Input label="Search GRNs" name="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Challan, vendor, or status" />
        </div>
        <Table columns={columns} rows={visibleReceives} rowKey="id" emptyMessage={search ? 'No GRNs match your search.' : 'No goods receives yet.'} />
      </Card>
    </section>
  );
}
