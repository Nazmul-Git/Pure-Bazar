'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { ArrowLeft, Printer } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import { getVendorStatements, getVendors } from '@/services/vendor';
import { T } from '@/i18n/language-provider';

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);
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
const qty = (value) => Math.round(((Number(value) || 0) + Number.EPSILON) * 1000) / 1000;
const tone = (status) => ({ Draft: 'warning', Approved: 'info', Paid: 'success' }[status] || 'neutral');

export default function VendorStatementDocument({ receipt = false }) {
  const { vendorId, statementId } = useParams();
  const { token, user, initialized } = useSelector((state) => state.auth);
  const canRead = can(user?.permissions || [], 'vendors:read');
  const [vendor, setVendor] = useState(null);
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialized || !token || !canRead || !vendorId || !statementId) return undefined;
    let active = true;
    Promise.all([getVendors(token), getVendorStatements(token, vendorId)])
      .then(([vendorResponse, statementResponse]) => {
        if (!active) return;
        setVendor(vendorResponse.data.vendors.find((item) => item.id === vendorId) || null);
        setStatement(statementResponse.data.statements.find((item) => item._id === statementId) || null);
      })
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load this vendor statement.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, initialized, statementId, token, vendorId]);

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500"><T>{"Loading printable document..."}</T></p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><T>{"You do not have permission to view vendor statements."}</T></p>;
  if (error || !vendor || !statement || (receipt && statement.status !== 'Paid')) {
    const message = error || (!vendor ? 'Vendor not found.' : !statement ? 'Statement not found.' : 'A payment receipt is available only for paid statements.');
    return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p>;
  }

  return (
    <section className="print-document mx-auto max-w-4xl space-y-5">
      <div className="print-actions flex flex-wrap items-center justify-between gap-3">
        <Link href="/vendors/ledger" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to Vendor Ledger
        </Link>
        <Button onClick={() => window.print()}><Printer size={16} /> Print {receipt ? 'Receipt' : 'Statement'}</Button>
      </div>
      <Card>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">PureBazar · Vendor {receipt ? 'Payment Receipt' : 'Monthly Statement'}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{receipt ? 'Payment Receipt' : 'Vendor Statement'}</h1>
            <p className="mt-1 text-sm text-slate-500">{statement.statementNumber}</p>
          </div>
          {!receipt && <Badge tone={tone(statement.status)}>{statement.status}</Badge>}
        </div>

        <dl className="mb-6 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500"><T>{"Vendor"}</T></dt><dd className="mt-1 font-semibold text-slate-800">{vendor.name}</dd></div>
          <div><dt className="text-slate-500"><T>{"Shop"}</T></dt><dd className="mt-1 font-semibold text-slate-800">{vendor.shopName}</dd></div>
          <div><dt className="text-slate-500"><T>{"Member ID"}</T></dt><dd className="mt-1 font-semibold text-slate-800">{vendor.memberId}</dd></div>
          <div><dt className="text-slate-500"><T>{"Statement period"}</T></dt><dd className="mt-1 font-semibold text-slate-800">{date(statement.periodStart)} – {date(statement.periodEnd)}</dd></div>
          {receipt && (
            <>
              <div><dt className="text-slate-500"><T>{"Payment date"}</T></dt><dd className="mt-1 font-semibold text-slate-800">{date(statement.paidAt)}</dd></div>
              <div><dt className="text-slate-500"><T>{"Payment method"}</T></dt><dd className="mt-1 font-semibold text-slate-800">{statement.paymentMethod}</dd></div>
              <div><dt className="text-slate-500"><T>{"Payment reference"}</T></dt><dd className="mt-1 font-semibold text-slate-800">{statement.paymentReference}</dd></div>
              {statement.settlementRef && <div><dt className="text-slate-500"><T>{"Settlement reference"}</T></dt><dd className="mt-1 font-semibold text-slate-800">{statement.settlementRef}</dd></div>}
            </>
          )}
        </dl>

        {!receipt ? (
          <div className="overflow-x-auto">
            <table className="ui-table min-w-0">
              <thead><tr><th scope="col"><T>{"Monthly stock & earnings summary"}</T></th><th scope="col" className="text-right"><T>{"Units / amount"}</T></th></tr></thead>
              <tbody>
                <tr><td><T>{"Opening stock"}</T></td><td className="text-right">{qty(statement.openingStock)}</td></tr>
                <tr><td><T>{"Receipts"}</T></td><td className="text-right">{qty(statement.receipts)}</td></tr>
                <tr><td><T>{"Sales"}</T></td><td className="text-right">{qty(statement.sales)}</td></tr>
                <tr><td><T>{"Returns"}</T></td><td className="text-right">{qty(statement.returns)}</td></tr>
                <tr><td><T>{"Closing stock"}</T></td><td className="text-right">{qty(statement.closingStock)}</td></tr>
                <tr><td><T>{"Sales value at vendor price"}</T></td><td className="text-right">{money(statement.salesValueAtVendorPrice)}</td></tr>
                <tr><td><strong><T>{"Net payable"}</T></strong></td><td className="text-right"><strong>{money(statement.netPayable)}</strong></td></tr>
              </tbody>
            </table>
            {statement.products?.length > 0 && (
              <table className="ui-table mt-6 min-w-0">
                <thead>
                  <tr>
                    <th scope="col"><T>{"Product"}</T></th>
                    <th scope="col" className="text-right"><T>{"Opening"}</T></th>
                    <th scope="col" className="text-right"><T>{"Receipts"}</T></th>
                    <th scope="col" className="text-right"><T>{"Sales"}</T></th>
                    <th scope="col" className="text-right"><T>{"Closing"}</T></th>
                    <th scope="col" className="text-right"><T>{"Sales value"}</T></th>
                    <th scope="col" className="text-right"><T>{"Stock value"}</T></th>
                  </tr>
                </thead>
                <tbody>
                  {statement.products.map((line) => (
                    <tr key={line.productId}>
                      <td>{line.name}</td>
                      <td className="text-right">{qty(line.openingStock)}</td>
                      <td className="text-right">{qty(line.receipts)}</td>
                      <td className="text-right">{qty(line.sales)}</td>
                      <td className="text-right">{qty(line.closingStock)}</td>
                      <td className="text-right">{money(line.salesValueAtVendorPrice)}</td>
                      <td className="text-right">{money(line.closingStockValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="rounded border border-slate-200 p-5">
            <p className="text-sm text-slate-500"><T>{"Amount received"}</T></p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{money(statement.netPayable)}</p>
            <p className="mt-3 text-sm text-slate-600">Payment recorded against statement {statement.statementNumber}.</p>
          </div>
        )}
        <p className="mt-6 text-right text-xs text-slate-500"><T>{"Generated from PureBazar vendor statement records."}</T></p>
      </Card>
    </section>
  );
}
