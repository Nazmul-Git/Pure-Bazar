'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Button, Card, Input, Table } from '@/components/ui';
import { downloadReport, getReport } from '@/services/reports';

const reportConfig = {
  sales: {
    title: 'Sales Report',
    description: 'Review paid sales by day or month.',
    metrics: [
      ['billCount', 'Paid bills', 'count'],
      ['subtotal', 'Subtotal', 'money'],
      ['discounts', 'Discounts', 'money'],
      ['vat', 'VAT', 'money'],
      ['totalSales', 'Total sales', 'money'],
    ],
    columns: [
      ['period', 'Period'],
      ['billCount', 'Bills', 'count'],
      ['subtotal', 'Subtotal', 'money'],
      ['discounts', 'Discounts', 'money'],
      ['vat', 'VAT', 'money'],
      ['totalSales', 'Total sales', 'money'],
    ],
  },
  stock: {
    title: 'Stock Report',
    description: 'Track stock movement, closing quantities, turnover, and low stock.',
    metrics: [],
    columns: [
      ['productName', 'Product'],
      ['barcode', 'Barcode'],
      ['opening', 'Opening', 'quantity'],
      ['received', 'Received', 'quantity'],
      ['sold', 'Sold net', 'quantity'],
      ['otherChange', 'Other change', 'quantity'],
      ['closing', 'Closing', 'quantity'],
      ['onHand', 'On hand', 'quantity'],
      ['turnover', 'Turnover', 'number'],
    ],
  },
  vendor: {
    title: 'Vendor Profitability',
    description: 'Compare vendor payables and company net earnings for the selected period.',
    metrics: [
      ['quantitySold', 'Quantity sold', 'quantity'],
      ['vendorPayable', 'Vendor payable', 'money'],
      ['companyNet', 'Company net', 'money'],
    ],
    columns: [
      ['vendorName', 'Vendor'],
      ['shopName', 'Shop'],
      ['billCount', 'Bills', 'count'],
      ['quantitySold', 'Qty sold', 'quantity'],
      ['vendorPayable', 'Vendor payable', 'money'],
      ['companyNet', 'Company net', 'money'],
      ['marginPercentOfPayable', 'Margin %', 'percent'],
    ],
  },
  profitLoss: {
    title: 'Profit and Loss',
    description: 'Review margin, discounts, expenses, and net profit.',
    metrics: [
      ['marginIncome', 'Vendor margin income', 'money'],
      ['ownStockMargin', 'Own-stock margin', 'money'],
      ['discounts', 'Discounts', 'money'],
      ['expenses', 'Expenses', 'money'],
      ['netProfit', 'Net profit', 'money'],
    ],
    columns: [],
  },
  vatDiscount: {
    title: 'VAT and Discounts',
    description: 'Review paid bill VAT and discounts recorded in each business day.',
    metrics: [
      ['billCount', 'Paid bills', 'count'],
      ['vat', 'VAT', 'money'],
      ['itemDiscount', 'Item discounts', 'money'],
      ['billDiscount', 'Bill discounts', 'money'],
      ['shareholderDiscount', 'Shareholder discounts', 'money'],
      ['totalDiscount', 'Total discounts', 'money'],
    ],
    columns: [
      ['period', 'Period'],
      ['billCount', 'Bills', 'count'],
      ['vat', 'VAT', 'money'],
      ['itemDiscount', 'Item discount', 'money'],
      ['billDiscount', 'Bill discount', 'money'],
      ['shareholderDiscount', 'Shareholder discount', 'money'],
      ['totalDiscount', 'Total discount', 'money'],
    ],
  },
};

const moneyFormatter = new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' });
const numberFormatter = new Intl.NumberFormat('en-BD', { maximumFractionDigits: 4 });

function formatValue(value, kind) {
  if (value === null || value === undefined || value === '') return '—';
  if (kind === 'money') return moneyFormatter.format(value);
  if (kind === 'percent') return `${numberFormatter.format(value)}%`;
  if (kind === 'count' || kind === 'quantity' || kind === 'number') return numberFormatter.format(value);
  return String(value);
}

function ReportTable({ columns, rows, emptyMessage }) {
  const tableColumns = columns.map(([key, label, kind]) => ({
    key,
    label,
    render: (value) => formatValue(value, kind),
  }));
  return <Table columns={tableColumns} rows={rows} rowKey="_id" pageSize={15} emptyMessage={emptyMessage} />;
}

