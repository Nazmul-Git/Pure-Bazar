const mongoose = require('mongoose');
const {
  AuditLog, Order, Shift,
} = require('../models');
const { resolveOutlet } = require('./posCheckoutService');
const { statusError } = require('./posBillService');

const PAYMENT_METHODS = [
  ['Cash', 'CASH'],
  ['Bank', 'BANK'],
  ['bKash', 'BKASH'],
  ['Nagad', 'NAGAD'],
  ['Card', 'CARD'],
  ['Wallet', 'WALLET'],
];

function money(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function objectOf(value) {
  return value?.toObject ? value.toObject() : value;
}

async function findPayments(shift, closedAt) {
  const orders = await Order.find({
    cashier: shift.cashierId,
    outlet: shift.outletId,
    paymentStatus: 'PAID',
    createdAt: { $gte: shift.openedAt, $lte: closedAt },
  }).lean();
  const totals = new Map(PAYMENT_METHODS.map(([, code]) => [code, 0]));
  orders.forEach((order) => {
    order.payments.forEach((payment) => {
      totals.set(payment.method, money((totals.get(payment.method) || 0) + payment.amount));
    });
  });
  return totals;
}

async function buildReport(shift, closedAt = shift.closedAt || new Date()) {
  const totals = await findPayments(shift, closedAt);
  const cashSales = totals.get('CASH') || 0;
  const expectedCash = money(shift.openingCash + cashSales);
  const paymentSummary = PAYMENT_METHODS.map(([method, code]) => {
    const expectedAmount = code === 'CASH' ? expectedCash : totals.get(code);
    return {
      method,
      expectedAmount: money(expectedAmount),
      actualAmount: code === 'CASH'
        ? (Number.isFinite(shift.actualCash) ? shift.actualCash : null)
        : money(totals.get(code)),
    };
  });

  return {
    expectedCash,
    actualCash: Number.isFinite(shift.actualCash) ? shift.actualCash : null,
    cashDifference: Number.isFinite(shift.actualCash)
      ? money(shift.actualCash - expectedCash)
      : null,
    paymentSummary,
  };
}

function assertShiftAccess(shift, user) {
  if (user.role !== 'Super Admin' && shift.cashierId.toString() !== user._id.toString()) {
    throw statusError('Shift access is limited to the assigned cashier', 403);
  }
}

async function openShift(req) {
  const outletId = await resolveOutlet({ outletId: req.body.outletId }, req.user);
  const openingCash = money(req.body.openingCash);
  let session;
  try {
    session = await mongoose.startSession();
    let shift;
    await session.withTransaction(async () => {
      const existing = await Shift.findOne({
        cashierId: req.user._id,
        status: 'OPEN',
      }).session(session).lean();
      if (existing) throw statusError('Cashier already has an open shift', 409);

      [shift] = await Shift.create([{
        outletId,
        cashierId: req.user._id,
        openingCash,
        openedAt: new Date(),
      }], { session });
      await AuditLog.create([{
        actorId: req.user._id,
        action: 'OPEN',
        entity: 'Shift',
        entityId: shift._id,
        after: objectOf(shift),
        ipAddress: req.ip,
      }], { session });
    });
    return { shift };
  } catch (error) {
    if (error.code === 11000) throw statusError('Cashier already has an open shift', 409);
    throw error;
  } finally {
    if (session) await session.endSession();
  }
}

async function getCurrentShift(req) {
  const shift = await Shift.findOne({
    cashierId: req.user._id,
    status: 'OPEN',
  }).lean();
  if (!shift) return { shift: null, report: null };
  return { shift, report: await buildReport(shift) };
}

async function getShiftReport(req) {
  const shift = await Shift.findById(req.params.shiftId).lean();
  if (!shift) throw statusError('Shift was not found', 404);
  assertShiftAccess(shift, req.user);
  return { shift, report: await buildReport(shift) };
}

async function closeShift(req) {
  let session;
  try {
    session = await mongoose.startSession();
    let shift;
    let report;
    await session.withTransaction(async () => {
      const openShift = await Shift.findById(req.params.shiftId).session(session).lean();
      if (!openShift) throw statusError('Shift was not found', 404);
      assertShiftAccess(openShift, req.user);
      if (openShift.status !== 'OPEN') throw statusError('Shift is already closed', 409);

      const closedAt = new Date();
      const expectedReport = await buildReport(openShift, closedAt);
      const actualCash = money(req.body.actualCash);
      shift = await Shift.findOneAndUpdate(
        { _id: openShift._id, status: 'OPEN' },
        {
          $set: {
            status: 'CLOSED',
            closedAt,
            closedBy: req.user._id,
            expectedCash: expectedReport.expectedCash,
            actualCash,
            cashDifference: money(actualCash - expectedReport.expectedCash),
            paymentSummary: expectedReport.paymentSummary.map((payment) => ({
              ...payment,
              actualAmount: payment.method === 'Cash' ? actualCash : payment.actualAmount,
            })),
          },
        },
        { new: true, runValidators: true, session },
      );
      if (!shift) throw statusError('Shift is already closed', 409);
      report = await buildReport(shift, closedAt);
      await AuditLog.create([{
        actorId: req.user._id,
        action: 'CLOSE',
        entity: 'Shift',
        entityId: shift._id,
        before: objectOf(openShift),
        after: objectOf(shift),
        metadata: report,
        ipAddress: req.ip,
      }], { session });
    });
    return { shift, report };
  } finally {
    if (session) await session.endSession();
  }
}

module.exports = {
  openShift, getCurrentShift, getShiftReport, closeShift, buildReport,
};
