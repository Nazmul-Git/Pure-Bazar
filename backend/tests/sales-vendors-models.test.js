const mongoose = require('mongoose');
const models = require('../models');

const objectId = () => new mongoose.Types.ObjectId();

describe('Sales and vendor models', () => {
  it('requires core order fields and supports only blueprint payment enums', async () => {
    const missing = new models.Order();
    await expect(missing.validate()).rejects.toMatchObject({
      errors: {
        orderNumber: expect.objectContaining({ kind: 'required' }),
        subtotal: expect.objectContaining({ kind: 'required' }),
        grandTotal: expect.objectContaining({ kind: 'required' }),
        paymentStatus: expect.objectContaining({ kind: 'required' }),
        cashier: expect.objectContaining({ kind: 'required' }),
        outlet: expect.objectContaining({ kind: 'required' }),
      },
    });

    const order = new models.Order({
      orderNumber: 'PB-1', subtotal: 10, grandTotal: 10, paymentStatus: 'PAID',
      cashier: objectId(), outlet: objectId(), payments: [{ method: 'CHEQUE', amount: 10 }],
    });
    await expect(order.validate()).rejects.toMatchObject({
      errors: { 'payments.0.method': expect.objectContaining({ kind: 'enum' }) },
    });
  });

  it('requires return references and validates vendor and settlement enums', async () => {
    const missingReturn = new models.Return();
    await expect(missingReturn.validate()).rejects.toMatchObject({
      errors: {
        returnNumber: expect.objectContaining({ kind: 'required' }),
        orderId: expect.objectContaining({ kind: 'required' }),
        createdBy: expect.objectContaining({ kind: 'required' }),
      },
    });

    const vendor = new models.Vendor({
      memberId: 'M-1', name: 'Vendor', mobile: '01700000000', shopName: 'Shop', address: 'Dhaka',
      productCategory: 'Food', payoutMethod: 'Cheque', accountDetails: 'Account',
      termsAccepted: true, termsVersion: '1',
    });
    const statement = new models.VendorStatement({ status: 'Pending' });
    await expect(vendor.validate()).rejects.toMatchObject({
      errors: { payoutMethod: expect.objectContaining({ kind: 'enum' }) },
    });
    await expect(new models.Vendor().validate()).rejects.toMatchObject({
      errors: {
        memberId: expect.objectContaining({ kind: 'required' }),
        name: expect.objectContaining({ kind: 'required' }),
        mobile: expect.objectContaining({ kind: 'required' }),
        shopName: expect.objectContaining({ kind: 'required' }),
        address: expect.objectContaining({ kind: 'required' }),
        productCategory: expect.objectContaining({ kind: 'required' }),
        termsAccepted: expect.objectContaining({ kind: 'required' }),
        termsVersion: expect.objectContaining({ kind: 'required' }),
      },
    });
    await expect(statement.validate()).rejects.toMatchObject({
      errors: { status: expect.objectContaining({ kind: 'enum' }) },
    });
    await expect(new models.VendorStatement().validate()).rejects.toMatchObject({
      errors: {
        vendorId: expect.objectContaining({ kind: 'required' }),
        statementNumber: expect.objectContaining({ kind: 'required' }),
        periodStart: expect.objectContaining({ kind: 'required' }),
        periodEnd: expect.objectContaining({ kind: 'required' }),
        openingStock: expect.objectContaining({ kind: 'required' }),
        receipts: expect.objectContaining({ kind: 'required' }),
        sales: expect.objectContaining({ kind: 'required' }),
        returns: expect.objectContaining({ kind: 'required' }),
        closingStock: expect.objectContaining({ kind: 'required' }),
        salesValueAtVendorPrice: expect.objectContaining({ kind: 'required' }),
        netPayable: expect.objectContaining({ kind: 'required' }),
      },
    });
  });

  it('requires ledger, shareholder, wallet, audit, and discount fields', async () => {
    const cases = [
      [new models.VendorLedger(), ['vendorId', 'orderId', 'productId', 'quantity', 'entryType', 'vendorPayable', 'companyNet']],
      [new models.Shareholder(), ['memberId', 'name', 'mobile', 'verified', 'active', 'walletEnabled']],
      [new models.WalletLog(), ['memberId', 'orderId', 'amount', 'type']],
      [new models.WalletAuditLog(), ['memberId', 'action', 'succeeded', 'createdBy']],
      [new models.DiscountLog(), ['orderId', 'scope', 'discountType', 'amount', 'reason', 'appliedBy']],
    ];

    for (const [document, fields] of cases) {
      await expect(document.validate()).rejects.toMatchObject({
        errors: Object.fromEntries(fields.map((field) => [field, expect.objectContaining({ kind: 'required' })])),
      });
    }

    const invalidLedger = new models.VendorLedger({ entryType: 'PURCHASE' });
    await expect(invalidLedger.validate()).rejects.toMatchObject({
      errors: { entryType: expect.objectContaining({ kind: 'enum' }) },
    });

    const invalidEnums = [
      [new models.Order({ channel: 'ONLINE', paymentStatus: 'PENDING' }), ['channel', 'paymentStatus']],
      [new models.Vendor({ status: 'Pending' }), ['status']],
      [new models.VendorStatement({ paymentMethod: 'CHEQUE' }), ['paymentMethod']],
      [new models.WalletLog({ type: 'CREDIT' }), ['type']],
      [new models.WalletAuditLog({ action: 'LOGIN' }), ['action']],
      [new models.DiscountLog({ scope: 'ORDER', discountType: 'AMOUNT' }), ['scope', 'discountType']],
    ];
    for (const [document, fields] of invalidEnums) {
      const error = await document.validate().catch((validationError) => validationError);
      for (const field of fields) expect(error.errors[field].kind).toBe('enum');
    }
  });

  it('declares requested sales and vendor lookup indexes', () => {
    const orderIndexes = models.Order.schema.indexes().map(([fields]) => fields);
    const ledgerIndexes = models.VendorLedger.schema.indexes().map(([fields]) => fields);
    const statementIndexes = models.VendorStatement.schema.indexes().map(([fields]) => fields);

    expect(orderIndexes).toEqual(expect.arrayContaining([
      { orderNumber: 1 }, { memberId: 1 }, { createdAt: 1 },
    ]));
    expect(ledgerIndexes).toEqual(expect.arrayContaining([{ vendorId: 1 }, { createdAt: 1 }]));
    expect(statementIndexes).toEqual(expect.arrayContaining([{ vendorId: 1 }, { createdAt: 1 }]));
  });
});