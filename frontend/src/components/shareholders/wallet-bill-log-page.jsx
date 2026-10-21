'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Badge, Button, Card, Input, Table } from '@/components/ui';
import { getWalletLogs } from '@/services/shareholder';
import { formatFinanceMoney, localDateInput } from '@/components/finance/finance-utils';

function formatLogDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function WalletBillLogPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const canRead = user?.permissions?.includes('*') || user?.permissions?.includes('wallet-logs:read');
  const [date, setDate] = useState(localDateInput());
  const [memberSearch, setMemberSearch] = useState('');
  const [filters, setFilters] = useState({ date: localDateInput(), memberId: '' });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !canRead) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    getWalletLogs(token, filters)
      .then(({ data }) => active && setLogs(data.logs))
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load wallet bill logs.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, filters, reload, token]);

  const totals = useMemo(() => logs.reduce((sum, log) => {
    const cents = Math.round((Number(log.amount) + Number.EPSILON) * 100);
    return {
      count: sum.count + 1,
      debit: sum.debit + (log.type === 'DEBIT' ? cents : 0),
      refund: sum.refund + (log.type === 'REFUND' ? cents : 0),
    };
  }, { count: 0, debit: 0, refund: 0 }), [logs]);

  const columns = [
    { key: 'createdAt', label: 'Date & time', render: formatLogDate },
    {
      key: 'memberId',
      label: 'Member',
      render: (member) => member
        ? <><strong className="block text-slate-800">{member.name || member.memberId}</strong><small className="text-slate-500">{member.memberId}</small></>
        : '—',
    },
    { key: 'orderId', label: 'Bill', render: (order) => order?.orderNumber || '—' },
    {
      key: 'type',
      label: 'Type',
      render: (type) => <Badge tone={type === 'REFUND' ? 'warning' : 'info'}>{type === 'REFUND' ? 'Refund' : 'Wallet debit'}</Badge>,
    },
    { key: 'amount', label: 'Amount', render: formatFinanceMoney },
  ];

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading wallet bill log...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view wallet bill logs.</p>;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Shareholders</p>
          <h1 className="text-2xl font-semibold text-slate-900">Wallet Bill Log</h1>
          <p className="mt-1 text-sm text-slate-600">Wallet debits and refunds recorded against POS bills.</p>
        </div>
        <Button variant="secondary" onClick={() => setReload((value) => value + 1)} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </Button>
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <Card title="Filter wallet activity">
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={(event) => {
          event.preventDefault();
          setFilters({ date, memberId: memberSearch.trim() });
        }}>
          <Input label="Business date" name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Input label="Member ID" name="memberId" placeholder="e.g. PB-1001" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
          <div className="flex items-end">
            <Button type="submit" disabled={loading}><Search size={16} /> Apply filters</Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card title="Wallet entries"><p className="text-2xl font-semibold">{totals.count}</p></Card>
        <Card title="Debits"><p className="text-xl font-semibold">{formatFinanceMoney(totals.debit / 100)}</p></Card>
        <Card title="Refunds"><p className="text-xl font-semibold">{formatFinanceMoney(totals.refund / 100)}</p></Card>
      </div>

      <Card title="Wallet activity" description={`Showing up to 500 entries for ${filters.date}${filters.memberId ? ` · member ${filters.memberId}` : ''}.`}>
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading wallet activity...</p> : (
          <Table columns={columns} rows={logs} rowKey="_id" emptyMessage="No wallet activity matches these filters." />
        )}
      </Card>
    </section>
  );
}
