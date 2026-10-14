const mongoose = require('mongoose');
const models = require('../models');

const objectId = () => new mongoose.Types.ObjectId();

describe('Finance and workforce models', () => {
  it('validates closed shifts and calculates cash differences', async () => {
    const closedShift = new models.Shift({
      outletId: objectId(), cashierId: objectId(), openingCash: 100,
      status: 'CLOSED', expectedCash: 125, actualCash: 120,
    });
    await expect(closedShift.validate()).rejects.toMatchObject({
      errors: {
        closedAt: expect.objectContaining({ message: expect.stringContaining('Close date is required') }),
        closedBy: expect.objectContaining({ message: expect.stringContaining('Closing user is required') }),
      },
    });

    const shift = new models.Shift({
      outletId: objectId(), cashierId: objectId(), openingCash: 100,
      status: 'CLOSED', closedAt: new Date(), closedBy: objectId(), expectedCash: 125.5, actualCash: 120,
    });
    await shift.validate();
    expect(shift.cashDifference).toBe(-5.5);
  });

  it('calculates rounded salary totals and requires paid-sheet audit fields', async () => {
    const sheet = new models.SalarySheet({
      month: '2026-10',
      lines: [{ employeeId: objectId(), baseSalary: 1000.105, allowances: 25, deductions: 10 }],
    });
    await sheet.validate();
    expect(sheet.lines[0].baseSalary).toBe(1000.11);
    expect(sheet.lines[0].netAmount).toBe(1015.11);
    expect(sheet.totalAmount).toBe(1015.11);

    sheet.status = 'Paid';
    const error = await sheet.validate().catch((validationError) => validationError);
    expect(error.errors).toEqual(expect.objectContaining({
      approvedBy: expect.any(Object), paidBy: expect.any(Object), paidAt: expect.any(Object), expenseId: expect.any(Object),
    }));
  });

  it('requires employee, advance, expense, and audit details', async () => {
    const cases = [
      [new models.Employee(), ['employeeCode', 'name', 'baseSalary']],
      [new models.SalaryAdvance(), ['employeeId', 'amount', 'reason']],
      [new models.Expense(), ['categoryId', 'amount', 'description', 'paymentMethod', 'createdBy']],
      [new models.ExpenseCategory(), ['name']],
      [new models.AuditLog(), ['actorId', 'action', 'entity']],
    ];

    for (const [document, fields] of cases) {
      await expect(document.validate()).rejects.toMatchObject({
        errors: Object.fromEntries(fields.map((field) => [field, expect.objectContaining({ kind: 'required' })])),
      });
    }

    const payrollExpense = new models.Expense({
      categoryId: objectId(), amount: 100, description: 'Payroll', paymentMethod: 'Cash',
      createdBy: objectId(), sourceType: 'SALARY_SHEET',
    });
    await expect(payrollExpense.validate()).rejects.toMatchObject({
      errors: { sourceId: expect.objectContaining({ message: expect.stringContaining('Salary sheet is required') }) },
    });
  });

  it('provides requested singleton settings defaults', async () => {
    const settings = new models.Settings();
    await settings.validate();

    expect(settings.shareholderDiscountPercent).toBe(5);
    expect(settings.vatEnabled).toBe(false);
    expect(settings.commissionEnabled).toBe(false);
    expect(settings.vendorWalletPayoutEnabled).toBe(false);
  });
});