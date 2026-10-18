'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useAuth from '@/store/use-auth';
import Button from '@/components/ui/button';
import CartPanel from './cart-panel';
import BillSummary from './bill-summary';
import ItemScanner from './item-scanner';
import PaymentPanel from './payment-panel';
import ShareholderModal from './shareholder-modal';
import {
  checkPosWalletBalance, checkoutPosBill, posErrorMessage, previewPosBill,
} from '@/services/pos';
import billingUtils from '@/services/pos-billing-utils.cjs';

const { createPreviewPayload, paymentTotalMatches } = billingUtils;

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
  const [shareholder, setShareholder] = useState(null);
  const [shareholderOpen, setShareholderOpen] = useState(false);
  const [bill, setBill] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [discountApproved, setDiscountApproved] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [walletStatus, setWalletStatus] = useState('idle');
  const [walletRetry, setWalletRetry] = useState(0);
  const latestPreview = useRef(0);
  const selectedMethods = methods.includes('WALLET') ? ['WALLET'] : methods;
  const walletSelected = selectedMethods.includes('WALLET');
  const singleMethod = selectedMethods.length === 1 ? selectedMethods[0] : null;

  let payload;
  let formError = '';
  try {
    payload = createPreviewPayload(items, billDiscount, selectedMethods, shareholder);
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

  useEffect(() => {
    let cancelled = false;
    if (!walletSelected || !shareholder || !bill || previewLoading) {
      setWalletStatus('idle');
      return () => { cancelled = true; };
    }
    if (!shareholder.walletEnabled) {
      setWalletStatus('ineligible');
      return () => { cancelled = true; };
    }
    setWalletStatus('checking');
    checkPosWalletBalance({ memberId: shareholder.memberId, amount: bill.grandTotal })
      .then(({ data }) => {
        if (!cancelled) setWalletStatus(data.sufficient ? 'sufficient' : 'insufficient');
      })
      .catch(() => {
        if (!cancelled) setWalletStatus('error');
      });
    return () => { cancelled = true; };
  }, [walletSelected, shareholder, bill, previewLoading, walletRetry]);

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
      setShareholder(null);
      setDiscountApproved(false);
      setBill(null);
    } catch (error) {
      if (error.response?.status === 409 && error.response.data?.sufficient === false) {
        setMethods(['CASH']);
        setShareholder(null);
        setAmounts({ CASH: Number(error.response.data.bill?.grandTotal || 0).toFixed(2) });
      }
      setCheckoutError(posErrorMessage(error));
    } finally {
      setCheckoutLoading(false);
    }
  }

  const paymentsMatch = bill && paymentTotalMatches(selectedMethods, amounts, bill.grandTotal);
  const walletReady = !selectedMethods.includes('WALLET')
    || (shareholder?.verified && shareholder?.active && shareholder?.walletEnabled && walletStatus === 'sufficient');
  const approvalReady = !bill?.discountApprovalRequired || (canApprove && discountApproved);
  const canCheckout = canWrite && items.length > 0 && bill && !previewLoading && !previewError
    && !formError && !checkoutLoading && selectedMethods.length > 0
    && paymentsMatch && walletReady && approvalReady;

  if (!initialized) return <p role="status" className="py-10 text-center">Loading your POS session...</p>;
  if (!token || !canRead) return <p role="alert" className="rounded bg-red-50 p-4 text-red-800">You do not have permission to view the POS.</p>;
  if (!canWrite) return <p role="alert" className="rounded bg-red-50 p-4 text-red-800">You do not have permission to complete POS sales.</p>;

  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sales</p>
        <h1 className="text-2xl font-semibold text-slate-900">Point of Sale</h1>
        <p className="mt-1 text-sm text-slate-600">Scan items, apply permitted discounts, and complete a bill.</p>
      </header>
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
            shareholder={shareholder}
            walletStatus={walletStatus}
            onMethods={changeMethods}
            onAmount={updateAmount}
            onWalletRetry={() => setWalletRetry((current) => current + 1)}
          />
        </div>
        <BillSummary
          bill={bill}
          billDiscount={billDiscount}
          onBillDiscount={updateBillDiscount}
          shareholder={shareholder}
          onChooseShareholder={() => setShareholderOpen(true)}
          onRemoveShareholder={() => setShareholder(null)}
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
      {walletStatus === 'error' && selectedMethods.includes('WALLET') && (
        <Button variant="secondary" onClick={() => setWalletRetry((current) => current + 1)}>Retry wallet balance check</Button>
      )}
      <ShareholderModal
        open={shareholderOpen}
        onClose={() => setShareholderOpen(false)}
        onVerified={(verified) => { setShareholder(verified); setDiscountApproved(false); }}
      />
    </section>
  );
}