export default function ReportScreen({ type }) {
  const token = useSelector((state) => state.auth.token);
  const config = reportConfig[type];
  const [filters, setFilters] = useState({ from: '', to: '', groupBy: 'day', lowStockThreshold: '10' });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');

  const loadReport = useCallback(async (params) => {
    setLoading(true);
    setError('');
    try {
      const response = await getReport(token, type, params);
      setReport(response.data.report);
      setAppliedFilters(params);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load this report.');
    } finally {
      setLoading(false);
    }
  }, [token, type]);

  useEffect(() => {
    if (token) loadReport({});
  }, [token, loadReport]);

  const metrics = useMemo(() => {
    if (type === 'stock') {
      return [
        ['products', 'Products with movement', report?.rows?.length || 0, 'count'],
        ['lowStock', 'Low-stock products', report?.lowStock?.length || 0, 'count'],
        ['threshold', 'Low-stock threshold', report?.lowStockThreshold ?? 10, 'quantity'],
      ];
    }
    if (type === 'profitLoss') {
      return config.metrics.map(([key, label, kind]) => [key, label, report?.[key], kind]);
    }
    const totals = report?.totals;
    return config.metrics.map(([key, label, kind]) => [key, label, totals?.[key], kind]);
  }, [config.metrics, report, type]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  async function applyFilters(event) {
    event.preventDefault();
    const params = { from: filters.from, to: filters.to };
    if (type === 'sales') params.groupBy = filters.groupBy;
    if (type === 'stock') params.lowStockThreshold = filters.lowStockThreshold;
    await loadReport(params);
  }

  async function clearFilters() {
    const cleared = { from: '', to: '', groupBy: 'day', lowStockThreshold: '10' };
    setFilters(cleared);
    await loadReport({});
  }

  async function exportReport(format) {
    setExporting(format);
    setError('');
    try {
      const response = await downloadReport(token, type, appliedFilters, format);
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type === 'vendor' ? 'vendor-profitability' : type === 'profitLoss' ? 'profit-loss-report' : type === 'vatDiscount' ? 'vat-discount-report' : `${type}-report`}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || `Unable to download the ${format.toUpperCase()} report.`);
    } finally {
      setExporting('');
    }
  }

  const reportRows = type === 'profitLoss' ? [] : report?.rows || [];

  return (
    <section className="space-y-5">
      <header>
        <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Reports</p>
        <h1 className="text-2xl font-semibold text-slate-900">{config.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{config.description}</p>
      </header>

      <form onSubmit={applyFilters} className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
        <Input label="From date" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => updateFilter('from', event.target.value)} />
        <Input label="To date" type="date" min={filters.from || undefined} value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} />
        {type === 'sales' && (
          <label className="ui-field" htmlFor="groupBy">
            <span className="field-label">Group by</span>
            <select id="groupBy" className="ui-input" value={filters.groupBy} onChange={(event) => updateFilter('groupBy', event.target.value)}>
              <option value="day">Day</option><option value="month">Month</option>
            </select>
          </label>
        )}
        {type === 'stock' && <Input label="Low-stock threshold" type="number" min="0" step="any" value={filters.lowStockThreshold} onChange={(event) => updateFilter('lowStockThreshold', event.target.value)} />}
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={loading}>{loading ? 'Loading...' : 'Apply filters'}</Button>
          <Button type="button" variant="secondary" onClick={clearFilters} disabled={loading}>Clear</Button>
        </div>
      </form>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {loading ? (
        <p role="status" className="py-10 text-center text-slate-500">Loading report...</p>
      ) : report && (
        <>
          {metrics.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {metrics.map(([key, label, value, kind]) => (
                <Card key={key} className="min-w-0">
                  <p className="m-0 text-sm text-slate-500">{label}</p>
                  <p className="mb-0 mt-2 text-xl font-semibold text-slate-900">{formatValue(value, kind)}</p>
                </Card>
              ))}
            </div>
          )}
          {type === 'profitLoss' ? (
            <Card title="Expenses by category">
              <ReportTable
                columns={[['category', 'Category'], ['total', 'Amount', 'money']]}
                rows={report.expensesByCategory || []}
                emptyMessage="No expenses recorded for this period."
              />
            </Card>
          ) : (
            <Card
              title={type === 'stock' ? 'Stock movement' : config.title}
              actions={
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={Boolean(exporting)} onClick={() => exportReport('xlsx')}>
                    <FileSpreadsheet size={16} className="mr-1 inline" /> Excel
                  </Button>
                  <Button variant="secondary" size="sm" disabled={Boolean(exporting)} onClick={() => exportReport('pdf')}>
                    <FileDown size={16} className="mr-1 inline" /> PDF
                  </Button>
                </div>
              }
            >
              <ReportTable columns={config.columns} rows={reportRows} emptyMessage="No records match these filters." />
            </Card>
          )}
          {type === 'stock' && (
            <Card title="Low stock">
              <ReportTable
                columns={[['productName', 'Product'], ['barcode', 'Barcode'], ['quantity', 'On hand', 'quantity']]}
                rows={report.lowStock || []}
                emptyMessage="No products are at or below the threshold."
              />
            </Card>
          )}
          {type === 'profitLoss' && (
            <Card
              title="Download report"
              actions={
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={Boolean(exporting)} onClick={() => exportReport('xlsx')}>
                    <FileSpreadsheet size={16} className="mr-1 inline" /> Excel
                  </Button>
                  <Button variant="secondary" size="sm" disabled={Boolean(exporting)} onClick={() => exportReport('pdf')}>
                    <FileDown size={16} className="mr-1 inline" /> PDF
                  </Button>
                </div>
              }
            >
              <p className="m-0 text-sm text-slate-600">Exports include income, discounts, expenses, category details, and net profit.</p>
            </Card>
          )}
        </>
      )}
    </section>
  );
}
