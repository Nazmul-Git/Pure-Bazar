'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { getVendorOverview } from '@/services/vendor';
import { T } from '@/i18n/language-provider';
import VendorStatementInvoice from './vendor-statement-invoice';
import { money, qty } from './vendor-format';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);

function Field({ label, value }) {
  return <div><dt className="text-xs uppercase text-slate-500">{label}</dt><dd className="font-medium text-slate-800">{value || '—'}</dd></div>;
}

export default function VendorOverview() {
  const { vendorId } = useParams();
  const { token, user, initialized } = useSelector((state) => state.auth);
  const canRead = can(user?.permissions || [], 'vendors:read');
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialized || !token || !canRead || !vendorId) return undefined;
    if (range.startDate && range.endDate && range.startDate > range.endDate) {
      setError('Start date must not be after end date.');
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    getVendorOverview(token, vendorId, range)
      .then(({ data: body }) => active && setData(body))
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'Unable to load vendor details.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, initialized, range, token, vendorId]);

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500"><T>{"Loading vendor details..."}</T></p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><T>{"You do not have permission to view vendors."}</T></p>;

  const { vendor, products = [], summary } = data || {};
  const stats = summary && [
    ['Active products', summary.totalProducts],
    ['Available stock', qty(summary.totalAvailableStock)],
    ['Sold units', qty(summary.totalSoldUnits)],
    ['Payout due', money(summary.totalPayable)],
  ];

  return (
    <>
      <section className="print-actions space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/vendors/directory" className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase text-slate-500"><ArrowLeft size={14} /> <T>{"Vendor Directory"}</T></Link>
            <h1 className="text-2xl font-semibold text-slate-900">{vendor?.name || 'Vendor details'}</h1>
          </div>
          <Button onClick={() => window.print()} disabled={!data}><Printer size={16} /> <T>{"Print Statement / Generate Invoice"}</T></Button>
        </div>

        {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

        <Card title="Statement period" description="Leave blank for all-time sales and receipts. Stock is always current.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="From" type="date" name="startDate" value={range.startDate} onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))} />
            <Input label="To" type="date" name="endDate" value={range.endDate} onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))} />
          </div>
        </Card>

        {loading && <p role="status" className="py-8 text-center text-sm text-slate-500"><T>{"Loading vendor details..."}</T></p>}
        {data && (
          <>
            <Card title="Vendor information">
              <dl className="grid gap-3 sm:grid-cols-3">
                <Field label="Name" value={vendor.name} />
                <Field label="Member ID (Probashi)" value={vendor.memberId} />
                <Field label="Shop" value={vendor.shopName} />
                <Field label="Category" value={vendor.productCategory} />
                <Field label="Contact" value={[vendor.mobile, vendor.email].filter(Boolean).join(' · ')} />
                <Field label="Status" value={vendor.status} />
              </dl>
            </Card>
            <div className="grid gap-3 sm:grid-cols-4">
              {stats.map(([label, value]) => (
                <div key={label} className="rounded border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase text-slate-500">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            <Card title="Products" description={`${products.length} product${products.length === 1 ? '' : 's'} registered`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>{['Product', 'Received (GRN)', 'Warehouse', 'Outlets', 'Total stock', 'Sold', 'Unit price', 'Valuation'].map((h) => <th key={h} className="px-2 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {products.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center text-slate-500">No products registered for this vendor.</td></tr>}
                    {products.map((p) => (
                      <tr key={p.productId} className="border-t border-slate-100">
                        <td className="px-2 py-2 font-medium">{p.name}</td>
                        <td className="px-2 py-2">{qty(p.receivedQty)}</td>
                        <td className="px-2 py-2">{qty(p.warehouseStock)}</td>
                        <td className="px-2 py-2">{qty(p.outletStock)}</td>
                        <td className="px-2 py-2">{qty(p.currentStock)}</td>
                        <td className="px-2 py-2">{qty(p.soldQty)}</td>
                        <td className="px-2 py-2">{money(p.unitPrice)}</td>
                        <td className="px-2 py-2">{money(p.valuation)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </section>
      {data && <VendorStatementInvoice data={data} />}
    </>
  );
}
