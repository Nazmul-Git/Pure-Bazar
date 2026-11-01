'use client';

import { useState } from 'react';
import { Eye, RefreshCw, Search } from 'lucide-react';
import { Badge, Button, Card, Input, Modal, Select, Table } from '@/components/ui';
import usePosSales from '@/hooks/use-pos-sales';
import { formatLineQuantity } from '@/services/stock-units.cjs';
import useToastMessages from '@/hooks/use-toast-messages';
import {
  paymentMethodLabel, sumMoney,
} from '@/services/pos-screen-utils.cjs';
import { T } from '@/i18n/language-provider';

const currency = new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' });
const amount = (value) => currency.format(Number(value) || 0);
const dateTime = (value) => (value ? new Date(value).toLocaleString() : '—');
const orderId = (order) => String(order._id || order.id);

function OrderDetails({ order }) {
  if (!order) return null;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><small className="text-slate-500"><T>{"Bill"}</T></small><p className="m-0 font-semibold">{order.orderNumber}</p></div>
        <div><small className="text-slate-500"><T>{"Sale date"}</T></small><p className="m-0 font-semibold">{dateTime(order.soldAt || order.createdAt)}</p></div>
        <div><small className="text-slate-500"><T>{"Cashier"}</T></small><p className="m-0 font-semibold">{order.cashier?.name || String(order.cashier || '—')}</p></div>
        <div><small className="text-slate-500"><T>{"Payment"}</T></small><p className="m-0 font-semibold">{order.payments?.map((item) => `${paymentMethodLabel(item.method)} ${amount(item.amount)}`).join(', ') || '—'}</p></div>
      </div>
      <div className="table-wrap">
        <div className="table-scroll">
          <table className="ui-table">
            <thead><tr><th><T>{"Product"}</T></th><th><T>{"Qty"}</T></th><th><T>{"Unit price"}</T></th><th className="text-right"><T>{"Total"}</T></th></tr></thead>
            <tbody>{(order.lines || []).map((line, index) => (
              <tr key={`${line.productId}-${index}`}>
                <td>{line.productName}</td><td>{formatLineQuantity(line)}</td><td>{amount(line.mrp)}</td><td className="text-right">{amount(line.total)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr><th colSpan="3" className="text-right"><T>{"Grand total"}</T></th><th className="text-right">{amount(order.grandTotal)}</th></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function SalesHistoryPage() {
  const {
    orders, loading, error, canRead, loadOrders,
  } = usePosSales();
  useToastMessages({ error });
  const [filters, setFilters] = useState({ from: '', to: '', paymentMethod: '' });
  const [selected, setSelected] = useState(null);
  const rows = orders.map((order) => ({ ...order, id: orderId(order) }));
  const paidTotal = sumMoney(orders.filter((order) => order.paymentStatus === 'PAID').map((order) => order.grandTotal));
  const columns = [
    { key: 'orderNumber', label: 'Bill', render: (value, row) => <div><strong>{value}</strong><small className="block text-slate-500">{dateTime(row.soldAt || row.createdAt)}</small></div> },
    { key: 'cashier', label: 'Cashier', render: (value) => value?.name || (value ? String(value).slice(-8) : '—') },
    { key: 'payments', label: 'Payment', render: (payments = []) => payments.map((item) => paymentMethodLabel(item.method)).join(', ') || '—' },
    { key: 'grandTotal', label: 'Total', render: (value) => amount(value) },
    { key: 'paymentStatus', label: 'Status', render: (value) => <Badge tone={value === 'PAID' ? 'success' : 'warning'}>{value === 'REFUNDED' ? 'Refunded' : 'Paid'}</Badge> },
    { key: 'actions', label: '', render: (_, row) => <Button variant="ghost" size="sm" onClick={() => setSelected(row)}><Eye size={16} /> <T>{"Details"}</T></Button> },
  ];

  if (!canRead) return <section className="access-denied"><h1><T>{"Access denied"}</T></h1><p><T>{"Your role does not have POS read permission."}</T></p></section>;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="m-0 text-2xl font-semibold"><T>{"Sales History"}</T></h1><p className="mb-0 mt-1 text-sm text-slate-500"><T>{"Review the latest POS bills and payment details."}</T></p></div>
        <Button variant="secondary" onClick={() => loadOrders(filters)} disabled={loading}><RefreshCw size={16} /> <T>{"Refresh"}</T></Button>
      </header>
      <Card title="Filter sales" description="Up to 100 matching bills are shown.">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); loadOrders(filters); }}>
          <Input label="From" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
          <Input label="To" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
          <Select label="Payment method" value={filters.paymentMethod} onChange={(event) => setFilters({ ...filters, paymentMethod: event.target.value })}>
            <option value=""><T>{"All methods"}</T></option>
            {['CASH', 'BKASH', 'NAGAD', 'CARD', 'WALLET'].map((method) => <option key={method} value={method}>{paymentMethodLabel(method)}</option>)}
          </Select>
          <div className="flex items-end"><Button type="submit" disabled={loading}><Search size={16} /> <T>{"Apply"}</T></Button></div>
        </form>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card><p className="m-0 text-sm text-slate-500"><T>{"Bills in results"}</T></p><strong className="mt-1 block text-xl">{orders.length}</strong></Card>
        <Card><p className="m-0 text-sm text-slate-500"><T>{"Paid sales total"}</T></p><strong className="mt-1 block text-xl">{amount(paidTotal)}</strong></Card>
      </div>
      <Card title="Recent bills">
        {loading ? <p className="m-0 text-slate-500" role="status"><T>{"Loading sales…"}</T></p> : <Table columns={columns} rows={rows} rowKey="id" emptyMessage="No sales match these filters." />}
      </Card>
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.orderNumber || 'Bill details'} className="max-w-3xl">
        <OrderDetails order={selected} />
      </Modal>
    </div>
  );
}
