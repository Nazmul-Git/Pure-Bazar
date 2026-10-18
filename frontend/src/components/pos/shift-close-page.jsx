'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Badge, Button, Card, Input, Table } from '@/components/ui';
import useAuth from '@/store/use-auth';
import {
  closePosShift, getCurrentPosShift, getPosShiftReport, openPosShift,
} from '@/services/pos-admin';
import { paymentMethodLabel } from '@/services/pos-screen-utils.cjs';

const currency = new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' });
const amount = (value) => (value == null ? '—' : currency.format(Number(value) || 0));
const dateTime = (value) => (value ? new Date(value).toLocaleString() : '—');

function Report({ shift, report }) {
  const rows = (report?.paymentSummary || []).map((payment) => ({
    ...payment,
    id: payment.method,
    method: paymentMethodLabel(payment.method),
  }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><small className="text-slate-500">Opening cash</small><strong className="mt-1 block text-lg">{amount(shift.openingCash)}</strong></Card>
        <Card><small className="text-slate-500">Expected cash</small><strong className="mt-1 block text-lg">{amount(report.expectedCash)}</strong></Card>
        <Card><small className="text-slate-500">Cash difference</small><strong className="mt-1 block text-lg">{amount(report.cashDifference)}</strong></Card>
      </div>
      <Card title="Tender summary" description="Cash expected includes the opening float.">
        <Table
          columns={[
            { key: 'method', label: 'Payment method' },
            { key: 'expectedAmount', label: 'Expected', render: (value) => amount(value) },
            { key: 'actualAmount', label: 'Actual', render: (value) => amount(value) },
          ]}
          rows={rows}
          rowKey="id"
        />
      </Card>
    </div>
  );
}

export default function ShiftClosePage() {
  const { token, initialized, hasPermission } = useAuth();
  const { user } = useSelector((state) => state.auth);
  const canRead = hasPermission('pos:read');
  const canWrite = hasPermission('pos:write');
  const [shift, setShift] = useState(null);
  const [report, setReport] = useState(null);
  const [closedShift, setClosedShift] = useState(null);
  const [closedReport, setClosedReport] = useState(null);
  const [openingCash, setOpeningCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCurrent = useCallback(async () => {
    setError('');
    try {
      const { data } = await getCurrentPosShift();
      setShift(data.shift);
      setReport(data.report);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load the current shift.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (!token || !canRead) {
      setLoading(false);
      return;
    }
    loadCurrent();
  }, [canRead, initialized, loadCurrent, token]);

  async function handleOpen(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await openPosShift({ openingCash: Number(openingCash) });
      setShift(data.shift);
      setClosedShift(null);
      setClosedReport(null);
      setOpeningCash('');
      try {
        const reportResponse = await getPosShiftReport(data.shift._id);
        setReport(reportResponse.data.report);
        setNotice('Cashier shift opened.');
      } catch (reportError) {
        setError(`Shift opened, but its report could not be loaded: ${reportError.response?.data?.message || 'Please refresh the page.'}`);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to open the shift.');
    } finally {
      setSaving(false);
    }
  }

  async function handleClose(event) {
    event.preventDefault();
    if (!shift) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await closePosShift(shift._id, { actualCash: Number(actualCash) });
      setClosedShift(data.shift);
      setClosedReport(data.report);
      setShift(null);
      setReport(null);
      setActualCash('');
      setNotice('Shift closed. Review the final tender reconciliation below.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to close the shift.');
    } finally {
      setSaving(false);
    }
  }

  if (!canRead) return <section className="access-denied"><h1>Access denied</h1><p>Your role does not have POS read permission.</p></section>;

  const currentShift = shift || closedShift;
  const currentReport = shift ? report : closedReport;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="m-0 text-2xl font-semibold">Cashier Shift / Day Close</h1><p className="mb-0 mt-1 text-sm text-slate-500">Open your register, reconcile tenders, and close the shift.</p></div>
        {shift && <Badge tone="success">Shift open</Badge>}
        {closedShift && !shift && <Badge tone="neutral">Shift closed</Badge>}
      </header>
      {error && <p className="field-error" role="alert">{error}</p>}
      {notice && <p className="text-sm text-green-700" role="status">{notice}</p>}
      {loading ? <Card><p className="m-0 text-slate-500" role="status">Loading shift…</p></Card> : (
        <>
          {currentShift && currentReport && (
            <Card title={shift ? 'Current shift' : 'Last closed shift'} description={`${user?.name || 'Cashier'} · Opened ${dateTime(currentShift.openedAt)}${currentShift.closedAt ? ` · Closed ${dateTime(currentShift.closedAt)}` : ''}`}>
              <Report shift={currentShift} report={currentReport} />
            </Card>
          )}
          {!shift && (
            <Card title="Open shift" description="Enter the cash float counted into the drawer at opening.">
              {canWrite ? (
                <form className="flex max-w-md flex-wrap items-end gap-3" onSubmit={handleOpen}>
                  <Input className="min-w-56 flex-1" label="Opening cash (৳)" type="number" min="0" step="0.01" required value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} />
                  <Button type="submit" disabled={saving}>{saving ? 'Opening…' : 'Open shift'}</Button>
                </form>
              ) : <p className="m-0 text-sm text-slate-500">POS write permission is required to open a shift.</p>}
            </Card>
          )}
          {shift && (
            <Card title="Close shift" description="Count the cash drawer and compare it with expected cash before closing.">
              {canWrite ? (
                <form className="flex max-w-md flex-wrap items-end gap-3" onSubmit={handleClose}>
                  <Input className="min-w-56 flex-1" label="Actual cash counted (৳)" type="number" min="0" step="0.01" required value={actualCash} onChange={(event) => setActualCash(event.target.value)} />
                  <Button type="submit" disabled={saving}>{saving ? 'Closing…' : 'Close shift'}</Button>
                </form>
              ) : <p className="m-0 text-sm text-slate-500">POS write permission is required to close a shift.</p>}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
