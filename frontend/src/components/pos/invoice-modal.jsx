'use client';

import { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { getCode39Runs } from '@/services/code39.cjs';
import './xprinter-print.css';

const money = (value) => (Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2);

function OrderBarcode({ value }) {
  let runs;
  try {
    runs = getCode39Runs(value);
  } catch {
    return null;
  }
  const total = runs.reduce((sum, run) => sum + run.width, 0);
  let x = 0;
  return (
    <svg className="receipt-barcode" viewBox={`0 0 ${total} 30`} preserveAspectRatio="none" role="img" aria-label={`Order barcode ${value}`}>
      {runs.map((run, index) => {
        const bar = run.bar && <rect key={index} x={x} y={0} width={run.width} height={30} fill="#000" />;
        x += run.width;
        return bar;
      })}
    </svg>
  );
}

function Receipt({ receipt }) {
  const payments = receipt.payments || [];
  return (
    <div className="receipt-sheet">
      <div className="receipt-center">
        <div className="receipt-logo">PB</div>
        <strong className="receipt-title">PureBazar</strong>
        <div>{new Date(receipt.soldAt || Date.now()).toLocaleString()}</div>
        <div>Invoice: {receipt.orderNumber}</div>
      </div>
      <hr />
      <table className="receipt-table">
        <thead><tr><th>Item</th><th className="r">Qty</th><th className="r">Price</th><th className="r">Total</th></tr></thead>
        <tbody>
          {receipt.lines.map((line, index) => (
            <tr key={`${line.barcode}-${index}`}>
              <td>{line.productName}</td>
              <td className="r">{line.quantity}</td>
              <td className="r">{money(line.mrp)}</td>
              <td className="r">{money(line.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr />
      <div className="receipt-row"><span>Subtotal</span><span>{money(receipt.subtotal)}</span></div>
      {Number(receipt.otherDiscountAmount) > 0 && <div className="receipt-row"><span>Discount</span><span>-{money(receipt.otherDiscountAmount)}</span></div>}
      {Number(receipt.shareholderDiscountAmount) > 0 && <div className="receipt-row"><span>Member discount</span><span>-{money(receipt.shareholderDiscountAmount)}</span></div>}
      {Number(receipt.vatAmount) > 0 && <div className="receipt-row"><span>VAT</span><span>{money(receipt.vatAmount)}</span></div>}
      <div className="receipt-row receipt-grand"><span>TOTAL (BDT)</span><span>{money(receipt.grandTotal)}</span></div>
      {payments.map((payment) => (
        <div key={payment.method} className="receipt-row"><span>{payment.method}</span><span>{money(payment.amount)}</span></div>
      ))}
      <div className="receipt-center receipt-barcode-wrap">
        <OrderBarcode value={receipt.orderNumber} />
        <div>{receipt.orderNumber}</div>
        <div>Thank you for shopping!</div>
      </div>
    </div>
  );
}

export default function InvoiceModal({ receipt, onClose }) {
  const [width, setWidth] = useState('80mm');

  useEffect(() => {
    document.body.dataset.printMode = `receipt-${width}`;
    return () => { delete document.body.dataset.printMode; };
  }, [width]);

  function printReceipt() {
    window.print();
  }

  const pageSize = `${width} auto`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 print:static print:bg-transparent print:p-0" role="dialog" aria-modal="true" aria-label="Invoice">
      <style>{`@media print { @page { size: ${pageSize}; margin: 0; } }`}</style>
      <div className="flex max-h-full w-full max-w-md flex-col rounded-xl bg-white shadow-xl print:max-h-none print:max-w-none print:shadow-none">
        <div className="print-actions flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Invoice · {receipt.orderNumber}</h2>
          <button type="button" onClick={onClose} aria-label="Close invoice" className="rounded p-1 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="print-actions flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm">
            <select aria-label="Paper width" value={width} onChange={(event) => setWidth(event.target.value)} className="rounded border border-slate-300 px-2 py-1">
              <option value="80mm">80mm</option>
              <option value="58mm">58mm</option>
            </select>
        </div>
        <div className="overflow-auto bg-slate-100 p-4 print:overflow-visible print:bg-white print:p-0">
          <div id="pos-print-area" className="mx-auto bg-white p-2">
            <Receipt receipt={receipt} />
          </div>
        </div>
        <div className="print-actions flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" onClick={printReceipt} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"><Printer size={15} /> Print Receipt</button>
        </div>
      </div>
    </div>
  );
}
