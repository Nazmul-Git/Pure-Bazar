const { calculateBill } = require('../services/billEngine');

const items = [
  { productId: 'oil', ownerType: 'VENDOR', vendorId: 'vendor-1', quantity: 1, mrp: 850, vendorPrice: 765 },
  { productId: 'rice', ownerType: 'VENDOR', vendorId: 'vendor-1', quantity: 1, mrp: 420, vendorPrice: 378 },
];

const walletSettings = {
  shareholderDiscountPercent: 5,
  vatEnabled: false,
};

describe('bill engine', () => {
  it('calculates MRP subtotal, wallet shareholder discount, and per-line vendor ledger', () => {
    const bill = calculateBill({
      items,
      paymentMethod: 'WALLET',
      shareholder: { verified: true },
      settings: walletSettings,
    });

    expect(bill).toMatchObject({
      subtotal: 1270,
      otherDiscountAmount: 0,
      shareholderDiscountAmount: 63.5,
      vatAmount: 0,
      grandTotal: 1206.5,
      ledgerLines: [
        { productId: 'oil', vendorPayable: 765, companyNet: 42.5, shareholderDiscountAmount: 42.5 },
        { productId: 'rice', vendorPayable: 378, companyNet: 21, shareholderDiscountAmount: 21 },
      ],
    });
    expect(bill.ledgerLines.reduce((total, line) => total + line.vendorPayable, 0)).toBe(1143);
    expect(bill.ledgerLines.reduce((total, line) => total + line.companyNet, 0)).toBe(63.5);
  });

  it('applies a fixed bill discount then wallet discount before product VAT', () => {
    const bill = calculateBill({
      items: items.map((item) => ({ ...item, vatApplicable: true })),
      paymentMethod: 'WALLET',
      shareholder: { verified: true },
      billDiscount: { type: 'FIXED', value: 70, reason: 'Promotion' },
      settings: { ...walletSettings, vatEnabled: true, defaultVatRate: 5 },
    });

    expect(bill).toMatchObject({
      subtotal: 1270,
      otherDiscountAmount: 70,
      shareholderDiscountAmount: 60,
      vatAmount: 57,
      grandTotal: 1197,
      ledgerLines: [
        { vendorPayable: 765, companyNet: -2.01, vatAmount: 38.15 },
        { vendorPayable: 378, companyNet: -0.99, vatAmount: 18.85 },
      ],
    });
    expect(bill.ledgerLines.reduce((total, line) => total + line.vendorPayable, 0)).toBe(1143);
    expect(bill.ledgerLines.reduce((total, line) => total + line.companyNet, 0)).toBe(-3);
  });

  it('applies the automatic shareholder discount after item and bill discounts', () => {
    const bill = calculateBill({
      items: items.map((item, index) => ({
        ...item,
        discount: index === 0 ? { type: 'PERCENT', value: 10, reason: 'Damaged packaging' } : undefined,
      })),
      paymentMethod: 'WALLET',
      shareholder: { verified: true },
      billDiscount: { type: 'FIXED', value: 70, reason: 'Manager promotion' },
      settings: walletSettings,
    });

    expect(bill).toMatchObject({
      subtotal: 1270,
      otherDiscountAmount: 155,
      shareholderDiscountAmount: 55.75,
      grandTotal: 1059.25,
    });
    expect(bill.ledgerLines.reduce((sum, line) => sum + line.discountAmount, 0)).toBe(210.75);
    expect(bill.otherDiscountAmount + bill.shareholderDiscountAmount).toBeLessThanOrEqual(bill.subtotal);
  });

  it('does not apply a shareholder discount to cash bills', () => {
    const bill = calculateBill({
      items,
      paymentMethod: 'CASH',
      shareholder: { verified: true },
      settings: walletSettings,
    });

    expect(bill).toMatchObject({
      subtotal: 1270,
      shareholderDiscountAmount: 0,
      vatAmount: 0,
      grandTotal: 1270,
      ledgerLines: [
        { vendorPayable: 765, companyNet: 85 },
        { vendorPayable: 378, companyNet: 42 },
      ],
    });
  });

  it('requires verified status and rejects manual shareholder discounts', () => {
    const unverifiedBill = calculateBill({
      items,
      paymentMethod: 'WALLET',
      shareholder: { verified: false },
      settings: walletSettings,
    });
    expect(unverifiedBill.shareholderDiscountAmount).toBe(0);
    expect(unverifiedBill.grandTotal).toBe(unverifiedBill.subtotal);

    expect(() => calculateBill({
      items: [{ ...items[0], discount: { type: 'FIXED', value: 5, reason: 'Shareholder' } }],
      paymentMethod: 'WALLET',
      shareholder: { verified: true },
    })).toThrow(/cannot refer to a shareholder discount/);
  });

  it('supports percentage and fixed item/bill discounts and honors VAT order', () => {
    const bill = calculateBill({
      items: [
        { ...items[0], discount: { type: 'PERCENT', value: 10, reason: 'Oil offer' }, vatApplicable: true, vatRate: 10 },
        { ...items[1], discount: { type: 'FIXED', value: 20, reason: 'Rice offer' }, vatApplicable: true, category: { vatRate: 5 } },
      ],
      paymentMethod: 'CARD',
      billDiscount: { type: 'PERCENT', value: 10, reason: 'Bill offer' },
      settings: { vatEnabled: true, defaultVatRate: 2, vatCalculationOrder: 'VAT_THEN_DISCOUNT' },
    });

    expect(bill).toMatchObject({
      subtotal: 1270,
      otherDiscountAmount: 221.5,
      shareholderDiscountAmount: 0,
      vatAmount: 96.5,
      grandTotal: 1145,
    });
    expect(bill.ledgerLines.map((line) => line.vatRate)).toEqual([10, 5]);
    expect(bill.ledgerLines.map((line) => line.vendorPayable)).toEqual([765, 378]);
    expect(bill.ledgerLines.reduce((total, line) => total + line.companyNet, 0)).toBe(-94.5);
  });

  it('uses the default VAT rate when applicable and rejects discounts without reasons', () => {
    const bill = calculateBill({
      items: [{ ownerType: 'COMPANY', quantity: 2, mrp: 50, vendorPrice: 30, vatApplicable: true }],
      paymentMethod: 'CASH',
      settings: { vatEnabled: true, defaultVatRate: 7.5 },
    });

    expect(bill).toMatchObject({
      subtotal: 100,
      vatAmount: 7.5,
      grandTotal: 107.5,
      ledgerLines: [{ vendorPayable: 0, companyNet: 100, vatRate: 7.5 }],
    });
    expect(() => calculateBill({
      items: [{ ...items[0], discount: { type: 'FIXED', value: 1 } }],
      paymentMethod: 'CASH',
    })).toThrow('reason is required');
  });
});
