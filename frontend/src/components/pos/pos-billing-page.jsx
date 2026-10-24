'use client';

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import useAuth from '@/store/use-auth';
import CartPanel from './cart-panel';
import BillSummary from './bill-summary';
import ItemScanner from './item-scanner';
import PaymentPanel from './payment-panel';
import { checkoutPosBill, posErrorMessage, previewPosBill } from '@/services/pos';
import {
  HeldBillsButton, HeldBillsModal, estimateTotal, useHeldSales,
} from './held-sales';
import HoldSaleModal from './hold-sale-modal';
import billingUtils from '@/services/pos-billing-utils.cjs';

const { createPreviewPayload, paymentTotalMatches } = billingUtils;
const WALLET_DISCOUNT_RATE = 0.05;

export default function PosBillingPage() {
  const {
    initialized, token, user, hasPermission,
  } = useAuth();
  const canRead = hasPermission('pos:read');
  const canWrite = hasPermission('pos:write');
  const canApprove = user?.role === 'Super Admin';
  const [items, setItems] = useState([]);
  const [billDiscount, setBillDiscount] = useState(null);
  const [methods, setMethods] = useState(['CASH']);
  const [amounts, setAmounts] = useState({});
  const [serverBill, setBill] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [discountApproved, setDiscountApproved] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [heldOpen, setHeldOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const { held, hold, remove: discardHeld } = useHeldSales();
  const latestPreview = useRef(0);
  const selectedMethods = methods.includes('WALLET') ? ['WALLET'] : methods;
  const walletSelected = selectedMethods.includes('WALLET');
  const singleMethod = selectedMethods.length === 1 ? selectedMethods[0] : null;
  const bill = useMemo(() => {
    if (!serverBill || !walletSelected) return serverBill;
    const walletDiscountAmount = Math.round((Number(serverBill.subtotal) * WALLET_DISCOUNT_RATE + Number.EPSILON) * 100) / 100;
    return {
      ...serverBill,
      walletDiscountAmount,
      grandTotal: Math.max(0, Math.round((serverBill.grandTotal - walletDiscountAmount + Number.EPSILON) * 100) / 100),
    };
  }, [serverBill, walletSelected]);

  let payload;
  let formError = '';
  try {
    payload = createPreviewPayload(items, billDiscount, selectedMethods);
  } catch (error) {
    payload = null;
    formError = error.message;
  }

  const previewKey = payload ? JSON.stringify(payload) : '';

  useEffect(() => {
    const requestId = ++latestPreview.current;
    let cancelled = false;
    if (!items.length || !payload) {
      setBill(null);
      setPreviewError('');
      setPreviewLoading(false);
      return () => { cancelled = true; };
    }
    setBill(null);
    setPreviewLoading(true);
    setPreviewError('');
    previewPosBill(payload).then(({ data }) => {
      if (!cancelled && requestId === latestPreview.current) setBill(data.bill);
    }).catch((error) => {
      if (!cancelled && requestId === latestPreview.current) setPreviewError(posErrorMessage(error));
    }).finally(() => {
      if (!cancelled && requestId === latestPreview.current) setPreviewLoading(false);
    });
    return () => { cancelled = true; };
  // previewKey captures all data that determines server pricing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, items.length]);

  useEffect(() => {
    if (singleMethod && singleMethod !== 'WALLET' && bill) {
      const total = bill.grandTotal.toFixed(2);
      setAmounts((current) => (current[singleMethod] === total
        ? current
        : { ...current, [singleMethod]: total }));
    }
  }, [bill, singleMethod]);

  const addItem = useCallback((product) => {
    setSuccessMessage('');
    setItems((current) => {
      const found = current.find((item) => item.productId === String(product.productId));
      if (found) {
        return current.map((item) => item.productId === found.productId
          ? { ...item, quantity: Number(item.quantity) + 1 }
          : item);
      }
      return [...current, {
        productId: String(product.productId),
        name: product.name,
        barcode: product.barcode,
        mrp: Number(product.mrp),
        quantity: 1,
        discount: null,
      }];
    });
  }, []);

  function updateQuantity(productId, quantity) {
    setItems((current) => current.map((item) => item.productId === productId ? { ...item, quantity } : item));
  }

  function updateItemDiscount(productId, patch) {
    setDiscountApproved(false);
    setItems((current) => current.map((item) => item.productId === productId
      ? { ...item, discount: { type: 'PERCENT', ...item.discount, ...patch } }
      : item));
  }

  function updateBillDiscount(patch) {
    setDiscountApproved(false);
    setBillDiscount((current) => ({ type: 'PERCENT', ...current, ...patch }));
  }

  function changeMethods(next) {
    setMethods(next);
    setDiscountApproved(false);
    setCheckoutError('');
  }

  function updateAmount(method, amount) {
    setAmounts((current) => ({ ...current, [method]: amount }));
  }

  async function checkout() {
    if (!bill || !payload || !canWrite || checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutError('');
    setSuccessMessage('');
    try {
      const payments = selectedMethods.map((method) => ({
        method,
        amount: method === 'WALLET' ? bill.grandTotal : Number(amounts[method]),
      }));
      const { data } = await checkoutPosBill({
        ...payload,
        payments,
        ...(discountApproved ? { discountApproved: true } : {}),
      });
      setSuccessMessage(`Sale completed${data.order?.orderNumber ? ` · ${data.order.orderNumber}` : ''}.`);
      setItems([]);
      setBillDiscount(null);
      setMethods(['CASH']);
      setAmounts({});
      setDiscountApproved(false);
      setBill(null);
    } catch (error) {
      if (error.response?.status === 409 && error.response.data?.sufficient === false) {
        setMethods(['CASH']);
        setAmounts({ CASH: Number(error.response.data.bill?.grandTotal || 0).toFixed(2) });
      }
      setCheckoutError(posErrorMessage(error));
    } finally {
      setCheckoutLoading(false);
    }
  }

  function resetCart() {
    setItems([]);
    setBillDiscount(null);
    setMethods(['CASH']);
    setAmounts({});
    setDiscountApproved(false);
    setBill(null);
    setCheckoutError('');
  }

  function holdSale() {
    if (!items.length) {
      setCheckoutError('Cart is empty. Add items before holding a sale.');
      return;
    }
    setHoldOpen(true);
  }

  function confirmHold(noteText) {
    const note = noteText.trim();
    setHoldOpen(false);
    hold({
      note,
      items,
      billDiscount,
      methods,
      amounts,
      itemCount: items.reduce((s, i) => s + Number(i.quantity || 0), 0),
      total: bill?.grandTotal ?? estimateTotal(items),
    });
    resetCart();
    setSuccessMessage(`Sale held${note ? ` · ${note}` : ''}.`);
  }

  function restoreSale(sale) {
    if (items.length) {
      if (!window.confirm('The current cart has items. OK = replace it with the held bill; Cancel = keep current cart.')) return;
    }
    resetCart();
    setItems(sale.items);
    setBillDiscount(sale.billDiscount || null);
    setMethods(sale.methods?.length ? sale.methods : ['CASH']);
    setAmounts(sale.amounts || {});
    discardHeld(sale.id);
    setHeldOpen(false);
    setSuccessMessage('Held bill restored.');
  }

  const paymentsMatch = bill && paymentTotalMatches(selectedMethods, amounts, bill.grandTotal);
  const approvalReady = !bill?.discountApprovalRequired || (canApprove && discountApproved);
  const canCheckout = canWrite && items.length > 0 && bill && !previewLoading && !previewError
    && !formError && !checkoutLoading && selectedMethods.length > 0
    && paymentsMatch && approvalReady;

  if (!initialized) return <p role="status" className="py-10 text-center">Loading your POS session...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded bg-red-50 p-4 text-red-800">You do not have permission to view the POS.</p>;
  if (!canWrite) return <p role="alert" className="rounded bg-red-50 p-4 text-red-800">You do not have permission to complete POS sales.</p>;

  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sales</p>
          <h1 className="text-2xl font-semibold text-slate-900">Point of Sale</h1>
          <p className="mt-1 text-sm text-slate-600">Scan items, apply permitted discounts, and complete a bill.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={holdSale} disabled={!items.length || checkoutLoading} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Hold Sale</button>
          <HeldBillsButton count={held.length} onClick={() => setHeldOpen(true)} />
        </div>
      </header>
      {holdOpen && <HoldSaleModal onConfirm={confirmHold} onCancel={() => setHoldOpen(false)} />}
      {heldOpen && <HeldBillsModal held={held} onRestore={restoreSale} onDiscard={discardHeld} onClose={() => setHeldOpen(false)} />}
      {successMessage && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{successMessage}</p>}
      {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
      <ItemScanner onAdd={addItem} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <CartPanel
            items={items}
            onQuantity={updateQuantity}
            onRemove={(id) => setItems((current) => current.filter((item) => item.productId !== id))}
            onDiscount={updateItemDiscount}
          />
          <PaymentPanel
            methods={selectedMethods}
            amounts={amounts}
            total={bill?.grandTotal || 0}
            onMethods={changeMethods}
            onAmount={updateAmount}
          />
        </div>
        <BillSummary
          bill={bill}
          billDiscount={billDiscount}
          onBillDiscount={updateBillDiscount}
          approvalRequired={Boolean(bill?.discountApprovalRequired)}
          canApprove={canApprove}
          discountApproved={discountApproved}
          onApprove={setDiscountApproved}
          previewLoading={previewLoading}
          previewError={previewError}
          onCheckout={checkout}
          checkoutLoading={checkoutLoading}
          checkoutError={checkoutError}
          canCheckout={Boolean(canCheckout)}
        />
      </div>
    </section>
  );
}
