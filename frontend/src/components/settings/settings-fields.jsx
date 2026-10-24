import { Card } from '@/components/ui';

export const paymentMethods = ['Cash', 'Bank', 'bKash', 'Nagad', 'Card', 'Wallet'];
export const payoutMethods = ['Cash', 'Bank', 'bKash', 'Nagad'];
export const settingFields = [
  'shareholderDiscountPercent',
  'stockAdjustmentApprovalLimit',
  'vatEnabled',
  'defaultVatRate',
  'vatPriceMode',
  'vatCalculationOrder',
  'discountLimitByRole',
  'enabledPaymentMethods',
  'receiptLayout',
  'vendorTerms',
  'probashiStatus',
  'vendorSettlementCyclePerMonth',
  'vendorPayoutCutoffDates',
  'enabledVendorPayoutMethods',
  'commissionEnabled',
  'vendorWalletPayoutEnabled',
  'outlets',
];

export const defaultSettings = {
  shareholderDiscountPercent: 5,
  stockAdjustmentApprovalLimit: 0,
  vatEnabled: false,
  defaultVatRate: 0,
  vatPriceMode: 'EXCLUDED',
  vatCalculationOrder: 'DISCOUNT_THEN_VAT',
  discountLimitByRole: {},
  enabledPaymentMethods: ['Cash', 'Bank', 'bKash', 'Nagad'],
  receiptLayout: {},
  vendorTerms: [],
  probashiStatus: 'NotConfigured',
  vendorSettlementCyclePerMonth: 1,
  vendorPayoutCutoffDates: [],
  enabledVendorPayoutMethods: ['Cash', 'Bank', 'bKash', 'Nagad'],
  commissionEnabled: false,
  vendorWalletPayoutEnabled: false,
  outlets: [],
};

export function ToggleField({ label, checked, onChange, description }) {
  return (
    <label className="flex items-start gap-3 py-2">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 accent-[#82C341]" />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="mt-1 block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}

export function MethodChoices({ label, methods, value, onChange }) {
  return (
    <fieldset>
      <legend className="field-label mb-2">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {methods.map((method) => (
          <label key={method} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={value.includes(method)}
              onChange={(event) => onChange(event.target.checked
                ? [...value, method]
                : value.filter((item) => item !== method))}
              className="h-4 w-4 accent-[#82C341]"
            />
            {method}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsSection({ title, description, children }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <div className="card-header border-l-4 border-l-[#82C341]">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      <div className="card-content space-y-5">{children}</div>
    </Card>
  );
}
