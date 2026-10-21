const { AuditLog, Employee, SalaryAdvance } = require('../models');

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function audit(req, action, entity, entityId, before, after) {
  return AuditLog.create({
    actorId: req.user._id, action, entity, entityId, before, after, ipAddress: req.ip,
  });
}

async function listEmployees(req, res, next) {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const employees = await Employee.find(filter).sort({ name: 1 }).lean();
    return res.json({ success: true, employees });
  } catch (error) {
    return next(error);
  }
}

async function createEmployee(req, res, next) {
  try {
    const employee = await Employee.create(req.body);
    await audit(req, 'CREATE', 'Employee', employee._id, undefined, employee.toObject());
    return res.status(201).json({ success: true, employee });
  } catch (error) {
    if (error.code === 11000) return next(statusError('Employee code already exists', 409));
    return next(error);
  }
}

async function updateEmployee(req, res, next) {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) throw statusError('Employee not found', 404);
    const before = employee.toObject();
    Object.assign(employee, req.body);
    await employee.save();
    await audit(req, 'UPDATE', 'Employee', employee._id, before, employee.toObject());
    return res.json({ success: true, employee });
  } catch (error) {
    if (error.code === 11000) return next(statusError('Employee code already exists', 409));
    return next(error);
  }
}

async function listAdvances(req, res, next) {
  try {
    const filter = {};
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.status) filter.status = req.query.status;
    const advances = await SalaryAdvance.find(filter).sort({ requestedAt: -1 }).lean();
    return res.json({ success: true, advances });
  } catch (error) {
    return next(error);
  }
}

async function createAdvance(req, res, next) {
  try {
    const employee = await Employee.findById(req.body.employeeId);
    if (!employee) throw statusError('Employee not found', 404);
    if (employee.status !== 'ACTIVE') throw statusError('Advances are only for active employees', 409);
    const advance = await SalaryAdvance.create({
      employeeId: employee._id,
      amount: req.body.amount,
      reason: req.body.reason,
      requestedAt: req.body.requestedAt ? new Date(req.body.requestedAt) : new Date(),
    });
    await audit(req, 'CREATE', 'SalaryAdvance', advance._id, undefined, advance.toObject());
    return res.status(201).json({ success: true, advance });
  } catch (error) {
    return next(error);
  }
}

const transitions = {
  approve: { from: 'Draft', to: 'Approved', action: 'APPROVE' },
  reject: { from: 'Draft', to: 'Rejected', action: 'REJECT' },
  pay: { from: 'Approved', to: 'Paid', action: 'PAY' },
};

function advanceTransition(name) {
  const rule = transitions[name];
  return async (req, res, next) => {
    try {
      const advance = await SalaryAdvance.findById(req.params.id);
      if (!advance) throw statusError('Advance not found', 404);
      if (advance.status !== rule.from) {
        throw statusError(`Only ${rule.from} advances can be ${rule.to === 'Rejected' ? 'rejected' : rule.to.toLowerCase()}`, 409);
      }
      const before = advance.toObject();
      advance.status = rule.to;
      if (name === 'approve') advance.approvedBy = req.user._id;
      if (name === 'pay') {
        advance.paidBy = req.user._id;
        advance.paidAt = new Date();
      }
      await advance.save();
      await audit(req, rule.action, 'SalaryAdvance', advance._id, before, advance.toObject());
      return res.json({ success: true, advance });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  approveAdvance: advanceTransition('approve'),
  createAdvance,
  createEmployee,
  listAdvances,
  listEmployees,
  payAdvance: advanceTransition('pay'),
  rejectAdvance: advanceTransition('reject'),
  updateEmployee,
};
