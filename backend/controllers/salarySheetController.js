const {
  AuditLog, Employee, Expense, ExpenseCategory, SalaryAdvance, SalarySheet,
} = require('../models');
const {
  buildSalaryLines, fromCents, lineDeductionCents, lineGrossCents, toCents,
} = require('../services/payrollService');

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function audit(req, action, entityId, before, after) {
  return AuditLog.create({
    actorId: req.user._id, action, entity: 'SalarySheet', entityId, before, after, ipAddress: req.ip,
  });
}

async function loadSheet(id) {
  const sheet = await SalarySheet.findById(id);
  if (!sheet) throw statusError('Salary sheet not found', 404);
  return sheet;
}

async function listSheets(req, res, next) {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const sheets = await SalarySheet.find(filter).sort({ month: -1 }).lean();
    return res.json({ success: true, sheets });
  } catch (error) {
    return next(error);
  }
}

async function getSheet(req, res, next) {
  try {
    return res.json({ success: true, sheet: await loadSheet(req.params.id) });
  } catch (error) {
    return next(error);
  }
}

async function createSheet(req, res, next) {
  try {
    if (await SalarySheet.findOne({ month: req.body.month })) {
      throw statusError('A salary sheet already exists for this month', 409);
    }
    const employees = await Employee.find({ status: 'ACTIVE' }).sort({ name: 1 });
    if (!employees.length) throw statusError('No active employees to pay', 409);
    const advances = await SalaryAdvance.find({ status: 'Paid', deductedSheetId: null });
    const sheet = await SalarySheet.create({
      month: req.body.month,
      lines: buildSalaryLines(employees, advances),
    });
    await audit(req, 'CREATE', sheet._id, undefined, sheet.toObject());
    return res.status(201).json({ success: true, sheet });
  } catch (error) {
    if (error.code === 11000) return next(statusError('A salary sheet already exists for this month', 409));
    return next(error);
  }
}

async function updateLine(req, res, next) {
  try {
    const sheet = await loadSheet(req.params.id);
    if (sheet.status !== 'Draft') throw statusError('Only draft salary sheets can be edited', 409);
    const line = sheet.lines.find((item) => String(item.employeeId) === req.params.employeeId);
    if (!line) throw statusError('Employee is not on this salary sheet', 404);
    const before = sheet.toObject();
    if (req.body.allowances !== undefined) line.allowances = req.body.allowances;
    if (req.body.otherDeductions !== undefined) line.otherDeductions = req.body.otherDeductions;
    if (lineDeductionCents(line) > lineGrossCents(line)) {
      throw statusError('Deductions cannot exceed gross pay', 400);
    }
    await sheet.save();
    await audit(req, 'UPDATE', sheet._id, before, sheet.toObject());
    return res.json({ success: true, sheet });
  } catch (error) {
    return next(error);
  }
}

async function approveSheet(req, res, next) {
  try {
    const sheet = await loadSheet(req.params.id);
    if (sheet.status !== 'Draft') throw statusError('Only draft salary sheets can be approved', 409);
    const advanceIds = sheet.lines.flatMap((line) => line.advanceIds);
    if (advanceIds.length) {
      const claim = await SalaryAdvance.updateMany(
        { _id: { $in: advanceIds }, deductedSheetId: null },
        { $set: { deductedSheetId: sheet._id, deductedMonth: sheet.month } },
      );
      if (claim.modifiedCount !== advanceIds.length) {
        await SalaryAdvance.updateMany({ deductedSheetId: sheet._id }, { $unset: { deductedSheetId: '', deductedMonth: '' } });
        throw statusError('Some advances were already deducted elsewhere; recreate the sheet', 409);
      }
    }
    const before = sheet.toObject();
    sheet.status = 'Approved';
    sheet.approvedBy = req.user._id;
    await sheet.save();
    await audit(req, 'APPROVE', sheet._id, before, sheet.toObject());
    return res.json({ success: true, sheet });
  } catch (error) {
    return next(error);
  }
}

async function salaryCategory() {
  const existing = await ExpenseCategory.findOne({ name: 'Salary' });
  if (existing) return existing;
  return ExpenseCategory.create({ name: 'Salary', description: 'Monthly payroll' });
}

// Paying an Approved sheet records exactly one Salary expense; the unique
// (sourceType, sourceId) index on Expense backs this up.
async function paySheet(req, res, next) {
  let expense;
  try {
    const sheet = await loadSheet(req.params.id);
    if (sheet.status !== 'Approved' || sheet.expenseId) {
      throw statusError('Only approved salary sheets can be paid', 409);
    }
    const category = await salaryCategory();
    const [year, month] = sheet.month.split('-').map(Number);
    expense = await Expense.create({
      categoryId: category._id,
      amount: sheet.totalAmount,
      expenseDate: new Date(Date.UTC(year, month, 0, 12)),
      description: `Salary ${sheet.month}`,
      paymentMethod: req.body.paymentMethod,
      locationId: req.body.locationId,
      createdBy: req.user._id,
      sourceType: 'SALARY_SHEET',
      sourceId: sheet._id,
    });
    const before = sheet.toObject();
    sheet.status = 'Paid';
    sheet.paidBy = req.user._id;
    sheet.paidAt = new Date();
    sheet.expenseId = expense._id;
    await sheet.save();
    await AuditLog.create({
      actorId: req.user._id, action: 'CREATE', entity: 'Expense', entityId: expense._id, after: expense.toObject(), ipAddress: req.ip,
    });
    await audit(req, 'PAY', sheet._id, before, sheet.toObject());
    return res.json({ success: true, sheet, expense });
  } catch (error) {
    if (expense && error.code !== 11000) await Expense.deleteOne({ _id: expense._id });
    if (error.code === 11000) return next(statusError('This salary sheet already has an expense', 409));
    return next(error);
  }
}

async function payslip(req, res, next) {
  try {
    const sheet = await loadSheet(req.params.id);
    const line = sheet.lines.find((item) => String(item.employeeId) === req.params.employeeId);
    if (!line) throw statusError('Employee is not on this salary sheet', 404);
    const employee = await Employee.findById(req.params.employeeId);
    const advances = line.advanceIds.length
      ? await SalaryAdvance.find({ _id: { $in: line.advanceIds } }).lean()
      : [];
    return res.json({
      success: true,
      payslip: {
        month: sheet.month,
        status: sheet.status,
        paidAt: sheet.paidAt,
        employee: employee && {
          _id: employee._id, employeeCode: employee.employeeCode, name: employee.name, designation: employee.designation,
        },
        baseSalary: line.baseSalary,
        allowances: line.allowances,
        gross: fromCents(lineGrossCents(line)),
        advanceDeduction: line.advanceDeduction,
        otherDeductions: line.otherDeductions,
        totalDeductions: fromCents(toCents(line.advanceDeduction) + toCents(line.otherDeductions)),
        netAmount: line.netAmount,
        advances: advances.map((a) => ({ _id: a._id, amount: a.amount, reason: a.reason, requestedAt: a.requestedAt })),
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  approveSheet, createSheet, getSheet, listSheets, paySheet, payslip, updateLine,
};
