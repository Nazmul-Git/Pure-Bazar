'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { History, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, Input, Select } from '@/components/ui';
import { getVendorStatements, getVendors, updateVendorStatement } from '@/services/vendor';
import {
  filterPayoutRows,
  formatDate,
  formatMoney,
  localDateInput,
  makePaymentPayload,
} from './vendor-payout-utils';
import { T } from '@/i18n/language-provider';
import useToastMessages from '@/hooks/use-toast-messages';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
const badgeTone = (status) => ({ Draft: 'warning', Approved: 'info' }[status] || 'neutral');

export default function VendorPayoutsPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const canRead = can(permissions, 'vendors:read');
  const canWrite = can(permissions, 'vendor-payouts:write');
  const [vendors, setVendors] = useState([]);
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [payment, setPayment] = useState({
    paymentMethod: 'Cash',
    paymentReference: '',
    paidAt: localDateInput(),
    receiverName: '',
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useToastMessages({ success: notice, error });

  useEffect(() => {
    if (!token || !canRead) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    Promise.resolve()
      .then(() => getVendors(token))
      .then(async ({ data }) => {
        const vendorRows = data.vendors;
        const statementGroups = await Promise.all(vendorRows.map(async (vendor) => {
          const response = await getVendorStatements(token, vendor.id);
          return response.data.statements.map((statement) => ({ ...statement, vendor }));
        }));
        if (active) {
          setVendors(vendorRows);
          setRows(statementGroups.flat().filter((row) => row.status !== 'Paid'));
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load vendor settlements.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, reload, token]);

  const filteredRows = useMemo(
    () => filterPayoutRows(rows, statusFilter, vendorFilter),
    [rows, statusFilter, vendorFilter],
  );
  const approvedPayable = rows
    .filter((row) => row.status === 'Approved')
    .reduce((total, row) => total + Math.round((Number(row.netPayable) + Number.EPSILON) * 100), 0) / 100;

  async function changeStatus(statement, payload) {
    setBusyId(statement._id);
    setError('');
    setNotice('');
    try {
      const { data } = await updateVendorStatement(token, statement._id, payload);
      if (data.statement.status === 'Paid') {
        setRows((current) => current.filter((row) => row._id !== statement._id));
        setPaymentId('');
      } else {
        setRows((current) => current.map((row) => (
          row._id === statement._id ? { ...row, ...data.statement } : row
        )));
      }
      setNotice(`${data.statement.statementNumber} is now ${data.statement.status}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update the vendor settlement.');
    } finally {
      setBusyId('');
    }
  }

  function submitPayment(event, statement) {
    event.preventDefault();
    changeStatus(statement, makePaymentPayload(payment));
  }

  function togglePayment(statement) {
    setPaymentId((current) => (current === statement._id ? '' : statement._id));
    setPayment({
      paymentMethod: 'Cash',
      paymentReference: '',
      paidAt: localDateInput(),
      receiverName: '',
    });
  }

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500"><T>{"Loading vendor settlements..."}</T></p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><T>{"You do not have permission to view vendor settlements."}</T></p>;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500"><T>{"Vendors"}</T></p>
          <h1 className="text-2xl font-semibold text-slate-900"><T>{"Vendor Settlement & Payout"}</T></h1>
          <p className="mt-1 text-sm text-slate-600"><T>{"Review statements, approve settlements, and record vendor payments."}</T></p>
        </div>
        <div className="flex gap-2">
          <Link href="/vendors/payouts/history" className="ui-button button-secondary"><History size={16} /> <T>{"Payout history"}</T></Link>
          <Button variant="secondary" onClick={() => setReload((value) => value + 1)} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
      </div>


      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Open statements"><p className="text-2xl font-semibold text-slate-900">{rows.length}</p><p className="mt-1 text-xs text-slate-500"><T>{"Draft and approved statements"}</T></p></Card>
        <Card title="Awaiting approval"><p className="text-2xl font-semibold text-slate-900">{rows.filter((row) => row.status === 'Draft').length}</p><p className="mt-1 text-xs text-slate-500"><T>{"Draft statements"}</T></p></Card>
        <Card title="Approved to pay"><p className="text-2xl font-semibold text-slate-900">{formatMoney(approvedPayable)}</p><p className="mt-1 text-xs text-slate-500"><T>{"Total approved payable"}</T></p></Card>
      </div>

      <Card title="Settlement queue" description="Only Draft and Approved statements appear here. Paid statements are available in payout history.">
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Select label="Vendor" name="vendorFilter" value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)}>
            <option value=""><T>{"All vendors"}</T></option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.shopName}</option>)}
          </Select>
          <Select label="Status" name="statusFilter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value=""><T>{"All open statuses"}</T></option>
            <option value="Draft"><T>{"Draft"}</T></option>
            <option value="Approved"><T>{"Approved"}</T></option>
          </Select>
        </div>
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500"><T>{"Loading settlement queue..."}</T></p> : (
          <div className="overflow-x-auto">
            <table className="ui-table min-w-0">
              <thead><tr><th scope="col"><T>{"Vendor"}</T></th><th scope="col"><T>{"Statement & period"}</T></th><th scope="col"><T>{"Units (sales / returns)"}</T></th><th scope="col"><T>{"Net payable"}</T></th><th scope="col"><T>{"Status"}</T></th><th scope="col"><T>{"Actions"}</T></th></tr></thead>
              <tbody>
                {filteredRows.map((statement) => (
                  <tr key={statement._id}>
                    <td><strong className="block text-slate-800">{statement.vendor.name}</strong><small className="text-slate-500">{statement.vendor.shopName}</small></td>
                    <td><strong className="block">{statement.statementNumber}</strong><small className="text-slate-500">{formatDate(statement.periodStart)} – {formatDate(statement.periodEnd)}</small></td>
                    <td>{statement.sales} / {statement.returns}</td>
                    <td className="font-semibold">{formatMoney(statement.netPayable)}</td>
                    <td><Badge tone={badgeTone(statement.status)}>{statement.status}</Badge></td>
                    <td>
                      {canWrite && statement.status === 'Draft' && (
                        <Button size="sm" variant="secondary" disabled={busyId === statement._id} onClick={() => changeStatus(statement, { status: 'Approved' })}>
                          {busyId === statement._id ? 'Approving...' : 'Approve'}
                        </Button>
                      )}
                      {canWrite && statement.status === 'Approved' && (
                        <Button size="sm" disabled={busyId === statement._id} onClick={() => togglePayment(statement)}>
                          Record payment
                        </Button>
                      )}
                      {!canWrite && <span className="text-sm text-slate-500"><T>{"Read only"}</T></span>}
                      {paymentId === statement._id && (
                        <form className="mt-3 grid min-w-0 gap-2 rounded border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2" onSubmit={(event) => submitPayment(event, statement)}>
                          <Select label="Payment method" name="paymentMethod" value={payment.paymentMethod} onChange={(event) => setPayment((current) => ({ ...current, paymentMethod: event.target.value }))}>
                            {['Cash', 'Bank', 'bKash', 'Nagad'].map((method) => <option key={method}>{method}</option>)}
                          </Select>
                          <Input label="Payment reference" name="paymentReference" required maxLength={150} value={payment.paymentReference} onChange={(event) => setPayment((current) => ({ ...current, paymentReference: event.target.value }))} />
                          <Input label="Paid date" name="paidAt" type="date" required value={payment.paidAt} onChange={(event) => setPayment((current) => ({ ...current, paidAt: event.target.value }))} />
                          <Input label="Received by" name="receiverName" required maxLength={150} value={payment.receiverName} onChange={(event) => setPayment((current) => ({ ...current, receiverName: event.target.value }))} />
                          <div className="flex items-end gap-2 sm:col-span-2">
                            <Button type="submit" disabled={busyId === statement._id || !payment.paymentReference.trim() || !payment.receiverName.trim()}>
                              {busyId === statement._id ? 'Saving...' : 'Mark Paid'}
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => setPaymentId('')}>Cancel</Button>
                          </div>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {!filteredRows.length && <tr><td colSpan="6" className="table-empty">{rows.length ? 'No statements match these filters.' : 'No open vendor settlements.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
