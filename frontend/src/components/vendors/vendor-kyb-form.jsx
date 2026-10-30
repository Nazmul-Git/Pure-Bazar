'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button, Card, Input, Select } from '@/components/ui';
import { submitVendorKyb } from '@/services/vendor';
import {
  BUSINESS_TYPES, STEP_FIELDS, buildKybPayload, emptyKybForm, validateKybForm,
} from '@/services/vendor-kyb.cjs';
import { T } from '@/i18n/language-provider';
import useToastMessages from '@/hooks/use-toast-messages';

const steps = ['Business Legal Information & Owner NID', 'Warehouse Logistics & Dispatch Contact'];
const can = (permissions, permission) => permissions.includes('*') || permissions.includes(permission);

function FileField({ label, name, file, error, onChange }) {
  return (
    <label className="ui-field" htmlFor={name}>
      <span className="field-label"><T>{label}</T></span>
      <input
        id={name}
        name={name}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        className={`ui-input${error ? ' field-invalid' : ''}`}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(name, event.target.files?.[0] || null)}
      />
      {file && <span className="text-xs text-slate-500">{file.name}</span>}
      {error && <span className="field-error"><T>{error}</T></span>}
    </label>
  );
}

export default function VendorKybForm() {
  const { token, user, initialized } = useSelector((state) => state.auth);
  const permissions = user?.permissions || [];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyKybForm);
  const [files, setFiles] = useState({ tradeLicense: null, ownerNid: null });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  useToastMessages({ error });

  const setField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };
  const setFile = (name, file) => {
    setFiles((current) => ({ ...current, [name]: file }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };
  const field = (name, label, props = {}) => (
    <Input label={label} name={name} value={form[name]} error={errors[name]} onChange={(e) => setField(name, e.target.value)} {...props} />
  );

  function next() {
    const all = validateKybForm(form, files);
    const stepErrors = Object.fromEntries(Object.entries(all).filter(([key]) => STEP_FIELDS[0].includes(key)));
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) setStep(1);
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const all = validateKybForm(form, files);
    setErrors(all);
    if (Object.keys(all).length) {
      if (Object.keys(all).some((key) => STEP_FIELDS[0].includes(key))) setStep(0);
      setError('Please complete all mandatory KYB fields before submitting.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await submitVendorKyb(token, buildKybPayload(form), files);
      setSubmitted(data.registration);
      setForm(emptyKybForm);
      setFiles({ tradeLicense: null, ownerNid: null });
      setStep(0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to submit this registration.');
    } finally {
      setSaving(false);
    }
  }

  if (!initialized) return <p role="status" className="py-10 text-center text-sm text-slate-500"><T>{"Loading vendor registration..."}</T></p>;
  if (!token || !can(permissions, 'vendors:write')) {
    return <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><T>{"You do not have permission to register vendors."}</T></p>;
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500"><T>{"Vendors"}</T></p>
          <h1 className="text-2xl font-semibold text-slate-900"><T>{"Vendor KYB Registration"}</T></h1>
          <p className="mt-1 text-sm text-slate-600"><T>{"Legal identity and warehouse logistics. Payouts are flexible and managed on demand."}</T></p>
        </div>
        <Link href="/vendors/directory" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900">
          <ArrowLeft size={16} /> <T>{"Vendor Directory"}</T>
        </Link>
      </div>

      <ol className="flex gap-2 text-sm">
        {steps.map((label, index) => (
          <li key={label} className={`flex-1 rounded border px-3 py-2 ${index === step ? 'border-blue-600 bg-blue-50 font-semibold text-blue-800' : 'border-slate-200 text-slate-500'}`}>
            {index + 1}. <T>{label}</T>
          </li>
        ))}
      </ol>

      {submitted && (
        <p role="status" className="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={18} /> {submitted.businessLegalIdentity?.companyName} was submitted for verification (PENDING).
        </p>
      )}

      <form onSubmit={submit} noValidate className="space-y-5">
        {step === 0 && (
          <>
            <Card title="Business legal information">
              <div className="grid gap-4 sm:grid-cols-2">
                {field('companyName', 'Company name *')}
                {field('tradeLicenseNo', 'Trade license no. *')}
                {field('tradeLicenseExpiry', 'Trade license expiry *', { type: 'date' })}
                <Select label="Business type *" name="businessType" value={form.businessType} error={errors.businessType} onChange={(e) => setField('businessType', e.target.value)}>
                  <option value="">Select type</option>
                  {BUSINESS_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </Select>
                {field('tinNumber', 'TIN number')}
                {field('vatBinNumber', 'VAT / BIN number')}
                <FileField label="Trade license document *" name="tradeLicense" file={files.tradeLicense} error={errors.tradeLicense} onChange={setFile} />
              </div>
            </Card>
            <Card title="Owner information & NID">
              <div className="grid gap-4 sm:grid-cols-2">
                {field('fullNameEng', 'Full name (English) *')}
                {field('fullNameBen', 'Full name (Bangla)')}
                {field('nidNumber', 'NID number *', { inputMode: 'numeric' })}
                {field('dob', 'Date of birth', { type: 'date' })}
                {field('presentAddress', 'Present address')}
                {field('permanentAddress', 'Permanent address')}
                <FileField label="Owner NID document *" name="ownerNid" file={files.ownerNid} error={errors.ownerNid} onChange={setFile} />
              </div>
            </Card>
            <div className="flex justify-end"><Button type="button" onClick={next}><T>{"Next: Warehouse Logistics"}</T></Button></div>
          </>
        )}

        {step === 1 && (
          <>
            <Card title="Warehouse & dispatch">
              <div className="grid gap-4 sm:grid-cols-2">
                {field('warehouseAddress', 'Warehouse address *', { className: 'sm:col-span-2' })}
                {field('primaryContactPerson', 'Primary contact person *')}
                {field('dispatchMobile', 'Dispatch mobile *', { type: 'tel' })}
                {field('productCategories', 'Product categories (comma separated)')}
                {field('deliveryLeadTimeHours', 'Delivery lead time (hours)', { type: 'number', min: 0 })}
              </div>
            </Card>
            <p className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"><T>{"Payout preference: Flexible payout managed on demand."}</T></p>
            <div className="flex justify-between">
              <Button type="button" variant="secondary" onClick={() => setStep(0)}><T>{"Back"}</T></Button>
              <Button type="submit" disabled={saving}>{saving ? 'Submitting...' : 'Submit for verification'}</Button>
            </div>
          </>
        )}
      </form>
    </section>
  );
}
