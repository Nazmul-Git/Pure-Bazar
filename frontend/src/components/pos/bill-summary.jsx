'use client';

import { Percent, ReceiptText } from 'lucide-react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import { T } from '@/i18n/language-provider';

const money = (value) => (Number(value) || 0).toFixed(2);

export default function BillSummary({
  bill, billDiscount, onBillDiscount,
  approvalRequired, canApprove, discountApproved, onApprove, previewLoading, previewError,
  onCheckout, checkoutLoading, checkoutError, canCheckout,
}) {
  return (
    <aside className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900"><ReceiptText size={18} /> <T>{"Bill summary"}</T></h2>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-y-2 text-sm">
          <span className="text-slate-600"><T>{"Subtotal (MRP)"}</T></span>
          <span className="text-right">৳{money(bill?.subtotal)}</span>
          <span className="text-slate-600"><T>{"Other discounts"}</T></span>
          <span className="text-right text-red-700">− ৳{money(bill?.otherDiscountAmount)}</span>
          <span className="text-slate-600">          <T>{"Shareholder/Wallet discount (5%)"}</T></span>
                    <span className="text-right text-red-700">− ৳{money(bill?.shareholderDiscountAmount)}</span>
          <span className="text-slate-600"><T>{"VAT"}</T></span>
          <span className="text-right">৳{money(bill?.vatAmount)}</span>
          <strong className="border-t border-slate-200 pt-3 text-base"><T>{"Total due"}</T></strong>
          <strong className="border-t border-slate-200 pt-3 text-right text-lg">৳{money(bill?.grandTotal)}</strong>
        </div>
        {previewLoading && <p role="status" className="mt-3 text-xs text-slate-500"><T>{"Updating bill from server..."}</T></p>}
        {previewError && <p role="alert" className="mt-3 text-sm text-red-700">{previewError}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900"><T>{"Manual / other bill discount"}</T></h2>
          <Percent size={17} className="text-slate-500" />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Discretionary bill-level discounts only. The automatic shareholder discount is calculated separately.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Select label="Discount type" value={billDiscount?.type || 'PERCENT'} onChange={(event) => onBillDiscount({ type: event.target.value })}>
            <option value="PERCENT"><T>{"Percent"}</T></option>
            <option value="FIXED"><T>{"Fixed amount"}</T></option>
          </Select>
          <Input
            label={billDiscount?.type === 'FIXED' ? 'Amount (৳)' : 'Percent (%)'}
            type="number"
            min="0"
            step="0.01"
            value={billDiscount?.value ?? ''}
            onChange={(event) => onBillDiscount({ value: event.target.value })}
          />
        </div>
        <Input
          className="mt-3"
          label="Reason"
          value={billDiscount?.reason || ''}
          onChange={(event) => onBillDiscount({ reason: event.target.value })}
          placeholder="Required when discount is applied (not Shareholder)"
          maxLength={300}
        />
      </section>

      {approvalRequired && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p role="alert" className="text-sm text-amber-900">
            This discount exceeds the role limit. A Super Admin must approve it before checkout.
          </p>
          {canApprove && (
            <label className="mt-2 flex items-start gap-2 text-sm text-amber-950">
              <input type="checkbox" checked={discountApproved} onChange={(event) => onApprove(event.target.checked)} />
              I approve this above-limit discount as Super Admin
            </label>
          )}
        </section>
      )}
      {checkoutError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{checkoutError}</p>}
      <Button className="w-full py-3" disabled={!canCheckout || checkoutLoading} onClick={onCheckout}>
        {checkoutLoading ? 'Completing sale...' : `Complete sale · ৳${money(bill?.grandTotal)}`}
      </Button>
    </aside>
  );
}
