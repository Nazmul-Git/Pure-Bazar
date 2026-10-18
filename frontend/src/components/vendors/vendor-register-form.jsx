'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button, Card, Input, Select } from '@/components/ui';
import { getCurrentVendorTerms, registerVendor } from '@/services/vendor';

const emptyForm = {
  memberId: '',
  name: '',
  mobile: '',
  shopName: '',
  address: '',
  productCategory: '',
  payoutMethod: '',
  accountDetails: '',
};

const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);

export default function VendorRegisterForm() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const [terms, setTerms] = useState(null);
  const [loadingTerms, setLoadingTerms] = useState(true);
  const [termsError, setTermsError] = useState('');
  const [retryTerms, setRetryTerms] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    setLoadingTerms(true);
    setTermsError('');
    setTerms(null);
    getCurrentVendorTerms(token)
      .then(({ data }) => active && setTerms(data.terms))
      .catch((requestError) => {
        if (active) setTermsError(requestError.response?.data?.message || 'Unable to load current vendor terms.');
      })
      .finally(() => active && setLoadingTerms(false));
    return () => { active = false; };
  }, [token, retryTerms]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setAccepted(false);
    setError('');
    setRegistered(null);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setRegistered(null);
    if (!terms) {
      setError('Registration is unavailable until current vendor terms are configured.');
      return;
    }
    if (!accepted) {
      setError('The vendor must accept the current terms before registration.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await registerVendor(token, {
        ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])),
        termsAccepted: true,
        termsVersion: terms.version,
      });
      setRegistered(data.vendor);
      setForm(emptyForm);
      setAccepted(false);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to register this vendor.');
    } finally {
      setSaving(false);
    }
  }

  if (!initialized) {
    return <p role="status" className="py-10 text-center text-sm text-slate-500">Loading vendor registration...</p>;
  }
  if (!token || !can(permissions, 'vendors:write')) {
    return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">You do not have permission to register vendors.</p>;
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Vendors</p>
          <h1 className="text-2xl font-semibold text-slate-900">Register Vendor (Form A)</h1>
          <p className="mt-1 text-sm text-slate-600">Record the vendor details and capture acceptance of the active terms.</p>
        </div>
        {can(permissions, 'vendors:read') && (
          <Link href="/vendors/directory" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900">
            <ArrowLeft size={16} /> Vendor Directory
          </Link>
        )}
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {registered && (
        <p role="status" className="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={18} /> {registered.name} was registered as a vendor.
        </p>
      )}

      <Card title="Vendor information" description="Member eligibility is verified by the server when this form is submitted.">
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Probashi Member ID" name="memberId" value={form.memberId} onChange={(event) => setField('memberId', event.target.value)} maxLength={100} required autoComplete="off" />
            <Input label="Member name" name="name" value={form.name} onChange={(event) => setField('name', event.target.value)} maxLength={150} required autoComplete="name" />
            <Input label="Mobile number" name="mobile" value={form.mobile} onChange={(event) => setField('mobile', event.target.value)} maxLength={21} pattern="\+?[0-9]{7,20}" title="Enter 7 to 20 digits, optionally starting with +." required autoComplete="tel" />
            <Input label="Shop name" name="shopName" value={form.shopName} onChange={(event) => setField('shopName', event.target.value)} maxLength={150} required />
            <Input label="Product category" name="productCategory" value={form.productCategory} onChange={(event) => setField('productCategory', event.target.value)} maxLength={100} required placeholder="e.g. Grocery, produce" />
            <Select label="Payout method" name="payoutMethod" value={form.payoutMethod} onChange={(event) => setField('payoutMethod', event.target.value)} required>
              <option value="">Choose payout method</option>
              {['Cash', 'Bank', 'bKash', 'Nagad'].map((method) => <option key={method} value={method}>{method}</option>)}
            </Select>
          </div>
          <Input label="Business address" name="address" value={form.address} onChange={(event) => setField('address', event.target.value)} maxLength={500} required autoComplete="street-address" />
          <Input
            label="Payout account details"
            name="accountDetails"
            value={form.accountDetails}
            onChange={(event) => setField('accountDetails', event.target.value)}
            maxLength={250}
            placeholder={form.payoutMethod === 'Cash' ? 'Enter N/A for cash payout' : 'Account or wallet details'}
            required
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Vendor terms</h2>
                {terms && <p className="mt-1 text-xs text-slate-500">Version {terms.version} · effective {new Date(terms.effectiveFrom).toLocaleDateString()}</p>}
              </div>
              {termsError && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setRetryTerms((count) => count + 1)} disabled={loadingTerms}>
                  <RefreshCw size={15} /> Retry
                </Button>
              )}
            </div>
            {loadingTerms ? (
              <p role="status" className="mt-3 text-sm text-slate-500">Loading current terms...</p>
            ) : termsError ? (
              <p role="alert" className="mt-3 text-sm text-red-700">{termsError}</p>
            ) : terms ? (
              <>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{terms.terms}</p>
                <label className="mt-4 flex items-start gap-2 border-t border-slate-200 pt-4 text-sm text-slate-700">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-blue-600" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                  <span>The vendor has read and accepts Version {terms.version} of the vendor terms.</span>
                </label>
              </>
            ) : (
              <p role="status" className="mt-3 text-sm text-amber-800">No effective vendor terms are configured. Ask an administrator to publish terms before registering vendors.</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || loadingTerms || !terms || !accepted}>
              {saving ? 'Verifying and registering...' : 'Verify Member & Register'}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
