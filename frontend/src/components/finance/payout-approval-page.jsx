'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Badge, Button, Card, Table } from '@/components/ui';
import { getVendorStatements, getVendors } from '@/services/vendor';
import { approvePayoutBatch } from '@/services/finance';
import { formatFinanceDate, formatFinanceMoney, sumMoneyCents } from './finance-utils';

export default function PayoutApprovalPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = permissions.includes('*') || permissions.includes('vendors:read');
  const canWrite = permissions.includes('*') || permissions.includes('vendor-payouts:write');
  const [drafts, setDrafts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token || !canRead) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    Promise.resolve()
      .then(() => getVendors(token))
      .then(async ({ data }) => {
        const groups = await Promise.all(data.vendors.map(async (vendor) => {
          const response = await getVendorStatements(token, vendor.id);
          return response.data.statements
            .filter((statement) => statement.status === 'Draft')
            .map((statement) => ({ ...statement, vendor }));
        }));
        if (active) {
          setDrafts(groups.flat());
          setSelected([]);
        }
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load payout statements.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, reload, token]);

  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const selectedCents = sumMoneyCents(
    drafts.filter((row) => selectedIds.has(row._id)),
    'netPayable',
  );

  function toggleSelected(id) {
    setSelected((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  }

  function toggleAll() {
    const batchRows = drafts.slice(0, 100);
    const allBatchRowsSelected = batchRows.every((row) => selectedIds.has(row._id));
    setSelected(allBatchRowsSelected ? [] : batchRows.map((row) => row._id));
  }

  async function approveSelected() {
    if (!selected.length || !window.confirm(`Approve ${selected.length} draft statement(s)?`)) return;
    setApproving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await approvePayoutBatch(token, selected);
      setNotice(`${data.approved} statement(s) approved. Batch reference: ${data.batchId}`);
      setSelected([]);
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to approve the payout batch.');
    } finally {
      setApproving(false);
    }
  }

  const columns = [
    { key: 'select', label: <input type="checkbox" aria-label="Select up to 100 drafts" checked={drafts.length > 0 && drafts.slice(0, 100).every((row) => selectedIds.has(row._id))} onChange={toggleAll} disabled={!canWrite || !drafts.length} />,
      render: (_, row) => <input type="checkbox" aria-label={`Select ${row.statementNumber}`} checked={selectedIds.has(row._id)} onChange={() => toggleSelected(row._id)} disabled={!canWrite || (!selectedIds.has(row._id) && selected.length >= 100)} /> },
    { key: 'vendor', label: 'Vendor', render: (_, row) => <><strong className="block text-slate-800">{row.vendor.name}</strong><small className="text-slate-500">{row.vendor.shopName}</small></> },
    { key: 'statementNumber', label: 'Statement' },
    { key: 'periodStart', label: 'Period', render: (_, row) => `${formatFinanceDate(row.periodStart)} – ${formatFinanceDate(row.periodEnd)}` },
    { key: 'sales', label: 'Sales / returns', render: (_, row) => `${row.sales} / ${row.returns}` },
    { key: 'netPayable', label: 'Net payable', render: (value) => formatFinanceMoney(value) },
    { key: 'status', label: 'Status', render: () => <Badge tone="warning">Draft</Badge> },
  ];

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading payout approvals...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view payout approvals.</p>;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Finance</p>
          <h1 className="text-2xl font-semibold text-slate-900">Payout Approval</h1>
          <p className="mt-1 text-sm text-slate-600">Select Draft vendor statements and approve them together as one audited batch.</p>
        </div>
        <Button variant="secondary" onClick={() => setReload((value) => value + 1)} disabled={loading || approving}>
          <RefreshCw size={16} /> Refresh
        </Button>
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}
      <Card
        title="Draft statements"
        description="Approval is all-or-nothing: every selected statement must still be Draft."
        actions={<Button onClick={approveSelected} disabled={!canWrite || !selected.length || approving || loading}>{approving ? 'Approving...' : `Approve ${selected.length} selected`}</Button>}
      >
        {!canWrite && <p className="mb-3 text-sm text-slate-500">You have read-only access. Payout approval permission is required to approve statements.</p>}
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading draft statements...</p> : (
          <>
            <p className="mb-3 text-sm text-slate-600">{drafts.length} drafts · <strong>{formatFinanceMoney(selectedCents / 100)}</strong> selected for approval (maximum 100 per batch)</p>
            <Table columns={columns} rows={drafts} rowKey="_id" emptyMessage="There are no draft statements awaiting approval." />
          </>
        )}
      </Card>
    </section>
  );
}
