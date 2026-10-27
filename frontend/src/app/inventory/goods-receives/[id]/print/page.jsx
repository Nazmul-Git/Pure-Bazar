'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { ArrowLeft, Printer } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import { getPrintableGoodsReceive } from '@/services/stock';
import { T } from '@/i18n/language-provider';

const formatDate = (value) => new Intl.DateTimeFormat('en-BD', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export default function PrintableGoodsReceivePage() {
  const { id } = useParams();
  const { token, user, initialized } = useSelector((state) => state.auth);
  const canRead = user?.permissions?.includes('*') || user?.permissions?.includes('stock:read');
  const [receive, setReceive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialized) return undefined;
    if (!token || !canRead) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    getPrintableGoodsReceive(token, id)
      .then((response) => active && setReceive(response.data.goodsReceive))
      .catch((requestError) => active && setError(
        requestError.response?.data?.message || 'Unable to load this GRN.',
      ))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canRead, id, initialized, token]);

  if (!initialized || loading) return <p role="status" className="py-10 text-center text-sm text-slate-500"><T>{"Loading printable GRN..."}</T></p>;
  if (!token || !canRead) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><T>{"You do not have permission to view goods receives."}</T></p>;
  if (error || !receive) return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error || 'Goods receive not found.'}</p>;

  return (
    <section className="mx-auto max-w-4xl space-y-5 print-document">
      <div className="print-actions flex flex-wrap items-center justify-between gap-3">
        <Link href="/inventory/goods-receives" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to Goods Receive
        </Link>
        <Button onClick={() => window.print()}><Printer size={16} /> <T>{"Print GRN"}</T></Button>
      </div>
      <Card>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500"><T>{"PureBazar · Goods Receive Note"}</T></p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900"><T>{"Central Warehouse"}</T></h1>
            <p className="mt-1 text-sm text-slate-500">GRN {receive.id}</p>
          </div>
          <Badge tone={receive.status === 'Approved' ? 'success' : receive.status === 'Rejected' ? 'danger' : 'warning'}>{receive.status}</Badge>
        </div>
        <dl className="mb-6 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500"><T>{"Vendor"}</T></dt><dd className="mt-1 font-semibold text-slate-800">{receive.vendor?.name || '—'}</dd></div>
          <div><dt className="text-slate-500"><T>{"Shop"}</T></dt><dd className="mt-1 font-semibold text-slate-800">{receive.vendor?.shopName || '—'}</dd></div>
          <div><dt className="text-slate-500"><T>{"Vendor challan"}</T></dt><dd className="mt-1 font-semibold text-slate-800">{receive.vendorChallanNumber || '—'}</dd></div>
          <div><dt className="text-slate-500"><T>{"Received on"}</T></dt><dd className="mt-1 font-semibold text-slate-800">{formatDate(receive.createdAt)}</dd></div>
        </dl>
        <div className="overflow-x-auto">
          <table className="ui-table min-w-[620px]">
            <thead><tr><th scope="col"><T>{"Product"}</T></th><th scope="col"><T>{"Barcode"}</T></th><th scope="col"><T>{"Received"}</T></th><th scope="col"><T>{"Accepted"}</T></th><th scope="col"><T>{"Rejected"}</T></th></tr></thead>
            <tbody>
              {receive.lines.map((line) => (
                <tr key={line.productId}>
                  <td>{line.productName}</td><td>{line.barcode}</td><td>{line.receivedQuantity}</td>
                  <td>{line.acceptedQuantity}</td><td>{line.rejectedQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-right text-xs text-slate-500"><T>{"Generated from PureBazar inventory records."}</T></p>
      </Card>
    </section>
  );
}
