'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { FileText, Printer, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, Input, Select } from '@/components/ui';
import {
  createVendorStatement,
  getVendorLedger,
  getVendorStatements,
  getVendors,
  updateVendorStatement,
} from '@/services/vendor';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const monthStart = (month) => `${month}-01`;
const monthEnd = (month) => {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
};
const money = (amount) => new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  minimumFractionDigits: 2,
}).format(Number(amount) || 0);
const date = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium' }).format(parsed);
};
const shortId = (value) => (typeof value === 'string' ? value : value?._id?.toString())?.slice(-8) || '—';
const badgeTone = (status) => ({ Draft: 'warning', Approved: 'info', Paid: 'success' }[status] || 'neutral');

export default function VendorLedgerPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'vendors:read');
  const canWrite = can(permissions, 'vendors:write');
  const canPayout = can(permissions, 'vendor-payouts:write');
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [month, setMonth] = useState(currentMonth);
  const [startDate, setStartDate] = useState(monthStart(currentMonth));
  const [endDate, setEndDate] = useState(monthEnd(currentMonth));
  const [ledger, setLedger] = useState(null);
  const [statements, setStatements] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paidAt, setPaidAt] = useState(today);
  const [receiverName, setReceiverName] = useState('');
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === vendorId),
    [vendors, vendorId],
  );

  useEffect(() => {
    if (!token || !canRead) return undefined;
    let active = true;
    setLoadingVendors(true);
    getVendors(token)
      .then(({ data }) => {
        if (!active) return;
        setVendors(data.vendors);
        setVendorId((current) => current || data.vendors[0]?.id || '');
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load vendors.',
      ))
      .finally(() => active && setLoadingVendors(false));
    return () => { active = false; };
  }, [canRead, token]);

  useEffect(() => {
    if (!token || !vendorId || !startDate || !endDate) {
      setLedger(null);
      setStatements([]);
      return undefined;
    }
    let active = true;
    setLoadingData(true);
    setError('');
    Promise.all([
      getVendorLedger(token, vendorId, { startDate, endDate }),
      getVendorStatements(token, vendorId),
    ])
      .then(([ledgerResponse, statementResponse]) => {
        if (!active) return;
        setLedger(ledgerResponse.data);
        setStatements(statementResponse.data.statements);
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load the vendor ledger.',
      ))
      .finally(() => active && setLoadingData(false));
    return () => { active = false; };
  }, [endDate, reload, startDate, token, vendorId]);

  function chooseMonth(value) {
    setMonth(value);
    if (value) {
      setStartDate(monthStart(value));
      setEndDate(monthEnd(value));
    }
  }

  async function createStatement() {
    if (!vendorId || !month) return;
    setBusyId('create');
    setError('');
    setNotice('');
    try {
      const { data } = await createVendorStatement(token, vendorId, {
        startDate: monthStart(month),
        endDate: monthEnd(month),
      });
      setNotice(`Statement ${data.statement.statementNumber} was created.`);
      setReload((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create the monthly statement.');
    } finally {
      setBusyId('');
    }
  }

  async function changeStatus(statement, payload) {
    setBusyId(statement._id);
    setError('');
    setNotice('');
    try {
      const { data } = await updateVendorStatement(token, statement._id, payload);
      setStatements((current) => current.map((item) => (
        item._id === statement._id ? data.statement : item
      )));
      setPaymentId('');
      setNotice(`Statement ${data.statement.statementNumber} is now ${data.statement.status}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update the statement.');
    } finally {
      setBusyId('');
    }
  }

  function submitPayment(event, statement) {
    event.preventDefault();
    changeStatus(statement, {
      status: 'Paid',
      paymentMethod,
      paymentReference: paymentReference.trim(),
      paidAt,
      receiverName: receiverName.trim(),
    });
  }

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading vendor ledger...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view vendor ledgers.</p>;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Vendors</p>
          <h1 className="text-2xl font-semibold text-slate-900">Vendor Ledger &amp; Earnings</h1>
          <p className="mt-1 text-sm text-slate-600">Review vendor sales, earnings, and monthly statements.</p>
        </div>
        <Button variant="secondary" onClick={() => setReload((value) => value + 1)} disabled={loadingData || !vendorId}>
          <RefreshCw size={16} /> Refresh
        </Button>
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

      <Card title="Ledger period" description="Choose a vendor and date range to review posted sales earnings.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Vendor" name="vendor" value={vendorId} onChange={(event) => setVendorId(event.target.value)} disabled={loadingVendors}>
            <option value="">Select a vendor</option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.shopName}</option>)}
          </Select>
          <Input label="Statement month" name="month" type="month" value={month} onChange={(event) => chooseMonth(event.target.value)} />
          <Input label="From" name="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input label="Through" name="endDate" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </div>
      </Card>

      {selectedVendor && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card title="Units sold"><p className="text-2xl font-semibold text-slate-900">{ledger?.totals?.sales ?? '—'}</p><p className="mt-1 text-xs text-slate-500">Sales in selected ledger period</p></Card>
          <Card title="Vendor earnings"><p className="text-2xl font-semibold text-slate-900">{money(ledger?.totals?.vendorPayable)}</p><p className="mt-1 text-xs text-slate-500">Payable at vendor-price snapshots</p></Card>
          <Card title="Company margin"><p className="text-2xl font-semibold text-slate-900">{money(ledger?.totals?.companyMargin)}</p><p className="mt-1 text-xs text-slate-500">Net margin from selected sales</p></Card>
        </div>
      )}

      <Card title="Sales ledger" description={selectedVendor ? `${selectedVendor.name} · ${startDate} to ${endDate}` : 'Select a vendor to view ledger entries.'}>
        {loadingData ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading ledger...</p> : (
          <div className="overflow-x-auto">
            <table className="ui-table min-w-[720px]">
              <thead><tr><th scope="col">Date</th><th scope="col">Order</th><th scope="col">Product</th><th scope="col">Units</th><th scope="col">Vendor payable</th><th scope="col">Company margin</th></tr></thead>
              <tbody>
                {(ledger?.entries || []).map((entry) => (
                  <tr key={entry._id}>
                    <td>{date(entry.createdAt)}</td><td>{shortId(entry.orderId)}</td><td>{shortId(entry.productId)}</td>
                    <td>{entry.quantity}</td><td>{money(entry.vendorPayable)}</td><td>{money(entry.companyNet)}</td>
                  </tr>
                ))}
                {!ledger?.entries?.length && <tr><td colSpan="6" className="table-empty">{selectedVendor ? 'No sales for this period.' : 'Select a vendor to view ledger entries.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Monthly statements"
        description="Statements preserve the period stock and vendor-price figures when generated."
        actions={canWrite && selectedVendor && month ? (
          <Button onClick={createStatement} disabled={busyId === 'create' || loadingData}>
            <FileText size={16} /> {busyId === 'create' ? 'Creating...' : 'Create statement'}
          </Button>
        ) : null}
      >
        {loadingData ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading statements...</p> : (
          <div className="overflow-x-auto">
            <table className="ui-table min-w-[940px]">
              <thead><tr><th scope="col">Statement</th><th scope="col">Period</th><th scope="col">Units (sales / returns)</th><th scope="col">Net payable</th><th scope="col">Status</th><th scope="col">Documents &amp; actions</th></tr></thead>
              <tbody>
                {statements.map((statement) => (
                  <tr key={statement._id}>
                    <td><strong>{statement.statementNumber}</strong></td>
                    <td>{date(statement.periodStart)} – {date(statement.periodEnd)}</td>
                    <td>{statement.sales} / {statement.returns}</td>
                    <td>{money(statement.netPayable)}</td>
                    <td><Badge tone={badgeTone(statement.status)}>{statement.status}</Badge></td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Link className="ui-button button-secondary button-sm" href={`/vendors/ledger/${vendorId}/${statement._id}/print`}><Printer size={14} /> Statement</Link>
                        {statement.status === 'Paid' && <Link className="ui-button button-secondary button-sm" href={`/vendors/ledger/${vendorId}/${statement._id}/receipt`}><Printer size={14} /> Receipt</Link>}
                        {canPayout && statement.status === 'Draft' && <Button size="sm" variant="secondary" disabled={busyId === statement._id} onClick={() => changeStatus(statement, { status: 'Approved' })}>Approve</Button>}
                        {canPayout && statement.status === 'Approved' && <Button size="sm" disabled={busyId === statement._id} onClick={() => setPaymentId(paymentId === statement._id ? '' : statement._id)}>Record payment</Button>}
                      </div>
                      {paymentId === statement._id && (
                        <form className="mt-3 grid min-w-[560px] gap-2 rounded border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2" onSubmit={(event) => submitPayment(event, statement)}>
                          <Select label="Payment method" name="paymentMethod" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                            {['Cash', 'Bank', 'bKash', 'Nagad'].map((method) => <option key={method}>{method}</option>)}
                          </Select>
                          <Input label="Payment reference" name="paymentReference" required maxLength={150} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
                          <Input label="Paid date" name="paidAt" type="date" required value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
                          <Input label="Received by" name="receiverName" required maxLength={150} value={receiverName} onChange={(event) => setReceiverName(event.target.value)} />
                          <div className="flex items-end gap-2 sm:col-span-2">
                            <Button type="submit" disabled={busyId === statement._id || !paymentReference.trim() || !receiverName.trim()}>Mark paid</Button>
                            <Button type="button" variant="secondary" onClick={() => setPaymentId('')}>Cancel</Button>
                          </div>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {!statements.length && <tr><td colSpan="6" className="table-empty">No statements found for this vendor.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
