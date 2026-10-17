'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Button, Input, Select } from '@/components/ui';
import { getSettings, updateSettings } from '@/services/admin';
import {
  defaultSettings,
  JsonField,
  MethodChoices,
  paymentMethods,
  payoutMethods,
  settingFields,
  SettingsSection,
  ToggleField,
} from '@/components/settings/settings-fields';

export default function SettingsForm() {
  const token = useSelector((state) => state.auth.token);
  const [settings, setSettings] = useState(defaultSettings);
  const [jsonValues, setJsonValues] = useState({ discountLimitByRole: '{}', receiptLayout: '{}', outlets: '[]' });
  const [newTerm, setNewTerm] = useState({ version: '', terms: '', effectiveFrom: '' });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    getSettings(token)
      .then(({ data }) => {
        if (!active) return;
        const values = { ...defaultSettings, ...data.settings };
        setSettings(values);
        setLoaded(true);
        setJsonValues({
          discountLimitByRole: JSON.stringify(values.discountLimitByRole, null, 2),
          receiptLayout: JSON.stringify(values.receiptLayout, null, 2),
          outlets: JSON.stringify(values.outlets, null, 2),
        });
      })
      .catch((requestError) => active && setError(requestError.response?.data?.message || 'Unable to load settings.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token, reloadCount]);

  function setField(name, value) {
    setSettings((current) => ({ ...current, [name]: value }));
    setError('');
    setNotice('');
  }

  function addVendorTerm(event) {
    event.preventDefault();
    if (!newTerm.version.trim() || !newTerm.terms.trim() || !newTerm.effectiveFrom) {
      setError('Enter a version, terms, and effective date before adding a vendor terms version.');
      return;
    }
    setField('vendorTerms', [...settings.vendorTerms, {
      version: newTerm.version.trim(),
      terms: newTerm.terms.trim(),
      effectiveFrom: new Date(`${newTerm.effectiveFrom}T00:00:00.000Z`).toISOString(),
    }]);
    setNewTerm({ version: '', terms: '', effectiveFrom: '' });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    let discountLimitByRole;
    let receiptLayout;
    let outlets;
    try {
      discountLimitByRole = JSON.parse(jsonValues.discountLimitByRole);
      receiptLayout = JSON.parse(jsonValues.receiptLayout);
      outlets = JSON.parse(jsonValues.outlets);
      if (!discountLimitByRole || Array.isArray(discountLimitByRole) || typeof discountLimitByRole !== 'object') {
        throw new Error('Discount limits by role must be a JSON object.');
      }
      if (!receiptLayout || Array.isArray(receiptLayout) || typeof receiptLayout !== 'object') {
        throw new Error('Receipt layout must be a JSON object.');
      }
      if (!Array.isArray(outlets)) throw new Error('Outlets must be a JSON array.');
    } catch (parseError) {
      setError(parseError.message.startsWith('Unexpected') ? `Invalid JSON: ${parseError.message}` : parseError.message);
      return;
    }
    const cutoffDates = settings.vendorPayoutCutoffDates;
    if ((cutoffDates.length > 0 && cutoffDates.length !== Number(settings.vendorSettlementCyclePerMonth))
      || cutoffDates.some((date) => !Number.isInteger(date) || date < 1 || date > 31)
      || new Set(cutoffDates).size !== cutoffDates.length) {
      setError('Enter a unique cut-off date for each vendor settlement cycle.');
      return;
    }

    const payload = Object.fromEntries(settingFields.map((field) => [field, settings[field]]));
    payload.discountLimitByRole = discountLimitByRole;
    payload.receiptLayout = receiptLayout;
    payload.outlets = outlets;
    setSaving(true);
    try {
      const { data } = await updateSettings(token, payload);
      const values = { ...defaultSettings, ...data.settings };
      setSettings(values);
      setJsonValues({
        discountLimitByRole: JSON.stringify(values.discountLimitByRole, null, 2),
        receiptLayout: JSON.stringify(values.receiptLayout, null, 2),
        outlets: JSON.stringify(values.outlets, null, 2),
      });
      setNotice('Settings saved successfully.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status" className="py-10 text-center text-slate-500">Loading settings...</p>;
  if (!loaded) {
    return (
      <section className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Workspace configuration</p>
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        </div>
        <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error || 'Settings could not be loaded.'}</p>
        <Button type="button" variant="secondary" onClick={() => setReloadCount((count) => count + 1)}>Retry</Button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Workspace configuration</p>
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">Manage checkout, tax, stock, vendor, and outlet settings.</p>
        </div>
        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

      <SettingsSection title="Sales, tax, and discounts" description="Configure checkout tax calculations and discount limits.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Shareholder discount (%)" type="number" min="0" max="100" step="0.01" value={settings.shareholderDiscountPercent} onChange={(event) => setField('shareholderDiscountPercent', Number(event.target.value))} />
          <Input label="Default VAT rate (%)" type="number" min="0" max="100" step="0.01" value={settings.defaultVatRate} onChange={(event) => setField('defaultVatRate', Number(event.target.value))} />
          <Select label="VAT price mode" value={settings.vatPriceMode} onChange={(event) => setField('vatPriceMode', event.target.value)}>
            <option value="INCLUDED">Included in price</option><option value="EXCLUDED">Added to price</option>
          </Select>
          <Select label="VAT calculation order" value={settings.vatCalculationOrder} onChange={(event) => setField('vatCalculationOrder', event.target.value)}>
            <option value="DISCOUNT_THEN_VAT">Discount, then VAT</option><option value="VAT_THEN_DISCOUNT">VAT, then discount</option>
          </Select>
        </div>
        <ToggleField label="Enable VAT" checked={settings.vatEnabled} onChange={(event) => setField('vatEnabled', event.target.checked)} />
        <JsonField label="Discount limits by role" value={jsonValues.discountLimitByRole} onChange={(value) => setJsonValues((current) => ({ ...current, discountLimitByRole: value }))} help='JSON object mapping role names to maximum discount percentages, for example { "Cashier": 10 }.' />
      </SettingsSection>

      <SettingsSection title="Stock adjustments" description="Adjustments valued above this limit require Super Admin approval. Values use product purchase cost.">
        <Input
          label="Super Admin approval limit"
          type="number"
          min="0"
          step="0.01"
          value={settings.stockAdjustmentApprovalLimit}
          onChange={(event) => setField('stockAdjustmentApprovalLimit', Number(event.target.value))}
        />
      </SettingsSection>

      <SettingsSection title="Payments and receipt" description="Choose accepted checkout methods and configure the receipt layout.">
        <MethodChoices label="Enabled payment methods" methods={paymentMethods} value={settings.enabledPaymentMethods} onChange={(value) => setField('enabledPaymentMethods', value)} />
        <JsonField label="Receipt layout" value={jsonValues.receiptLayout} onChange={(value) => setJsonValues((current) => ({ ...current, receiptLayout: value }))} help="JSON object consumed by receipt rendering." />
      </SettingsSection>

      <SettingsSection title="Vendor settlement" description="Set settlement frequency, cut-off dates, terms, and payout options.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Settlement cycles per month" value={settings.vendorSettlementCyclePerMonth} onChange={(event) => setField('vendorSettlementCyclePerMonth', Number(event.target.value))}>
            <option value={1}>1 cycle</option><option value={2}>2 cycles</option>
          </Select>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: Number(settings.vendorSettlementCyclePerMonth) }, (_, index) => (
              <Input
                key={index}
                label={`Cut-off date ${index + 1}`}
                type="number"
                min="1"
                max="31"
                value={settings.vendorPayoutCutoffDates[index] ?? ''}
                onChange={(event) => {
                  const dates = Array.from({ length: Number(settings.vendorSettlementCyclePerMonth) }, (_, dateIndex) => settings.vendorPayoutCutoffDates[dateIndex]);
                  dates[index] = event.target.value === '' ? '' : Number(event.target.value);
                  setField('vendorPayoutCutoffDates', dates);
                }}
              />
            ))}
          </div>
        </div>
        <MethodChoices label="Enabled vendor payout methods" methods={payoutMethods} value={settings.enabledVendorPayoutMethods} onChange={(value) => setField('enabledVendorPayoutMethods', value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleField label="Enable vendor commission" checked={settings.commissionEnabled} onChange={(event) => setField('commissionEnabled', event.target.checked)} />
          <ToggleField label="Enable vendor wallet payout" checked={settings.vendorWalletPayoutEnabled} onChange={(event) => setField('vendorWalletPayoutEnabled', event.target.checked)} />
        </div>
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Vendor terms versions</h3>
            <p className="mt-1 text-xs text-slate-500">Existing versions are locked; new versions are appended.</p>
          </div>
          {settings.vendorTerms.map((term) => (
            <div key={term.version} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-800">Version {term.version} · effective {new Date(term.effectiveFrom).toLocaleDateString()}</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-600">{term.terms}</p>
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="New version" value={newTerm.version} onChange={(event) => setNewTerm((current) => ({ ...current, version: event.target.value }))} />
            <Input label="Effective date" type="date" value={newTerm.effectiveFrom} onChange={(event) => setNewTerm((current) => ({ ...current, effectiveFrom: event.target.value }))} />
            <Input label="Terms" value={newTerm.terms} onChange={(event) => setNewTerm((current) => ({ ...current, terms: event.target.value }))} />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addVendorTerm}>Append vendor terms</Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Integrations and outlets" description="Probashi credentials are intentionally not managed here.">
        <Select label="Probashi status" value={settings.probashiStatus} onChange={(event) => setField('probashiStatus', event.target.value)}>
          <option value="NotConfigured">Not configured</option><option value="Active">Active</option><option value="Inactive">Inactive</option>
        </Select>
        <JsonField label="Outlets" value={jsonValues.outlets} onChange={(value) => setJsonValues((current) => ({ ...current, outlets: value }))} help="JSON array of configured outlet records." />
      </SettingsSection>

      <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button></div>
    </form>
  );
}
