'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, Select } from '@/components/ui';
import { getVendorPayouts } from '@/services/vendor';
import { formatDate, formatMoney, idString } from './vendor-payout-utils';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);

export default function VendorPayoutHistoryPage() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const canRead = can(user?.permissions || [], 'vendor-payouts:read');
  const [vendors, setVendors] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [vendorFilter, setVendorFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !canRead) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    getVendorPayouts(token)
      .then(({ data }) => {
        if (!active) return;
        setPayouts(data.payouts);
        const vendorOptions = new Map(data.payouts.map((payout) => {
          const vendor = payout.vendorId;
          const id = idString(vendor);
          return [id, {
            id,
            name: typeof vendor === 'object' ? vendor.name : '',
            shopName: typeof vendor === 'object' ? vendor.shopName : '',
          }];
        }));
        setVendors([...vendorOptions.values()]);
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load payout history.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, reload, token]);

  const vendorById = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor])), [vendors]);
  const visiblePayouts = payouts.filter((payout) => (
    !vendorFilter || idString(payout.vendorId) === vendorFilter
  ));
  const totalPaid = visiblePayouts.reduce(
    (total, payout) => total + Math.round((Number(payout.netPayable) + Number.EPSILON) * 100),
    0,
  ) / 100;

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading payout history...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to view payout history.</p>;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Vendors</p>
          <h1 className="text-2xl font-semibold text-slate-900">Payout History</h1>
          <p className="mt-1 text-sm text-slate-600">Review completed vendor settlements and payment references.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/vendors/payouts" className="ui-button button-secondary"><ArrowLeft size={16} /> Settlement queue</Link>
          <Button variant="secondary" onClick={() => setReload((value) => value + 1)} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
      </div>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Paid statements"><p className="text-2xl font-semibold text-slate-900">{visiblePayouts.length}</p><p className="mt-1 text-xs text-slate-500">Completed vendor payouts</p></Card>
        <Card title="Total paid"><p className="text-2xl font-semibold text-slate-900">{formatMoney(totalPaid)}</p><p className="mt-1 text-xs text-slate-500">For the selected vendor</p></Card>
      </div>

      <Card title="Completed payouts" description="Payment details are read-only after a statement is marked Paid.">
        <div className="mb-4 max-w-md">
          <Select label="Vendor" name="vendorFilter" value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)}>
            <option value="">All vendors</option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.shopName}</option>)}
          </Select>
        </div>
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading payout records...</p> : (
          <div className="overflow-x-auto">
            <table className="ui-table min-w-[1150px]">
              <thead><tr><th scope="col">Vendor</th><th scope="col">Statement &amp; period</th><th scope="col">Amount paid</th><th scope="col">Payment details</th><th scope="col">Received by</th><th scope="col">Receipt</th></tr></thead>
              <tbody>
                {visiblePayouts.map((payout) => {
                  const vendorId = idString(payout.vendorId);
                  const vendor = vendorById.get(vendorId);
                  return (
                    <tr key={payout._id}>
                      <td><strong className="block text-slate-800">{vendor?.name || 'Vendor'}</strong><small className="text-slate-500">{vendor?.shopName || vendorId.slice(-8)}</small></td>
                      <td><strong className="block">{payout.statementNumber}</strong><small className="text-slate-500">{formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)}</small></td>
                      <td><strong>{formatMoney(payout.netPayable)}</strong><small className="mt-1 block text-slate-500">Paid {formatDate(payout.paidAt)}</small></td>
                      <td><strong className="block">{payout.paymentMethod}</strong><small className="text-slate-500">Ref: {payout.paymentReference}</small></td>
                      <td>{payout.receiverName || '—'}</td>
                      <td>
                        {vendor && <Link className="ui-button button-secondary button-sm" href={`/vendors/ledger/${vendorId}/${payout._id}/receipt`}><Printer size={14} /> Receipt</Link>}
                        <Badge tone="success" className="ml-2">Paid</Badge>
                      </td>
                    </tr>
                  );
                })}
                {!visiblePayouts.length && <tr><td colSpan="6" className="table-empty">{payouts.length ? 'No paid statements for this vendor.' : 'No completed vendor payouts yet.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
