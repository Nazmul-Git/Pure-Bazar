'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Badge, Button, Card, Input, Modal, Table } from '@/components/ui';
import {
  getWalletReconciliation, resolveWalletReconciliation, runWalletReconciliation,
} from '@/services/finance';
import { formatFinanceDate, formatFinanceMoney, localDateInput } from './finance-utils';

function statusBadge(record) {
  if (record.status === 'Matched') return <Badge tone="success">Matched</Badge>;
  if (record.status === 'Pending') return <Badge tone="neutral">Pending</Badge>;
  return <Badge tone={record.resolved ? 'info' : 'danger'}>{record.resolved ? 'Resolved' : 'Mismatch'}</Badge>;
}

export default function WalletReconciliationPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = permissions.includes('*') || permissions.includes('finance:read');
  const canWrite = permissions.includes('*') || permissions.includes('finance:write');
  const [date, setDate] = useState(localDateInput());
  const [data, setData] = useState({ records: [], totals: { matched: 0, mismatch: 0, pending: 0, unresolved: 0 } });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resolving, setResolving] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !canRead) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    getWalletReconciliation(token, date)
      .then(({ data: result }) => active && setData(result))
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load wallet reconciliation.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, date, reload, token]);

  async function runReconciliation() {
    setRunning(true);
    setError('');
    setNotice('');
    try {
      const { data: result } = await runWalletReconciliation(token, date);
      setData(result);
      setNotice(`Reconciliation completed for ${date}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to run wallet reconciliation.');
    } finally {
      setRunning(false);
    }
  }

  async function resolveMismatch(event) {
    event.preventDefault();
    if (!resolving || reason.trim().length < 3) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await resolveWalletReconciliation(token, resolving._id, reason.trim());
      setResolving(null);
      setReason('');
      setNotice(`Mismatch for bill ${resolving.orderNumber} was resolved.`);
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to resolve this mismatch.');
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: 'orderNumber', label: 'Wallet bill' },
    { key: 'memberId', label: 'Member ID' },
    { key: 'amount', label: 'Bill amount', render: formatFinanceMoney },
    {
      key: 'probashiTransactionId',
      label: 'Probashi transaction',
      render: (value, record) => value || (record.mismatchType === 'MISSING' ? 'Not found' : '—'),
    },
    { key: 'probashiAmount', label: 'Probashi amount', render: (value) => value == null ? '—' : formatFinanceMoney(value) },
    { key: 'status', label: 'Status', render: (_, record) => <div className="space-y-1">{statusBadge(record)}{record.mismatchType && <small className="block text-slate-500">{record.mismatchType === 'MISSING' ? 'Missing transaction' : 'Amount mismatch'}</small>}</div> },
    {
      key: 'action',
      label: 'Action',
      render: (_, record) => record.status === 'Mismatch' && !record.resolved
        ? <Button size="sm" variant="secondary" disabled={!canWrite} onClick={() => { setResolving(record); setReason(''); }}>Resolve</Button>
        : record.resolved ? <span className="text-xs text-slate-500" title={record.resolutionReason}>Reason recorded</span> : '—',
    },
  ];

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading wallet reconciliation...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view wallet reconciliation.</p>;

  const totals = data.totals;
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Finance</p>
          <h1 className="text-2xl font-semibold text-slate-900">Wallet Reconciliation</h1>
          <p className="mt-1 text-sm text-slate-600">Compare POS wallet bills with the member's Probashi transaction report.</p>
        </div>
        <Button variant="secondary" onClick={() => setReload((value) => value + 1)} disabled={loading || running}>
          <RefreshCw size={16} /> Refresh
        </Button>
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

      <Card title="Daily reconciliation" description="Run once the day's wallet transactions are available. The run is idempotent; resolved mismatches are preserved." actions={
        <Button onClick={runReconciliation} disabled={!canWrite || loading || running || !date || date > localDateInput()}>
          {running ? 'Reconciling...' : 'Run reconciliation'}
        </Button>
      }>
        <div className="max-w-xs">
          <Input label="Business date" name="date" type="date" max={localDateInput()} value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        {!canWrite && <p className="mt-3 text-sm text-slate-500">Read-only access. Finance write permission is required to run or resolve reconciliation records.</p>}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Matched"><p className="text-2xl font-semibold text-green-700">{totals.matched}</p></Card>
        <Card title="Mismatches"><p className="text-2xl font-semibold text-red-700">{totals.mismatch}</p></Card>
        <Card title="Pending"><p className="text-2xl font-semibold text-slate-700">{totals.pending}</p></Card>
        <Card title="Unresolved"><p className="flex items-center gap-2 text-2xl font-semibold text-amber-700"><AlertTriangle size={20} />{totals.unresolved}</p></Card>
      </div>

      {totals.unresolved > 0 && (
        <p role="status" className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={17} /> {totals.unresolved} wallet mismatch(es) remain unresolved for {date}.
        </p>
      )}
      {totals.unresolved === 0 && data.records.length > 0 && (
        <p role="status" className="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={17} /> No unresolved wallet mismatches for {date}.
        </p>
      )}

      <Card title="Wallet bills" description={`${data.records.length} bill(s) for ${formatFinanceDate(`${date}T00:00:00`)}.`}>
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading reconciliation records...</p> : (
          <Table columns={columns} rows={data.records} rowKey="_id" emptyMessage="No wallet bills have been reconciled for this date. Run reconciliation to check the day's bills." />
        )}
      </Card>

      <Modal
        open={Boolean(resolving)}
        onClose={() => !saving && setResolving(null)}
        title={`Resolve mismatch${resolving ? ` · ${resolving.orderNumber}` : ''}`}
      >
        {resolving && (
          <form className="space-y-4" onSubmit={resolveMismatch}>
            <p className="text-sm text-slate-600">Record why this mismatch is considered resolved. This action cannot be undone.</p>
            <label className="ui-field" htmlFor="resolution-reason">
              <span className="field-label">Resolution reason</span>
              <textarea id="resolution-reason" className="ui-input min-h-24" minLength={3} maxLength={500} required value={reason} onChange={(event) => setReason(event.target.value)} />
              <span className="text-xs text-slate-500">{reason.trim().length}/500 characters (minimum 3)</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setResolving(null)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving || reason.trim().length < 3}>{saving ? 'Saving...' : 'Resolve mismatch'}</Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
