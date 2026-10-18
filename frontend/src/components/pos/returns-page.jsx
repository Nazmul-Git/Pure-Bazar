'use client';

import { useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { Button, Card, Modal, Select, Table } from '@/components/ui';
import useAuth from '@/store/use-auth';
import usePosSales from '@/hooks/use-pos-sales';
import { returnPosOrder } from '@/services/pos-admin';
import { isWalletSale, paymentMethodLabel } from '@/services/pos-screen-utils.cjs';

const currency = new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' });
const amount = (value) => currency.format(Number(value) || 0);
const dateTime = (value) => (value ? new Date(value).toLocaleString() : '—');
const orderId = (order) => String(order._id || order.id);

export default function ReturnsPage() {
  const { hasPermission } = useAuth();
  const {
    orders, loading, error, canRead, loadOrders,
  } = usePosSales();
  const [selected, setSelected] = useState(null);
  const [refundMethod, setRefundMethod] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const canWrite = hasPermission('pos:write');
  const eligibleOrders = orders.filter((order) => order.paymentStatus === 'PAID');

  async function submitReturn(event) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setActionError('');
    setNotice('');
    try {
      await returnPosOrder(orderId(selected), {
        walletRefunded: Boolean(refundMethod),
        ...(refundMethod ? { walletRefundMethod: refundMethod } : {}),
      });
      setNotice(`Bill ${selected.orderNumber} returned. Its items were restored to stock.`);
      setSelected(null);
      setRefundMethod('');
      await loadOrders();
    } catch (requestError) {
      setActionError(requestError.response?.data?.message || 'Unable to return this bill.');
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: 'orderNumber', label: 'Bill', render: (value, row) => <div><strong>{value}</strong><small className="block text-slate-500">{dateTime(row.soldAt || row.createdAt)}</small></div> },
    { key: 'lines', label: 'Items', render: (lines = []) => lines.reduce((count, line) => count + Number(line.quantity || 0), 0) },
    { key: 'payments', label: 'Payment', render: (payments = []) => payments.map((item) => paymentMethodLabel(item.method)).join(', ') || '—' },
    { key: 'grandTotal', label: 'Refund amount', render: (value) => amount(value) },
    { key: 'action', label: '', render: (_, row) => (
      <Button size="sm" variant="secondary" disabled={!canWrite} onClick={() => { setSelected(row); setRefundMethod(''); setActionError(''); }}>
        <RotateCcw size={15} /> Return bill
      </Button>
    ) },
  ];
  const rows = eligibleOrders.map((order) => ({ ...order, id: orderId(order) }));

  if (!canRead) return <section className="access-denied"><h1>Access denied</h1><p>Your role does not have POS read permission.</p></section>;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="m-0 text-2xl font-semibold">Returns &amp; Exchanges</h1><p className="mb-0 mt-1 text-sm text-slate-500">Find a paid bill to process a full-bill return.</p></div>
        <Button variant="secondary" onClick={() => loadOrders()} disabled={loading}><RefreshCw size={16} /> Refresh</Button>
      </header>
      <Card>
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Returns are supported for the entire bill only. Partial returns and direct exchanges are not available; complete a return, then ring up replacement items as a new sale.
        </div>
      </Card>
      {!canWrite && <p className="m-0 text-sm text-slate-500">You can view eligible bills, but POS write permission is required to process returns.</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      {actionError && !selected && <p className="field-error" role="alert">{actionError}</p>}
      {notice && <p className="text-sm text-green-700" role="status">{notice}</p>}
      <Card title="Eligible bills" description={`${eligibleOrders.length} paid bills in the latest results.`}>
        {loading ? <p className="m-0 text-slate-500" role="status">Loading bills…</p> : <Table columns={columns} rows={rows} rowKey="id" emptyMessage="No paid bills are available to return." />}
      </Card>
      <Modal open={Boolean(selected)} onClose={() => !saving && setSelected(null)} title="Confirm full-bill return">
        {selected && (
          <form className="space-y-4" onSubmit={submitReturn}>
            <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="m-0 font-semibold">{selected.orderNumber}</p>
              <p className="mb-0 mt-1 text-slate-600">{dateTime(selected.soldAt || selected.createdAt)} · {selected.lines?.length || 0} line items</p>
              <p className="mb-0 mt-3 font-semibold">Full refund: {amount(selected.grandTotal)}</p>
            </div>
            <p className="m-0 text-sm text-slate-600">All items on this bill will be restored to stock. This action cannot be reversed.</p>
            {isWalletSale(selected) && (
              <Select label="Wallet refund status" value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)}>
                <option value="">Not yet refunded</option>
                <option value="MANUAL">Refund completed manually</option>
                <option value="API">Refund completed via API</option>
              </Select>
            )}
            {isWalletSale(selected) && refundMethod === 'API' && <p className="m-0 text-xs text-slate-500">This records a completed refund; it does not initiate a provider transaction.</p>}
            {actionError && <p className="m-0 field-error" role="alert">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setSelected(null)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Processing…' : 'Confirm return'}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
