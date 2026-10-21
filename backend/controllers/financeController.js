const {
  AuditLog, Expense, ExpenseCategory, Location, SalarySheet,
} = require('../models');
const { getRevenueLedger } = require('../services/revenueLedgerService');

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const monthOf = (date) => new Date(date).toISOString().slice(0, 7);

// A month is closed once its salary sheet is Paid.
async function assertMonthOpen(date) {
  const closed = await SalarySheet.findOne({ month: monthOf(date), status: 'Paid' }).select('_id').lean();
  if (closed) throw statusError('This month is closed; expenses cannot be added or edited', 409);
}

async function assertReferences({ categoryId, locationId }) {
  if (categoryId) {
    const category = await ExpenseCategory.findById(categoryId).lean();
    if (!category || category.isActive === false) throw statusError('Expense category not found', 404);
  }
  if (locationId) {
    const location = await Location.findById(locationId).lean();
    if (!location) throw statusError('Location not found', 404);
  }
}

function audit(req, action, entityId, before, after) {
  return AuditLog.create({
    actorId: req.user._id, action, entity: 'Expense', entityId, before, after, ipAddress: req.ip,
  });
}

async function revenueLedger(req, res, next) {
  try {
    const ledger = await getRevenueLedger(req.query.startDate, req.query.endDate);
    return res.json({ success: true, ...ledger });
  } catch (error) {
    return next(error);
  }
}

async function listExpenseCategories(req, res, next) {
  try {
    const categories = await ExpenseCategory.find({ isActive: true }).sort({ name: 1 }).lean();
    return res.json({ success: true, categories });
  } catch (error) {
    return next(error);
  }
}

async function createExpenseCategory(req, res, next) {
  try {
    const category = await ExpenseCategory.create({ name: req.body.name, description: req.body.description });
    await AuditLog.create({
      actorId: req.user._id, action: 'CREATE', entity: 'ExpenseCategory', entityId: category._id, after: category.toObject(), ipAddress: req.ip,
    });
    return res.status(201).json({ success: true, category });
  } catch (error) {
    if (error.code === 11000) return next(statusError('Expense category already exists', 409));
    return next(error);
  }
}

async function listExpenses(req, res, next) {
  try {
    const filter = {};
    if (req.query.startDate || req.query.endDate) {
      filter.expenseDate = {};
      if (req.query.startDate) filter.expenseDate.$gte = new Date(`${req.query.startDate}T00:00:00.000Z`);
      if (req.query.endDate) filter.expenseDate.$lt = new Date(new Date(`${req.query.endDate}T00:00:00.000Z`).getTime() + 86400000);
    }
    ['categoryId', 'locationId', 'paymentMethod'].forEach((name) => {
      if (req.query[name]) filter[name] = req.query[name];
    });
    const expenses = await Expense.find(filter)
      .populate('categoryId', 'name')
      .populate('locationId', 'name type')
      .sort({ expenseDate: -1, createdAt: -1 })
      .lean();
    const totalCents = expenses.reduce((sum, expense) => sum + Math.round(expense.amount * 100), 0);
    return res.json({ success: true, expenses, total: totalCents / 100 });
  } catch (error) {
    return next(error);
  }
}

async function createExpense(req, res, next) {
  try {
    const expenseDate = req.body.expenseDate ? new Date(req.body.expenseDate) : new Date();
    await assertReferences(req.body);
    await assertMonthOpen(expenseDate);
    const expense = await Expense.create({
      categoryId: req.body.categoryId,
      amount: req.body.amount,
      expenseDate,
      description: req.body.description,
      paymentMethod: req.body.paymentMethod,
      locationId: req.body.locationId,
      attachment: req.expenseAttachment,
      createdBy: req.user._id,
      sourceType: 'MANUAL',
    });
    await audit(req, 'CREATE', expense._id, undefined, expense.toObject());
    return res.status(201).json({ success: true, expense });
  } catch (error) {
    return next(error);
  }
}

async function updateExpense(req, res, next) {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) throw statusError('Expense not found', 404);
    if (expense.sourceType === 'SALARY_SHEET') throw statusError('Payroll expenses are managed by the salary sheet', 409);
    await assertMonthOpen(expense.expenseDate);
    const nextDate = req.body.expenseDate ? new Date(req.body.expenseDate) : expense.expenseDate;
    if (monthOf(nextDate) !== monthOf(expense.expenseDate)) await assertMonthOpen(nextDate);
    await assertReferences(req.body);

    const before = expense.toObject();
    ['categoryId', 'amount', 'description', 'paymentMethod', 'locationId'].forEach((name) => {
      if (req.body[name] !== undefined) expense[name] = req.body[name];
    });
    expense.expenseDate = nextDate;
    if (req.expenseAttachment) expense.attachment = req.expenseAttachment;
    expense.updatedBy = req.user._id;
    await expense.save();
    await audit(req, 'UPDATE', expense._id, before, expense.toObject());
    return res.json({ success: true, expense });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createExpense,
  createExpenseCategory,
  listExpenseCategories,
  listExpenses,
  revenueLedger,
  updateExpense,
};
