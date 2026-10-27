'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, Select } from '@/components/ui';
import { getVendorPayouts } from '@/services/vendor';
import { formatDate, formatMoney, idString } from './vendor-payout-utils';
import { T } from '@/i18n/language-provider';
import useToastMessages from '@/hooks/use-toast-messages';

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
  useToastMessages({ error });

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

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500"><T>{"Loading payout history..."}</T></p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><T>{"You do not have permission to view payout history."}</T></p>;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500"><T>{"Vendors"}</T></p>
          <h1 className="text-2xl font-semibold text-slate-900"><T>{"Payout History"}</T></h1>
          <p className="mt-1 text-sm text-slate-600"><T>{"Review completed vendor settlements and payment references."}</T></p>
        </div>
        <div className="flex gap-2">
          <Link href="/vendors/payouts" className="ui-button button-secondary"><ArrowLeft size={16} /> <T>{"Settlement queue"}</T></Link>
          <Button variant="secondary" onClick={() => setReload((value) => value + 1)} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Paid statements"><p className="text-2xl font-semibold text-slate-900">{visiblePayouts.length}</p><p className="mt-1 text-xs text-slate-500"><T>{"Completed vendor payouts"}</T></p></Card>
        <Card title="Total paid"><p className="text-2xl font-semibold text-slate-900">{formatMoney(totalPaid)}</p><p className="mt-1 text-xs text-slate-500"><T>{"For the selected vendor"}</T></p></Card>
      </div>

      <Card title="Completed payouts" description="Payment details are read-only after a statement is marked Paid.">
        <div className="mb-4 max-w-md">
          <Select label="Vendor" name="vendorFilter" value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)}>
            <option value=""><T>{"All vendors"}</T></option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name} · {vendor.shopName}</option>)}
          </Select>
        </div>
        {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500"><T>{"Loading payout records..."}</T></p> : (
          <div className="overflow-x-auto">
            <table className="ui-table min-w-[1150px]">
              <thead><tr><th scope="col"><T>{"Vendor"}</T></th><th scope="col"><T>{"Statement & period"}</T></th><th scope="col"><T>{"Amount paid"}</T></th><th scope="col"><T>{"Payment details"}</T></th><th scope="col"><T>{"Received by"}</T></th><th scope="col"><T>{"Receipt"}</T></th></tr></thead>
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
                        {vendor && <Link className="ui-button button-secondary button-sm" href={`/vendors/ledger/${vendorId}/${payout._id}/receipt`}><Printer size={14} /> <T>{"Receipt"}</T></Link>}
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
