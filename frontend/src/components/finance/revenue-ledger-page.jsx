'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Button, Card, Input, Table } from '@/components/ui';
import { getRevenueLedger } from '@/services/finance';
import { firstDayOfMonth, formatFinanceMoney, localDateInput } from './finance-utils';
import { T } from '@/i18n/language-provider';

const columns = [
  { key: 'category', label: 'Category' },
  { key: 'sales', label: 'Sales', render: (value) => formatFinanceMoney(value) },
  { key: 'discounts', label: 'Discounts', render: (value) => formatFinanceMoney(value) },
  { key: 'returnsAdjustment', label: 'Returns', render: (value) => formatFinanceMoney(value) },
  { key: 'vat', label: 'VAT', render: (value) => formatFinanceMoney(value) },
  { key: 'income', label: 'Company income', render: (value) => formatFinanceMoney(value) },
];

export default function RevenueLedgerPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const canRead = user?.permissions?.includes('*') || user?.permissions?.includes('finance:read');
  const [period, setPeriod] = useState({ startDate: firstDayOfMonth(), endDate: localDateInput() });
  const [ledger, setLedger] = useState({ categories: [], totals: null });
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !canRead) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    if (period.startDate > period.endDate) {
      setError('Start date must be on or before end date.');
      setLoading(false);
      return () => { active = false; };
    }
    getRevenueLedger(token, period)
      .then(({ data }) => active && setLedger(data))
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load the revenue ledger.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, period, reload, token]);

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500"><T>{"Loading revenue ledger..."}</T></p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><T>{"You do not have permission to view the revenue ledger."}</T></p>;

  const rows = ledger.categories.map((row) => ({ ...row, id: row.categoryId || row.category }));
  const totals = ledger.totals;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500"><T>{"Finance"}</T></p>
          <h1 className="text-2xl font-semibold text-slate-900"><T>{"Revenue Ledger"}</T></h1>
          <p className="mt-1 text-sm text-slate-600"><T>{"Sales, discounts, returns and company income by product category."}</T></p>
        </div>
        <Button variant="secondary" onClick={() => setReload((value) => value + 1)} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </Button>
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <Card title="Reporting period" description="VAT is reported separately and is not included in company income.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="From" name="startDate" type="date" value={period.startDate} onChange={(event) => setPeriod((value) => ({ ...value, startDate: event.target.value }))} />
          <Input label="To" name="endDate" type="date" value={period.endDate} onChange={(event) => setPeriod((value) => ({ ...value, endDate: event.target.value }))} />
          <div className="flex items-end"><Button onClick={() => setReload((value) => value + 1)} disabled={loading}>Apply dates</Button></div>
        </div>
      </Card>

      <Card title="Revenue by category">
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500"><T>{"Loading revenue data..."}</T></p> : (
          <Table
            columns={columns}
            rows={rows}
            rowKey="id"
            emptyMessage="No revenue activity for this period."
          />
        )}
        {totals && !loading && (
          <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 lg:grid-cols-5">
            <div><span className="text-xs text-slate-500"><T>{"Sales"}</T></span><p className="font-semibold">{formatFinanceMoney(totals.sales)}</p></div>
            <div><span className="text-xs text-slate-500"><T>{"Discounts"}</T></span><p className="font-semibold">{formatFinanceMoney(totals.discounts)}</p></div>
            <div><span className="text-xs text-slate-500"><T>{"Returns"}</T></span><p className="font-semibold">{formatFinanceMoney(totals.returnsAdjustment)}</p></div>
            <div><span className="text-xs text-slate-500"><T>{"VAT (separate)"}</T></span><p className="font-semibold">{formatFinanceMoney(totals.vat)}</p></div>
            <div><span className="text-xs text-slate-500"><T>{"Company income"}</T></span><p className="font-semibold text-blue-700">{formatFinanceMoney(totals.income)}</p></div>
          </div>
        )}
      </Card>
    </section>
  );
}
